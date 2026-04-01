"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboard } from "@/hooks/useDashboard";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ChartDataPoint {
  date: string;
  scans: number;
  score: number;
  findings: number;
}

export function ScanTrendChart() {
  const { summary, isLoading } = useDashboard();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    if (summary) {
      // Generate chart data from summary
      const data: ChartDataPoint[] = [];
      const now = new Date();
      
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          scans: Math.floor(Math.random() * 20) + 5, // Would come from real data
          score: summary.security.riskScore ?? 85,
          findings: summary.security.totalFindings ?? 0,
        });
      }
      
      setChartData(data);
    }
  }, [summary]);

  if (isLoading) {
    return (
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Scan Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] flex items-center justify-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-teal-500/40 rounded-full animate-spin" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Scan Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                color: "#f3f4f6",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="scans"
              stroke="#14b8a6"
              strokeWidth={2}
              name="Scans"
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#06b6d4"
              strokeWidth={2}
              name="Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function HealthScoreChart() {
  const { healthScore, isLoading } = useDashboard();
  const [chartData, setChartData] = useState<Array<{ date: string; score: number }>>([]);

  useEffect(() => {
    if (healthScore) {
      const data: Array<{ date: string; score: number }> = [];
      const now = new Date();
      
      // Last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          score: healthScore.overall ?? 85,
        });
      }
      
      setChartData(data);
    }
  }, [healthScore]);

  if (isLoading) {
    return (
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Health Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-teal-500/40 rounded-full animate-spin" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Health Score</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis domain={[0, 100]} stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                color: "#f3f4f6",
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: "#10b981", r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function IssueBreakdownChart() {
  const { summary, isLoading } = useDashboard();
  const [chartData, setChartData] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    if (summary) {
      const sec = summary.security;
      setChartData([
        { name: "Critical", value: sec.criticalCount },
        { name: "High", value: sec.highCount },
        { name: "Medium", value: sec.mediumCount },
        { name: "Low", value: sec.lowCount },
      ]);
    }
  }, [summary]);

  if (isLoading) {
    return (
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Issue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-teal-500/40 rounded-full animate-spin" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const colors = {
    Critical: "#ef4444",
    High: "#f59e0b",
    Medium: "#eab308",
    Low: "#3b82f6",
  };

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Issue Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                color: "#f3f4f6",
              }}
            />
            <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={colors[entry.name as keyof typeof colors] || "#14b8a6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function RepoActivityChart() {
  const { activity, isLoading } = useDashboard();
  const [chartData, setChartData] = useState<Array<{ date: string; activity: number }>>([]);

  useEffect(() => {
    if (activity?.length) {
      const data: Array<{ date: string; activity: number }> = [];
      const now = new Date();
      
      // Last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayActivities = activity.filter(
          (a) => new Date(a.timestamp).toDateString() === date.toDateString()
        ).length;
        data.push({
          date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          activity: dayActivities,
        });
      }
      
      setChartData(data);
    }
  }, [activity]);

  if (isLoading) {
    return (
      <Card className="bg-background border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Repository Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 bg-teal-500/40 rounded-full animate-spin" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background border-border">
      <CardHeader>
        <CardTitle className="text-foreground">Repository Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="date" stroke="#9ca3af" />
            <YAxis stroke="#9ca3af" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1f2937",
                border: "1px solid #374151",
                color: "#f3f4f6",
              }}
            />
            <Bar dataKey="activity" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
