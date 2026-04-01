import { HomeLanding } from "@/components/landing/home-landing";
import { IBM_Plex_Sans, Sora } from "next/font/google";

const landingDisplay = Sora({
  subsets: ["latin"],
  variable: "--font-landing-display",
  weight: ["500", "600", "700"],
});

const landingSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-landing-sans",
  weight: ["400", "500", "600"],
});

/**
 * Public landing at `/` → `/auth` for login/signup → `/dashboard` after session.
 * `NEXT_PUBLIC_DEV_SKIP_AUTH` does not skip this page; open `/dashboard` directly if you want the bypass fast path.
 */
export default function HomePage() {
  return (
    <div
      className={`${landingDisplay.variable} ${landingSans.variable} min-h-screen bg-black text-white antialiased [--font-display:var(--font-landing-display)]`}
      // Comma inside Tailwind arbitrary font stacks breaks JIT parsing — use inline style.
      style={{
        fontFamily:
          "var(--font-landing-sans), ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <HomeLanding />
    </div>
  );
}
