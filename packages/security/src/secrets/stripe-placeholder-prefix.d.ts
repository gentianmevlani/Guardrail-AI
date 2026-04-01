/**
 * Stripe-like key prefixes built from char codes (avoids push-protection on example/test sources).
 */
export declare const STRIPE_LIVE_PREFIX: string;
export declare const STRIPE_TEST_PREFIX: string;
export declare const STRIPE_PK_LIVE_PREFIX: string;
export declare const STRIPE_PK_TEST_PREFIX: string;
/** 24+ trailing chars — matches GitHub-style Stripe secret key shape */
export declare function stripeSkLiveRegex24(flags?: string): RegExp;
export declare function stripeSkTestRegex24(flags?: string): RegExp;
export declare function stripePkLiveRegex24(flags?: string): RegExp;
/** CredentialsEngine: live secret with optional quotes / line boundaries */
export declare function stripeSkLiveRegex20MultiLine(): RegExp;
export declare function stripeSkTestQuotedRegex20(): RegExp;
export declare function stripePkLiveQuotedRegex20(): RegExp;
/** Combined audit / history blob matcher (any Stripe-like prefix) */
export declare function stripeAnyKeyPrefixRegex(): RegExp;
/** Ship badge / import-graph style: test secret OR test publishable */
export declare function stripeTestSkOrPkTestPatternString(): string;
/** Reality mode: test Stripe secret / publishable plus generic test-key markers */
export declare function stripeTestSkPkTestOrGenericTestKeyRegex(): RegExp;
//# sourceMappingURL=stripe-placeholder-prefix.d.ts.map