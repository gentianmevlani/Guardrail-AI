"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { fetchHealthScore } from "@/lib/api";
import { logger } from "@/lib/logger";
import { BarChart3, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DataPoint {
  time: string;
  score: number;
}

export function HealthGraph() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHealthScore() {
      try {
        const healthData = await fetchHealthScore();
        if (healthData) {
          setCurrentScore(healthData.overall);
          const newTime = new Date();
          const timeString = `${newTime.getHours().toString().padStart(2, "0")}:${newTime.getMinutes().toString().padStart(2, "0")}`;
          setData((prev) => {
            const newData = [
              ...prev,
              { time: timeString, score: healthData.overall },
            ];
            return newData.slice(-7);
          });
        }
      } catch (error) {
        logger.error("Failed to load health score", error);
      } finally {
        setLoading(false);
      }
    }

    loadHealthScore();

    const interval = setInterval(loadHealthScore, 30000);
    return () => clearInterval(interval);
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="h-[300px] w-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="h-[300px] w-full flex flex-col items-center justify-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mb-4 text-muted-foreground/70" />
          <p className="text-lg font-medium">No health data available yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Data will appear here once security scans are performed
          </p>
        </div>
      );
    }

    return (
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="hsl(var(--primary))"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="rounded-lg border bg-card p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-muted-foreground">
                            Score
                          </span>
                          <span className="font-bold text-primary">
                            {payload[0].value}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Area
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorScore)"
              isAnimationActive={true}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <Card className="col-span-4 bg-card/40 border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-foreground">Security Health Score</CardTitle>
        <CardDescription className="text-muted-foreground">
          Real-time security posture assessment (Live Updates).
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-2">{renderContent()}</CardContent>
    </Card>
  );
}
