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
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Crown,
  ExternalLink,
  GitBranch,
  Globe,
  Key,
  Layers,
  Lock,
  Mail,
  MoreHorizontal,
  Plus,
  Settings,
  Shield,
  Star,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = {
  teal: { 500: "hsl(174, 72%, 46%)", 400: "hsl(174, 72%, 52%)" },
  charcoal: { 700: "hsl(220, 13%, 15%)", 600: "hsl(220, 13%, 22%)", 500: "hsl(220, 13%, 30%)" },
  accent: {
    cyan: "hsl(187, 85%, 53%)",
    emerald: "hsl(160, 84%, 39%)",
    amber: "hsl(38, 92%, 50%)",
    red: "hsl(0, 72%, 51%)",
    purple: "hsl(262, 83%, 58%)",
  },
};

interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: "free" | "starter" | "pro" | "compliance";
  logo?: string;
  createdAt: string;
  members: number;
  maxMembers: number;
  projects: number;
  scans: number;
  apiCalls: number;
  securityScore: number;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "owner" | "admin" | "member" | "viewer";
  status: "active" | "pending" | "inactive";
  lastActive: string;
  scansRun: number;
}

interface Team {
  id: string;
  name: string;
  description: string;
  members: number;
  projects: number;
  scansRun: number;
  securityScore: number;
}

// Mock data
const organization: Organization = {
  id: "org_1",
  name: "Acme Corporation",
  slug: "acme-corp",
  tier: "compliance",
  createdAt: "2023-06-15",
  members: 45,
  maxMembers: 100,
  projects: 28,
  scans: 12847,
  apiCalls: 156234,
  securityScore: 87,
};

const members: TeamMember[] = [
  { id: "1", name: "John Smith", email: "john@acme.com", role: "owner", status: "active", lastActive: "Now", scansRun: 245 },
  { id: "2", name: "Sarah Connor", email: "sarah@acme.com", role: "admin", status: "active", lastActive: "2 hours ago", scansRun: 189 },
  { id: "3", name: "Mike Johnson", email: "mike@acme.com", role: "member", status: "active", lastActive: "1 day ago", scansRun: 156 },
  { id: "4", name: "Emily Davis", email: "emily@acme.com", role: "member", status: "active", lastActive: "3 hours ago", scansRun: 134 },
  { id: "5", name: "Alex Wilson", email: "alex@acme.com", role: "viewer", status: "pending", lastActive: "Never", scansRun: 0 },
];

const teams: Team[] = [
  { id: "1", name: "Frontend Team", description: "Web application development", members: 12, projects: 8, scansRun: 4521, securityScore: 92 },
  { id: "2", name: "Backend Team", description: "API and services development", members: 15, projects: 12, scansRun: 5234, securityScore: 85 },
  { id: "3", name: "DevOps", description: "Infrastructure and deployment", members: 8, projects: 6, scansRun: 2156, securityScore: 94 },
  { id: "4", name: "Mobile Team", description: "iOS and Android development", members: 10, projects: 4, scansRun: 1834, securityScore: 88 },
];

const activityData = [
  { date: "Jan 1", scans: 450, members: 42 },
  { date: "Jan 2", scans: 520, members: 43 },
  { date: "Jan 3", scans: 480, members: 43 },
  { date: "Jan 4", scans: 590, members: 44 },
  { date: "Jan 5", scans: 640, members: 44 },
  { date: "Jan 6", scans: 380, members: 44 },
  { date: "Jan 7", scans: 420, members: 45 },
];

const roleDistribution = [
  { role: "Members", count: 35, color: COLORS.teal[500] },
  { role: "Admins", count: 8, color: COLORS.accent.purple },
  { role: "Viewers", count: 2, color: COLORS.accent.cyan },
];

const tierConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  free: { label: "Free", color: "text-gray-400", bgColor: "bg-gray-500/10", icon: Star },
  starter: { label: "Starter", color: "text-purple-400", bgColor: "bg-purple-500/10", icon: TrendingUp },
  pro: { label: "Pro", color: "text-blue-400", bgColor: "bg-blue-500/10", icon: Zap },
  compliance: { label: "Compliance", color: "text-amber-400", bgColor: "bg-amber-500/10", icon: Crown },
};

const roleColors: Record<string, { color: string; bgColor: string }> = {
  owner: { color: "text-amber-400", bgColor: "bg-amber-500/20" },
  admin: { color: "text-purple-400", bgColor: "bg-purple-500/20" },
  member: { color: "text-teal-400", bgColor: "bg-teal-500/20" },
  viewer: { color: "text-gray-400", bgColor: "bg-gray-500/20" },
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-charcoal-800 border border-charcoal-600 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color || COLORS.teal[400] }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function MemberRow({ member }: { member: TeamMember }) {
  const roleStyle = roleColors[member.role];

  return (
    <div className="flex items-center justify-between p-4 bg-charcoal-800/50 rounded-lg border border-charcoal-700 hover:border-teal-500/30 transition-all">
      <div className="flex items-center gap-4">
        <Avatar className="w-10 h-10">
          <AvatarImage src={member.avatar} />
          <AvatarFallback className="bg-teal-500/20 text-teal-400">
            {member.name.split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-white">{member.name}</p>
            {member.status === "pending" && (
              <Badge className="bg-amber-500/20 text-amber-400 border-0 text-xs">Pending</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{member.email}</p>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-sm font-medium text-white">{member.scansRun}</p>
          <p className="text-xs text-muted-foreground">Scans</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">{member.lastActive}</p>
          <p className="text-xs text-muted-foreground">Last active</p>
        </div>
        <Badge className={cn(roleStyle.bgColor, roleStyle.color, "border-0 capitalize")}>
          {member.role}
        </Badge>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function TeamCard({ team }: { team: Team }) {
  return (
    <Card className="bg-card border-border hover:border-teal-500/30 transition-all">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-500/10">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{team.name}</h3>
              <p className="text-sm text-muted-foreground">{team.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-white">{team.members}</p>
            <p className="text-xs text-muted-foreground">Members</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{team.projects}</p>
            <p className="text-xs text-muted-foreground">Projects</p>
          </div>
          <div>
            <p className="text-lg font-bold text-white">{team.scansRun.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Scans</p>
          </div>
          <div>
            <p className={cn(
              "text-lg font-bold",
              team.securityScore >= 90 ? "text-emerald-400" :
              team.securityScore >= 80 ? "text-teal-400" : "text-amber-400"
            )}>
              {team.securityScore}
            </p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrganizationOverview() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tier = tierConfig[organization.tier];
  const TierIcon = tier.icon;
  const memberUsage = (organization.members / organization.maxMembers) * 100;

  if (!mounted) {
    return <div className="space-y-6"><Card className="h-96 skeleton bg-charcoal-800/50" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/30">
            <Building2 className="w-8 h-8 text-teal-400" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-white">{organization.name}</h2>
              <Badge className={cn(tier.bgColor, tier.color, "border-0 gap-1")}>
                <TierIcon className="w-3 h-3" />
                {tier.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">@{organization.slug} • Created {new Date(organization.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {organization.members}/{organization.maxMembers}
                </p>
              </div>
              <div className="p-2 rounded-full bg-teal-500/10">
                <Users className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <Progress value={memberUsage} className="mt-3 h-1" />
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-bold text-white mt-1">{organization.projects}</p>
              </div>
              <div className="p-2 rounded-full bg-purple-500/10">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Scans</p>
                <p className="text-2xl font-bold text-white mt-1">{organization.scans.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-full bg-cyan-500/10">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">API Calls</p>
                <p className="text-2xl font-bold text-white mt-1">{(organization.apiCalls / 1000).toFixed(1)}K</p>
              </div>
              <div className="p-2 rounded-full bg-amber-500/10">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Security Score</p>
                <p className={cn(
                  "text-2xl font-bold mt-1",
                  organization.securityScore >= 90 ? "text-emerald-400" :
                  organization.securityScore >= 80 ? "text-teal-400" : "text-amber-400"
                )}>
                  {organization.securityScore}/100
                </p>
              </div>
              <div className="p-2 rounded-full bg-emerald-500/10">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="members" className="space-y-6">
        <TabsList className="bg-charcoal-800 border-charcoal-600">
          <TabsTrigger value="members" className="gap-2">
            <Users className="w-4 h-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Layers className="w-4 h-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Organization Members</h3>
              <p className="text-sm text-muted-foreground">Manage team members and their permissions</p>
            </div>
            <Button className="gap-2 bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4" />
              Invite Member
            </Button>
          </div>

          <div className="space-y-3">
            {members.map((member) => (
              <MemberRow key={member.id} member={member} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="teams" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">Teams</h3>
              <p className="text-sm text-muted-foreground">Organize members into teams for better collaboration</p>
            </div>
            <Button className="gap-2 bg-teal-600 hover:bg-teal-700">
              <Plus className="w-4 h-4" />
              Create Team
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <TeamCard key={team.id} team={team} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="w-5 h-5 text-teal-400" />
                  Organization Activity
                </CardTitle>
                <CardDescription>Scans and member activity over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <defs>
                        <linearGradient id="scansGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.teal[500]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={COLORS.teal[500]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.charcoal[600]} vertical={false} />
                      <XAxis dataKey="date" stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="scans" stroke={COLORS.teal[500]} strokeWidth={2} fill="url(#scansGradient)" name="Scans" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="w-5 h-5 text-teal-400" />
                  Role Distribution
                </CardTitle>
                <CardDescription>Members by role type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <PieChart>
                      <Pie
                        data={roleDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {roleDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-[50%] space-y-4">
                    {roleDistribution.map((item) => (
                      <div key={item.role} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.role}</span>
                        </div>
                        <span className="text-sm font-medium text-white">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Shield className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">SSO Enabled</h4>
                    <p className="text-xs text-muted-foreground">SAML 2.0 configured</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Lock className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">2FA Required</h4>
                    <p className="text-xs text-muted-foreground">All members must use 2FA</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Enforced
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-500/10">
                    <Key className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">API Key Rotation</h4>
                    <p className="text-xs text-muted-foreground">Automatic 90-day rotation</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-400 border-0">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Configured
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default OrganizationOverview;
