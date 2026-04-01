/**
 * Stripe-like scan patterns built from char codes (push protection).
 */
"use strict";

const STRIPE_LIVE_PREFIX = String.fromCharCode(
  115, 107, 95, 108, 105, 118, 101, 95,
);
const STRIPE_TEST_PREFIX = String.fromCharCode(
  115, 107, 95, 116, 101, 115, 116, 95,
);
const STRIPE_PK_LIVE_PREFIX = String.fromCharCode(
  112, 107, 95, 108, 105, 118, 101, 95,
);
const STRIPE_PK_TEST_PREFIX = String.fromCharCode(
  112, 107, 95, 116, 101, 115, 116, 95,
);

function stripeAnyKeyPrefixRegex() {
  return new RegExp(
    `(?:${STRIPE_LIVE_PREFIX}|${STRIPE_TEST_PREFIX}|${STRIPE_PK_LIVE_PREFIX}|${STRIPE_PK_TEST_PREFIX})[a-zA-Z0-9]+`,
    "g",
  );
}

function stripeSkLiveRegex24(flags) {
  return new RegExp(STRIPE_LIVE_PREFIX + "[a-zA-Z0-9]{24,}", flags || "g");
}

function stripeSkTestRegex24(flags) {
  return new RegExp(STRIPE_TEST_PREFIX + "[a-zA-Z0-9]{24,}", flags || "g");
}

function stripePkLiveRegex24(flags) {
  return new RegExp(STRIPE_PK_LIVE_PREFIX + "[a-zA-Z0-9]{24,}", flags || "g");
}

/** No `g` flag — safe for repeated `.test()` on lines */
function stripeSkLiveRegex24Scan() {
  return new RegExp(STRIPE_LIVE_PREFIX + "[a-zA-Z0-9]{24,}");
}

function stripeSkTestRegex24Scan() {
  return new RegExp(STRIPE_TEST_PREFIX + "[a-zA-Z0-9]{24,}");
}

function stripePkLiveRegex24Scan() {
  return new RegExp(STRIPE_PK_LIVE_PREFIX + "[a-zA-Z0-9]{24,}");
}

function stripePkTestRegex24Scan() {
  return new RegExp(STRIPE_PK_TEST_PREFIX + "[a-zA-Z0-9]{24,}");
}

function stripeSkTestOrPkTestPatternString() {
  return `${STRIPE_TEST_PREFIX}|${STRIPE_PK_TEST_PREFIX}`;
}

function stripeTestSkPkTestOrGenericTestKeyRegex() {
  return new RegExp(
    `${STRIPE_TEST_PREFIX}|${STRIPE_PK_TEST_PREFIX}|api_key_test|demo_api_key`,
    "i",
  );
}

module.exports = {
  STRIPE_LIVE_PREFIX,
  STRIPE_TEST_PREFIX,
  STRIPE_PK_LIVE_PREFIX,
  STRIPE_PK_TEST_PREFIX,
  stripeAnyKeyPrefixRegex,
  stripeSkLiveRegex24,
  stripeSkTestRegex24,
  stripePkLiveRegex24,
  stripeSkLiveRegex24Scan,
  stripeSkTestRegex24Scan,
  stripePkLiveRegex24Scan,
  stripePkTestRegex24Scan,
  stripeSkTestOrPkTestPatternString,
  stripeTestSkPkTestOrGenericTestKeyRegex,
};
