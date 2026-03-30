import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { redirect } from "next/navigation";

/**
 * Login page - Redirects to auth page
 * Using server-side redirect for better Netlify compatibility
 */
export default function LoginPage() {
  if (isDevAuthBypassEnabled()) {
    redirect("/dashboard");
  }
  redirect("/auth");
}
