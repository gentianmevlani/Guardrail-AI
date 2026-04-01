"use client";

import { isDevAuthBypassEnabled } from "@/lib/dev-auth";
import { useEffect } from "react";

export default function SignupPage() {
  useEffect(() => {
    if (isDevAuthBypassEnabled()) {
      window.location.href = "/dashboard";
      return;
    }
    window.location.href = "/auth?mode=signup";
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
        <p>Redirecting to signup...</p>
      </div>
    </div>
  );
}
