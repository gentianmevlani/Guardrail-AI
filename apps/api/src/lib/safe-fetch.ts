import dns from "dns";
import { performance } from "perf_hooks";
import { URL } from "url";
import { promisify } from "util";

const dnsResolve4 = promisify(dns.resolve4);
const dnsResolve6 = promisify(dns.resolve6);

// Private IPv4 ranges to block
const PRIVATE_IP_RANGES = [
  { start: "10.0.0.0", range: 8, name: "10/8 private network" },
  { start: "172.16.0.0", range: 12, name: "172.16/12 private network" },
  { start: "192.168.0.0", range: 16, name: "192.168/16 private network" },
  { start: "127.0.0.0", range: 8, name: "127/8 loopback" },
  { start: "169.254.0.0", range: 16, name: "169.254/16 link-local" },
  { start: "0.0.0.0", range: 8, name: "0/8 unspecified" },
  { start: "224.0.0.0", range: 4, name: "224/4 multicast" },
  { start: "240.0.0.0", range: 4, name: "240/4 reserved" },
  { start: "100.64.0.0", range: 10, name: "100.64/10 carrier-grade NAT" },
  { start: "192.0.0.0", range: 24, name: "192.0.0/24 IETF protocol" },
  { start: "192.0.2.0", range: 24, name: "192.0.2/24 TEST-NET-1" },
  { start: "198.51.100.0", range: 24, name: "198.51.100/24 TEST-NET-2" },
  { start: "203.0.113.0", range: 24, name: "203.0.113/24 TEST-NET-3" },
];

// Private IPv6 ranges to block
const PRIVATE_IPV6_RANGES = [
  /^::1$/i, // Loopback
  /^fe80:/i, // Link-local
  /^fc00:/i, // Unique local (fc00::/7)
  /^fd[0-9a-f]{2}:/i, // Unique local (fd00::/8)
  /^::ffff:(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/i, // IPv4-mapped private
  /^::ffff:(127\.|0\.0\.0\.)/i, // IPv4-mapped loopback/unspecified
  /^::ffff:(169\.254\.)/i, // IPv4-mapped link-local
  /^100::/i, // Discard prefix
  /^64:ff9b::/i, // NAT64 prefix
  /^2001:db8:/i, // Documentation prefix
  /^2001::/i, // Teredo tunneling
  /^::$/, // Unspecified address
  /^ff[0-9a-f]{2}:/i, // Multicast
];

// Comprehensive allowlist of legitimate external services
const DEFAULT_ALLOWLIST = [
  // Payment providers
  "api.stripe.com",
  "checkout.stripe.com",
  "js.stripe.com",
  // GitHub
  "api.github.com",
  "github.com",
  "raw.githubusercontent.com",
  // Google
  "oauth2.googleapis.com",
  "www.googleapis.com",
  "accounts.google.com",
  // AI providers
  "api.openai.com",
  "api.anthropic.com",
  "api.cohere.ai",
  "generativelanguage.googleapis.com",
  // Email services
  "api.resend.com",
  "api.sendgrid.com",
  "api.mailgun.net",
  // Communication
  "hooks.slack.com",
  "api.slack.com",
  "discord.com",
  "api.telegram.org",
  // Analytics & monitoring
  "api.segment.io",
  "api.mixpanel.com",
  "o*.ingest.sentry.io",
  // Auth providers
  "auth0.com",
  "*.auth0.com",
  "cognito-idp.*.amazonaws.com",
  // Cloud storage
  "*.s3.amazonaws.com",
  "storage.googleapis.com",
  "*.blob.core.windows.net",
];

// DNS resolution cache with TTL for rebinding protection
interface DNSCacheEntry {
  ipv4: string[];
  ipv6: string[];
  resolvedAt: number;
  ttl: number;
}

const dnsCache = new Map<string, DNSCacheEntry>();
const DNS_CACHE_TTL = 60000; // 60 seconds
const DNS_RESOLUTION_TIMEOUT = 3000; // 3 seconds

interface SafeFetchOptions extends RequestInit {
  maxRedirects?: number;
  connectTimeout?: number;
  totalTimeout?: number;
  maxResponseSize?: number;
  allowlist?: string[];
  skipDNSRebindingCheck?: boolean;
}

interface SafeFetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  size: number;
  duration: number;
}

class SSRFError extends Error {
  constructor(
    message: string,
    public reason: string,
  ) {
    super(message);
    this.name = "SSRFError";
  }
}

/**
 * Convert IP string to number for comparison
 */
function ipToNumber(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

/**
 * Check if IPv4 is in private range
 */
function isPrivateIPv4(ip: string): { blocked: boolean; reason?: string } {
  const ipNum = ipToNumber(ip);

  for (const range of PRIVATE_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const mask = (0xffffffff << (32 - range.range)) >>> 0;

    if ((ipNum & mask) === (startNum & mask)) {
      return { blocked: true, reason: `Blocked ${range.name} (${ip})` };
    }
  }

  return { blocked: false };
}

/**
 * Check if IPv6 is in private range
 */
function isPrivateIPv6(ip: string): { blocked: boolean; reason?: string } {
  const normalizedIP = ip.toLowerCase();

  for (const pattern of PRIVATE_IPV6_RANGES) {
    if (pattern.test(normalizedIP)) {
      return { blocked: true, reason: `Blocked private IPv6 address (${ip})` };
    }
  }

  return { blocked: false };
}

/**
 * Check if any IP (v4 or v6) is private
 */
function isPrivateIP(ip: string): { blocked: boolean; reason?: string } {
  // Check if IPv6
  if (ip.includes(":")) {
    return isPrivateIPv6(ip);
  }
  return isPrivateIPv4(ip);
}

/**
 * Parse and validate URL
 */
function validateURL(url: string): { hostname: string; port?: string } {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch (error) {
    throw new SSRFError(`Invalid URL: ${url}`, "INVALID_URL");
  }

  // Only allow HTTP/HTTPS
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new SSRFError(
      `Unsupported protocol: ${parsed.protocol}`,
      "INVALID_PROTOCOL",
    );
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new SSRFError(
      `URL contains credentials: ${url}`,
      "CREDENTIALS_IN_URL",
    );
  }

  return {
    hostname: parsed.hostname,
    port: parsed.port,
  };
}

/**
 * Check if hostname is allowed
 */
function checkAllowlist(
  hostname: string,
  allowlist: string[],
): { allowed: boolean; reason?: string } {
  // Exact match
  if (allowlist.includes(hostname)) {
    return { allowed: true };
  }

  // Wildcard matching (*.example.com)
  for (const allowed of allowlist) {
    if (allowed.startsWith("*.")) {
      const domain = allowed.slice(2);
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return { allowed: true };
      }
    }
  }

  return { allowed: false, reason: `Hostname not in allowlist: ${hostname}` };
}

/**
 * Resolve DNS with timeout
 */
async function resolveDNSWithTimeout<T>(
  resolver: () => Promise<T>,
  timeoutMs: number = DNS_RESOLUTION_TIMEOUT,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new SSRFError("DNS resolution timeout", "DNS_TIMEOUT"));
    }, timeoutMs);

    resolver()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

/**
 * Resolve hostname and cache results for DNS rebinding protection
 */
async function resolveAndCacheHostname(
  hostname: string,
): Promise<DNSCacheEntry> {
  // Check cache first
  const cached = dnsCache.get(hostname);
  if (cached && Date.now() - cached.resolvedAt < cached.ttl) {
    return cached;
  }

  const entry: DNSCacheEntry = {
    ipv4: [],
    ipv6: [],
    resolvedAt: Date.now(),
    ttl: DNS_CACHE_TTL,
  };

  // Resolve IPv4
  try {
    entry.ipv4 = await resolveDNSWithTimeout(() => dnsResolve4(hostname));
  } catch {
    // No IPv4 records
  }

  // Resolve IPv6
  try {
    entry.ipv6 = await resolveDNSWithTimeout(() => dnsResolve6(hostname));
  } catch {
    // No IPv6 records
  }

  if (entry.ipv4.length === 0 && entry.ipv6.length === 0) {
    throw new SSRFError(
      `DNS resolution failed for ${hostname}`,
      "DNS_RESOLUTION_FAILED",
    );
  }

  dnsCache.set(hostname, entry);
  return entry;
}

/**
 * Resolve hostname to IP and check if it's private
 */
async function checkPrivateIP(
  hostname: string,
): Promise<{ blocked: boolean; reason?: string; resolvedIPs?: string[] }> {
  const dnsEntry = await resolveAndCacheHostname(hostname);
  const allIPs = [...dnsEntry.ipv4, ...dnsEntry.ipv6];

  // Check all IPv4 addresses
  for (const addr of dnsEntry.ipv4) {
    const check = isPrivateIPv4(addr);
    if (check.blocked) {
      return { ...check, resolvedIPs: allIPs };
    }
  }

  // Check all IPv6 addresses
  for (const addr of dnsEntry.ipv6) {
    const check = isPrivateIPv6(addr);
    if (check.blocked) {
      return { ...check, resolvedIPs: allIPs };
    }
  }

  return { blocked: false, resolvedIPs: allIPs };
}

/**
 * Verify resolved IPs haven't changed (DNS rebinding protection)
 */
async function verifyDNSNotRebound(
  hostname: string,
  originalIPs: string[],
): Promise<{ rebound: boolean; newIPs?: string[] }> {
  // Force fresh resolution by clearing cache
  dnsCache.delete(hostname);

  const freshEntry = await resolveAndCacheHostname(hostname);
  const freshIPs = [...freshEntry.ipv4, ...freshEntry.ipv6];

  // Check if any new IPs are private
  for (const ip of freshIPs) {
    const check = isPrivateIP(ip);
    if (check.blocked) {
      return { rebound: true, newIPs: freshIPs };
    }
  }

  return { rebound: false, newIPs: freshIPs };
}

/**
 * Safe fetch with SSRF protection
 */
export { SSRFError };
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const startTime = performance.now();

  // Merge options with defaults
  const {
    maxRedirects = 0,
    connectTimeout = 5000,
    totalTimeout = 30000,
    maxResponseSize = 10 * 1024 * 1024, // 10MB
    allowlist = DEFAULT_ALLOWLIST,
    ...fetchOptions
  } = options;

  // Validate URL
  const { hostname, port } = validateURL(url);

  // Check allowlist
  const allowlistCheck = checkAllowlist(hostname, allowlist);
  if (!allowlistCheck.allowed) {
    throw new SSRFError(allowlistCheck.reason!, "NOT_IN_ALLOWLIST");
  }

  // Check for private IPs
  const ipCheck = await checkPrivateIP(hostname);
  if (ipCheck.blocked) {
    throw new SSRFError(ipCheck.reason!, "PRIVATE_IP");
  }

  // Create abort controller for timeouts
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), totalTimeout);

  try {
    // Make request with enhanced options
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      redirect: "manual", // Handle redirects manually
    });

    // Handle redirects if allowed
    if (maxRedirects > 0 && response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (location) {
        // Validate redirect URL
        const redirectUrl = new URL(location, url);
        const redirectHostname = redirectUrl.hostname;

        // Check allowlist for redirect target
        const redirectAllowlistCheck = checkAllowlist(
          redirectHostname,
          allowlist,
        );
        if (!redirectAllowlistCheck.allowed) {
          throw new SSRFError(
            `Redirect to non-allowlisted host: ${redirectHostname}`,
            "REDIRECT_NOT_ALLOWED",
          );
        }

        // DNS rebinding check on redirect
        const redirectIPCheck = await checkPrivateIP(redirectHostname);
        if (redirectIPCheck.blocked) {
          throw new SSRFError(
            `Redirect target resolves to private IP: ${redirectIPCheck.reason}`,
            "REDIRECT_TO_PRIVATE_IP",
          );
        }

        if (maxRedirects > 1) {
          return safeFetch(redirectUrl.toString(), {
            ...options,
            maxRedirects: maxRedirects - 1,
          });
        } else {
          throw new SSRFError("Redirect limit exceeded", "TOO_MANY_REDIRECTS");
        }
      }
    }

    // Stream response to enforce size limit
    const reader = response.body?.getReader();
    if (!reader) {
      throw new SSRFError("No response body available", "NO_BODY");
    }

    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > maxResponseSize) {
        reader.cancel();
        throw new SSRFError(
          `Response too large: ${totalSize} bytes`,
          "RESPONSE_TOO_LARGE",
        );
      }

      chunks.push(value);
    }

    // Combine chunks
    const data = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to appropriate format
    let parsedData: any;
    const contentType = response.headers.get("content-type");

    try {
      if (contentType?.includes("application/json")) {
        parsedData = JSON.parse(new TextDecoder().decode(data));
      } else {
        parsedData = data;
      }
    } catch {
      parsedData = data;
    }

    const duration = performance.now() - startTime;

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers,
      data: parsedData,
      size: totalSize,
      duration,
    };
  } catch (error) {
    if (error instanceof SSRFError) {
      throw error;
    }

    if (error.name === "AbortError") {
      throw new SSRFError(`Request timeout after ${totalTimeout}ms`, "TIMEOUT");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Validate user-provided URL input
 */
export function validateUserURL(url: string): {
  valid: boolean;
  reason?: string;
} {
  try {
    const { hostname } = validateURL(url);

    // Additional checks for user input
    if (hostname.includes("localhost") || hostname.includes("127.0.0.1")) {
      return { valid: false, reason: "Localhost not allowed" };
    }

    if (hostname.includes("0.0.0.0") || hostname.includes("::")) {
      return { valid: false, reason: "Bind addresses not allowed" };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get current allowlist
 */
export function getAllowlist(): string[] {
  return [...DEFAULT_ALLOWLIST];
}

/**
 * Check if URL would be allowed (without making request)
 */
export async function checkURLAllowed(
  url: string,
  customAllowlist?: string[],
): Promise<{ allowed: boolean; reason?: string }> {
  try {
    const { hostname } = validateURL(url);
    const allowlist = customAllowlist || DEFAULT_ALLOWLIST;

    const allowlistCheck = checkAllowlist(hostname, allowlist);
    if (!allowlistCheck.allowed) {
      return allowlistCheck;
    }

    const ipCheck = await checkPrivateIP(hostname);
    if (ipCheck.blocked) {
      return { allowed: false, reason: ipCheck.reason };
    }

    return { allowed: true };
  } catch (error) {
    return {
      allowed: false,
      reason: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * IP validation utilities - exported for testing and reuse
 */
export const ipValidation = {
  isPrivateIPv4,
  isPrivateIPv6,
  isPrivateIP,
  PRIVATE_IP_RANGES,
  PRIVATE_IPV6_RANGES,
};

/**
 * DNS utilities - exported for testing
 */
export const dnsUtils = {
  resolveAndCacheHostname,
  verifyDNSNotRebound,
  clearCache: () => dnsCache.clear(),
};
