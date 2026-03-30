/**
 * Generate a unique correlation ID for tracking related actions
 */
export declare function generateCorrelationId(): string;
/**
 * Generate a task ID
 */
export declare function generateTaskId(): string;
/**
 * Calculate SHA-256 hash of content
 */
export declare function calculateHash(content: string): string;
/**
 * Calculate content entropy (randomness measure for secret detection)
 */
export declare function calculateEntropy(str: string): number;
/**
 * Mask sensitive value for logging
 */
export declare function maskSensitiveValue(value: string): string;
/**
 * Check if a path is within allowed paths
 */
export declare function isPathAllowed(path: string, allowedPaths: string[], deniedPaths: string[]): boolean;
/**
 * Check if a domain is allowed
 */
export declare function isDomainAllowed(url: string, allowedDomains: string[], deniedDomains: string[]): boolean;
/**
 * Sanitize error message for safe logging
 */
export declare function sanitizeError(error: unknown): {
    message: string;
    code?: string;
};
//# sourceMappingURL=utils.d.ts.map