/**
 * Lightweight Semver Utilities
 * Proper version comparison for vulnerability checking
 * (Avoids incorrect lexicographic comparison like "10.0.0" < "2.0.0")
 */

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

/**
 * Parse a semver string into components
 * Handles formats: 1.2.3, 1.2.3-beta.1, ^1.2.3, ~1.2.3
 */
export function parseSemver(version: string): SemverParts | null {
  // Strip range prefixes
  const cleaned = version.replace(/^[\^~>=<]+/, '').trim();
  
  // Match semver pattern
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
<<<<<<< HEAD
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) {
    // Try partial versions (1.2, 1)
    const partial = cleaned.match(/^(\d+)(?:\.(\d+))?$/);
    if (partial) {
      const maj = partial[1];
      const min = partial[2];
      if (maj === undefined) return null;
      return {
        major: parseInt(maj, 10),
        minor: min !== undefined ? parseInt(min, 10) : 0,
=======
  if (!match) {
    // Try partial versions (1.2, 1)
    const partial = cleaned.match(/^(\d+)(?:\.(\d+))?$/);
    if (partial) {
      return {
        major: parseInt(partial[1], 10),
        minor: partial[2] ? parseInt(partial[2], 10) : 0,
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
        patch: 0,
      };
    }
    return null;
  }
  
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
<<<<<<< HEAD
    prerelease: match[4] ?? undefined,
=======
    prerelease: match[4],
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  };
}

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareSemver(a: string, b: string): number {
  const parsedA = parseSemver(a);
  const parsedB = parseSemver(b);
  
  if (!parsedA || !parsedB) {
    // Fallback to string comparison if parsing fails
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  }
  
  // Compare major.minor.patch
  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }
  
  // Handle prerelease (1.0.0-alpha < 1.0.0)
  if (parsedA.prerelease && !parsedB.prerelease) return -1;
  if (!parsedA.prerelease && parsedB.prerelease) return 1;
  if (parsedA.prerelease && parsedB.prerelease) {
    return parsedA.prerelease.localeCompare(parsedB.prerelease);
  }
  
  return 0;
}

/**
 * Check if version is less than target
 * Enterprise-grade: "10.0.0" is NOT less than "2.0.0"
 */
export function isVersionLessThan(version: string, target: string): boolean {
  return compareSemver(version, target) < 0;
}

/**
 * Check if version satisfies a range expression
 * Supports: <1.2.3, <=1.2.3, >1.2.3, >=1.2.3, 1.2.3 (exact)
 */
export function satisfiesRange(version: string, range: string): boolean {
  const trimmed = range.trim();
  
  if (trimmed.startsWith('<=')) {
    return compareSemver(version, trimmed.slice(2)) <= 0;
  }
  if (trimmed.startsWith('<')) {
    return compareSemver(version, trimmed.slice(1)) < 0;
  }
  if (trimmed.startsWith('>=')) {
    return compareSemver(version, trimmed.slice(2)) >= 0;
  }
  if (trimmed.startsWith('>')) {
    return compareSemver(version, trimmed.slice(1)) > 0;
  }
  
  // Exact match
  return compareSemver(version, trimmed) === 0;
}

/**
 * Check if version is affected by vulnerability
 * affectedVersions format: "<4.17.21" or ">=1.0.0 <2.0.0"
 */
export function isAffected(version: string, affectedVersions: string): boolean {
  // Split on spaces for compound ranges
  const parts = affectedVersions.split(/\s+/).filter(Boolean);
  
  // All conditions must be satisfied
  return parts.every(part => satisfiesRange(version, part));
}
