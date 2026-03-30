"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

export function QualityTrendChart() {
  const data = [
    { day: "Mon", quality: 72 },
    { day: "Tue", quality: 75 },
    { day: "Wed", quality: 78 },
    { day: "Thu", quality: 76 },
    { day: "Fri", quality: 82 },
    { day: "Sat", quality: 85 },
    { day: "Sun", quality: 87 },
  ];

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          Code Quality Trend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data}>
              <defs>
                <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
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
                domain={[0, 100]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-sm">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-zinc-500">
                            Quality Score
                          </span>
                          <span className="font-bold text-cyan-400">
                            {payload[0].value}%
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="quality"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: "#06b6d4", strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div>
            <p className="text-[10px] text-zinc-500">Current</p>
            <p className="text-sm font-semibold text-white">87%</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Average</p>
            <p className="text-sm font-semibold text-white">79%</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500">Trend</p>
            <p className="text-sm font-semibold text-emerald-400">+15%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
