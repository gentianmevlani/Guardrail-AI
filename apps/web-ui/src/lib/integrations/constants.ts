/** Public defaults — no secrets. Used by Integrations UI and docs. */
export const GUARDRAIL_DEFAULT_API_URL = "https://api.guardrail.dev";

export const INTEGRATION_ENV = {
  API_URL: "GUARDRAIL_API_URL",
  API_BASE_URL: "GUARDRAIL_API_BASE_URL",
  API_KEY: "GUARDRAIL_API_KEY",
  SYNC: "GUARDRAIL_SYNC",
  BRANCH: "GUARDRAIL_BRANCH",
  COMMIT_SHA: "GUARDRAIL_COMMIT_SHA",
} as const;
