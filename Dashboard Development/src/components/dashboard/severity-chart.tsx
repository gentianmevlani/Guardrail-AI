"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Shield } from "lucide-react";

export function SeverityChart() {
  const data = [
    { name: "Critical", value: 3, color: "#ef4444" },
    { name: "High", value: 8, color: "#f97316" },
    { name: "Medium", value: 15, color: "#eab308" },
    { name: "Low", value: 24, color: "#3b82f6" },
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Shield className="w-4 h-4 text-blue-400" />
          Vulnerability Severity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0];
                    return (
                      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 shadow-sm">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] uppercase text-zinc-500">
                            {data.name}
                          </span>
                          <span className="font-bold text-white">
                            {data.value} issues
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {((data.value as number / total) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs text-zinc-400">{item.name}</span>
                <span className="text-xs font-semibold text-white">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}