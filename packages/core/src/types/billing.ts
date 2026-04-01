/**
 * Guardrail Billing Types — 5-Tier Enterprise Model
 *
 * Extends VibeCheck's 4-tier model with a 5th enterprise tier.
 * VibeCheck handles the payment backbone (Stripe); Guardrail adds
 * enterprise-specific billing features.
 *
 * VibeCheck tiers:  Free ($0) → Vibecoder ($9.99) → Developer ($29.99) → Engineer ($59.99)
 * Guardrail tiers:  Starter ($0) → Pro ($29) → Team ($99) → Business ($249) → Enterprise ($499)
 */

// ── Guardrail Plan IDs ───────────────────────────────────────────────────────

export const GUARDRAIL_PLAN_IDS = [
  'starter',
  'pro',
  'team',
  'business',
  'enterprise',
] as const;

export type GuardrailPlanId = (typeof GUARDRAIL_PLAN_IDS)[number];

// ── Plan Rank ────────────────────────────────────────────────────────────────

export const GUARDRAIL_PLAN_RANK: Record<GuardrailPlanId, number> = {
  starter: 0,
  pro: 1,
  team: 2,
  business: 3,
  enterprise: 4,
};

// ── Plan Definitions ─────────────────────────────────────────────────────────

export interface GuardrailPlanDefinition {
  id: GuardrailPlanId;
  displayName: string;
  tagline: string;
  monthlyPriceUsd: number;
  priceLabel: string;
  rank: number;
  highlights: string[];
  bestFor: string;
  popular: boolean;
  seatLimit: number | 'unlimited';
  supportLevel: 'community' | 'email' | 'priority' | 'dedicated' | 'white_glove';
  /** Which VibeCheck tier powers this Guardrail tier */
  vibecheckTierMapping: 'free' | 'vibecoder' | 'developer' | 'engineer';
}

export const GUARDRAIL_PLANS: Record<GuardrailPlanId, GuardrailPlanDefinition> = {
  starter: {
    id: 'starter',
    displayName: 'Starter',
    tagline: 'Get started with AI code safety.',
    monthlyPriceUsd: 0,
    priceLabel: '$0',
    rank: 0,
    highlights: [
      'All 20 scan engines (powered by VibeCheck)',
      'Unlimited local scans',
      'Ship score & HTML reports',
      'Community support',
    ],
    bestFor: 'Individual developers exploring AI code safety',
    popular: false,
    seatLimit: 1,
    supportLevel: 'community',
    vibecheckTierMapping: 'free',
  },
  pro: {
    id: 'pro',
    displayName: 'Pro',
    tagline: 'Professional-grade AI safety for serious builders.',
    monthlyPriceUsd: 29,
    priceLabel: '$29/mo',
    rank: 1,
    highlights: [
      'Everything in Starter, plus:',
      'LLM Safety (input/output guardrails)',
      'PII detection & redaction',
      'Toxicity scanning',
      'CI/CD integration',
      'API access',
      'Cloud sync & 90-day history',
    ],
    bestFor: 'Professional developers shipping AI-powered products',
    popular: true,
    seatLimit: 1,
    supportLevel: 'email',
    vibecheckTierMapping: 'developer',
  },
  team: {
    id: 'team',
    displayName: 'Team',
    tagline: 'AI safety for your entire team.',
    monthlyPriceUsd: 99,
    priceLabel: '$99/mo',
    rank: 2,
    highlights: [
      'Everything in Pro, plus:',
      'Up to 10 seats',
      'Team dashboard & analytics',
      'Shared scan policies',
      'Behavioral guardrails (rate limiting, tool use)',
      'Human-in-the-loop review gates',
      'Slack/Discord alerts',
      'Role-based access control',
    ],
    bestFor: 'Small to medium engineering teams',
    popular: false,
    seatLimit: 10,
    supportLevel: 'priority',
    vibecheckTierMapping: 'engineer',
  },
  business: {
    id: 'business',
    displayName: 'Business',
    tagline: 'Enterprise compliance meets AI safety.',
    monthlyPriceUsd: 249,
    priceLabel: '$249/mo',
    rank: 3,
    highlights: [
      'Everything in Team, plus:',
      'Up to 50 seats',
      'SOC2 / HIPAA / GDPR compliance dashboards',
      'Red team harness (adversarial testing)',
      'Eval suite runner',
      'Kill switch & escalation policies',
      'Monitoring dashboard',
      'Audit log export',
      '365-day scan history',
    ],
    bestFor: 'Organizations with compliance requirements',
    popular: false,
    seatLimit: 50,
    supportLevel: 'dedicated',
    vibecheckTierMapping: 'engineer',
  },
  enterprise: {
    id: 'enterprise',
    displayName: 'Enterprise',
    tagline: 'White-glove AI safety for the world\'s best engineering orgs.',
    monthlyPriceUsd: 499,
    priceLabel: '$499/mo',
    rank: 4,
    highlights: [
      'Everything in Business, plus:',
      'Unlimited seats',
      'SSO / SAML',
      'On-premise deployment',
      'Custom compliance frameworks',
      'Dedicated SLA (99.99%)',
      'Custom engine development',
      'White-glove onboarding',
      'Cross-repo scanning',
      'Signed scan bundles',
    ],
    bestFor: 'Large enterprises and regulated industries',
    popular: false,
    seatLimit: 'unlimited',
    supportLevel: 'white_glove',
    vibecheckTierMapping: 'engineer',
  },
};

// ── Guardrail Entitlements ───────────────────────────────────────────────────

export const GUARDRAIL_ENTITLEMENTS = {
  // Starter (free)
  SCAN_ALL_ENGINES: 'scan_all_engines',
  SCAN_UNLIMITED_LOCAL: 'scan_unlimited_local',
  REPORTS_HTML: 'reports_html',
  SHIP_SCORE: 'ship_score',

  // Pro ($29)
  LLM_SAFETY: 'llm_safety',
  INPUT_GUARDRAILS: 'input_guardrails',
  OUTPUT_GUARDRAILS: 'output_guardrails',
  PII_DETECTION: 'pii_detection',
  TOXICITY_SCANNING: 'toxicity_scanning',
  CI_CD_INTEGRATION: 'ci_cd_integration',
  API_ACCESS: 'api_access',
  CLOUD_SYNC: 'cloud_sync',
  REPORTS_PDF: 'reports_pdf',

  // Team ($99)
  TEAM_DASHBOARD: 'team_dashboard',
  TEAM_ANALYTICS: 'team_analytics',
  SHARED_POLICIES: 'shared_policies',
  BEHAVIORAL_GUARDRAILS: 'behavioral_guardrails',
  HUMAN_REVIEW_GATES: 'human_review_gates',
  SLACK_DISCORD_ALERTS: 'slack_discord_alerts',
  RBAC: 'rbac',
  RATE_LIMITING: 'rate_limiting',
  TOOL_USE_POLICY: 'tool_use_policy',

  // Business ($249)
  COMPLIANCE_DASHBOARDS: 'compliance_dashboards',
  RED_TEAM_HARNESS: 'red_team_harness',
  EVAL_SUITE: 'eval_suite',
  KILL_SWITCH: 'kill_switch',
  ESCALATION_POLICIES: 'escalation_policies',
  MONITORING_DASHBOARD: 'monitoring_dashboard',
  AUDIT_LOG_EXPORT: 'audit_log_export',
  LONG_HISTORY: 'long_history',

  // Enterprise ($499)
  SSO_SAML: 'sso_saml',
  ON_PREMISE: 'on_premise',
  CUSTOM_COMPLIANCE: 'custom_compliance',
  DEDICATED_SLA: 'dedicated_sla',
  CUSTOM_ENGINES: 'custom_engines',
  WHITE_GLOVE: 'white_glove',
  CROSS_REPO_SCANNING: 'cross_repo_scanning',
  SIGNED_BUNDLES: 'signed_bundles',
} as const;

export type GuardrailEntitlement = (typeof GUARDRAIL_ENTITLEMENTS)[keyof typeof GUARDRAIL_ENTITLEMENTS];

// ── Entitlement Sets (cumulative) ────────────────────────────────────────────

const STARTER_SET = new Set<GuardrailEntitlement>([
  GUARDRAIL_ENTITLEMENTS.SCAN_ALL_ENGINES,
  GUARDRAIL_ENTITLEMENTS.SCAN_UNLIMITED_LOCAL,
  GUARDRAIL_ENTITLEMENTS.REPORTS_HTML,
  GUARDRAIL_ENTITLEMENTS.SHIP_SCORE,
]);

const PRO_SET = new Set<GuardrailEntitlement>([
  ...STARTER_SET,
  GUARDRAIL_ENTITLEMENTS.LLM_SAFETY,
  GUARDRAIL_ENTITLEMENTS.INPUT_GUARDRAILS,
  GUARDRAIL_ENTITLEMENTS.OUTPUT_GUARDRAILS,
  GUARDRAIL_ENTITLEMENTS.PII_DETECTION,
  GUARDRAIL_ENTITLEMENTS.TOXICITY_SCANNING,
  GUARDRAIL_ENTITLEMENTS.CI_CD_INTEGRATION,
  GUARDRAIL_ENTITLEMENTS.API_ACCESS,
  GUARDRAIL_ENTITLEMENTS.CLOUD_SYNC,
  GUARDRAIL_ENTITLEMENTS.REPORTS_PDF,
]);

const TEAM_SET = new Set<GuardrailEntitlement>([
  ...PRO_SET,
  GUARDRAIL_ENTITLEMENTS.TEAM_DASHBOARD,
  GUARDRAIL_ENTITLEMENTS.TEAM_ANALYTICS,
  GUARDRAIL_ENTITLEMENTS.SHARED_POLICIES,
  GUARDRAIL_ENTITLEMENTS.BEHAVIORAL_GUARDRAILS,
  GUARDRAIL_ENTITLEMENTS.HUMAN_REVIEW_GATES,
  GUARDRAIL_ENTITLEMENTS.SLACK_DISCORD_ALERTS,
  GUARDRAIL_ENTITLEMENTS.RBAC,
  GUARDRAIL_ENTITLEMENTS.RATE_LIMITING,
  GUARDRAIL_ENTITLEMENTS.TOOL_USE_POLICY,
]);

const BUSINESS_SET = new Set<GuardrailEntitlement>([
  ...TEAM_SET,
  GUARDRAIL_ENTITLEMENTS.COMPLIANCE_DASHBOARDS,
  GUARDRAIL_ENTITLEMENTS.RED_TEAM_HARNESS,
  GUARDRAIL_ENTITLEMENTS.EVAL_SUITE,
  GUARDRAIL_ENTITLEMENTS.KILL_SWITCH,
  GUARDRAIL_ENTITLEMENTS.ESCALATION_POLICIES,
  GUARDRAIL_ENTITLEMENTS.MONITORING_DASHBOARD,
  GUARDRAIL_ENTITLEMENTS.AUDIT_LOG_EXPORT,
  GUARDRAIL_ENTITLEMENTS.LONG_HISTORY,
]);

const ENTERPRISE_SET = new Set<GuardrailEntitlement>([
  ...BUSINESS_SET,
  GUARDRAIL_ENTITLEMENTS.SSO_SAML,
  GUARDRAIL_ENTITLEMENTS.ON_PREMISE,
  GUARDRAIL_ENTITLEMENTS.CUSTOM_COMPLIANCE,
  GUARDRAIL_ENTITLEMENTS.DEDICATED_SLA,
  GUARDRAIL_ENTITLEMENTS.CUSTOM_ENGINES,
  GUARDRAIL_ENTITLEMENTS.WHITE_GLOVE,
  GUARDRAIL_ENTITLEMENTS.CROSS_REPO_SCANNING,
  GUARDRAIL_ENTITLEMENTS.SIGNED_BUNDLES,
]);

export const GUARDRAIL_PLAN_ENTITLEMENTS: Record<GuardrailPlanId, ReadonlySet<GuardrailEntitlement>> = {
  starter: STARTER_SET,
  pro: PRO_SET,
  team: TEAM_SET,
  business: BUSINESS_SET,
  enterprise: ENTERPRISE_SET,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

export function hasGuardrailEntitlement(plan: GuardrailPlanId, entitlement: GuardrailEntitlement): boolean {
  return GUARDRAIL_PLAN_ENTITLEMENTS[plan]?.has(entitlement) ?? false;
}

export function getRequiredGuardrailPlan(entitlement: GuardrailEntitlement): GuardrailPlanId {
  for (const id of GUARDRAIL_PLAN_IDS) {
    if (GUARDRAIL_PLAN_ENTITLEMENTS[id]?.has(entitlement)) return id;
  }
  return 'enterprise';
}

export function meetsGuardrailPlanRequirement(userPlan: GuardrailPlanId, requiredPlan: GuardrailPlanId): boolean {
  return GUARDRAIL_PLAN_RANK[userPlan] >= GUARDRAIL_PLAN_RANK[requiredPlan];
}
