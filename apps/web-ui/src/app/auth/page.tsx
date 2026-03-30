"use client";

import { ArrowLeft, Eye, EyeOff, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useCapsLock } from "@/hooks/useCapsLock";
import { isDevAuthBypassEnabled } from "@/lib/dev-auth";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const { capsLockEnabled } = useCapsLock(passwordInputRef.current);
  const formSubmittedRef = useRef(false);

  // Deep-link signup from /signup, etc.
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "signup") setMode("signup");
  }, []);

  useEffect(() => {
    if (isDevAuthBypassEnabled()) {
      router.replace("/dashboard");
    }
  }, [router]);

  // Check if user is already logged in
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/user", {
          credentials: "include",
        });
        if (response.ok) {
          // User is already logged in, redirect to dashboard
          router.push("/dashboard");
        }
      } catch {
        // Not logged in, continue
      }
    };
    checkSession();
  }, [router]);

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError("Email is required");
      return false;
    }
    if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
      return false;
    }
    setEmailError("");
    return true;
  };

  // Validate password
  const validatePassword = (password: string): boolean => {
    if (!password) {
      setPasswordError("Password is required");
      return false;
    }
    if (mode === "signup" && password.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError("");
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isLoading || formSubmittedRef.current) {
      return;
    }

    // Clear previous errors
    setError("");
    setEmailError("");
    setPasswordError("");

    // Validate form
    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) {
      return;
    }

    formSubmittedRef.current = true;
    setIsLoading(true);

    try {
      const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "signup"
        ? { email, password, name: fullName, company }
        : { email, password };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        credentials: "include",
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem("guardrail_remember_me", "true");
        } else {
          localStorage.removeItem("guardrail_remember_me");
        }

        // Redirect after short delay
        setTimeout(() => {
          const redirectTo = new URLSearchParams(window.location.search).get("redirect") || "/dashboard";
          router.push(redirectTo);
        }, 1000);
      } else {
        // Parse error messages for better UX
        let errorMessage = data.error || "Authentication failed";
        
        if (response.status === 423) {
          errorMessage = data.error || "Account temporarily locked. Please try again later.";
        } else if (response.status === 429) {
          errorMessage = "Too many attempts. Please wait a moment and try again.";
        } else if (response.status === 401) {
          errorMessage = "Invalid email or password. Please check your credentials.";
          if (data.attemptsRemaining !== undefined) {
            errorMessage += ` ${data.attemptsRemaining} attempt(s) remaining.`;
          }
        } else if (response.status === 503) {
          errorMessage = "Authentication service is temporarily unavailable. Please try again later.";
        }

        setError(errorMessage);
        formSubmittedRef.current = false;
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
      formSubmittedRef.current = false;
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div
        className="min-h-screen bg-black text-white flex items-center justify-center px-4"
        style={{
          minHeight: "100vh",
          backgroundColor: "#000000",
          color: "#ffffff",
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {mode === "signup" ? "Account Created!" : "Welcome Back!"}
          </h1>
          <p className="text-gray-400">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-black text-white flex items-center justify-center px-4 py-12"
      style={{
        minHeight: "100vh",
        backgroundColor: "#000000",
        color: "#ffffff",
      }}
    >
      <div className="w-full max-w-md" style={{ maxWidth: 28 * 16 }}>
        {/* Public docs — /dashboard requires a session and heavy app shell */}
        <Link
          href="/docs"
          className="inline-flex items-center text-gray-400 hover:text-white transition-colors mb-8"
          style={{ color: "#9ca3af", marginBottom: "2rem", display: "inline-flex", alignItems: "center" }}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Documentation
        </Link>

        <div
          className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            backgroundColor: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "1rem",
            overflow: "hidden",
          }}
        >
          <div className="p-6">
            {/* Logo */}
            <div className="text-center mb-6">
              <img
                src="/logo.png"
                alt="guardrail"
                width={120}
                height={48}
                className="h-12 w-auto mx-auto mb-4"
              />
              <h1 className="text-2xl font-bold">
                {mode === "signup" ? "Create Account" : "Sign In"}
              </h1>
              <p className="text-gray-400 mt-2">
                {mode === "signup"
                  ? "Get started with guardrail security scanning"
                  : "Welcome back to your security dashboard"
                }
              </p>
            </div>

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Company (Optional)</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                      placeholder="Acme Corp"
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  onBlur={() => validateEmail(email)}
                  className={`w-full px-3 py-2 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 text-white ${
                    emailError
                      ? "border-red-500 focus:ring-red-500"
                      : "border-gray-700 focus:ring-blue-500"
                  }`}
                  placeholder="you@example.com"
                  required
                  disabled={isLoading}
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? "email-error" : undefined}
                />
                {emailError && (
                  <p id="email-error" className="mt-1 text-sm text-red-400" role="alert">
                    {emailError}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    ref={passwordInputRef}
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) setPasswordError("");
                    }}
                    onBlur={() => validatePassword(password)}
                    className={`w-full px-3 py-2 bg-gray-800 border rounded-lg focus:outline-none focus:ring-2 text-white pr-10 ${
                      passwordError
                        ? "border-red-500 focus:ring-red-500"
                        : "border-gray-700 focus:ring-blue-500"
                    }`}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                    aria-invalid={!!passwordError}
                    aria-describedby={
                      passwordError || capsLockEnabled
                        ? `password-error${capsLockEnabled ? " caps-lock-warning" : ""}`
                        : undefined
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 rounded p-1"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={0}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {capsLockEnabled && (
                  <div
                    id="caps-lock-warning"
                    className="mt-1 flex items-center gap-1 text-sm text-amber-400"
                    role="alert"
                  >
                    <AlertCircle className="w-3 h-3" />
                    Caps Lock is on
                  </div>
                )}
                {passwordError && (
                  <p id="password-error" className="mt-1 text-sm text-red-400" role="alert">
                    {passwordError}
                  </p>
                )}
              </div>

              {/* Remember Me (Login only) */}
              {mode === "login" && (
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <label
                    htmlFor="remember-me"
                    className="ml-2 text-sm text-gray-400 cursor-pointer"
                  >
                    Remember me for 30 days
                  </label>
                </div>
              )}

              {/* Error Summary */}
              {error && (
                <div
                  className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm"
                  role="alert"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Authentication Error</p>
                      <p className="mt-1">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading || formSubmittedRef.current}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-busy={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {mode === "signup" ? "Creating Account..." : "Signing In..."}
                  </span>
                ) : (
                  mode === "signup" ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>

            {/* Mode Toggle */}
            <div className="mt-6 text-center">
              <p className="text-gray-400">
                {mode === "signup" ? "Already have an account?" : "Don't have an account?"}
                <button
                  type="button"
                  onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                  className="ml-2 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {mode === "signup" ? "Sign In" : "Create Account"}
                </button>
              </p>
            </div>

            {/* OAuth Options */}
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-700"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                  onClick={() => window.location.href = "/api/auth/github"}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  GitHub
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 hover:bg-gray-800"
                  onClick={() => window.location.href = "/api/auth/google"}
                >
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Google
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
