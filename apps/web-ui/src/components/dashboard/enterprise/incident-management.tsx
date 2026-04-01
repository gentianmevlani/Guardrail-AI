"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  Filter,
  Link2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  User,
  Users,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

type IncidentStatus = "investigating" | "identified" | "monitoring" | "resolved" | "scheduled";
type IncidentSeverity = "critical" | "major" | "minor" | "maintenance";
type IncidentImpact = "all_systems" | "partial" | "minor" | "none";

interface IncidentUpdate {
  id: string;
  message: string;
  status: IncidentStatus;
  author: {
    name: string;
    avatar?: string;
  };
  timestamp: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  status: IncidentStatus;
  severity: IncidentSeverity;
  impact: IncidentImpact;
  affectedServices: string[];
  startedAt: string;
  resolvedAt?: string;
  estimatedResolution?: string;
  assignees: Array<{ name: string; avatar?: string }>;
  updates: IncidentUpdate[];
  isPublic: boolean;
}

// Mock data
const incidents: Incident[] = [
  {
    id: "INC-2024-001",
    title: "Elevated API Latency in US-East Region",
    description: "We are investigating reports of increased API response times affecting users in the US-East region.",
    status: "monitoring",
    severity: "major",
    impact: "partial",
    affectedServices: ["API Gateway", "Scan Service"],
    startedAt: "2024-01-10T14:30:00Z",
    estimatedResolution: "2024-01-10T18:00:00Z",
    assignees: [
      { name: "John Smith", avatar: "" },
      { name: "Sarah Connor", avatar: "" },
    ],
    updates: [
      {
        id: "1",
        message: "We have identified the root cause as a database connection pool exhaustion. Implementing fix now.",
        status: "identified",
        author: { name: "John Smith" },
        timestamp: "30 minutes ago",
      },
      {
        id: "2",
        message: "Deployed connection pool increase. Monitoring for improvements.",
        status: "monitoring",
        author: { name: "Sarah Connor" },
        timestamp: "15 minutes ago",
      },
    ],
    isPublic: true,
  },
  {
    id: "INC-2024-002",
    title: "Scheduled Maintenance: Database Migration",
    description: "Scheduled database migration to improve performance and reliability. Expected duration: 2 hours.",
    status: "scheduled",
    severity: "maintenance",
    impact: "minor",
    affectedServices: ["Database"],
    startedAt: "2024-01-12T02:00:00Z",
    estimatedResolution: "2024-01-12T04:00:00Z",
    assignees: [{ name: "DevOps Team" }],
    updates: [],
    isPublic: true,
  },
  {
    id: "INC-2023-045",
    title: "Authentication Service Outage",
    description: "Complete authentication service failure affecting all login attempts.",
    status: "resolved",
    severity: "critical",
    impact: "all_systems",
    affectedServices: ["Auth Service", "API Gateway", "Dashboard"],
    startedAt: "2024-01-08T09:15:00Z",
    resolvedAt: "2024-01-08T11:45:00Z",
    assignees: [
      { name: "John Smith" },
      { name: "Mike Johnson" },
      { name: "Emily Davis" },
    ],
    updates: [
      {
        id: "1",
        message: "Investigating reports of failed login attempts.",
        status: "investigating",
        author: { name: "John Smith" },
        timestamp: "Jan 8, 9:20 AM",
      },
      {
        id: "2",
        message: "Root cause identified: Certificate expiration on auth servers.",
        status: "identified",
        author: { name: "Mike Johnson" },
        timestamp: "Jan 8, 10:15 AM",
      },
      {
        id: "3",
        message: "Certificates renewed and services restarted. Monitoring recovery.",
        status: "monitoring",
        author: { name: "Emily Davis" },
        timestamp: "Jan 8, 11:00 AM",
      },
      {
        id: "4",
        message: "All systems operational. Incident resolved.",
        status: "resolved",
        author: { name: "John Smith" },
        timestamp: "Jan 8, 11:45 AM",
      },
    ],
    isPublic: true,
  },
];

const statusConfig: Record<IncidentStatus, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  investigating: { label: "Investigating", color: "text-amber-400", bgColor: "bg-amber-500/10", icon: AlertCircle },
  identified: { label: "Identified", color: "text-blue-400", bgColor: "bg-blue-500/10", icon: Zap },
  monitoring: { label: "Monitoring", color: "text-cyan-400", bgColor: "bg-cyan-500/10", icon: Activity },
  resolved: { label: "Resolved", color: "text-emerald-400", bgColor: "bg-emerald-500/10", icon: CheckCircle },
  scheduled: { label: "Scheduled", color: "text-purple-400", bgColor: "bg-purple-500/10", icon: Calendar },
};

const severityConfig: Record<IncidentSeverity, { label: string; color: string; bgColor: string }> = {
  critical: { label: "Critical", color: "text-red-400", bgColor: "bg-red-500/20" },
  major: { label: "Major", color: "text-amber-400", bgColor: "bg-amber-500/20" },
  minor: { label: "Minor", color: "text-yellow-400", bgColor: "bg-yellow-500/20" },
  maintenance: { label: "Maintenance", color: "text-blue-400", bgColor: "bg-blue-500/20" },
};

const impactConfig: Record<IncidentImpact, { label: string; color: string }> = {
  all_systems: { label: "All Systems Affected", color: "text-red-400" },
  partial: { label: "Partial Impact", color: "text-amber-400" },
  minor: { label: "Minor Impact", color: "text-yellow-400" },
  none: { label: "No Impact", color: "text-emerald-400" },
};

function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge className={cn("gap-1", config.bgColor, config.color, "border-0")}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);
  const severity = severityConfig[incident.severity];
  const impact = impactConfig[incident.impact];

  return (
    <Card className="bg-card border-border hover:border-teal-500/30 transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono text-muted-foreground">{incident.id}</span>
              <IncidentStatusBadge status={incident.status} />
              <Badge className={cn(severity.bgColor, severity.color, "border-0")}>
                {severity.label}
              </Badge>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">{incident.title}</h3>
            <p className="text-sm text-muted-foreground">{incident.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span>Started: {new Date(incident.startedAt).toLocaleString()}</span>
          </div>
          {incident.resolvedAt ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>Resolved: {new Date(incident.resolvedAt).toLocaleString()}</span>
            </div>
          ) : incident.estimatedResolution ? (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>ETA: {new Date(incident.estimatedResolution).toLocaleString()}</span>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-6 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Impact</p>
            <p className={cn("text-sm font-medium", impact.color)}>{impact.label}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Affected Services</p>
            <div className="flex items-center gap-2">
              {incident.affectedServices.map((service) => (
                <Badge key={service} variant="outline" className="text-xs">
                  {service}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Assignees</p>
            <div className="flex -space-x-2">
              {incident.assignees.map((assignee, i) => (
                <Avatar key={i} className="w-6 h-6 border-2 border-charcoal-800">
                  <AvatarImage src={assignee.avatar} />
                  <AvatarFallback className="text-xs bg-teal-500/20 text-teal-400">
                    {assignee.name.split(" ").map((n) => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        </div>

        {incident.updates.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="gap-2 mb-2"
            >
              <MessageSquare className="w-4 h-4" />
              {incident.updates.length} Update{incident.updates.length > 1 ? "s" : ""}
              <ArrowRight className={cn("w-4 h-4 transition-transform", expanded && "rotate-90")} />
            </Button>

            {expanded && (
              <div className="mt-4 border-l-2 border-charcoal-600 pl-4 space-y-4">
                {incident.updates.map((update) => (
                  <div key={update.id} className="relative">
                    <div className="absolute -left-[21px] w-2 h-2 rounded-full bg-teal-500" />
                    <div className="flex items-center gap-2 mb-1">
                      <IncidentStatusBadge status={update.status} />
                      <span className="text-xs text-muted-foreground">{update.timestamp}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{update.message}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">— {update.author.name}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CreateIncidentDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4" />
          Create Incident
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-charcoal-800 border-charcoal-600 max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Create New Incident</DialogTitle>
          <DialogDescription>
            Report a new incident affecting platform services
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Title</label>
            <Input
              placeholder="Brief description of the incident"
              className="bg-charcoal-700 border-charcoal-600"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Description</label>
            <Textarea
              placeholder="Detailed description of what's happening..."
              className="bg-charcoal-700 border-charcoal-600 min-h-[100px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Severity</label>
              <Select>
                <SelectTrigger className="bg-charcoal-700 border-charcoal-600">
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-700 border-charcoal-600">
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Impact</label>
              <Select>
                <SelectTrigger className="bg-charcoal-700 border-charcoal-600">
                  <SelectValue placeholder="Select impact" />
                </SelectTrigger>
                <SelectContent className="bg-charcoal-700 border-charcoal-600">
                  <SelectItem value="all_systems">All Systems</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Affected Services</label>
            <Select>
              <SelectTrigger className="bg-charcoal-700 border-charcoal-600">
                <SelectValue placeholder="Select affected services" />
              </SelectTrigger>
              <SelectContent className="bg-charcoal-700 border-charcoal-600">
                <SelectItem value="api">API Gateway</SelectItem>
                <SelectItem value="auth">Auth Service</SelectItem>
                <SelectItem value="scan">Scan Service</SelectItem>
                <SelectItem value="database">Database</SelectItem>
                <SelectItem value="dashboard">Dashboard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="public" className="rounded border-charcoal-600" />
            <label htmlFor="public" className="text-sm text-muted-foreground">
              Make this incident visible on the public status page
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setOpen(false)}>
            Create Incident
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function IncidentManagement() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    setMounted(true);
  }, []);

  const filteredIncidents = incidents.filter((incident) => {
    const matchesSearch =
      incident.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      incident.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeIncidents = incidents.filter((i) => i.status !== "resolved" && i.status !== "scheduled");
  const scheduledMaintenance = incidents.filter((i) => i.status === "scheduled");

  if (!mounted) {
    return <div className="space-y-6"><Card className="h-96 skeleton bg-charcoal-800/50" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-teal-400" />
            Incident Management
          </h2>
          <p className="text-muted-foreground">Track and manage platform incidents</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="w-4 h-4" />
            Status Page
          </Button>
          <CreateIncidentDialog />
        </div>
      </div>

      {/* Active Incident Alert */}
      {activeIncidents.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-5 h-5 text-amber-400" />
              <p className="text-amber-400">
                <span className="font-medium">{activeIncidents.length} active incident{activeIncidents.length > 1 ? "s" : ""}</span>
                {" "}currently being addressed
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Incidents</p>
                <p className="text-3xl font-bold text-amber-400 mt-1">{activeIncidents.length}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Scheduled</p>
                <p className="text-3xl font-bold text-purple-400 mt-1">{scheduledMaintenance.length}</p>
              </div>
              <div className="p-3 rounded-full bg-purple-500/10">
                <Calendar className="w-6 h-6 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved (30d)</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">12</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Resolution</p>
                <p className="text-3xl font-bold text-white mt-1">2.4h</p>
              </div>
              <div className="p-3 rounded-full bg-teal-500/10">
                <Clock className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search incidents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-charcoal-800 border-charcoal-600"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-charcoal-800 border-charcoal-600">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-800 border-charcoal-600">
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="identified">Identified</SelectItem>
            <SelectItem value="monitoring">Monitoring</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Incident List */}
      <div className="space-y-4">
        {filteredIncidents.map((incident) => (
          <IncidentCard key={incident.id} incident={incident} />
        ))}
      </div>
    </div>
  );
}

export default IncidentManagement;
