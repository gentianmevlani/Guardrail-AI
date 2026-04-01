"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect to settings - profile is now part of settings
export const dynamic = "force-dynamic";

export default function ProfilePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <p className="text-muted-foreground">Redirecting to settings...</p>
    </div>
  );
}
