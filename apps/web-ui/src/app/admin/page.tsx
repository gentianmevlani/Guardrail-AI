"use client";

/**
 * Admin Dashboard
 *
 * Secure admin dashboard for:
 * - User management and debugging
 * - Impersonation controls
 * - Broadcast email management
 * - Support tools and audit logs
 *
 * SECURITY: Admin-only access with full audit logging
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth-context";
import { logger } from "@/lib/logger";
import {
    Activity,
    AlertTriangle,
    Ban,
    Eye,
    Filter,
    MessageSquare,
    Search,
    Send,
    Shield,
    UserCheck,
    Users
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  recentSignups: number;
  openSupportTickets: number;
  activeImpersonations: number;
  pendingBroadcasts: number;
  systemHealth: "healthy" | "warning" | "error";
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  subscriptionTier?: string;
  lastLoginAt?: string;
  emailVerified?: string | null;
  createdAt: string;
  isActive: boolean;
  flags: {
    isDisabled: boolean;
    requiresMfaReset: boolean;
    hasPendingIssues: boolean;
    subscriptionIssues: boolean;
  };
}

interface ImpersonationSession {
  id: string;
  actorUserId: string;
  targetUserId: string;
  startedAt: string;
  reason: string;
  isActive: boolean;
  actorUser: {
    name: string;
    email: string;
  };
  targetUser: {
    name: string;
    email: string;
  };
}

interface BroadcastJob {
  id: string;
  subject: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  totalRecipients?: number;
  sentCount: number;
  failedCount: number;
  createdBy: string;
}

// =============================================================================
// ADMIN DASHBOARD COMPONENT
// =============================================================================

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activeImpersonations, setActiveImpersonations] = useState<ImpersonationSession[]>([]);
  const [broadcastJobs, setBroadcastJobs] = useState<BroadcastJob[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Load dashboard stats
      const statsResponse = await fetch("/api/v1/admin/dashboard");
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.data);
      }

      // Load active impersonations
      const impersonationsResponse = await fetch("/api/v1/admin/impersonation/active");
      if (impersonationsResponse.ok) {
        const impersonationsData = await impersonationsResponse.json();
        setActiveImpersonations(impersonationsData.data || []);
      }

      // Load recent broadcast jobs
      const broadcastsResponse = await fetch("/api/v1/admin/broadcast?limit=10");
      if (broadcastsResponse.ok) {
        const broadcastsData = await broadcastsResponse.json();
        setBroadcastJobs(broadcastsData.data?.jobs || []);
      }

      // Load recent users
      const usersResponse = await fetch("/api/v1/admin/users?limit=20");
      if (usersResponse.ok) {
        const usersData = await usersResponse.json();
        setUsers(usersData.data?.users || []);
      }
    } catch (error) {
      logger.logUnknownError("Failed to load admin data", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Check admin access and load dashboard
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!user.role || !["admin", "support"].includes(user.role)) {
      router.push("/dashboard");
      return;
    }
    void loadAdminData();
  }, [authLoading, user, router, loadAdminData]);

  // Handle user actions
  const handleUserAction = async (userId: string, action: string, reason?: string) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        // Refresh data
        loadAdminData();
      } else {
        logger.error("Failed to perform user action", {
          body: await response.text(),
        });
      }
    } catch (error) {
      logger.logUnknownError("Failed to perform user action", error);
    }
  };

  // Handle impersonation
  const handleStartImpersonation = async (targetUserId: string, reason: string) => {
    try {
      const response = await fetch("/api/v1/admin/impersonate/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetUserId, reason }),
      });

      if (response.ok) {
        const data = await response.json();
        // Store impersonation token and redirect
        localStorage.setItem("impersonationToken", data.data.impersonationToken);
        window.open(`/dashboard?impersonate=${data.data.impersonationToken}`, "_blank");
      } else {
        logger.error("Failed to start impersonation", {
          body: await response.text(),
        });
      }
    } catch (error) {
      logger.logUnknownError("Failed to start impersonation", error);
    }
  };

  // Filter users based on search
  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user.role || !["admin", "support"].includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="border-yellow-500/20 bg-yellow-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              <p className="text-yellow-400">
                Failed to load admin dashboard. Please refresh the page.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage users, impersonation, and system operations
          </p>
        </div>
        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
          {user.role === "admin" ? "Administrator" : "Support Staff"}
        </Badge>
      </div>

      {/* System Health Alert */}
      {stats.systemHealth !== "healthy" && (
        <Card className="border-red-500/20 bg-red-500/10">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <p className="text-red-400">
                System health is {stats.systemHealth}. Please check system status.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="impersonation">Impersonation</TabsTrigger>
          <TabsTrigger value="broadcast">Broadcast</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.recentSignups} new this week
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeUsers.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {Math.round((stats.activeUsers / stats.totalUsers) * 100)}% of total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Support Tickets</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.openSupportTickets}</div>
                <p className="text-xs text-muted-foreground">
                  Open tickets
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.activeImpersonations}</div>
                <p className="text-xs text-muted-foreground">
                  Impersonation sessions
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Impersonations */}
            <Card>
              <CardHeader>
                <CardTitle>Active Impersonations</CardTitle>
                <CardDescription>
                  Currently active support sessions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeImpersonations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active impersonations</p>
                ) : (
                  <div className="space-y-3">
                    {activeImpersonations.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{session.actorUser.name}</p>
                          <p className="text-sm text-muted-foreground">
                            impersonating {session.targetUser.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Started {new Date(session.startedAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline">Active</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Broadcasts */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Broadcasts</CardTitle>
                <CardDescription>
                  Latest email broadcasts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {broadcastJobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent broadcasts</p>
                ) : (
                  <div className="space-y-3">
                    {broadcastJobs.map((job) => (
                      <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium">{job.subject}</p>
                          <p className="text-sm text-muted-foreground">
                            {job.totalRecipients || 0} recipients
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(job.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge 
                          variant={
                            job.status === "completed" ? "default" :
                            job.status === "failed" ? "destructive" :
                            job.status === "processing" ? "secondary" : "outline"
                          }
                        >
                          {job.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </div>
            <Button>
              <Users className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4">User</th>
                      <th className="text-left p-4">Role</th>
                      <th className="text-left p-4">Plan</th>
                      <th className="text-left p-4">Status</th>
                      <th className="text-left p-4">Last Login</th>
                      <th className="text-left p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="border-b">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{user.name || user.email}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {user.subscriptionTier || "Free"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? "Active" : "Disabled"}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">
                            {user.lastLoginAt 
                              ? new Date(user.lastLoginAt).toLocaleDateString()
                              : "Never"
                            }
                          </p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleStartImpersonation(user.id, "Support investigation")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {user.isActive ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUserAction(user.id, "disable", "Admin action")}
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleUserAction(user.id, "enable", "Admin action")}
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Impersonation Tab */}
        <TabsContent value="impersonation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Impersonation Controls</CardTitle>
              <CardDescription>
                Manage active impersonation sessions and start new ones
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Card className="border-blue-500/20 bg-blue-500/10">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-blue-400" />
                      <p className="text-blue-400">
                        All impersonation actions are logged and audited. Sessions automatically expire after 10 minutes.
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <div className="text-sm text-muted-foreground">
                  Impersonation interface coming soon. Use the Users tab to start impersonation sessions.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Broadcast Tab */}
        <TabsContent value="broadcast" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Broadcast Email System</CardTitle>
              <CardDescription>
                Send emails to all users or specific segments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {stats.pendingBroadcasts} broadcasts pending
                  </p>
                  <Button>
                    <Send className="h-4 w-4 mr-2" />
                    Create Broadcast
                  </Button>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Broadcast interface coming soon.
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Admin Audit Log</CardTitle>
              <CardDescription>
                Complete audit trail of all admin actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                Audit log interface coming soon.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
