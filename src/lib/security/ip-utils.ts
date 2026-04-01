
/**
 * Converts an IPv4 address string to a 32-bit integer.
 */
function ip4ToInt(ip: string): number {
  return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
}

/**
 * Checks if an IPv4 address is within a CIDR range.
 */
function isIPv4InCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = bitsStr ? parseInt(bitsStr, 10) : 32;

    if (bits < 0 || bits > 32) return false;

    const mask = ~(2 ** (32 - bits) - 1);
    return (ip4ToInt(ip) & mask) === (ip4ToInt(range!) & mask);
  } catch (e) {
    return false;
  }
}

/**
 * Expands an IPv6 address to its full 8-group hexadecimal representation.
 */
function expandIPv6(ip: string): string {
  const parts = ip.split('::');
  let fullIP = parts[0];

  if (parts.length > 1) {
    const start = parts[0] ? parts[0].split(':') : [];
    const end = parts[1] ? parts[1].split(':') : [];
    const missing = 8 - (start.length + end.length);
    const zeros = Array(missing).fill('0000').join(':');

    fullIP = [
      parts[0],
      zeros,
      parts[1]
    ].filter(Boolean).join(':');
  }

  // Ensure all groups are 4 chars
  return fullIP.split(':').map(part => part.padStart(4, '0')).join(':');
}

/**
 * Converts an IPv6 address string to a BigInt.
 */
function ip6ToBigInt(ip: string): bigint {
  const expanded = expandIPv6(ip);
  const hex = expanded.replace(/:/g, '');
  return BigInt(`0x${hex}`);
}

/**
 * Checks if an IPv6 address is within a CIDR range.
 */
function isIPv6InCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bitsStr] = cidr.split('/');
    const bits = bitsStr ? parseInt(bitsStr, 10) : 128;

    if (bits < 0 || bits > 128) return false;

    const ipBig = ip6ToBigInt(ip);
    const rangeBig = ip6ToBigInt(range!);

    const mask = (BigInt(1) << BigInt(128)) - BigInt(1);
    const prefixMask = ~(mask >> BigInt(bits)) & mask; // This is tricky with BigInt shift, let's rethink logic

    // Alternative mask logic for BigInt
    // To get a mask of N ones followed by (128-N) zeros:
    // mask = ((1 << N) - 1) << (128 - N)  -- No, that's not right.

    // Correct logic:
    // mask = ~((1 << (128 - bits)) - 1)
    // But bitwise NOT on BigInt acts as if infinite width signed.

    // Let's use subtraction
    const hostBits = BigInt(128 - bits);
    const maskVal = (BigInt(1) << BigInt(128)) - (BigInt(1) << hostBits);

    return (ipBig & maskVal) === (rangeBig & maskVal);
  } catch (e) {
    return false;
  }
}

/**
 * Checks if an IP address matches a CIDR range.
 * Supports both IPv4 and IPv6.
 */
export function isIPInCIDR(ip: string, cidr: string): boolean {
  const isIPv6 = ip.includes(':');
  const isCidrIPv6 = cidr.includes(':');

  if (isIPv6 !== isCidrIPv6) return false;

  if (isIPv6) {
    return isIPv6InCIDR(ip, cidr);
  } else {
    return isIPv4InCIDR(ip, cidr);
  }
}
