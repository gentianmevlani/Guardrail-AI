"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect to compliance - enforcement settings are now part of compliance
export const dynamic = "force-dynamic";

export default function EnforcementPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/compliance");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Redirecting to compliance...</p>
    </div>
  );
}
