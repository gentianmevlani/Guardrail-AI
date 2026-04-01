"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Loader2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import React, { Suspense, useState } from "react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || null;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
      } else {
        setError(
          data.error || "Failed to reset password. The link may have expired.",
        );
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <div className="p-4 rounded-full bg-red-500/20 inline-block mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Invalid Reset Link
        </h2>
        <p className="text-white/60 mb-6">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="p-4 rounded-full bg-emerald-500/20 inline-block mb-4">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">
          Password Reset Successfully
        </h2>
        <p className="text-white/60 mb-6">
          Your password has been updated. You can now sign in with your new
          password.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-lg transition-all"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-6">
        <div className="p-3 rounded-full bg-blue-500/20 inline-block mb-4">
          <Lock className="w-6 h-6 text-blue-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          Reset Your Password
        </h1>
        <p className="text-white/60">Enter your new password below</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
            placeholder="Enter new password"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/70 mb-2">
            Confirm Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50"
            placeholder="Confirm new password"
            required
            minLength={8}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white py-3 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset Password"
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/"
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Back to Sign In
        </Link>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl p-8">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
              </div>
            }
          >
            <ResetPasswordForm />
          </Suspense>
        </div>
      </motion.div>
    </div>
  );
}
