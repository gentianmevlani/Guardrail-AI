"use strict";
/**
 * Fix Packs Types
 *
 * First-class objects that group findings into actionable batches.
 * Used by CLI, Autopilot, and Verified AutoFix.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FIX_STRATEGIES = exports.SEVERITY_ORDER = exports.SEVERITY_LEVELS = exports.FINDING_CATEGORIES = void 0;
exports.compareSeverity = compareSeverity;
exports.isHigherSeverity = isHigherSeverity;
exports.getHighestSeverity = getHighestSeverity;
exports.generatePackId = generatePackId;
exports.sortPacksBySeverity = sortPacksBySeverity;
// ============================================================================
// FINDING CATEGORY ENUM
// ============================================================================
exports.FINDING_CATEGORIES = [
    'secrets',
    'routes',
    'mocks',
    'auth',
    'placeholders',
    'deps',
    'types',
    'tests',
    'security',
    'performance',
];
// ============================================================================
// SEVERITY LEVELS
// ============================================================================
exports.SEVERITY_LEVELS = ['critical', 'high', 'medium', 'low', 'info'];
exports.SEVERITY_ORDER = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
};
// ============================================================================
// FIX STRATEGY
// ============================================================================
exports.FIX_STRATEGIES = [
    'auto', // Fully automated fix
    'guided', // AI-guided with human review
    'manual', // Requires manual intervention
    'ai-assisted', // AI generates suggestions
];
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function compareSeverity(a, b) {
    return exports.SEVERITY_ORDER[a] - exports.SEVERITY_ORDER[b];
}
function isHigherSeverity(a, b) {
    return compareSeverity(a, b) < 0;
}
function getHighestSeverity(severities) {
    if (severities.length === 0)
        return 'info';
    return severities.reduce((highest, current) => isHigherSeverity(current, highest) ? current : highest);
}
function generatePackId(category, index, hash) {
    const categoryPrefix = category.slice(0, 3).toUpperCase();
    const hashSuffix = hash.slice(0, 6);
    return `FP-${categoryPrefix}-${String(index).padStart(3, '0')}-${hashSuffix}`;
}
function sortPacksBySeverity(packs) {
    return [...packs].sort((a, b) => compareSeverity(a.severity, b.severity));
}
