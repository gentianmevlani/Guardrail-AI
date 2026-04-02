import { GsapLanding } from "@/components/landing/gsap-landing/gsap-landing";

/**
 * Public landing at `/` → `/auth` for login/signup → `/dashboard` after session.
 * `NEXT_PUBLIC_DEV_SKIP_AUTH` does not skip this page; open `/dashboard` directly if you want the bypass fast path.
 */
export default function HomePage() {
  return <GsapLanding />;
}
