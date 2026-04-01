"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
    AlertTriangle,
    FileCode,
    GitBranch,
    Inbox,
    Plus,
    RefreshCw,
    Search,
    Shield,
    Users,
    Zap
} from "lucide-react";

// Base Empty State Component
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary";
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  size = "md"
}: EmptyStateProps) {
  const sizeClasses = {
    sm: "p-6",
    md: "p-8",
    lg: "p-12"
  };

  const iconSizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16"
  };

  return (
    <div className={cn(
      "flex flex-col items-center justify-center text-center space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30",
      sizeClasses[size],
      className
    )}>
      {icon && (
        <div className={cn(
          "flex items-center justify-center rounded-full bg-zinc-800 p-3",
          iconSizes[size]
        )}>
          {icon}
        </div>
      )}
      <div className="space-y-2 max-w-md">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      {action && (
        <Button
          onClick={action.onClick}
          variant={action.variant || "default"}
          className="flex items-center gap-2"
        >
          {action.icon}
          {action.label}
        </Button>
      )}
      {secondaryAction && (
        <Button
          variant="ghost"
          onClick={secondaryAction.onClick}
          className="text-zinc-400 hover:text-white"
        >
          {secondaryAction.label}
        </Button>
      )}
    </div>
  );
}

// Specific Empty State Variants

export function NoDataEmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <EmptyState
      icon={<Inbox className="w-full h-full text-zinc-500" />}
      title="No data available"
      description="There's no data to display yet. Check back later or refresh to see the latest information."
      action={onRefresh ? {
        label: "Refresh",
        onClick: onRefresh,
        icon: <RefreshCw className="w-4 h-4" />
      } : undefined}
      size="md"
    />
  );
}

export function NoSearchResults({ onClearSearch }: { onClearSearch?: () => void }) {
  return (
    <EmptyState
      icon={<Search className="w-full h-full text-zinc-500" />}
      title="No results found"
      description="We couldn't find any results matching your search criteria. Try adjusting your filters or search terms."
      secondaryAction={onClearSearch ? {
        label: "Clear search",
        onClick: onClearSearch
      } : undefined}
      size="md"
    />
  );
}

export function NoRepositoriesEmptyState({ onConnectGitHub }: { onConnectGitHub?: () => void }) {
  return (
    <Card className="bg-black/40 border-zinc-800 backdrop-blur-sm">
      <CardContent className="p-8">
        <EmptyState
          icon={<GitBranch className="w-full h-full text-zinc-500" />}
          title="No repositories connected"
          description="Connect your GitHub account to start scanning repositories for security issues and code quality."
          action={onConnectGitHub ? {
            label: "Connect GitHub",
            onClick: onConnectGitHub,
            icon: <GitBranch className="w-4 h-4" />
          } : undefined}
          size="lg"
        />
      </CardContent>
    </Card>
  );
}

export function NoScansEmptyState({ onRunScan }: { onRunScan?: () => void }) {
  return (
    <EmptyState
      icon={<Shield className="w-full h-full text-zinc-500" />}
      title="No scans run yet"
      description="Run your first security scan to identify vulnerabilities and code quality issues in your repository."
      action={onRunScan ? {
        label: "Run First Scan",
        onClick: onRunScan,
        icon: <Zap className="w-4 h-4" />
      } : undefined}
      size="md"
    />
  );
}

export function NoFilesEmptyState({ onUploadFiles, onSelectFolder }: { 
  onUploadFiles?: () => void;
  onSelectFolder?: () => void;
}) {
  return (
    <EmptyState
      icon={<FileCode className="w-full h-full text-zinc-500" />}
      title="No files selected"
      description="Select files or folders to scan for security vulnerabilities and code quality issues."
      action={onUploadFiles ? {
        label: "Select Files",
        onClick: onUploadFiles,
        icon: <FileCode className="w-4 h-4" />
      } : undefined}
      secondaryAction={onSelectFolder ? {
        label: "Select Folder",
        onClick: onSelectFolder
      } : undefined}
      size="md"
    />
  );
}

export function NoTeamMembersEmptyState({ onInviteMember }: { onInviteMember?: () => void }) {
  return (
    <EmptyState
      icon={<Users className="w-full h-full text-zinc-500" />}
      title="No team members yet"
      description="Invite team members to collaborate on security scans and manage your repositories together."
      action={onInviteMember ? {
        label: "Invite Member",
        onClick: onInviteMember,
        icon: <Plus className="w-4 h-4" />
      } : undefined}
      size="md"
    />
  );
}

export function NoIssuesEmptyState({ onRunScan }: { onRunScan?: () => void }) {
  return (
    <Card className="bg-gradient-to-br from-emerald-950/30 to-emerald-900/20 border-emerald-800/50">
      <CardContent className="p-8">
        <EmptyState
          icon={<Shield className="w-full h-full text-emerald-400" />}
          title="All clear! No issues found"
          description="Great job! Your code passed all security checks. Keep up the good work."
          action={onRunScan ? {
            label: "Run New Scan",
            onClick: onRunScan,
            icon: <RefreshCw className="w-4 h-4" />,
            variant: "outline"
          } : undefined}
          size="md"
        />
      </CardContent>
    </Card>
  );
}

export function NoActivityEmptyState({ onRunScan }: { onRunScan?: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="w-full h-full text-zinc-500" />}
      title="No recent activity"
      description="No scans or security checks have been run recently. Start a new scan to see activity here."
      action={onRunScan ? {
        label: "Run Scan",
        onClick: onRunScan,
        icon: <Zap className="w-4 h-4" />
      } : undefined}
      size="md"
    />
  );
}

export function NoConnectionsEmptyState({ onConnect }: { onConnect?: () => void }) {
  return (
    <EmptyState
      icon={<GitBranch className="w-full h-full text-zinc-500" />}
      title="No integrations connected"
      description="Connect your tools and services to enable automated security scanning and monitoring."
      action={onConnect ? {
        label: "Connect Service",
        onClick: onConnect,
        icon: <Plus className="w-4 h-4" />
      } : undefined}
      size="md"
    />
  );
}

// Card-specific empty states
export function EmptyCard({ 
  title, 
  description, 
  action,
  className 
}: { 
  title: string; 
  description: string; 
  action?: EmptyStateProps['action'];
  className?: string;
}) {
  return (
    <Card className={cn("bg-black/40 border-zinc-800 backdrop-blur-sm", className)}>
      <CardHeader>
        <CardTitle className="text-zinc-300">{title}</CardTitle>
        <CardDescription className="text-zinc-500">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {action && (
          <Button onClick={action.onClick} className="w-full">
            {action.icon}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// List/Table empty states
export function EmptyList({ 
  message, 
  action,
  className 
}: { 
  message: string; 
  action?: EmptyStateProps['action'];
  className?: string;
}) {
  return (
    <div className={cn("text-center py-12", className)}>
      <div className="text-zinc-500 mb-2">{message}</div>
      {action && (
        <Button
          onClick={action.onClick}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          {action.icon}
          {action.label}
        </Button>
      )}
    </div>
  );
}

// Smart Empty State Container
interface SmartEmptyStateProps {
  isEmpty: boolean;
  isLoading?: boolean;
  error?: Error | null;
  children: React.ReactNode;
  emptyState: React.ReactNode;
  loadingState?: React.ReactNode;
  errorState?: React.ReactNode;
}

export function SmartEmptyState({
  isEmpty,
  isLoading = false,
  error = null,
  children,
  emptyState,
  loadingState,
  errorState,
}: SmartEmptyStateProps) {
  if (error) {
    return errorState || (
      <div className="p-8 text-center">
        <div className="text-red-400 mb-2">Something went wrong</div>
        <div className="text-sm text-zinc-500">{error.message}</div>
      </div>
    );
  }

  if (isLoading) {
    return loadingState || <div className="p-8 text-center text-zinc-500">Loading...</div>;
  }

  if (isEmpty) {
    return emptyState;
  }

  return <>{children}</>;
}
