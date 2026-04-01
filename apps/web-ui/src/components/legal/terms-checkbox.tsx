"use client";

import { PRIVACY_VERSION, TERMS_VERSION } from "@/hooks/use-terms-acceptance";
import { cn } from "@/lib/utils";
import { Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  variant?: "default" | "compact";
  showVersions?: boolean;
}

export function TermsCheckbox({
  checked,
  onChange,
  disabled = false,
  error,
  className,
  variant = "default",
  showVersions = false,
}: TermsCheckboxProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div
        className={cn(
          "flex items-start gap-3",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {/* Custom Checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label="Accept Terms of Service and Privacy Policy"
          disabled={disabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          className={cn(
            "flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
            checked
              ? "bg-primary border-primary"
              : "border-border hover:border-primary/50",
            disabled && "pointer-events-none",
          )}
        >
          {checked && (
            <Check className="w-full h-full text-primary-foreground p-0.5" />
          )}
        </button>

        {/* Label */}
        <div className="flex-1">
          {variant === "default" ? (
            <label
              className={cn(
                "text-sm text-muted-foreground cursor-pointer select-none",
                disabled && "cursor-not-allowed",
              )}
              onClick={handleClick}
            >
              I agree to the{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                Terms of Service
                <ExternalLink className="h-3 w-3" />
              </Link>{" "}
              and{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                className="text-primary hover:underline inline-flex items-center gap-1"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy Policy
                <ExternalLink className="h-3 w-3" />
              </Link>
              {showVersions && (
                <span className="text-xs text-muted-foreground/60 ml-1">
                  (v{TERMS_VERSION} / v{PRIVACY_VERSION})
                </span>
              )}
            </label>
          ) : (
            <label
              className={cn(
                "text-xs text-muted-foreground cursor-pointer select-none",
                disabled && "cursor-not-allowed",
              )}
              onClick={handleClick}
            >
              I agree to the{" "}
              <Link
                href="/legal/terms"
                target="_blank"
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Terms
              </Link>{" "}
              &{" "}
              <Link
                href="/legal/privacy"
                target="_blank"
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Privacy
              </Link>
            </label>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-xs text-destructive ml-8" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

interface TermsAcceptanceBlockProps {
  termsAccepted: boolean;
  privacyAccepted: boolean;
  onTermsChange: (checked: boolean) => void;
  onPrivacyChange: (checked: boolean) => void;
  disabled?: boolean;
  errors?: {
    terms?: string;
    privacy?: string;
  };
  className?: string;
}

export function TermsAcceptanceBlock({
  termsAccepted,
  privacyAccepted,
  onTermsChange,
  onPrivacyChange,
  disabled = false,
  errors,
  className,
}: TermsAcceptanceBlockProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="p-4 rounded-lg border border-border bg-card/50">
        <h3 className="text-sm font-medium mb-4">Legal Agreements</h3>

        {/* Terms of Service */}
        <div className="space-y-3">
          <div
            className={cn(
              "flex items-start gap-3",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={termsAccepted}
              aria-label="Accept Terms of Service"
              disabled={disabled}
              onClick={() => !disabled && onTermsChange(!termsAccepted)}
              className={cn(
                "flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50",
                termsAccepted
                  ? "bg-primary border-primary"
                  : "border-border hover:border-primary/50",
                disabled && "pointer-events-none",
              )}
            >
              {termsAccepted && (
                <Check className="w-full h-full text-primary-foreground p-0.5" />
              )}
            </button>
            <div className="flex-1">
              <label className="text-sm text-foreground cursor-pointer">
                I accept the{" "}
                <Link
                  href="/legal/terms"
                  target="_blank"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Terms of Service
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Version {TERMS_VERSION} - Last updated January 6, 2026
              </p>
              {errors?.terms && (
                <p className="text-xs text-destructive mt-1" role="alert">
                  {errors.terms}
                </p>
              )}
            </div>
          </div>

          {/* Privacy Policy */}
          <div
            className={cn(
              "flex items-start gap-3",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={privacyAccepted}
              aria-label="Accept Privacy Policy"
              disabled={disabled}
              onClick={() => !disabled && onPrivacyChange(!privacyAccepted)}
              className={cn(
                "flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50",
                privacyAccepted
                  ? "bg-primary border-primary"
                  : "border-border hover:border-primary/50",
                disabled && "pointer-events-none",
              )}
            >
              {privacyAccepted && (
                <Check className="w-full h-full text-primary-foreground p-0.5" />
              )}
            </button>
            <div className="flex-1">
              <label className="text-sm text-foreground cursor-pointer">
                I accept the{" "}
                <Link
                  href="/legal/privacy"
                  target="_blank"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Privacy Policy
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Version {PRIVACY_VERSION} - Last updated January 6, 2026
              </p>
              {errors?.privacy && (
                <p className="text-xs text-destructive mt-1" role="alert">
                  {errors.privacy}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
