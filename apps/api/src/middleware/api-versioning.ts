/**
 * API Versioning Middleware
 *
 * Provides clean API versioning with:
 * - Version detection from URL, header, or query param
 * - Deprecation warnings for old endpoints
 * - Version routing helpers
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import { logger } from "../logger";

const versionLogger = logger.child({ service: "api-versioning" });

// =============================================================================
// TYPES
// =============================================================================

export type ApiVersion = "v1" | "v2" | "v3";

export interface VersionConfig {
  current: ApiVersion;
  supported: ApiVersion[];
  deprecated: ApiVersion[];
  sunset: Record<ApiVersion, string | null>; // ISO date when version will be removed
}

export interface VersionedRequest extends FastifyRequest {
  apiVersion: ApiVersion;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const VERSION_CONFIG: VersionConfig = {
  current: "v1",
  supported: ["v1"],
  deprecated: [],
  sunset: {
    v1: null,
    v2: null,
    v3: null,
  },
};

// Legacy route mappings (old path -> new path)
const LEGACY_ROUTE_MAP: Record<
  string,
  { newPath: string; version: ApiVersion }
> = {
  "/api/auth/login": { newPath: "/v1/auth/login", version: "v1" },
  "/api/auth/register": { newPath: "/v1/auth/register", version: "v1" },
  "/api/projects": { newPath: "/v1/projects", version: "v1" },
  "/api/scan": { newPath: "/v1/scan", version: "v1" },
};

// =============================================================================
// VERSION DETECTION
// =============================================================================

/**
 * Extract API version from request
 * Priority: URL path > Header > Query param > Default
 */
export function detectApiVersion(request: FastifyRequest): ApiVersion {
  // 1. Check URL path (/v1/, /v2/, etc.)
  const pathMatch = request.url.match(/^\/(v\d+)\//);
  if (pathMatch) {
    const version = pathMatch[1] as ApiVersion;
    if (
      VERSION_CONFIG.supported.includes(version) ||
      VERSION_CONFIG.deprecated.includes(version)
    ) {
      return version;
    }
  }

  // 2. Check Accept header (Accept: application/vnd.guardrail.v1+json)
  const acceptHeader = request.headers.accept;
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(
      /application\/vnd\.guardrail\.(v\d+)\+json/,
    );
    if (versionMatch) {
      const version = versionMatch[1] as ApiVersion;
      if (
        VERSION_CONFIG.supported.includes(version) ||
        VERSION_CONFIG.deprecated.includes(version)
      ) {
        return version;
      }
    }
  }

  // 3. Check custom header (X-API-Version: v1)
  const versionHeader = request.headers["x-api-version"];
  if (versionHeader) {
    const version = (
      Array.isArray(versionHeader) ? versionHeader[0] : versionHeader
    ) as ApiVersion;
    if (
      VERSION_CONFIG.supported.includes(version) ||
      VERSION_CONFIG.deprecated.includes(version)
    ) {
      return version;
    }
  }

  // 4. Check query parameter (?api_version=v1)
  const queryVersion = (request.query as Record<string, string>)?.api_version;
  if (queryVersion) {
    const version = queryVersion as ApiVersion;
    if (
      VERSION_CONFIG.supported.includes(version) ||
      VERSION_CONFIG.deprecated.includes(version)
    ) {
      return version;
    }
  }

  // Default to current version
  return VERSION_CONFIG.current;
}

// =============================================================================
// DEPRECATION HANDLING
// =============================================================================

/**
 * Add deprecation headers to response
 */
function addDeprecationHeaders(
  reply: FastifyReply,
  version: ApiVersion,
  legacyPath?: string,
): void {
  const sunsetDate = VERSION_CONFIG.sunset[version];

  // Add Deprecation header (RFC 8594)
  reply.header("Deprecation", "true");

  // Add Sunset header if date is known
  if (sunsetDate) {
    reply.header("Sunset", sunsetDate);
  }

  // Add Link header pointing to current version docs
  reply.header(
    "Link",
    `<https://guardrailai.dev/docs/api/${VERSION_CONFIG.current}>; rel="successor-version"`,
  );

  // Add warning header
  const warning = legacyPath
    ? `299 - "This endpoint is deprecated. Use ${LEGACY_ROUTE_MAP[legacyPath]?.newPath || "/v1/*"} instead."`
    : `299 - "API version ${version} is deprecated. Please migrate to ${VERSION_CONFIG.current}."`;

  reply.header("Warning", warning);
}

/**
 * Check if route is a legacy /api/* route that should redirect to versioned endpoint
 */
function isLegacyRoute(path: string): boolean {
  return path.startsWith("/api/") && !path.startsWith("/api/v");
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Version detection and deprecation middleware
 */
export async function versioningMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const version = detectApiVersion(request);
  (request as VersionedRequest).apiVersion = version;

  // Add version to response headers
  reply.header("X-API-Version", version);

  // Check if using deprecated version
  if (VERSION_CONFIG.deprecated.includes(version)) {
    addDeprecationHeaders(reply, version);

    versionLogger.info(
      {
        version,
        path: request.url,
        ip: request.ip,
      },
      "Deprecated API version used",
    );
  }

  // Check if using legacy /api/* route
  if (isLegacyRoute(request.url)) {
    const legacyMapping = LEGACY_ROUTE_MAP[request.url.split("?")[0]];
    if (legacyMapping) {
      addDeprecationHeaders(reply, "v1", request.url);
    }
  }
}

/**
 * Middleware to reject unsupported API versions
 */
export async function versionValidator(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const version =
    (request as VersionedRequest).apiVersion || detectApiVersion(request);

  const allVersions = [
    ...VERSION_CONFIG.supported,
    ...VERSION_CONFIG.deprecated,
  ];

  if (!allVersions.includes(version)) {
    reply.status(400).send({
      success: false,
      error: "Unsupported API version",
      code: "UNSUPPORTED_API_VERSION",
      requestedVersion: version,
      supportedVersions: VERSION_CONFIG.supported,
      currentVersion: VERSION_CONFIG.current,
    });
  }
}

// =============================================================================
// ROUTE HELPERS
// =============================================================================

/**
 * Create versioned route path
 */
export function versionedPath(version: ApiVersion, path: string): string {
  return `/${version}${path.startsWith("/") ? path : "/" + path}`;
}

/**
 * Register routes for multiple API versions
 */
export function registerVersionedRoutes(
  fastify: FastifyInstance,
  path: string,
  handler: (fastify: FastifyInstance) => Promise<void>,
  versions: ApiVersion[] = VERSION_CONFIG.supported,
): void {
  for (const version of versions) {
    const versionedPath = `/${version}${path}`;
    fastify.register(handler, { prefix: versionedPath });
  }
}

/**
 * Get current API version config
 */
export function getVersionConfig(): VersionConfig {
  return { ...VERSION_CONFIG };
}

// =============================================================================
// FASTIFY PLUGIN
// =============================================================================

export async function apiVersioningPlugin(
  fastify: FastifyInstance,
  _options: Record<string, unknown> = {},
): Promise<void> {
  // Add versioning middleware to all routes
  fastify.addHook("preHandler", versioningMiddleware);

  // Add version info endpoint
  fastify.get("/api/version", async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        current: VERSION_CONFIG.current,
        supported: VERSION_CONFIG.supported,
        deprecated: VERSION_CONFIG.deprecated,
      },
    });
  });

  versionLogger.info(
    {
      current: VERSION_CONFIG.current,
      supported: VERSION_CONFIG.supported,
      deprecated: VERSION_CONFIG.deprecated,
    },
    "API versioning initialized",
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { VERSION_CONFIG };
