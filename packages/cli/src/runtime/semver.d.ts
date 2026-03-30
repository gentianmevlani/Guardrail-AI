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
export declare function parseSemver(version: string): SemverParts | null;
/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export declare function compareSemver(a: string, b: string): number;
/**
 * Check if version is less than target
 * Enterprise-grade: "10.0.0" is NOT less than "2.0.0"
 */
export declare function isVersionLessThan(version: string, target: string): boolean;
/**
 * Check if version satisfies a range expression
 * Supports: <1.2.3, <=1.2.3, >1.2.3, >=1.2.3, 1.2.3 (exact)
 */
export declare function satisfiesRange(version: string, range: string): boolean;
/**
 * Check if version is affected by vulnerability
 * affectedVersions format: "<4.17.21" or ">=1.0.0 <2.0.0"
 */
export declare function isAffected(version: string, affectedVersions: string): boolean;
//# sourceMappingURL=semver.d.ts.map