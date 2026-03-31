"use client";

import { ErrorBoundary } from "@/components/dashboard/error-boundary";
import { CyberHeader } from "@/components/dashboard/cyber-header";
import { CyberSidebar } from "@/components/dashboard/cyber-sidebar";
import { SimpleOnboardingWizard } from "@/components/onboarding/SimpleOnboardingWizard";
import { CommandPalette } from "@/components/ui/command-palette";
import { MobileNavigation } from "@/components/ui/navigation/mobile-navigation";
import { AuthProvider } from "@/context/auth-context";
import { DashboardProvider } from "@/context/dashboard-context";
import { GitHubProvider } from "@/context/github-context";
import { RepositoryProvider } from "@/context/repository-context";
import { useEffect, useState } from "react";

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
              {/* Mobile Navigation */}
              <MobileNavigation />

              {/* Cyber Top Nav */}
              <CyberHeader />

              <div className="flex min-h-[calc(100vh-3.5rem)]">
                {/* Cyber Side Nav */}
                <CyberSidebar />

                {/* Main Content */}
                <main
                  id="main-content"
                  role="main"
                  aria-label="Main content"
                  className="flex-1 p-6 lg:p-10 space-y-8 overflow-y-auto"
                >
                  <ErrorBoundary>{children}</ErrorBoundary>
                </main>
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
