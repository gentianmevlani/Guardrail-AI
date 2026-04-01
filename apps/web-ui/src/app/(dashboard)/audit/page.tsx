"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchAuditLogs } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  Filter,
  Loader2,
  Lock,
  Plus,
  Search,
  Settings,
  Shield,
  Unlock,
  User,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  category:
    | "policy"
    | "allowlist"
    | "suppression"
    | "override"
    | "settings"
    | "access";
  user: string;
  resource: string;
  details: string;
  before?: string;
  after?: string;
  reason?: string;
  immutable: boolean;
}

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadAuditLogs() {
      try {
        const logs = await fetchAuditLogs("");
        const mappedEntries: AuditEntry[] = logs.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          action: log.action,
          category: (log.resourceType === "policy"
            ? "policy"
            : log.resourceType === "allowlist"
              ? "allowlist"
              : log.resourceType === "finding"
                ? "suppression"
                : log.resourceType === "override"
                  ? "override"
                  : log.resourceType === "settings"
                    ? "settings"
                    : "access") as AuditEntry["category"],
          user: log.userId,
          resource: log.resource,
          details: log.action,
          before: (log.details as Record<string, unknown>)?.before as
            | string
            | undefined,
          after: (log.details as Record<string, unknown>)?.after as
            | string
            | undefined,
          reason: (log.details as Record<string, unknown>)?.reason as
            | string
            | undefined,
          immutable: true,
        }));
        setEntries(mappedEntries);
      } catch (error) {
        logger.error("Failed to load audit logs", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuditLogs();
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const uniqueUsers = Array.from(new Set(entries.map((e) => e.user)));

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.user.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || entry.category === categoryFilter;

    const matchesUser = userFilter === "all" || entry.user === userFilter;

    return matchesSearch && matchesCategory && matchesUser;
  });

  const getCategoryIcon = (category: AuditEntry["category"]) => {
    switch (category) {
      case "policy":
        return <Shield className="w-4 h-4 text-blue-400" />;
      case "allowlist":
        return <Plus className="w-4 h-4 text-emerald-400" />;
      case "suppression":
        return <XCircle className="w-4 h-4 text-yellow-400" />;
      case "override":
        return <Unlock className="w-4 h-4 text-red-400" />;
      case "settings":
        return <Settings className="w-4 h-4 text-muted-foreground" />;
      case "access":
        return <User className="w-4 h-4 text-purple-400" />;
    }
  };

  const getCategoryBadge = (category: AuditEntry["category"]) => {
    const colors: Record<string, string> = {
      policy: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      allowlist: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      suppression: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      override: "bg-red-500/20 text-red-400 border-red-500/30",
      settings: "bg-muted text-muted-foreground border",
      access: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    return <Badge className={colors[category]}>{category}</Badge>;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-400" />
            Audit Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Immutable record of all policy changes, suppressions, and overrides
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" className="border">
            <Download className="w-4 h-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-xl font-bold text-white">{entries.length}</p>
              </div>
              <ClipboardList className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Policy Changes</p>
                <p className="text-xl font-bold text-blue-400">
                  {entries.filter((e) => e.category === "policy").length}
                </p>
              </div>
              <Shield className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Suppressions</p>
                <p className="text-xl font-bold text-yellow-400">
                  {entries.filter((e) => e.category === "suppression").length}
                </p>
              </div>
              <XCircle className="w-5 h-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overrides</p>
                <p className="text-xl font-bold text-red-400">
                  {entries.filter((e) => e.category === "override").length}
                </p>
              </div>
              <Unlock className="w-5 h-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search actions, resources, users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-card border text-foreground"
                />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border text-foreground/80">
                  <Filter className="w-4 h-4 mr-2" />
                  Category: {categoryFilter === "all" ? "All" : categoryFilter}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-card border">
                <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                  All
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter("policy")}>
                  Policy
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCategoryFilter("allowlist")}
                >
                  Allowlist
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setCategoryFilter("suppression")}
                >
                  Suppression
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter("override")}>
                  Override
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCategoryFilter("settings")}>
                  Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="border text-foreground/80">
                  <User className="w-4 h-4 mr-2" />
                  User:{" "}
                  {userFilter === "all" ? "All" : userFilter.split("@")[0]}
                  <ChevronDown className="w-4 h-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-card border">
                <DropdownMenuItem onClick={() => setUserFilter("all")}>
                  All Users
                </DropdownMenuItem>
                {uniqueUsers.map((user) => (
                  <DropdownMenuItem
                    key={user}
                    onClick={() => setUserFilter(user)}
                  >
                    {user}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Audit Entries</CardTitle>
          <CardDescription className="text-muted-foreground">
            {filteredEntries.length} entries found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium text-foreground/80 mb-2">
                No audit logs yet
              </h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                Audit logs will appear here as policy changes, suppressions, and
                overrides are made in your organization.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Time</TableHead>
                  <TableHead className="text-muted-foreground">
                    Category
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Resource
                  </TableHead>
                  <TableHead className="text-muted-foreground">User</TableHead>
                  <TableHead className="text-muted-foreground">
                    Details
                  </TableHead>
                  <TableHead className="text-muted-foreground"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id} className="border hover:bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {formatTimestamp(entry.timestamp)}
                    </TableCell>
                    <TableCell>{getCategoryBadge(entry.category)}</TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-foreground/90 text-sm max-w-[200px] truncate">
                      {entry.resource}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.user}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[250px]">
                        <p className="text-sm text-muted-foreground truncate">
                          {entry.details}
                        </p>
                        {entry.before && entry.after && (
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            <span className="text-red-400">{entry.before}</span>
                            {" → "}
                            <span className="text-emerald-400">
                              {entry.after}
                            </span>
                          </p>
                        )}
                        {entry.reason && (
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">
                            "{entry.reason}"
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {entry.immutable && (
                          <span title="Immutable">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                        >
                          <Eye className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
