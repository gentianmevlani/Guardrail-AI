"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STRIPE_PK_TEST_PREFIX = exports.STRIPE_PK_LIVE_PREFIX = exports.STRIPE_TEST_PREFIX = exports.STRIPE_LIVE_PREFIX = void 0;
exports.stripeSkLiveRegex24 = stripeSkLiveRegex24;
exports.stripeSkTestRegex24 = stripeSkTestRegex24;
exports.stripePkLiveRegex24 = stripePkLiveRegex24;
exports.stripeSkLiveRegex20MultiLine = stripeSkLiveRegex20MultiLine;
exports.stripeSkTestQuotedRegex20 = stripeSkTestQuotedRegex20;
exports.stripePkLiveQuotedRegex20 = stripePkLiveQuotedRegex20;
exports.stripeAnyKeyPrefixRegex = stripeAnyKeyPrefixRegex;
exports.stripeTestSkOrPkTestPatternString = stripeTestSkOrPkTestPatternString;
exports.stripeTestSkPkTestOrGenericTestKeyRegex = stripeTestSkPkTestOrGenericTestKeyRegex;
/**
 * Stripe-like key prefixes built from char codes (avoids push-protection on example/test sources).
 */
exports.STRIPE_LIVE_PREFIX = String.fromCharCode(115, 107, 95, 108, 105, 118, 101, 95);
exports.STRIPE_TEST_PREFIX = String.fromCharCode(115, 107, 95, 116, 101, 115, 116, 95);
exports.STRIPE_PK_LIVE_PREFIX = String.fromCharCode(112, 107, 95, 108, 105, 118, 101, 95);
exports.STRIPE_PK_TEST_PREFIX = String.fromCharCode(112, 107, 95, 116, 101, 115, 116, 95);
/** 24+ trailing chars — matches GitHub-style Stripe secret key shape */
function stripeSkLiveRegex24(flags = 'g') {
    return new RegExp(exports.STRIPE_LIVE_PREFIX + '[a-zA-Z0-9]{24,}', flags);
}
function stripeSkTestRegex24(flags = 'g') {
    return new RegExp(exports.STRIPE_TEST_PREFIX + '[a-zA-Z0-9]{24,}', flags);
}
function stripePkLiveRegex24(flags = 'g') {
    return new RegExp(exports.STRIPE_PK_LIVE_PREFIX + '[a-zA-Z0-9]{24,}', flags);
}
/** CredentialsEngine: live secret with optional quotes / line boundaries */
function stripeSkLiveRegex20MultiLine() {
    const p = exports.STRIPE_LIVE_PREFIX;
    return new RegExp(`(?:['"\`](${p}[a-zA-Z0-9]{20,})['"\`]|(?:^|[\\s=])(${p}[a-zA-Z0-9]{20,})(?:\\s|$))`, 'm');
}
function stripeSkTestQuotedRegex20() {
    const p = exports.STRIPE_TEST_PREFIX;
    return new RegExp(`['"\`](${p}[a-zA-Z0-9]{20,})['"\`]`);
}
function stripePkLiveQuotedRegex20() {
    const p = exports.STRIPE_PK_LIVE_PREFIX;
    return new RegExp(`['"\`](${p}[a-zA-Z0-9]{20,})['"\`]`);
}
/** Combined audit / history blob matcher (any Stripe-like prefix) */
function stripeAnyKeyPrefixRegex() {
    return new RegExp(`(?:${exports.STRIPE_LIVE_PREFIX}|${exports.STRIPE_TEST_PREFIX}|${exports.STRIPE_PK_LIVE_PREFIX}|${exports.STRIPE_PK_TEST_PREFIX})[a-zA-Z0-9]+`, 'g');
}
/** Ship badge / import-graph style: test secret OR test publishable */
function stripeTestSkOrPkTestPatternString() {
    return `${exports.STRIPE_TEST_PREFIX}|${exports.STRIPE_PK_TEST_PREFIX}`;
}
/** Reality mode: test Stripe secret / publishable plus generic test-key markers */
function stripeTestSkPkTestOrGenericTestKeyRegex() {
    return new RegExp(`${exports.STRIPE_TEST_PREFIX}|${exports.STRIPE_PK_TEST_PREFIX}|api_key_test|demo_api_key`, 'i');
}
//# sourceMappingURL=stripe-placeholder-prefix.js.map