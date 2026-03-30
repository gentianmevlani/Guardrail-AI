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
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

export interface AuditEvent {
  id: string;
  type: string;
  category: "compliance" | "security" | "access" | "data" | "system";
  timestamp: Date;
  actor?: string;
  action: string;
  resource?: string;
  details?: Record<string, unknown>;
  severity: "low" | "medium" | "high" | "critical";
  projectId?: string;
  frameworkId?: string;
}

interface AuditTrailTableProps {
  events: AuditEvent[];
  loading?: boolean;
  onRefresh?: () => void;
  onEventClick?: (event: AuditEvent) => void;
  className?: string;
  pageSize?: number;
}

const SEVERITY_CONFIG = {
  low: { color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20" },
  medium: { color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  high: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  critical: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" },
};

const CATEGORY_CONFIG = {
  compliance: { color: "text-teal-400", icon: Shield },
  security: { color: "text-red-400", icon: AlertTriangle },
  access: { color: "text-blue-400", icon: User },
  data: { color: "text-purple-400", icon: Eye },
  system: { color: "text-gray-400", icon: Clock },
};

type FilterKey = "category" | "severity" | "actor";

export function AuditTrailTable({
  events,
  loading = false,
  onRefresh,
  onEventClick,
  className,
  pageSize = 10,
}: AuditTrailTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{
    category: string | null;
    severity: string | null;
    actor: string | null;
  }>({
    category: null,
    severity: null,
    actor: null,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const uniqueActors = useMemo(() => {
    const actors = new Set<string>();
    events.forEach((e) => {
      if (e.actor) actors.add(e.actor);
    });
    return Array.from(actors);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch =
          event.type.toLowerCase().includes(searchLower) ||
          event.action.toLowerCase().includes(searchLower) ||
          event.actor?.toLowerCase().includes(searchLower) ||
          event.resource?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      if (filters.category && event.category !== filters.category) return false;
      if (filters.severity && event.severity !== filters.severity) return false;
      if (filters.actor && event.actor !== filters.actor) return false;

      return true;
    });
  }, [events, searchQuery, filters]);

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const paginatedEvents = filteredEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const clearFilter = useCallback((key: FilterKey) => {
    setFilters((prev) => ({ ...prev, [key]: null }));
    setCurrentPage(1);
  }, []);

  const setFilter = useCallback((key: FilterKey, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const formatTimestamp = (date: Date) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const activeFiltersCount = Object.values(filters).filter(Boolean).length;

  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-400" />
              Audit Trail
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Complete history of compliance-related activities
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "border-border",
                showFilters && "bg-muted"
              )}
            >
              <Filter className="h-4 w-4 mr-1" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-teal-500 text-white">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                className="border-border"
              >
                <RefreshCw
                  className={cn("h-4 w-4", loading && "animate-spin")}
                />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 bg-muted/50 border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Category:</span>
              <div className="flex gap-1">
                {Object.keys(CATEGORY_CONFIG).map((cat) => (
                  <button
                    key={cat}
                    onClick={() =>
                      filters.category === cat
                        ? clearFilter("category")
                        : setFilter("category", cat)
                    }
                    className={cn(
                      "px-2 py-1 text-xs rounded border transition-colors",
                      filters.category === cat
                        ? "bg-teal-500/20 border-teal-500/50 text-teal-400"
                        : "bg-muted border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-muted-foreground">Severity:</span>
              <div className="flex gap-1">
                {Object.keys(SEVERITY_CONFIG).map((sev) => (
                  <button
                    key={sev}
                    onClick={() =>
                      filters.severity === sev
                        ? clearFilter("severity")
                        : setFilter("severity", sev)
                    }
                    className={cn(
                      "px-2 py-1 text-xs rounded border transition-colors",
                      filters.severity === sev
                        ? "bg-teal-500/20 border-teal-500/50 text-teal-400"
                        : "bg-muted border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            {uniqueActors.length > 0 && (
              <div className="flex items-center gap-2 ml-4">
                <span className="text-xs text-muted-foreground">Actor:</span>
                <select
                  value={filters.actor || ""}
                  onChange={(e) =>
                    e.target.value
                      ? setFilter("actor", e.target.value)
                      : clearFilter("actor")
                  }
                  className="px-2 py-1 text-xs rounded border border-border bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                  <option value="">All</option>
                  {uniqueActors.map((actor) => (
                    <option key={actor} value={actor}>
                      {actor}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {activeFiltersCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({ category: null, severity: null, actor: null });
                  setCurrentPage(1);
                }}
                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 text-teal-400 animate-spin" />
          </div>
        ) : paginatedEvents.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No audit events found</p>
            {(searchQuery || activeFiltersCount > 0) && (
              <p className="text-sm">Try adjusting your search or filters</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedEvents.map((event) => {
              const categoryConfig = CATEGORY_CONFIG[event.category];
              const severityConfig = SEVERITY_CONFIG[event.severity];
              const CategoryIcon = categoryConfig.icon;

              return (
                <div
                  key={event.id}
                  onClick={() => onEventClick?.(event)}
                  className={cn(
                    "p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors",
                    onEventClick && "cursor-pointer"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-2 rounded-lg",
                        `bg-${event.category === "compliance" ? "teal" : event.category === "security" ? "red" : event.category === "access" ? "blue" : event.category === "data" ? "purple" : "gray"}-500/10`
                      )}
                    >
                      <CategoryIcon
                        className={cn("h-4 w-4", categoryConfig.color)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {event.type.replace(/_/g, " ")}
                        </span>
                        <Badge
                          className={cn(
                            "text-xs border",
                            severityConfig.bg,
                            severityConfig.color,
                            severityConfig.border
                          )}
                        >
                          {event.severity}
                        </Badge>
                        {event.frameworkId && (
                          <Badge
                            variant="outline"
                            className="text-xs text-muted-foreground"
                          >
                            {event.frameworkId.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {event.action}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{formatTimestamp(event.timestamp)}</span>
                        {event.actor && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {event.actor}
                            </span>
                          </>
                        )}
                        {event.resource && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">
                              {event.resource}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredEvents.length)} of{" "}
              {filteredEvents.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="border-border"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="border-border"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
