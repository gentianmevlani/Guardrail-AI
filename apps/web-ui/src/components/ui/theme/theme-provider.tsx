"use client";

import { cn } from "@/lib/utils";
import React, { createContext, useContext, useEffect, useState } from "react";
import { logger } from "@/lib/logger";

// Theme Types
export type Theme = "light" | "dark" | "system";

export interface ThemePreferences {
  theme: Theme;
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: "sm" | "md" | "lg" | "xl";
  compactMode: boolean;
}

// Theme Context
interface ThemeContextType {
  theme: Theme;
  preferences: ThemePreferences;
  setTheme: (theme: Theme) => void;
  setPreferences: (preferences: Partial<ThemePreferences>) => void;
  resolvedTheme: "light" | "dark";
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

// Default preferences
const defaultPreferences: ThemePreferences = {
  theme: "system",
  reducedMotion: false,
  highContrast: false,
  fontSize: "md",
  compactMode: false,
};

// Theme Provider
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferencesState] = useState<ThemePreferences>(defaultPreferences);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("guardrail-theme-preferences");
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferencesState({ ...defaultPreferences, ...parsed });
      }
    } catch (error) {
      logger.error("Failed to load theme preferences", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        component: "ThemeProvider"
      });
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = (newPreferences: ThemePreferences) => {
    try {
      localStorage.setItem("guardrail-theme-preferences", JSON.stringify(newPreferences));
    } catch (error) {
      logger.error("Failed to save theme preferences", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        component: "ThemeProvider"
      });
    }
  };

  // Resolve system theme
  const getSystemTheme = (): "light" | "dark" => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "dark";
  };

  // Update resolved theme when preferences change
  useEffect(() => {
    const theme = preferences.theme === "system" ? getSystemTheme() : preferences.theme;
    setResolvedTheme(theme);
  }, [preferences.theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply theme
    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    
    // Apply color scheme for browser UI
    root.style.colorScheme = resolvedTheme;
    
    // Apply reduced motion
    if (preferences.reducedMotion) {
      root.style.setProperty("--transition-duration", "0ms");
      root.classList.add("reduce-motion");
    } else {
      root.style.removeProperty("--transition-duration");
      root.classList.remove("reduce-motion");
    }
    
    // Apply high contrast
    if (preferences.highContrast) {
      root.classList.add("high-contrast");
    } else {
      root.classList.remove("high-contrast");
    }
    
    // Apply font size
    root.classList.remove("text-sm", "text-md", "text-lg", "text-xl");
    root.classList.add(`text-${preferences.fontSize}`);
    
    // Apply compact mode
    if (preferences.compactMode) {
      root.classList.add("compact-mode");
    } else {
      root.classList.remove("compact-mode");
    }
  }, [preferences, resolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (preferences.theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        setResolvedTheme(mediaQuery.matches ? "dark" : "light");
      };
      
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [preferences.theme]);

  const setTheme = (theme: Theme) => {
    const newPreferences = { ...preferences, theme };
    setPreferencesState(newPreferences);
    savePreferences(newPreferences);
  };

  const setPreferences = (newPreferences: Partial<ThemePreferences>) => {
    const updated = { ...preferences, ...newPreferences };
    setPreferencesState(updated);
    savePreferences(updated);
  };

  const toggleTheme = () => {
    const newTheme = preferences.theme === "dark" ? "light" : 
                     preferences.theme === "light" ? "dark" : 
                     getSystemTheme();
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme: preferences.theme,
        preferences,
        setTheme,
        setPreferences,
        resolvedTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Hook to use theme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Theme Toggle Component
export function ThemeToggle({
  variant = "default",
  showLabel = false,
  className
}: {
  variant?: "default" | "compact" | "icon-only";
  showLabel?: boolean;
  className?: string;
}) {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();

  const handleThemeChange = () => {
    if (variant === "compact") {
      // Cycle through themes: system -> light -> dark -> system
      const themes: Theme[] = ["system", "light", "dark"];
      const currentIndex = themes.indexOf(theme);
      const nextIndex = (currentIndex + 1) % themes.length;
      setTheme(themes[nextIndex]);
    } else {
      toggleTheme();
    }
  };

  const getThemeIcon = () => {
    if (theme === "system") {
      return resolvedTheme === "dark" ? "🌙" : "☀️";
    }
    return theme === "dark" ? "🌙" : "☀️";
  };

  const getThemeLabel = () => {
    if (theme === "system") {
      return `System (${resolvedTheme})`;
    }
    return theme.charAt(0).toUpperCase() + theme.slice(1);
  };

  return (
    <button
      onClick={handleThemeChange}
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all",
        "border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800/50",
        "text-zinc-300 hover:text-white",
        className
      )}
      aria-label={`Current theme: ${getThemeLabel()}. Click to change theme.`}
    >
      <span className="text-lg" role="img" aria-hidden="true">
        {getThemeIcon()}
      </span>
      {showLabel && (
        <span className="text-sm font-medium">
          {getThemeLabel()}
        </span>
      )}
    </button>
  );
}

// Theme Settings Panel
export function ThemeSettings() {
  const { preferences, setPreferences, theme, setTheme } = useTheme();

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <div>
        <h3 className="text-lg font-medium text-white mb-3">Theme</h3>
        <div className="grid grid-cols-3 gap-2">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={cn(
                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                theme === t
                  ? "border-blue-500 bg-blue-950/30 text-blue-400"
                  : "border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:text-white hover:border-zinc-600"
              )}
            >
              <span className="text-2xl">
                {t === "system" ? "💻" : t === "light" ? "☀️" : "🌙"}
              </span>
              <span className="text-sm capitalize">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accessibility Options */}
      <div>
        <h3 className="text-lg font-medium text-white mb-3">Accessibility</h3>
        <div className="space-y-3">
          {/* Reduced Motion */}
          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">Reduced Motion</div>
              <div className="text-sm text-zinc-400">Minimize animations and transitions</div>
            </div>
            <input
              type="checkbox"
              checked={preferences.reducedMotion}
              onChange={(e) => setPreferences({ reducedMotion: e.target.checked })}
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
            />
          </label>

          {/* High Contrast */}
          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">High Contrast</div>
              <div className="text-sm text-zinc-400">Increase color contrast for better visibility</div>
            </div>
            <input
              type="checkbox"
              checked={preferences.highContrast}
              onChange={(e) => setPreferences({ highContrast: e.target.checked })}
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
            />
          </label>
        </div>
      </div>

      {/* Display Options */}
      <div>
        <h3 className="text-lg font-medium text-white mb-3">Display</h3>
        <div className="space-y-3">
          {/* Font Size */}
          <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div className="text-white font-medium mb-2">Font Size</div>
            <div className="grid grid-cols-4 gap-2">
              {(["sm", "md", "lg", "xl"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPreferences({ fontSize: size })}
                  className={cn(
                    "p-2 rounded border text-sm transition-all",
                    preferences.fontSize === size
                      ? "border-blue-500 bg-blue-950/30 text-blue-400"
                      : "border-zinc-600 bg-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-500"
                  )}
                >
                  {size.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Compact Mode */}
          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">Compact Mode</div>
              <div className="text-sm text-zinc-400">Reduce spacing and padding</div>
            </div>
            <input
              type="checkbox"
              checked={preferences.compactMode}
              onChange={(e) => setPreferences({ compactMode: e.target.checked })}
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded focus:ring-blue-500 focus:ring-2"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// CSS Variables for theming
export const themeCSSVariables = `
  :root {
    /* Light theme colors */
    --bg-primary: 255 255 255;
    --bg-secondary: 248 250 252;
    --bg-tertiary: 241 245 249;
    --text-primary: 15 23 42;
    --text-secondary: 71 85 105;
    --text-tertiary: 148 163 184;
    --border-primary: 226 232 240;
    --border-secondary: 203 213 225;
    --accent: 59 130 246;
    --accent-hover: 37 99 235;
    
    /* Dark theme colors (will be overridden by dark class) */
    --bg-primary-dark: 0 0 0;
    --bg-secondary-dark: 17 24 39;
    --bg-tertiary-dark: 31 41 55;
    --text-primary-dark: 255 255 255;
    --text-secondary-dark: 156 163 175;
    --text-tertiary-dark: 107 114 128;
    --border-primary-dark: 55 65 81;
    --border-secondary-dark: 75 85 99;
    --accent-dark: 59 130 246;
    --accent-hover-dark: 37 99 235;
  }

  .dark {
    --bg-primary: var(--bg-primary-dark);
    --bg-secondary: var(--bg-secondary-dark);
    --bg-tertiary: var(--bg-tertiary-dark);
    --text-primary: var(--text-primary-dark);
    --text-secondary: var(--text-secondary-dark);
    --text-tertiary: var(--text-tertiary-dark);
    --border-primary: var(--border-primary-dark);
    --border-secondary: var(--border-secondary-dark);
    --accent: var(--accent-dark);
    --accent-hover: var(--accent-hover-dark);
  }

  .high-contrast {
    --text-primary: 255 255 255;
    --text-secondary: 255 255 255;
    --border-primary: 255 255 255;
    --border-secondary: 255 255 255;
  }

  .reduce-motion * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  .text-sm { font-size: 0.875rem; }
  .text-md { font-size: 1rem; }
  .text-lg { font-size: 1.125rem; }
  .text-xl { font-size: 1.25rem; }

  .compact-mode {
    --spacing-xs: 0.25rem;
    --spacing-sm: 0.5rem;
    --spacing-md: 0.75rem;
    --spacing-lg: 1rem;
    --spacing-xl: 1.25rem;
  }
`;
