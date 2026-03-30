/**
 * Local development: treat the user as signed in without calling the API.
 * Enabled when NODE_ENV is development and NEXT_PUBLIC_DEV_SKIP_AUTH is not "false".
 * Set NEXT_PUBLIC_DEV_SKIP_AUTH=false in .env.local to test real login flows.
 */

export const DEV_BYPASS_USER_ID = "dev-local-user";

export function isDevAuthBypassEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_DEV_SKIP_AUTH !== "false"
  );
}

/** Minimal user shape for dev bypass — cast to User in AuthProvider */
export function getDevBypassUser() {
  return {
    id: DEV_BYPASS_USER_ID,
    email: "dev@localhost",
    name: "Local Dev",
    subscription: {
      plan: "free" as const,
      status: "active" as const,
    },
    createdAt: new Date().toISOString(),
  };
}

export function isDevBypassUserId(id: string | undefined): boolean {
  return id === DEV_BYPASS_USER_ID;
}
