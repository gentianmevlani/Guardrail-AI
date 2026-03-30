import React, { createContext, useContext, useState } from "react";

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  isPaid: boolean;
  tier: "free" | "pro" | "enterprise";
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [value] = useState<AuthContextValue>({
    isAuthenticated: true,
    isLoading: false,
    isPaid: false,
    tier: "free",
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
