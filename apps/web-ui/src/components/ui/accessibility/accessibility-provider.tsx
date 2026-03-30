"use client";

import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";

// Accessibility Types
export interface AccessibilitySettings {
  screenReader: boolean;
  keyboardNavigation: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  largeText: boolean;
  focusVisible: boolean;
  announcements: boolean;
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (settings: Partial<AccessibilitySettings>) => void;
  announce: (message: string, priority?: "polite" | "assertive") => void;
  setFocus: (element: HTMLElement | null) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | null>(null);

// Default settings
const defaultSettings: AccessibilitySettings = {
  screenReader: false,
  keyboardNavigation: true,
  highContrast: false,
  reducedMotion: false,
  largeText: false,
  focusVisible: true,
  announcements: true,
};

// Accessibility Provider
export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("guardrail-accessibility-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      logger.logUnknownError("Failed to load accessibility settings", error);
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: AccessibilitySettings) => {
    try {
      localStorage.setItem("guardrail-accessibility-settings", JSON.stringify(newSettings));
    } catch (error) {
      logger.logUnknownError("Failed to save accessibility settings", error);
    }
  };

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply classes based on settings
    root.classList.toggle("high-contrast", settings.highContrast);
    root.classList.toggle("reduce-motion", settings.reducedMotion);
    root.classList.toggle("large-text", settings.largeText);
    root.classList.toggle("focus-visible", settings.focusVisible);
    root.classList.toggle("screen-reader", settings.screenReader);
    
    // Update ARIA live regions
    if (settings.announcements) {
      setupLiveRegions();
    }
    
    // Update focus management
    if (settings.keyboardNavigation) {
      setupKeyboardNavigation();
    }
    
    // Apply CSS custom properties
    if (settings.highContrast) {
      root.style.setProperty("--contrast-ratio", "7");
    } else {
      root.style.removeProperty("--contrast-ratio");
    }
    
    if (settings.largeText) {
      root.style.setProperty("--font-scale", "1.2");
    } else {
      root.style.removeProperty("--font-scale");
    }
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  const announce = (message: string, priority: "polite" | "assertive" = "polite") => {
    if (!settings.announcements) return;
    
    const liveRegion = document.getElementById(`live-region-${priority}`);
    if (liveRegion) {
      liveRegion.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        liveRegion.textContent = "";
      }, 1000);
    }
  };

  const setFocus = (element: HTMLElement | null) => {
    if (element && settings.keyboardNavigation) {
      element.focus();
      setFocusedElement(element);
    }
  };

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSettings,
        announce,
        setFocus,
      }}
    >
      {children}
      {/* Live regions for screen readers */}
      {settings.announcements && (
        <>
          <div
            id="live-region-polite"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          />
          <div
            id="live-region-assertive"
            aria-live="assertive"
            aria-atomic="true"
            className="sr-only"
          />
        </>
      )}
    </AccessibilityContext.Provider>
  );
}

// Hook to use accessibility
export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error("useAccessibility must be used within an AccessibilityProvider");
  }
  return context;
}

// Setup functions
function setupLiveRegions() {
  // Live regions are already in the provider
}

function setupKeyboardNavigation() {
  // Add keyboard navigation enhancements
  const handleKeyDown = (e: KeyboardEvent) => {
    // Skip if in input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    // Tab navigation enhancement
    if (e.key === "Tab") {
      document.body.classList.add("keyboard-navigation");
    }
  };

  const handleMouseDown = () => {
    document.body.classList.remove("keyboard-navigation");
  };

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("mousedown", handleMouseDown);

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("mousedown", handleMouseDown);
  };
}

// Focus Management Hook
export function useFocusManagement() {
  const { setFocus, announce } = useAccessibility();
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const trapFocus = (container: HTMLElement) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    container.addEventListener("keydown", handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener("keydown", handleTabKey);
    };
  };

  const saveFocus = () => {
    previousFocusRef.current = document.activeElement as HTMLElement;
  };

  const restoreFocus = () => {
    if (previousFocusRef.current) {
      setFocus(previousFocusRef.current);
    }
  };

  return {
    trapFocus,
    saveFocus,
    restoreFocus,
    setFocus,
  };
}

// Skip Link Component
export function SkipLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-lg z-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {children}
    </a>
  );
}

// Accessible Button Component
export function AccessibleButton({
  children,
  onClick,
  disabled = false,
  ariaLabel,
  ariaDescribedBy,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  ariaLabel?: string;
  ariaDescribedBy?: string;
}) {
  const { announce } = useAccessibility();

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled) return;
    
    onClick?.(e);
    
    // Announce action for screen readers
    const buttonText = typeof children === "string" ? children : "Button";
    announce(`${buttonText} activated`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-describedby={ariaDescribedBy}
      {...props}
      className={cn(
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        disabled && "opacity-50 cursor-not-allowed",
        props.className
      )}
    >
      {children}
    </button>
  );
}

// Accessible Form Component
export function AccessibleForm({
  children,
  onSubmit,
  ariaLabel,
  ...props
}: React.FormHTMLAttributes<HTMLFormElement> & {
  ariaLabel?: string;
}) {
  const { announce } = useAccessibility();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit?.(e);
    announce("Form submitted");
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={ariaLabel}
      noValidate
      {...props}
    >
      {children}
    </form>
  );
}

// Accessible Input Component
export function AccessibleInput({
  label,
  error,
  required = false,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  required?: boolean;
}) {
  const inputId = `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1">
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-zinc-300"
      >
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <input
        id={inputId}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
        aria-required={required}
        className={cn(
          "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
          error && "border-red-500 focus:ring-red-500",
          props.className
        )}
        {...props}
      />
      {error && (
        <div id={errorId} className="text-sm text-red-400" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

// Progress Announcer Component
export function ProgressAnnouncer({
  value,
  max = 100,
  label
}: {
  value: number;
  max?: number;
  label: string;
}) {
  const { announce } = useAccessibility();
  const previousValue = useRef(value);

  useEffect(() => {
    if (value !== previousValue.current) {
      const percentage = Math.round((value / max) * 100);
      announce(`${label}: ${percentage}% complete`);
      previousValue.current = value;
    }
  }, [value, max, label, announce]);

  return null;
}

// CSS for accessibility
export const accessibilityCSS = `
  /* Screen reader only content */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* Focus styles */
  .focus-visible *:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  .keyboard-navigation *:focus {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  /* High contrast mode */
  .high-contrast {
    --bg-primary: 0 0 0;
    --bg-secondary: 255 255 255;
    --text-primary: 255 255 255;
    --text-secondary: 0 0 0;
    --border-primary: 255 255 255;
    --accent: 255 255 0;
  }

  /* Large text mode */
  .large-text {
    font-size: calc(var(--font-scale, 1) * 16px);
    line-height: 1.5;
  }

  .large-text button,
  .large-text input,
  .large-text select,
  .large-text textarea {
    font-size: calc(var(--font-scale, 1) * 16px);
    padding: calc(var(--font-scale, 1) * 8px);
  }

  /* Reduced motion */
  .reduce-motion *,
  .reduce-motion *::before,
  .reduce-motion *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  /* Skip links */
  .sr-only:focus:not(.sr-only) {
    position: static;
    width: auto;
    height: auto;
    padding: 0.5rem 1rem;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
`;
