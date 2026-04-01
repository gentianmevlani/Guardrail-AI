/**
 * Server-only route segment config for the dashboard group.
 * Forces dynamic rendering for all dashboard routes — prevents SSG
 * from trying to statically generate pages that require auth/session.
 *
 * The actual layout UI lives in layout.tsx ("use client").
 * This file MUST stay a Server Component (no "use client").
 */

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
