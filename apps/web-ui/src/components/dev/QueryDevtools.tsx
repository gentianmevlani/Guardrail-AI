"use client";

/**
 * Query Devtools
 *
 * A development tool for inspecting the query cache state.
 * Only renders in development mode.
 */

import { useQueryClient } from "@/lib/query";
import { ChevronDown, ChevronRight, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

interface QueryEntry {
  key: string;
  status: string;
  dataUpdatedAt: number;
  isStale: boolean;
  hasData: boolean;
}

export function QueryDevtools() {
  const [isOpen, setIsOpen] = useState(false);
  const [queries, setQueries] = useState<QueryEntry[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  useEffect(() => {
    const updateQueries = () => {
      const allKeys = queryClient.getAllKeys();
      const queryEntries: QueryEntry[] = allKeys.map((key: string) => {
        const state = queryClient.getState(key);
        return {
          key,
          status: state?.status || "idle",
          dataUpdatedAt: state?.dataUpdatedAt || 0,
          isStale: state?.isStale ?? true,
          hasData: state?.data !== null && state?.data !== undefined,
        };
      });
      setQueries(queryEntries);
    };

    updateQueries();
    const interval = setInterval(updateQueries, 1000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleInvalidate = (key: string) => {
    queryClient.invalidateQueries(key);
  };

  const handleClearAll = () => {
    queryClient.clear();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-500";
      case "loading":
        return "bg-blue-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "Never";
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 bg-teal-600 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-teal-700 transition-colors text-sm font-medium"
      >
        🔍 Query Devtools ({queries.length})
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 right-0 w-96 max-h-[50vh] bg-gray-900 border-l border-t border-gray-700 shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 bg-gray-800">
        <span className="text-sm font-semibold text-white">
          Query Cache ({queries.length})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleClearAll}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Clear all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Query List */}
      <div className="flex-1 overflow-y-auto">
        {queries.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No queries in cache
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {queries.map((query) => (
              <div key={query.key} className="text-xs">
                <div
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 cursor-pointer"
                  onClick={() => toggleExpand(query.key)}
                >
                  {expandedKeys.has(query.key) ? (
                    <ChevronDown className="w-3 h-3 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-gray-500" />
                  )}
                  <span
                    className={`w-2 h-2 rounded-full ${getStatusColor(query.status)}`}
                  />
                  <span className="flex-1 text-gray-300 font-mono truncate">
                    {query.key}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInvalidate(query.key);
                    }}
                    className="p-1 hover:bg-gray-700 rounded text-gray-500 hover:text-white"
                    title="Invalidate"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                </div>

                {expandedKeys.has(query.key) && (
                  <div className="px-6 py-2 bg-gray-800/50 text-gray-400 space-y-1">
                    <div>
                      <span className="text-gray-500">Status:</span>{" "}
                      <span className="text-white">{query.status}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Has Data:</span>{" "}
                      <span className="text-white">
                        {query.hasData ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Stale:</span>{" "}
                      <span
                        className={
                          query.isStale ? "text-yellow-400" : "text-green-400"
                        }
                      >
                        {query.isStale ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Updated:</span>{" "}
                      <span className="text-white">
                        {formatTime(query.dataUpdatedAt)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default QueryDevtools;
