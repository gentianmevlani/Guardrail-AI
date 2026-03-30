"use client";

import { safeCreateMeta } from "@/lib/security/safe-dom";
import { logger } from "@/lib/logger";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// Security Types
export interface SecuritySettings {
  sessionTimeout: number; // minutes
  requireReauth: boolean;
  auditLogging: boolean;
  dataMasking: boolean;
  rateLimiting: boolean;
  csrfProtection: boolean;
  secureCookies: boolean;
}

interface SecurityContextType {
  settings: SecuritySettings;
  updateSettings: (settings: Partial<SecuritySettings>) => void;
  sessionInfo: {
    isActive: boolean;
    timeRemaining: number;
    lastActivity: Date;
  };
  extendSession: () => void;
  logout: () => void;
  logSecurityEvent: (event: SecurityEvent) => void;
}

export interface SecurityEvent {
  type:
  | "login"
  | "logout"
  | "permission_denied"
  | "data_access"
  | "suspicious_activity";
  userId?: string;
  resource?: string;
  details?: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const SecurityContext = createContext<SecurityContextType | null>(null);

// Default security settings
const defaultSettings: SecuritySettings = {
  sessionTimeout: 30, // 30 minutes
  requireReauth: true,
  auditLogging: true,
  dataMasking: true,
  rateLimiting: true,
  csrfProtection: true,
  secureCookies: true,
};

// Security Provider
export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SecuritySettings>(defaultSettings);
  const [sessionInfo, setSessionInfo] = useState({
    isActive: true,
    timeRemaining: settings.sessionTimeout * 60, // seconds
    lastActivity: new Date('2026-01-01T00:00:00.000Z'),
  });

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("guardrail-security-settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      logger.error("Failed to load security settings", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        component: "SecurityProvider"
      });
    }
  }, []);

  // Save settings to localStorage
  const saveSettings = (newSettings: SecuritySettings) => {
    try {
      localStorage.setItem(
        "guardrail-security-settings",
        JSON.stringify(newSettings),
      );
    } catch (error) {
      logger.error("Failed to save security settings", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        component: "SecurityProvider"
      });
    }
  };

  // Session timeout management
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const timeSinceActivity =
        (now.getTime() - sessionInfo.lastActivity.getTime()) / 1000; // seconds
      const timeRemaining = Math.max(
        0,
        settings.sessionTimeout * 60 - timeSinceActivity,
      );

      setSessionInfo((prev) => ({
        ...prev,
        timeRemaining,
        isActive: timeRemaining > 0,
      }));

      // Auto-logout if session expired
      if (timeRemaining <= 0 && sessionInfo.isActive) {
        handleLogout();
      }
    }, 1000); // Check every second

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.sessionTimeout, sessionInfo.lastActivity, sessionInfo.isActive]);

  // Activity tracking
  useEffect(() => {
    const handleActivity = () => {
      setSessionInfo((prev) => ({
        ...prev,
        lastActivity: new Date(),
      }));
    };

    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((event) => {
      document.addEventListener(event, handleActivity, true);
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity, true);
      });
    };
  }, []);

  const updateSettings = (newSettings: Partial<SecuritySettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  const extendSession = useCallback(() => {
    setSessionInfo((prev) => ({
      ...prev,
      lastActivity: new Date(),
      timeRemaining: settings.sessionTimeout * 60,
    }));

    logSecurityEvent({
      type: "login",
      details: "Session extended",
      timestamp: new Date(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.sessionTimeout]);

  const logout = useCallback(() => {
    handleLogout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logSecurityEvent({
      type: "logout",
      timestamp: new Date(),
    });

    // Clear session data
    localStorage.removeItem("guardrail-session");
    localStorage.removeItem("guardrail-user-token");

    // Redirect to login
    window.location.href = "/login";
  };

  const logSecurityEvent = useCallback(
    (event: SecurityEvent) => {
      if (!settings.auditLogging) return;

      // Add additional context
      const enrichedEvent: SecurityEvent = {
        ...event,
        ipAddress: getClientIP(),
        userAgent: navigator.userAgent,
      };

      // Send to logging service
      sendSecurityLog(enrichedEvent);
    },
    [settings.auditLogging],
  );

  return (
    <SecurityContext.Provider
      value={{
        settings,
        updateSettings,
        sessionInfo,
        extendSession,
        logout,
        logSecurityEvent,
      }}
    >
      {children}

      {/* Session timeout warning */}
      {sessionInfo.isActive && sessionInfo.timeRemaining < 300 && (
        <SessionWarning
          timeRemaining={sessionInfo.timeRemaining}
          onExtend={extendSession}
          onLogout={logout}
        />
      )}
    </SecurityContext.Provider>
  );
}

// Hook to use security
export function useSecurity() {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error("useSecurity must be used within a SecurityProvider");
  }
  return context;
}

// Session Warning Component
function SessionWarning({
  timeRemaining,
  onExtend,
  onLogout,
}: {
  timeRemaining: number;
  onExtend: () => void;
  onLogout: () => void;
}) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-amber-950/90 border border-amber-800/50 rounded-lg p-4 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-amber-500 rounded-full animate-pulse flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-amber-400 font-medium mb-1">
              Session Expiring Soon
            </h4>
            <p className="text-amber-300 text-sm mb-3">
              Your session will expire in {minutes}:
              {seconds.toString().padStart(2, "0")}.
              {minutes < 5 && " Please save your work."}
            </p>
            <div className="flex gap-2">
              <button
                onClick={onExtend}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg transition-colors"
              >
                Extend Session
              </button>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded-lg transition-colors"
              >
                Logout Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Data Masking Hook
export function useDataMasking() {
  const { settings } = useSecurity();

  const maskData = useCallback(
    (data: any): any => {
      if (!settings.dataMasking) return data;

      if (typeof data === "string") {
        return maskString(data);
      }

      if (typeof data === "object" && data !== null) {
        return maskObject(data);
      }

      return data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.dataMasking],
  );

  const maskString = (str: string): string => {
    // Mask emails
    if (str.includes("@")) {
      const [username, domain] = str.split("@");
      const maskedUsername =
        username.slice(0, 2) + "*".repeat(username.length - 2);
      return `${maskedUsername}@${domain}`;
    }

    // Mask phone numbers
    if (/^\+?[\d\s-()]+$/.test(str)) {
      return str.slice(0, -4) + "*".repeat(4);
    }

    // Mask credit card numbers
    if (
      /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(str.replace(/\s/g, ""))
    ) {
      return str.slice(0, 4) + "*".repeat(str.length - 8) + str.slice(-4);
    }

    // Mask long strings
    if (str.length > 10) {
      return str.slice(0, 3) + "*".repeat(str.length - 6) + str.slice(-3);
    }

    return str;
  };

  const maskObject = (obj: any): any => {
    const sensitiveKeys = [
      "password",
      "token",
      "secret",
      "key",
      "creditCard",
      "ssn",
    ];

    if (Array.isArray(obj)) {
      return obj.map((item) => maskData(item));
    }

    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = sensitiveKeys.some((sensitive) =>
        key.toLowerCase().includes(sensitive),
      );

      if (isSensitive && typeof value === "string") {
        masked[key] = "*".repeat(Math.min(value.length, 8));
      } else {
        masked[key] = maskData(value);
      }
    }

    return masked;
  };

  return { maskData };
}

// CSRF Protection Hook
export function useCSRFProtection() {
  const { settings } = useSecurity();

  const getCSRFToken = useCallback((): string => {
    if (!settings.csrfProtection) return "";

    let token = document
      .querySelector('meta[name="csrf-token"]')
      ?.getAttribute("content");
    if (!token) {
      token = generateCSRFToken();
      // Store token using safe DOM manipulation to prevent XSS
      const meta = safeCreateMeta("csrf-token", token);
      document.head.appendChild(meta);
    }
    return token;
  }, [settings.csrfProtection]);

  const generateCSRFToken = (): string => {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  return { getCSRFToken };
}

// Rate Limiting Hook
export function useRateLimiting() {
  const { settings } = useSecurity();
  const requestCounts = useRef<Map<string, number[]>>(new Map());

  const checkRateLimit = useCallback(
    (key: string, limit: number, windowMs: number): boolean => {
      if (!settings.rateLimiting) return true;

      const now = Date.now();
      const windowStart = now - windowMs;

      const requests = requestCounts.current.get(key) || [];
      const recentRequests = requests.filter(
        (timestamp: number) => timestamp > windowStart,
      );

      if (recentRequests.length >= limit) {
        return false; // Rate limited
      }

      recentRequests.push(now);
      requestCounts.current.set(key, recentRequests);
      return true;
    },
    [settings.rateLimiting],
  );

  return { checkRateLimit };
}

// Helper functions
function getClientIP(): string {
  // In a real implementation, this would come from the server
  return "unknown";
}

function sendSecurityLog(event: SecurityEvent) {
  // In a real implementation, this would send to a logging service
  // Only log in development to avoid exposing sensitive data in production
  if (process.env.NODE_ENV === "development") {
    logger.debug("Security event", { event });
  }

  // Store in localStorage for demo
  try {
    const logs = JSON.parse(
      localStorage.getItem("guardrail-security-logs") || "[]",
    );
    logs.push(event);
    localStorage.setItem(
      "guardrail-security-logs",
      JSON.stringify(logs.slice(-100)),
    ); // Keep last 100
  } catch (error) {
    logger.error("Failed to store security log", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      component: "SecurityProvider"
    });
  }
}

// Security Settings Panel
export function SecuritySettingsPanel() {
  const { settings, updateSettings, sessionInfo } = useSecurity();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-white mb-3">
          Session Management
        </h3>
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <label className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">Session Timeout</div>
                <div className="text-sm text-zinc-400">
                  Current: {settings.sessionTimeout} minutes
                </div>
              </div>
              <select
                value={settings.sessionTimeout}
                onChange={(e) =>
                  updateSettings({ sessionTimeout: Number(e.target.value) })
                }
                className="px-3 py-1 bg-zinc-800 border border-zinc-600 rounded text-white"
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={120}>2 hours</option>
              </select>
            </label>
          </div>

          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">
                Require Re-authentication
              </div>
              <div className="text-sm text-zinc-400">
                Ask for password on sensitive actions
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.requireReauth}
              onChange={(e) =>
                updateSettings({ requireReauth: e.target.checked })
              }
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-white mb-3">
          Privacy & Security
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">Audit Logging</div>
              <div className="text-sm text-zinc-400">
                Log security events and actions
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.auditLogging}
              onChange={(e) =>
                updateSettings({ auditLogging: e.target.checked })
              }
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">Data Masking</div>
              <div className="text-sm text-zinc-400">
                Mask sensitive data in logs
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.dataMasking}
              onChange={(e) =>
                updateSettings({ dataMasking: e.target.checked })
              }
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
            <div>
              <div className="text-white font-medium">Rate Limiting</div>
              <div className="text-sm text-zinc-400">
                Prevent abuse and attacks
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.rateLimiting}
              onChange={(e) =>
                updateSettings({ rateLimiting: e.target.checked })
              }
              className="w-4 h-4 text-blue-500 bg-zinc-700 border-zinc-600 rounded"
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-white mb-3">Current Session</h3>
        <div className="p-3 rounded-lg border border-zinc-700 bg-zinc-900/50">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Status:</span>
              <span
                className={
                  sessionInfo.isActive ? "text-green-400" : "text-red-400"
                }
              >
                {sessionInfo.isActive ? "Active" : "Expired"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Time Remaining:</span>
              <span className="text-white">
                {Math.floor(sessionInfo.timeRemaining / 60)}:
                {(sessionInfo.timeRemaining % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Last Activity:</span>
              <span className="text-white">
                {sessionInfo.lastActivity.toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
