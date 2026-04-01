"use client";

import { logger } from "@/lib/logger";
import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, BarChart3 } from "lucide-react";
import { fetchHealthScore, type HealthScore } from "@/lib/api";

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
        logger.error('Failed to load health score', error);
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
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div className="h-[300px] w-full flex flex-col items-center justify-center text-zinc-500">
          <BarChart3 className="h-12 w-12 mb-4 text-zinc-600" />
          <p className="text-lg font-medium">No health data available yet</p>
          <p className="text-sm text-zinc-600 mt-1">
            Data will appear here once security scans are performed
          </p>
        </div>
      );
    }

    return (
      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              stroke="#52525b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#52525b"
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
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <span className="text-[0.70rem] uppercase text-zinc-500">
                            Score
                          </span>
                          <span className="font-bold text-blue-400">
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
              stroke="#3b82f6"
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
    <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Security Health Score
        </CardTitle>
        <CardDescription className="text-zinc-400 text-xs">
          Real-time security posture assessment
        </CardDescription>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}