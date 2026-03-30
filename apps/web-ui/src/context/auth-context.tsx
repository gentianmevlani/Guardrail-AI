"use client";

import { refreshAccessToken, setAccessToken } from "@/lib/api/core";
import {
  getDevBypassUser,
  isDevAuthBypassEnabled,
  isDevBypassUserId,
} from "@/lib/dev-auth";
import { logger } from "@/lib/logger";
import type { PaidTier } from "@/lib/tier-gates";
import { useRouter } from "next/navigation";
import React, {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

export type UserTier = "free" | "starter" | "pro" | "compliance";

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  role?: string;
  subscription: {
    plan: UserTier;
    status: "active" | "trialing" | "past_due" | "canceled" | "none";
    currentPeriodEnd?: string;
    trialEndsAt?: string;
  };
  apiKey?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPaid: boolean;
  tier: UserTier;
  accessToken: string | null;

  login: () => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;

  subscribe: (
    plan: PaidTier,
  ) => Promise<{ success: boolean; checkoutUrl?: string; error?: string }>;
  generateApiKey: () => Promise<{
    success: boolean;
    apiKey?: string;
    error?: string;
  }>;
  revokeApiKey: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Use relative URLs for auth endpoints since they're in the web-ui app
const API_BASE = "";

// Token refresh interval (14 minutes - tokens expire in 15)
const TOKEN_REFRESH_INTERVAL = 14 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isAuthenticated = !!user;
  const isPaid =
    user?.subscription?.status === "active" ||
    user?.subscription?.status === "trialing" ||
    false;

  // Get user's tier from subscription, default to free
  const tier: UserTier = user?.subscription?.plan || "free";

  // Sync access token with core module
  useEffect(() => {
    setAccessToken(accessToken);
  }, [accessToken]);

  // Set up token refresh interval
  useEffect(() => {
    if (isDevAuthBypassEnabled()) return;
    if (isAuthenticated && !refreshIntervalRef.current) {
      refreshIntervalRef.current = setInterval(async () => {
        const newToken = await refreshAccessToken();
        if (newToken) {
          setAccessTokenState(newToken);
        } else {
          // Refresh failed, user needs to re-login
          setUser(null);
          setAccessTokenState(null);
        }
      }, TOKEN_REFRESH_INTERVAL);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (isDevAuthBypassEnabled()) {
      setUser(getDevBypassUser() as User);
      setIsLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/auth/user`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const transformedUser: User = {
            id: data.id,
            email: data.email || "",
            name:
              data.firstName && data.lastName
                ? `${data.firstName} ${data.lastName}`
                : data.email || "User",
            firstName: data.firstName,
            lastName: data.lastName,
            avatar: data.profileImageUrl,
            profileImageUrl: data.profileImageUrl,
            subscription: {
              plan: data.subscription?.plan || "free",
              status: data.subscription?.status || "none",
            },
            createdAt: data.createdAt || new Date().toISOString(),
          };
          setUser(transformedUser);

          // If we got an access token, store it
          if (data.accessToken) {
            setAccessTokenState(data.accessToken);
          }
        }
      }
    } catch (error) {
      logger.debug("Auth check failed");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    if (isDevAuthBypassEnabled()) return true;
    try {
      const newToken = await refreshAccessToken();
      if (newToken) {
        setAccessTokenState(newToken);
        return true;
      }
      return false;
    } catch (error) {
      logger.debug("Session refresh failed");
      return false;
    }
  };

  const login = () => {
    window.location.href = "/";
  };

  const logout = async () => {
    try {
      if (!isDevBypassUserId(user?.id)) {
        await fetch(`${API_BASE}/api/auth/logout`, {
          method: "POST",
          credentials: "include",
        });
      }
      setUser(null);
      setAccessTokenState(null);
      setAccessToken(null);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      window.location.href = "/";
    } catch (error) {
      logger.error("Logout failed:", error);
      window.location.href = "/";
    }
  };

  const subscribe = async (plan: PaidTier) => {
    try {
      const res = await fetch(`${API_BASE}/api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          tierId: plan,
          email: user?.email,
          userId: user?.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.preview) {
          return {
            success: false,
            error:
              data.message ||
              "Stripe is not configured. Please set up Stripe price IDs.",
          };
        }
        return {
          success: false,
          error: data.error || "Failed to create checkout session",
        };
      }

      if (data.url) {
        return { success: true, checkoutUrl: data.url };
      }

      return { success: false, error: "No checkout URL returned" };
    } catch (error) {
      logger.error("Subscribe error:", error);
      return { success: false, error: "Failed to connect to checkout service" };
    }
  };

  const generateApiKey = async () => {
    if (!isPaid) {
      return { success: false, error: "API keys require a paid subscription" };
    }

    try {
      const res = await fetch("/api/keys/generate", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || "Failed to generate API key",
        };
      }

      const data = await res.json();
      const apiKey = data.apiKey;

      setUser((prev) => (prev ? { ...prev, apiKey } : null));
      return { success: true, apiKey };
    } catch (error) {
      logger.error("API key generation failed:", error);
      return { success: false, error: "Failed to generate API key" };
    }
  };

  const revokeApiKey = async () => {
    setUser((prev) => (prev ? { ...prev, apiKey: undefined } : null));
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        isPaid,
        tier,
        accessToken,
        login,
        logout,
        refreshSession,
        subscribe,
        generateApiKey,
        revokeApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
