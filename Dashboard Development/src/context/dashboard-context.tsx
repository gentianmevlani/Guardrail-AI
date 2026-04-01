import React, { createContext, useContext, useState, useEffect } from "react";

export interface AppNotification {
  id: string;
  type: "security" | "compliance" | "billing" | "system";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface NotificationsData {
  notifications: AppNotification[];
  unreadCount: number;
}

interface SecuritySummary {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalFindings: number;
}

interface DashboardSummary {
  security: SecuritySummary;
  healthScore: number;
  lastScanDate: string;
}

interface DashboardContextValue {
  notifications: NotificationsData;
  isLoading: boolean;
  markAsRead: (ids: string[]) => Promise<void>;
  summary: DashboardSummary | null;
  findings: any[];
  lastUpdated: string;
  isScanning: boolean;
}

const DashboardContext = createContext<DashboardContextValue | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationsData>({
    notifications: [
      {
        id: "1",
        type: "security",
        title: "Critical vulnerability detected",
        message: "SQL injection vulnerability found in user authentication module",
        createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
        read: false,
      },
      {
        id: "2",
        type: "compliance",
        title: "Compliance check passed",
        message: "Your repository passed all SOC 2 compliance checks",
        createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        read: false,
      },
      {
        id: "3",
        type: "system",
        title: "Scan completed",
        message: "Full security scan completed for acme/frontend",
        createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        read: true,
      },
    ],
    unreadCount: 2,
  });

  const [summary] = useState<DashboardSummary>({
    security: {
      criticalCount: 2,
      highCount: 5,
      mediumCount: 12,
      lowCount: 8,
      totalFindings: 27,
    },
    healthScore: 78,
    lastScanDate: new Date().toISOString(),
  });

  const [findings] = useState<any[]>([]);
  const [isLoading] = useState(false);
  const [isScanning] = useState(false);
  const [lastUpdated] = useState(new Date().toISOString());

  const markAsRead = async (ids: string[]) => {
    setNotifications((prev) => {
      const updatedNotifications = prev.notifications.map((notif) =>
        ids.includes(notif.id) ? { ...notif, read: true } : notif
      );
      const unreadCount = updatedNotifications.filter((n) => !n.read).length;
      return {
        notifications: updatedNotifications,
        unreadCount,
      };
    });
  };

  return (
    <DashboardContext.Provider
      value={{
        notifications,
        isLoading,
        markAsRead,
        summary,
        findings,
        lastUpdated,
        isScanning,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboardContext() {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error("useDashboardContext must be used within DashboardProvider");
  }
  return context;
}
