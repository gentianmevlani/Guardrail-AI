import { Card, CardContent } from "@/components/ui/card";
import { Shield, Bug, Target, Code } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface Stat {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  color: string;
}

export function StatsGrid() {
  const stats: Stat[] = [
    {
      label: "Total Scans",
      value: "1,247",
      icon: <Target className="w-5 h-5" />,
      trend: 12,
      color: "blue",
    },
    {
      label: "Vulnerabilities Fixed",
      value: "342",
      icon: <Shield className="w-5 h-5" />,
      trend: 8,
      color: "emerald",
    },
    {
      label: "Active Issues",
      value: "23",
      icon: <Bug className="w-5 h-5" />,
      trend: -15,
      color: "yellow",
    },
    {
      label: "Code Quality",
      value: "94%",
      icon: <Code className="w-5 h-5" />,
      trend: 5,
      color: "purple",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      blue: { bg: "bg-blue-500/20", text: "text-blue-400", border: "border-blue-500/30" },
      emerald: { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30" },
      yellow: { bg: "bg-yellow-500/20", text: "text-yellow-400", border: "border-yellow-500/30" },
      purple: { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30" },
    };
    return colors[color];
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const colors = getColorClasses(stat.color);
        return (
          <Card key={stat.label} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-all duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-lg", colors.bg)}>
                  <div className={colors.text}>{stat.icon}</div>
                </div>
                {stat.trend && (
                  <span className={cn(
                    "text-xs font-medium",
                    stat.trend > 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {stat.trend > 0 ? "+" : ""}{stat.trend}%
                  </span>
                )}
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}