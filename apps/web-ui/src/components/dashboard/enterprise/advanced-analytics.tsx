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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Filter,
  GitBranch,
  Globe,
  LineChart,
  PieChart,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
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
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Design system colors
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

// KPI Card Interface
interface KPIData {
  title: string;
  value: string | number;
  change: number;
  trend: "up" | "down" | "neutral";
  description: string;
  icon: React.ElementType;
  color: string;
}

// Mock data generators
const generateTrendData = (days: number) => {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      scans: Math.floor(Math.random() * 100 + 150),
      issues: Math.floor(Math.random() * 30 + 10),
      fixed: Math.floor(Math.random() * 25 + 5),
      score: Math.floor(Math.random() * 15 + 75),
    });
  }
  return data;
};

const generateHourlyData = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    requests: Math.floor(Math.random() * 500 + 100),
    latency: Math.floor(Math.random() * 50 + 20),
    errors: Math.floor(Math.random() * 10),
  }));
};

const severityData = [
  { name: "Critical", value: 8, color: COLORS.accent.red },
  { name: "High", value: 23, color: COLORS.accent.amber },
  { name: "Medium", value: 45, color: COLORS.accent.cyan },
  { name: "Low", value: 67, color: COLORS.teal[500] },
  { name: "Info", value: 32, color: COLORS.charcoal[500] },
];

const categoryData = [
  { name: "Security", value: 35, color: COLORS.accent.red },
  { name: "Authentication", value: 22, color: COLORS.accent.purple },
  { name: "Data Validation", value: 28, color: COLORS.accent.cyan },
  { name: "API Issues", value: 18, color: COLORS.accent.amber },
  { name: "Code Quality", value: 42, color: COLORS.teal[500] },
];

const teamPerformance = [
  { team: "Frontend", scans: 245, issues: 32, fixed: 28, score: 87 },
  { team: "Backend", scans: 312, issues: 45, fixed: 42, score: 82 },
  { team: "DevOps", scans: 156, issues: 18, fixed: 17, score: 94 },
  { team: "Mobile", scans: 89, issues: 12, fixed: 10, score: 88 },
  { team: "Platform", scans: 178, issues: 25, fixed: 23, score: 85 },
];

const topRepositories = [
  { name: "main-app", scans: 156, issues: 12, score: 92, trend: "up" as const },
  { name: "api-gateway", scans: 134, issues: 18, score: 88, trend: "up" as const },
  { name: "auth-service", scans: 98, issues: 8, score: 95, trend: "up" as const },
  { name: "web-client", scans: 87, issues: 22, score: 78, trend: "down" as const },
  { name: "mobile-sdk", scans: 65, issues: 5, score: 96, trend: "up" as const },
];

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-charcoal-800 border border-charcoal-600 rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium text-white mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color || COLORS.teal[400] }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// KPI Card Component
function KPICard({ data }: { data: KPIData }) {
  const Icon = data.icon;
  return (
    <Card className="bg-card border-border hover:border-teal-500/30 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg", data.color)}>
            <Icon className="w-5 h-5" />
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
              data.trend === "up"
                ? "bg-emerald-500/10 text-emerald-400"
                : data.trend === "down"
                ? "bg-red-500/10 text-red-400"
                : "bg-gray-500/10 text-gray-400"
            )}
          >
            {data.trend === "up" ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : data.trend === "down" ? (
              <ArrowDownRight className="w-3 h-3" />
            ) : null}
            {Math.abs(data.change)}%
          </div>
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold text-white">{data.value}</p>
          <p className="text-sm font-medium text-muted-foreground mt-1">{data.title}</p>
          <p className="text-xs text-muted-foreground/70 mt-1">{data.description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// Main Component
export function AdvancedAnalytics() {
  const [mounted, setMounted] = useState(false);
  const [dateRange, setDateRange] = useState("7d");
  const [trendData, setTrendData] = useState<any[]>([]);
  const [hourlyData, setHourlyData] = useState<any[]>([]);

  useEffect(() => {
    setMounted(true);
    const days = dateRange === "7d" ? 7 : dateRange === "14d" ? 14 : 30;
    setTrendData(generateTrendData(days));
    setHourlyData(generateHourlyData());
  }, [dateRange]);

  const kpis: KPIData[] = [
    {
      title: "Total Scans",
      value: "12,847",
      change: 12.5,
      trend: "up",
      description: "This period vs last",
      icon: Activity,
      color: "bg-teal-500/10 text-teal-400",
    },
    {
      title: "Issues Found",
      value: "1,432",
      change: -8.3,
      trend: "down",
      description: "8% fewer than last period",
      icon: Shield,
      color: "bg-amber-500/10 text-amber-400",
    },
    {
      title: "Issues Fixed",
      value: "1,287",
      change: 23.1,
      trend: "up",
      description: "89.9% resolution rate",
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-400",
    },
    {
      title: "Avg Security Score",
      value: "86.4",
      change: 4.2,
      trend: "up",
      description: "Across all repositories",
      icon: Target,
      color: "bg-cyan-500/10 text-cyan-400",
    },
    {
      title: "Active Users",
      value: "342",
      change: 15.8,
      trend: "up",
      description: "Unique users this period",
      icon: Users,
      color: "bg-purple-500/10 text-purple-400",
    },
    {
      title: "Avg Response Time",
      value: "1.2s",
      change: -18.5,
      trend: "down",
      description: "Scan completion time",
      icon: Zap,
      color: "bg-cyan-500/10 text-cyan-400",
    },
  ];

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-36 skeleton bg-charcoal-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-teal-400" />
            Advanced Analytics
          </h2>
          <p className="text-muted-foreground">
            Comprehensive insights and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[150px] bg-charcoal-800 border-charcoal-600">
              <CalendarDays className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-charcoal-800 border-charcoal-600">
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="14d">Last 14 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {kpis.map((kpi) => (
          <KPICard key={kpi.title} data={kpi} />
        ))}
      </div>

      {/* Main Charts */}
      <Tabs defaultValue="trends" className="space-y-6">
        <TabsList className="bg-charcoal-800 border-charcoal-600">
          <TabsTrigger value="trends" className="gap-2">
            <LineChart className="w-4 h-4" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="distribution" className="gap-2">
            <PieChart className="w-4 h-4" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <Users className="w-4 h-4" />
            Teams
          </TabsTrigger>
          <TabsTrigger value="repositories" className="gap-2">
            <GitBranch className="w-4 h-4" />
            Repositories
          </TabsTrigger>
        </TabsList>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <TrendingUp className="w-5 h-5 text-teal-400" />
                  Scan Activity & Security Score
                </CardTitle>
                <CardDescription>Daily scans and overall security health</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scansGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.teal[500]} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={COLORS.teal[500]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.accent.cyan} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.accent.cyan} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.charcoal[600]} vertical={false} />
                      <XAxis dataKey="date" stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="scans" stroke={COLORS.teal[500]} strokeWidth={2} fill="url(#scansGradient)" name="Scans" />
                      <Area type="monotone" dataKey="score" stroke={COLORS.accent.cyan} strokeWidth={2} fill="url(#scoreGradient)" name="Score" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Activity className="w-5 h-5 text-teal-400" />
                  Issues Found vs Fixed
                </CardTitle>
                <CardDescription>Daily issue resolution tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.charcoal[600]} vertical={false} />
                      <XAxis dataKey="date" stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="issues" fill={COLORS.accent.amber} radius={[4, 4, 0, 0]} name="Found" />
                      <Bar dataKey="fixed" fill={COLORS.accent.emerald} radius={[4, 4, 0, 0]} name="Fixed" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Hourly Activity */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Clock className="w-5 h-5 text-teal-400" />
                Hourly Activity Pattern
              </CardTitle>
              <CardDescription>API requests and response times by hour</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.charcoal[600]} vertical={false} />
                    <XAxis dataKey="hour" stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={COLORS.charcoal[500]} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="requests" stroke={COLORS.teal[500]} strokeWidth={2} dot={false} name="Requests" />
                    <Line type="monotone" dataKey="latency" stroke={COLORS.accent.cyan} strokeWidth={2} dot={false} name="Latency (ms)" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Shield className="w-5 h-5 text-teal-400" />
                  Issues by Severity
                </CardTitle>
                <CardDescription>Distribution of findings by severity level</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {severityData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="w-[50%] space-y-3">
                    {severityData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="w-5 h-5 text-teal-400" />
                  Issues by Category
                </CardTitle>
                <CardDescription>Distribution of findings by type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] flex items-center">
                  <ResponsiveContainer width="50%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="w-[50%] space-y-3">
                    {categoryData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-sm text-muted-foreground">{item.name}</span>
                        </div>
                        <span className="text-sm font-medium text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Users className="w-5 h-5 text-teal-400" />
                Team Performance
              </CardTitle>
              <CardDescription>Security metrics by team</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-charcoal-700">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Team</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Scans</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Issues</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Fixed</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Resolution</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPerformance.map((team) => (
                      <tr key={team.team} className="border-b border-charcoal-700/50 hover:bg-charcoal-800/50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-teal-500/10 flex items-center justify-center">
                              <Users className="w-4 h-4 text-teal-400" />
                            </div>
                            <span className="font-medium text-white">{team.team}</span>
                          </div>
                        </td>
                        <td className="text-right py-3 px-4 text-white">{team.scans}</td>
                        <td className="text-right py-3 px-4 text-amber-400">{team.issues}</td>
                        <td className="text-right py-3 px-4 text-emerald-400">{team.fixed}</td>
                        <td className="text-right py-3 px-4">
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            {Math.round((team.fixed / team.issues) * 100)}%
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-charcoal-700 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  team.score >= 90 ? "bg-emerald-500" : team.score >= 80 ? "bg-teal-500" : "bg-amber-500"
                                )}
                                style={{ width: `${team.score}%` }}
                              />
                            </div>
                            <span className="text-white font-medium">{team.score}</span>
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

        {/* Repositories Tab */}
        <TabsContent value="repositories" className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <GitBranch className="w-5 h-5 text-teal-400" />
                Top Repositories
              </CardTitle>
              <CardDescription>Repository health and scan activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topRepositories.map((repo, index) => (
                  <div
                    key={repo.name}
                    className="flex items-center justify-between p-4 bg-charcoal-800/50 rounded-lg border border-charcoal-700 hover:border-teal-500/30 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full bg-charcoal-700 flex items-center justify-center text-sm font-bold text-white">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-white">{repo.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {repo.scans} scans • {repo.issues} issues
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="flex items-center gap-2">
                          {repo.trend === "up" ? (
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-red-400" />
                          )}
                          <span className={cn("text-lg font-bold", repo.score >= 90 ? "text-emerald-400" : repo.score >= 80 ? "text-teal-400" : "text-amber-400")}>
                            {repo.score}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">Security Score</p>
                      </div>
                      <div className="w-24 h-2 bg-charcoal-700 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            repo.score >= 90 ? "bg-emerald-500" : repo.score >= 80 ? "bg-teal-500" : "bg-amber-500"
                          )}
                          style={{ width: `${repo.score}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AdvancedAnalytics;
