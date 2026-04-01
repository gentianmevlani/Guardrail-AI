"use client";

import { cn } from "@/lib/utils";
import {
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    Filter,
    Search,
    X,
} from "lucide-react";
import { useMemo, useState } from "react";

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  monospace?: boolean;
  copyable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: Record<string, string>;
}

interface ProTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyField: string;
  onRowClick?: (row: T) => void;
  savedFilters?: SavedFilter[];
  emptyState?: {
    title: string;
    description: string;
    action?: React.ReactNode;
  };
  pageSize?: number;
  loading?: boolean;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="ml-1 p-0.5 rounded hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3 w-3 text-emerald-400" />
      ) : (
        <Copy className="h-3 w-3 text-zinc-500" />
      )}
    </button>
  );
}

function SkeletonRow({ columns }: { columns: number }) {
  return (
    <tr className="border-b border-zinc-800">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-zinc-800 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function ProTable<T extends Record<string, any>>({
  data,
  columns,
  keyField,
  onRowClick,
  savedFilters = [],
  emptyState,
  pageSize = 10,
  loading = false,
}: ProTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Handle sort
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply search
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          const value = row[col.key];
          return value && String(value).toLowerCase().includes(searchLower);
        })
      );
    }

    // Apply saved filter
    if (activeFilter) {
      const filter = savedFilters.find((f) => f.id === activeFilter);
      if (filter) {
        result = result.filter((row) =>
          Object.entries(filter.filters).every(([key, value]) =>
            String(row[key]).toLowerCase().includes(value.toLowerCase())
          )
        );
      }
    }

    // Apply sort
    if (sortKey) {
      result.sort((a, b) => {
        const aVal = a[sortKey];
        const bVal = b[sortKey];
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, search, activeFilter, savedFilters, sortKey, sortDir, columns]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / pageSize);
  const paginatedData = processedData.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-900 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Saved Filters */}
        {savedFilters.length > 0 && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-zinc-500" />
            <div className="flex items-center gap-1">
              {savedFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => {
                    setActiveFilter(activeFilter === filter.id ? null : filter.id);
                    setPage(0);
                  }}
                  className={cn(
                    "px-2.5 py-1 text-xs font-medium rounded-full border transition-colors",
                    activeFilter === filter.id
                      ? "bg-blue-500/20 border-blue-500/30 text-blue-400"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  )}
                >
                  {filter.name}
                  {activeFilter === filter.id && (
                    <X className="inline-block ml-1 h-3 w-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-zinc-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Sticky Header */}
            <thead className="bg-zinc-900 sticky top-0 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800",
                      col.sortable && "cursor-pointer hover:text-zinc-300 select-none"
                    )}
                    style={{ width: col.width }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div className="flex items-center gap-1">
                      {col.header}
                      {col.sortable && sortKey === col.key && (
                        sortDir === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} columns={columns.length} />
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    {emptyState ? (
                      <div className="space-y-2">
                        <p className="text-zinc-400 font-medium">{emptyState.title}</p>
                        <p className="text-sm text-zinc-600">{emptyState.description}</p>
                        {emptyState.action && (
                          <div className="pt-2">{emptyState.action}</div>
                        )}
                      </div>
                    ) : (
                      <p className="text-zinc-500">No data available</p>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row) => (
                  <tr
                    key={row[keyField]}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      "transition-colors group",
                      onRowClick && "cursor-pointer hover:bg-zinc-800/50"
                    )}
                  >
                    {columns.map((col) => {
                      const value = row[col.key];
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3 text-sm",
                            col.monospace ? "font-mono text-zinc-400" : "text-zinc-300"
                          )}
                        >
                          <div className="flex items-center">
                            {col.render ? col.render(value, row) : String(value ?? "-")}
                            {col.copyable && value && (
                              <CopyButton value={String(value)} />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-500">
            Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, processedData.length)} of {processedData.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4 text-zinc-400" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = i;
              return (
                <button
                  key={i}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-8 h-8 rounded text-sm font-medium transition-colors",
                    page === pageNum
                      ? "bg-zinc-800 text-white"
                      : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                  )}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page === totalPages - 1}
              className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
