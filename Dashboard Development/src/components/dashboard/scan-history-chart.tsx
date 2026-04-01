import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export function ScanHistoryChart() {
  const data = [
    { day: "Mon", scans: 12, issues: 3 },
    { day: "Tue", scans: 18, issues: 5 },
    { day: "Wed", scans: 15, issues: 2 },
    { day: "Thu", scans: 22, issues: 7 },
    { day: "Fri", scans: 19, issues: 4 },
    { day: "Sat", scans: 8, issues: 1 },
    { day: "Sun", scans: 6, issues: 0 },
  ];

  const maxScans = Math.max(...data.map(d => d.scans));

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white flex items-center gap-2 text-base">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          Weekly Scan Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {data.map((item) => (
            <div key={item.day} className="flex items-center gap-3">
              <div className="w-10 text-xs text-zinc-400">{item.day}</div>
              <div className="flex-1 flex gap-2">
                <div className="flex-1 relative h-6 bg-zinc-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded transition-all duration-500"
                    style={{ width: `${(item.scans / maxScans) * 100}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium text-white">
                    {item.scans}
                  </span>
                </div>
                {item.issues > 0 && (
                  <div className="w-12 h-6 bg-red-500/20 border border-red-500/30 rounded flex items-center justify-center text-[10px] font-medium text-red-400">
                    {item.issues}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}