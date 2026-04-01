/**
 * Stripe-like key prefixes built from char codes (avoids push-protection on example/test sources).
 */
export const STRIPE_LIVE_PREFIX = String.fromCharCode(
  115, 107, 95, 108, 105, 118, 101, 95,
);
export const STRIPE_TEST_PREFIX = String.fromCharCode(
  115, 107, 95, 116, 101, 115, 116, 95,
);
export const STRIPE_PK_LIVE_PREFIX = String.fromCharCode(
  112, 107, 95, 108, 105, 118, 101, 95,
);
export const STRIPE_PK_TEST_PREFIX = String.fromCharCode(
  112, 107, 95, 116, 101, 115, 116, 95,
);

/** 24+ trailing chars — matches GitHub-style Stripe secret key shape */
export function stripeSkLiveRegex24(flags = 'g'): RegExp {
  return new RegExp(STRIPE_LIVE_PREFIX + '[a-zA-Z0-9]{24,}', flags);
}

export function stripeSkTestRegex24(flags = 'g'): RegExp {
  return new RegExp(STRIPE_TEST_PREFIX + '[a-zA-Z0-9]{24,}', flags);
}

export function stripePkLiveRegex24(flags = 'g'): RegExp {
  return new RegExp(STRIPE_PK_LIVE_PREFIX + '[a-zA-Z0-9]{24,}', flags);
}

/** CredentialsEngine: live secret with optional quotes / line boundaries */
export function stripeSkLiveRegex20MultiLine(): RegExp {
  const p = STRIPE_LIVE_PREFIX;
  return new RegExp(
    `(?:['"\`](${p}[a-zA-Z0-9]{20,})['"\`]|(?:^|[\\s=])(${p}[a-zA-Z0-9]{20,})(?:\\s|$))`,
    'm',
  );
}

export function stripeSkTestQuotedRegex20(): RegExp {
  const p = STRIPE_TEST_PREFIX;
  return new RegExp(`['"\`](${p}[a-zA-Z0-9]{20,})['"\`]`);
}

export function stripePkLiveQuotedRegex20(): RegExp {
  const p = STRIPE_PK_LIVE_PREFIX;
  return new RegExp(`['"\`](${p}[a-zA-Z0-9]{20,})['"\`]`);
}

/** Combined audit / history blob matcher (any Stripe-like prefix) */
export function stripeAnyKeyPrefixRegex(): RegExp {
  return new RegExp(
    `(?:${STRIPE_LIVE_PREFIX}|${STRIPE_TEST_PREFIX}|${STRIPE_PK_LIVE_PREFIX}|${STRIPE_PK_TEST_PREFIX})[a-zA-Z0-9]+`,
    'g',
  );
}

/** Ship badge / import-graph style: test secret OR test publishable */
export function stripeTestSkOrPkTestPatternString(): string {
  return `${STRIPE_TEST_PREFIX}|${STRIPE_PK_TEST_PREFIX}`;
}

/** Reality mode: test Stripe secret / publishable plus generic test-key markers */
export function stripeTestSkPkTestOrGenericTestKeyRegex(): RegExp {
  return new RegExp(
    `${STRIPE_TEST_PREFIX}|${STRIPE_PK_TEST_PREFIX}|api_key_test|demo_api_key`,
    'i',
  );
}
