"use client";

import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AccountPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to profile in dashboard
    router.replace("/dashboard/profile");
  }, [router]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p>Redirecting to profile...</p>
      </div>
    </div>
  );
}
