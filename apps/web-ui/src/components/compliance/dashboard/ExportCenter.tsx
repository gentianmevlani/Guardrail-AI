"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  Download,
  File,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";

export type ExportFormat = "json" | "csv" | "pdf";

interface ExportOption {
  format: ExportFormat;
  label: string;
  description: string;
  icon: React.ElementType;
  available: boolean;
}

interface ExportCenterProps {
  projectId: string;
  onExport: (format: ExportFormat) => Promise<void>;
  className?: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    format: "json",
    label: "JSON Export",
    description: "Full compliance data with all details and metadata",
    icon: FileJson,
    available: true,
  },
  {
    format: "csv",
    label: "CSV Export",
    description: "Spreadsheet-compatible format for analysis",
    icon: FileSpreadsheet,
    available: true,
  },
  {
    format: "pdf",
    label: "PDF Report",
    description: "Formatted compliance report for auditors",
    icon: FileText,
    available: false,
  },
];

export function ExportCenter({
  projectId,
  onExport,
  className,
}: ExportCenterProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [lastExport, setLastExport] = useState<{
    format: ExportFormat;
    timestamp: Date;
  } | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setExporting(format);
    try {
      await onExport(format);
      setLastExport({ format, timestamp: new Date() });
    } catch (error) {
      logger.logUnknownError("Export failed", error);
    } finally {
      setExporting(null);
    }
  };

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Download className="h-5 w-5 text-teal-400" />
          Export Center
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Export compliance data and reports in various formats
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {EXPORT_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isExporting = exporting === option.format;

            return (
              <div
                key={option.format}
                className={cn(
                  "flex items-center justify-between p-4 rounded-lg border transition-colors",
                  option.available
                    ? "border-border hover:border-border/80 hover:bg-muted/30"
                    : "border-border/50 opacity-60"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      option.format === "json" && "bg-blue-500/10",
                      option.format === "csv" && "bg-emerald-500/10",
                      option.format === "pdf" && "bg-purple-500/10"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        option.format === "json" && "text-blue-400",
                        option.format === "csv" && "text-emerald-400",
                        option.format === "pdf" && "text-purple-400"
                      )}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {option.label}
                      </p>
                      {!option.available && (
                        <Badge
                          variant="outline"
                          className="text-xs text-muted-foreground"
                        >
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport(option.format)}
                  disabled={!option.available || isExporting}
                  className="border-border"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {lastExport && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Last export:{" "}
              <span className="text-foreground font-medium">
                {lastExport.format.toUpperCase()}
              </span>{" "}
              at{" "}
              {lastExport.timestamp.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
