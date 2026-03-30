// Updated route configuration
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect to dashboard - activity is now shown in the main dashboard
export const dynamic = "force-dynamic";

export default function ActivityPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Redirecting to dashboard...</p>
    </div>
  );
}
