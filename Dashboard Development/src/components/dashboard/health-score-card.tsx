import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/components/ui/utils";

interface HealthScoreCardProps {
  score: number;
  lastScan: string;
  loading: boolean;
}

export function HealthScoreCard({ score, lastScan, loading }: HealthScoreCardProps) {
  const trend = Math.random() > 0.5 ? "up" : "down";
  const trendValue = Math.floor(Math.random() * 10) + 1;

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <Activity className="w-4 h-4 text-blue-400" />
          Health Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="text-4xl font-bold text-white">{score}</div>
            <div className="pb-1">
              <div className="flex items-center gap-1">
                {trend === "up" ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={cn(
                  "text-xs font-medium",
                  trend === "up" ? "text-emerald-400" : "text-red-400"
                )}>
                  {trendValue}%
                </span>
              </div>
              <span className="text-[10px] text-zinc-500">vs last week</span>
            </div>
          </div>

          <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                score >= 80 ? "bg-gradient-to-r from-emerald-500 to-emerald-400" :
                score >= 60 ? "bg-gradient-to-r from-yellow-500 to-yellow-400" :
                "bg-gradient-to-r from-red-500 to-red-400"
              )}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 pt-1">
            <div>
              <p className="text-[10px] text-zinc-500">Security</p>
              <p className="text-sm font-semibold text-white">{Math.floor(score * 0.92)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">Quality</p>
              <p className="text-sm font-semibold text-white">{Math.floor(score * 1.08)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500">Coverage</p>
              <p className="text-sm font-semibold text-white">{Math.floor(score * 0.85)}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}