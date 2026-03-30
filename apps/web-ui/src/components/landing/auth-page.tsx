"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { logger } from "@/lib/logger";

interface AuthPageProps {
  onClose: () => void;
  onSuccess?: () => void;
  mode: "login" | "signup";
}

export function AuthPage({
  onClose,
  onSuccess,
  mode: initialMode,
}: AuthPageProps) {
  const router = useRouter();
  
  // Check if router is properly mounted
  const isRouterReady = !!router;
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();
      setForgotSuccess(true);
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    setIsLoading(true);
    setError("");
    window.location.href = "/api/auth/google";
  };

  const handleGithubAuth = () => {
    setIsLoading(true);
    setError("");
    window.location.href = "/api/auth/github";
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const endpoint = mode === "login" ? "login" : "register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, name: fullName };

      const response = await fetch(`/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        if (onSuccess) {
          onSuccess();
          // Delay redirect to allow splash to play
          setTimeout(() => {
            try {
              // Use window.location for more reliable navigation
              window.location.href = "/dashboard/dashboard";
            } catch (error) {
              logger.logUnknownError("Navigation error", error);
              setError("Redirect failed. Please try again.");
              setIsLoading(false);
            }
          }, 3000);
        } else {
          try {
            // Use window.location for more reliable navigation
            window.location.href = "/dashboard";
          } catch (error) {
            logger.logUnknownError("Navigation error", error);
            setError("Redirect failed. Please try again.");
            setIsLoading(false);
          }
        }
      } else {
        setError(data.error || "Authentication failed");
        setIsLoading(false);
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12">
      <button
        onClick={onClose}
        className="fixed top-6 right-6 text-gray-400 hover:text-white transition-colors z-50 bg-gray-900/80 backdrop-blur-sm p-2 rounded-full border border-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Close authentication dialog"
      >
        <X className="w-6 h-6" aria-hidden="true" />
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-md"
      >
        <div className="relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-400/5 via-transparent to-gray-600/5 pointer-events-none" />

          <div className="relative p-6">
            <div className="flex flex-col items-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/guardrail-logo.svg"
                alt="guardrail"
                width={200}
                height={40}
                className="h-16 w-auto object-contain"
              />
            </div>

            <div className="text-center mb-4">
              <h2 className="text-2xl font-semibold text-white mb-1">
                {mode === "forgot"
                  ? "Reset Password"
                  : mode === "login"
                    ? "Welcome Back"
                    : "Create Account"}
              </h2>
              <p className="text-gray-400 text-sm">
                {mode === "forgot"
                  ? "Enter your email to receive a reset link"
                  : mode === "login"
                    ? "Sign in to access your dashboard"
                    : "Get started today"}
              </p>
            </div>

            {mode !== "forgot" && (
              <div className="space-y-2 mb-4">
                <button
                  onClick={handleGoogleAuth}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-gray-100 text-gray-900 rounded-lg transition-colors font-medium text-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <button
                  onClick={handleGithubAuth}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z"
                    />
                  </svg>
                  Continue with GitHub
                </button>
              </div>
            )}

            {mode !== "forgot" && (
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-800"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-gradient-to-br from-gray-900 to-black text-gray-400">
                    Or continue with email
                  </span>
                </div>
              </div>
            )}

            {/* Forgot Password Form */}
            {mode === "forgot" &&
              (forgotSuccess ? (
                <div className="text-center py-4">
                  <div className="p-3 rounded-full bg-emerald-500/20 inline-block mb-4">
                    <svg
                      className="w-6 h-6 text-emerald-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Check Your Email
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    If an account exists with that email, we've sent a password
                    reset link.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setForgotSuccess(false);
                    }}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-3">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-xs font-medium text-gray-300 mb-1"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full px-3 py-2 bg-black/50 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="you@example.com"
                    />
                  </div>

                  {error && (
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                  </button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("login");
                        setError("");
                      }}
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              ))}

            {/* Login/Signup Form */}
            {mode !== "forgot" && (
              <form onSubmit={handleEmailAuth} className="space-y-3">
                {mode === "signup" && (
                  <>
                    <div>
                      <label
                        htmlFor="fullName"
                        className="block text-xs font-medium text-gray-300 mb-1"
                      >
                        Full Name
                      </label>
                      <input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-black/50 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="company"
                        className="block text-xs font-medium text-gray-300 mb-1"
                      >
                        Company{" "}
                        <span className="text-gray-500">(optional)</span>
                      </label>
                      <input
                        id="company"
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        className="w-full px-3 py-2 bg-black/50 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Acme Inc."
                      />
                    </div>
                  </>
                )}

                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs font-medium text-gray-300 mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-black/50 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-medium text-gray-300 mb-1"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-black/50 border border-gray-800 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div
                    className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg"
                    role="alert"
                    aria-live="assertive"
                  >
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {mode === "login" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setForgotSuccess(false);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-2.5 rounded-lg font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading
                    ? "Please wait..."
                    : mode === "login"
                      ? "Sign In"
                      : "Create Account"}
                </button>
              </form>
            )}

            {mode === "signup" && (
              <p className="mt-3 text-xs text-center text-gray-500">
                By signing up, you agree to our{" "}
                <a href="#" className="text-blue-400 hover:text-blue-300">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-blue-400 hover:text-blue-300">
                  Privacy Policy
                </a>
              </p>
            )}

            {mode !== "forgot" && (
              <div className="mt-4 text-center">
                <p className="text-gray-400">
                  {mode === "login"
                    ? "Don't have an account? "
                    : "Already have an account? "}
                  <button
                    onClick={() =>
                      setMode(mode === "login" ? "signup" : "login")
                    }
                    className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                  >
                    {mode === "login" ? "Sign up" : "Sign in"}
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
