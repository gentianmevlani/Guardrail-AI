"use client";

import { ErrorBoundary } from "@/components/dashboard/error-boundary";
import { Header } from "@/components/dashboard/header";
import { Sidebar } from "@/components/dashboard/sidebar";
import { SimpleOnboardingWizard } from "@/components/onboarding/SimpleOnboardingWizard";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { CommandPalette } from "@/components/ui/command-palette";
import { DotShaderBackground } from "@/components/ui/dot-shader-background";
import { MobileNavigation } from "@/components/ui/navigation/mobile-navigation";
import { AuthProvider } from "@/context/auth-context";
import { DashboardProvider } from "@/context/dashboard-context";
import { GitHubProvider } from "@/context/github-context";
import { RepositoryProvider } from "@/context/repository-context";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const SETUP_STORAGE_KEY = "guardrail_setup_complete";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const setupStatus = localStorage.getItem(SETUP_STORAGE_KEY);
    // Show wizard if not completed or skipped (also handle legacy "true" value)
    if (
      setupStatus !== "completed" &&
      setupStatus !== "skipped" &&
      setupStatus !== "true"
    ) {
      setShowSetupWizard(true);
    }
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <GitHubProvider>
          <RepositoryProvider>
            <DashboardProvider autoRefresh={true} refreshInterval={60000}>
              <DotShaderBackground
                dotColor="#20b2aa"
                bgColor="#0d0f12"
                dotOpacity={0.06}
                gridSize={32}
                animated={true}
              />
              {/* Mobile Navigation */}
              <MobileNavigation />
              <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
                <Sidebar />
                <div className="flex flex-col">
                  <Header />
                  <main
                    id="main-content"
                    role="main"
                    aria-label="Main content"
                    className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6"
                  >
                    <Breadcrumbs />
                    <ErrorBoundary>{children}</ErrorBoundary>
                  </main>
                </div>
              </div>
              <CommandPalette />
              {mounted && (
                <SimpleOnboardingWizard
                  isOpen={showSetupWizard}
                  onClose={() => {
                    setShowSetupWizard(false);
                    localStorage.setItem(SETUP_STORAGE_KEY, "completed");
                  }}
                />
              )}
            </DashboardProvider>
          </RepositoryProvider>
        </GitHubProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
