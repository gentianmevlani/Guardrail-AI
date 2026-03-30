"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  BookOpen,
  FileCode,
  Play,
  Shield,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

interface EnhancedEmptyStateProps {
  type: "findings" | "scans" | "projects";
  onAction?: () => void;
  actionLabel?: string;
  showHelp?: boolean;
}

export function EnhancedEmptyState({
  type,
  onAction,
  actionLabel,
  showHelp = true,
}: EnhancedEmptyStateProps) {
  const configs = {
    findings: {
      icon: Shield,
      title: "No findings yet",
      description:
        "Run your first scan to check your codebase for security issues, mock data, and other potential problems.",
      actionLabel: actionLabel || "Run Your First Scan",
      helpTitle: "What are findings?",
      helpContent: (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Security vulnerabilities and risks</li>
          <li>Mock data and placeholder code</li>
          <li>Dead endpoints and unused code</li>
          <li>Best practice violations</li>
        </ul>
      ),
      example: {
        title: "Example Finding",
        content: "Mock data detected in production code",
        file: "src/api/users.ts:42",
        severity: "high",
      },
    },
    scans: {
      icon: FileCode,
      title: "No scans yet",
      description:
        "Start scanning your codebase to discover issues and track improvements over time.",
      actionLabel: actionLabel || "Start Your First Scan",
      helpTitle: "How scanning works",
      helpContent: (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Scans analyze your entire codebase</li>
          <li>Detects security issues and code quality problems</li>
          <li>Provides actionable recommendations</li>
          <li>Tracks improvements over time</li>
        </ul>
      ),
    },
    projects: {
      icon: Sparkles,
      title: "No projects yet",
      description:
        "Create your first project to start tracking code quality and security.",
      actionLabel: actionLabel || "Create Project",
      helpTitle: "Getting started",
      helpContent: (
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Connect a repository or local project</li>
          <li>Run scans automatically or on-demand</li>
          <li>Track findings and improvements</li>
          <li>Export reports for compliance</li>
        </ul>
      ),
    },
  };

  const config = configs[type];
  const Icon = config.icon;
  const findingExample =
    type === "findings" ? configs.findings.example : undefined;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6">
      <Card className="w-full max-w-2xl bg-card border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-4 rounded-full bg-teal-500/10 w-20 h-20 flex items-center justify-center">
            <Icon className="w-10 h-10 text-teal-400" />
          </div>
          <CardTitle className="text-2xl">{config.title}</CardTitle>
          <CardDescription className="text-base mt-2">
            {config.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Action */}
          <div className="flex justify-center">
            <Button
              onClick={onAction}
              size="lg"
              className="bg-teal-600 hover:bg-teal-700"
            >
              <Play className="w-4 h-4 mr-2" />
              {config.actionLabel}
            </Button>
          </div>

          {/* Example (for findings) */}
          {findingExample && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                <div className="flex-1">
                  <div className="font-medium text-foreground mb-1">
                    {findingExample.title}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    {findingExample.content}
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <code className="bg-background px-2 py-1 rounded text-muted-foreground">
                      {findingExample.file}
                    </code>
                    <Badge
                      variant="outline"
                      className={
                        findingExample.severity === "high"
                          ? "border-red-500/30 text-red-400"
                          : ""
                      }
                    >
                      {findingExample.severity}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Help Section */}
          {showHelp && (
            <div className="border-t border-border pt-6">
              <div className="flex items-start gap-3">
                <BookOpen className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground mb-2">
                    {config.helpTitle}
                  </h3>
                  {config.helpContent}
                  <div className="mt-4">
                    <Link
                      href="/docs/getting-started"
                      className="text-sm text-teal-400 hover:text-teal-300 underline"
                    >
                      Read the documentation →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Links */}
          <div className="border-t border-border pt-4">
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link
                href="/docs"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Documentation
              </Link>
              <Link
                href="/docs/examples"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Examples
              </Link>
              <Link
                href="/support"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Get Help
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
