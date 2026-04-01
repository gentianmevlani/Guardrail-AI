"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCorrelationId = generateCorrelationId;
exports.generateTaskId = generateTaskId;
exports.calculateHash = calculateHash;
exports.calculateEntropy = calculateEntropy;
exports.maskSensitiveValue = maskSensitiveValue;
exports.isPathAllowed = isPathAllowed;
exports.isDomainAllowed = isDomainAllowed;
exports.sanitizeError = sanitizeError;
const crypto_1 = __importDefault(require("crypto"));
/**
 * Generate a unique correlation ID for tracking related actions
 */
function generateCorrelationId() {
    return `corr_${Date.now()}_${crypto_1.default.randomBytes(8).toString('hex')}`;
}
/**
 * Generate a task ID
 */
function generateTaskId() {
    return `task_${Date.now()}_${crypto_1.default.randomBytes(8).toString('hex')}`;
}
/**
 * Calculate SHA-256 hash of content
 */
function calculateHash(content) {
    return crypto_1.default.createHash('sha256').update(content).digest('hex');
}
/**
 * Calculate content entropy (randomness measure for secret detection)
 */
function calculateEntropy(str) {
    const len = str.length;
    const frequencies = {};
    for (let i = 0; i < len; i++) {
        const char = str[i];
        if (char) {
            frequencies[char] = (frequencies[char] || 0) + 1;
        }
    }
    let entropy = 0;
    for (const char in frequencies) {
        const frequency = frequencies[char];
        if (frequency !== undefined) {
            const p = frequency / len;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy;
}
/**
 * Mask sensitive value for logging
 */
function maskSensitiveValue(value) {
    if (value.length <= 8) {
        return '***';
    }
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
}
/**
 * Check if a path is within allowed paths
 */
function isPathAllowed(path, allowedPaths, deniedPaths) {
    const normalizedPath = path.replace(/\\/g, '/');
    // Check denied paths first (more restrictive)
    for (const deniedPath of deniedPaths) {
        if (normalizedPath.startsWith(deniedPath.replace(/\\/g, '/'))) {
            return false;
        }
    }
    // If no allowed paths specified, allow all (except denied)
    if (allowedPaths.length === 0) {
        return true;
    }
    // Check allowed paths
    for (const allowedPath of allowedPaths) {
        if (normalizedPath.startsWith(allowedPath.replace(/\\/g, '/'))) {
            return true;
        }
    }
    return false;
}
/**
 * Check if a domain is allowed
 */
function isDomainAllowed(url, allowedDomains, deniedDomains) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        // Check denied domains first
        for (const deniedDomain of deniedDomains) {
            if (hostname === deniedDomain || hostname.endsWith(`.${deniedDomain}`)) {
                return false;
            }
        }
        // If no allowed domains specified, allow all (except denied)
        if (allowedDomains.length === 0) {
            return true;
        }
        // Check allowed domains
        for (const allowedDomain of allowedDomains) {
            if (hostname === allowedDomain || hostname.endsWith(`.${allowedDomain}`)) {
                return true;
            }
        }
        return false;
    }
    catch (error) {
        return false;
    }
}
/**
 * Sanitize error message for safe logging
 */
function sanitizeError(error) {
    if (error instanceof Error) {
        return {
            message: error.message.replace(/\/[^\s:]+/g, '[path]'),
            code: error.code,
        };
    }
    return { message: 'Unknown error occurred' };
}
