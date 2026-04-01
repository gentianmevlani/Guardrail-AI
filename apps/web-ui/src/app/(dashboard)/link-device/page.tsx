"use client";

import { useAuth } from "@/context/auth-context";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

type VerifyState = "idle" | "verifying" | "success" | "error";

function LinkDeviceForm() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const searchParams = useSearchParams();
  const prefillCode = searchParams.get("code") || "";

  const [code, setCode] = useState(prefillCode);
  const [state, setState] = useState<VerifyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [clientType, setClientType] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-submit if code came from URL and user is authenticated
  const autoSubmitted = useRef(false);
  useEffect(() => {
    if (
      prefillCode &&
      isAuthenticated &&
      !autoSubmitted.current &&
      state === "idle"
    ) {
      autoSubmitted.current = true;
      void handleSubmit(prefillCode);
    }
  }, [prefillCode, isAuthenticated]);

  const handleSubmit = useCallback(
    async (codeToSubmit?: string) => {
      const submitCode = codeToSubmit || code;
      if (!submitCode || submitCode.replace(/[-\s]/g, "").length < 8) return;

      setState("verifying");
      setErrorMsg("");

      try {
        const res = await fetch("/api/auth/device/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ user_code: submitCode }),
        });

        const data = await res.json();

        if (res.ok && data.success) {
          setState("success");
          setClientType(data.client_type || "device");
        } else {
          setState("error");
          setErrorMsg(data.error || "Verification failed");
        }
      } catch {
        setState("error");
        setErrorMsg("Network error — please try again");
      }
    },
    [code],
  );

  // Format code as user types: auto-insert hyphen
  const handleCodeChange = (value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length <= 8) {
      const formatted =
        clean.length > 4
          ? `${clean.slice(0, 4)}-${clean.slice(4)}`
          : clean;
      setCode(formatted);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-400 text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Sign in required</h2>
          <p className="text-slate-400 text-sm">
            You need to be logged in to link a device. Please sign in first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Link Device
          </h1>
          <p className="text-slate-400 text-sm max-w-sm mx-auto">
            Enter the code shown in your CLI or VS Code extension to link it to
            your <span className="text-white font-medium">{user?.email}</span>{" "}
            account.
          </p>
        </div>

        {state === "success" ? (
          /* ── Success ── */
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-emerald-300">
              Device Linked
            </h2>
            <p className="text-slate-400 text-sm">
              Your{" "}
              <span className="text-white font-medium">
                {clientType === "cli"
                  ? "CLI"
                  : clientType === "vscode"
                    ? "VS Code extension"
                    : "device"}
              </span>{" "}
              is now connected. You can close this page.
            </p>
          </div>
        ) : (
          /* ── Code Input ── */
          <div className="space-y-6">
            <div className="bg-slate-800/50 border border-white/5 rounded-2xl p-6 space-y-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Device Code
              </label>
              <input
                ref={inputRef}
                type="text"
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="XXXX-XXXX"
                maxLength={9}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                className="w-full text-center text-3xl font-mono font-bold tracking-[0.3em] bg-slate-900/80 border border-white/10 rounded-xl px-4 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSubmit();
                }}
              />
              {state === "error" && (
                <p className="text-red-400 text-sm text-center">{errorMsg}</p>
              )}
            </div>

            <button
              onClick={() => void handleSubmit()}
              disabled={
                state === "verifying" || code.replace(/[-\s]/g, "").length < 8
              }
              className="w-full py-3.5 px-6 rounded-xl font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-[0_0_24px_rgba(0,229,255,0.3)] active:scale-[0.98]"
            >
              {state === "verifying" ? "Verifying..." : "Authorize Device"}
            </button>

            <p className="text-center text-xs text-slate-500">
              This will grant the device access to your Guardrail account.
              <br />
              Codes expire after 10 minutes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LinkDevicePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-slate-400 text-sm">Loading...</div>
        </div>
      }
    >
      <LinkDeviceForm />
    </Suspense>
  );
}
