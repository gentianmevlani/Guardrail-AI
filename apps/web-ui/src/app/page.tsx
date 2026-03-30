import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { redirect } from "next/navigation";

/**
 * Root page - Redirects to auth page
 * Landing page is excluded from deployment
 * Using server-side redirect for better Netlify compatibility
 *
 * Note: The auth page is at app/auth/page.tsx (outside the dashboard layout).
 * URL is /auth.
 *
 * Local dev: `isDevAuthBypassEnabled()` sends you to /dashboard without login.
 */
export default function HomePage() {
  if (isDevAuthBypassEnabled()) {
    redirect("/dashboard");
  }
  redirect("/auth");
}
