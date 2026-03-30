"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface RouteContextType {
  currentRoute: string;
  navigate: (path: string) => void;
}

const RouteContext = createContext<RouteContextType | undefined>(undefined);

export function RouteProvider({ children }: { children: ReactNode }) {
  const [currentRoute, setCurrentRoute] = useState("/dashboard");

  const navigate = (path: string) => {
    setCurrentRoute(path);
  };

  return (
    <RouteContext.Provider value={{ currentRoute, navigate }}>
      {children}
    </RouteContext.Provider>
  );
}

export function useRoute() {
  const context = useContext(RouteContext);
  if (context === undefined) {
    throw new Error("useRoute must be used within a RouteProvider");
  }
  return context;
}
