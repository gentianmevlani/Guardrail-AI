"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Search,
} from "lucide-react";
import React, { useCallback, useMemo, useRef, useState } from "react";

// Simple Checkbox component
const Checkbox = ({
  checked,
  onCheckedChange,
  className,
}: {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  className?: string;
}) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onCheckedChange?.(e.target.checked)}
    className={cn(
      "h-4 w-4 rounded border border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500",
      className,
    )}
  />
);

// Column Types
export interface Column<T = any> {
  id: string;
  header: string;
  accessor?: keyof T | ((row: T) => any);
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  minWidth?: string | number;
  maxWidth?: string | number;
  cell?: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

// Table Props
interface EnhancedTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: Error | null;
  empty?: React.ReactNode;

  // Pagination
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    totalItems?: number;
  };

  // Search
  search?: {
    enabled?: boolean;
    placeholder?: string;
    onSearch?: (query: string) => void;
  };

  // Filters
  filters?: {
    enabled?: boolean;
    onFilter?: (filters: Record<string, any>) => void;
    availableFilters?: Array<{
      id: string;
      label: string;
      type: "select" | "text" | "date";
      options?: Array<{ label: string; value: any }>;
    }>;
  };

  // Sorting
  sorting?: {
    enabled?: boolean;
    onSort?: (column: string, direction: "asc" | "desc") => void;
    defaultSort?: { column: string; direction: "asc" | "desc" };
  };

  // Selection
  selection?: {
    enabled?: boolean;
    onSelectionChange?: (selectedRows: T[]) => void;
    getRowId?: (row: T) => string;
  };

  // Actions
  actions?: {
    enabled?: boolean;
    actions?: Array<{
      label: string;
      icon?: React.ReactNode;
      onClick: (row: T) => void;
      variant?: "default" | "destructive" | "outline";
    }>;
  };

  // Bulk Actions
  bulkActions?: {
    enabled?: boolean;
    actions?: Array<{
      label: string;
      icon?: React.ReactNode;
      onClick: (selectedRows: T[]) => void;
      variant?: "default" | "destructive" | "outline";
    }>;
  };

  // Export
  exportConfig?: {
    enabled?: boolean;
    formats?: Array<"csv" | "json" | "xlsx">;
    onExport?: (format: string, data: T[]) => void;
  };

  className?: string;
  rowClassName?: (row: T) => string;
}

export function EnhancedTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error = null,
  empty,
  pagination = {},
  search = {},
  filters = {},
  sorting = {},
  selection = {},
  actions = {},
  bulkActions = {},
  exportConfig = {},
  className,
  rowClassName,
}: EnhancedTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
  const [sortConfig, setSortConfig] = useState<{
    column: string;
    direction: "asc" | "desc";
  } | null>(sorting.defaultSort || null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(pagination.currentPage || 1);
  const [showFilters, setShowFilters] = useState(false);

  const tableRef = useRef<HTMLTableElement>(null);

  // Get row ID
  const getRowId = useCallback(
    (row: T) => {
      if (selection.getRowId) {
        return selection.getRowId(row);
      }
      return row.id || JSON.stringify(row);
    },
    [selection],
  );

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];

    // Apply search
    if (search.enabled && searchQuery) {
      filtered = filtered.filter((row) => {
        return columns.some((column) => {
          const value = column.accessor
            ? typeof column.accessor === "function"
              ? column.accessor(row)
              : row[column.accessor]
            : row[column.id];
          return String(value)
            .toLowerCase()
            .includes(searchQuery.toLowerCase());
        });
      });
    }

    // Apply filters
    if (filters.enabled && Object.keys(activeFilters).length > 0) {
      filtered = filtered.filter((row) => {
        return Object.entries(activeFilters).every(([key, value]) => {
          if (!value) return true;
          const rowValue = row[key];
          return String(rowValue) === String(value);
        });
      });
    }

    // Apply sorting
    if (sorting.enabled && sortConfig) {
      filtered.sort((a, b) => {
        const column = columns.find((col) => col.id === sortConfig.column);
        if (!column) return 0;

        const aValue = column.accessor
          ? typeof column.accessor === "function"
            ? column.accessor(a)
            : a[column.accessor]
          : a[column.id];
        const bValue = column.accessor
          ? typeof column.accessor === "function"
            ? column.accessor(b)
            : b[column.accessor]
          : b[column.id];

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    data,
    search.enabled,
    searchQuery,
    filters.enabled,
    activeFilters,
    sorting.enabled,
    sortConfig,
    columns,
  ]);

  // Pagination
  const paginatedData = useMemo(() => {
    if (!pagination.enabled) return processedData;

    const pageSize = pagination.pageSize || 10;
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, pagination.enabled, pagination.pageSize, currentPage]);

  // Calculate pagination info
  const paginationInfo = useMemo(() => {
    if (!pagination.enabled) return null;

    const pageSize = pagination.pageSize || 10;
    const totalItems = pagination.totalItems ?? processedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      startIndex: (currentPage - 1) * pageSize + 1,
      endIndex: Math.min(currentPage * pageSize, totalItems),
    };
  }, [
    pagination.enabled,
    pagination.pageSize,
    pagination.totalItems,
    processedData.length,
    currentPage,
  ]);

  // Event handlers
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      search.onSearch?.(query);
      setCurrentPage(1); // Reset to first page on search
    },
    [search],
  );

  const handleFilter = useCallback(
    (newFilters: Record<string, any>) => {
      setActiveFilters(newFilters);
      filters.onFilter?.(newFilters);
      setCurrentPage(1); // Reset to first page on filter
    },
    [filters],
  );

  const handleSort = useCallback(
    (columnId: string) => {
      if (!sorting.enabled) return;

      let newDirection: "asc" | "desc" = "asc";
      if (sortConfig?.column === columnId && sortConfig.direction === "asc") {
        newDirection = "desc";
      }

      const newSortConfig = { column: columnId, direction: newDirection };
      setSortConfig(newSortConfig);
      sorting.onSort?.(columnId, newDirection);
    },
    [sorting, sortConfig],
  );

  const handleSelectionChange = useCallback(
    (rowId: string, selected: boolean) => {
      const newSelection = new Set(selectedRows);
      if (selected) {
        newSelection.add(rowId);
      } else {
        newSelection.delete(rowId);
      }
      setSelectedRows(newSelection);

      if (selection.onSelectionChange) {
        const selectedData = data.filter((row) =>
          newSelection.has(getRowId(row)),
        );
        selection.onSelectionChange(selectedData);
      }
    },
    [selectedRows, data, selection, getRowId],
  );

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        const allIds = new Set(paginatedData.map(getRowId));
        setSelectedRows(allIds);
        if (selection.onSelectionChange) {
          selection.onSelectionChange(paginatedData);
        }
      } else {
        setSelectedRows(new Set());
        if (selection.onSelectionChange) {
          selection.onSelectionChange([]);
        }
      }
    },
    [paginatedData, selection, getRowId],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      pagination.onPageChange?.(page);
    },
    [pagination],
  );

  const handleExport = useCallback(
    (format: string) => {
      const dataToExport =
        selectedRows.size > 0
          ? data.filter((row) => selectedRows.has(getRowId(row)))
          : processedData;
      exportConfig.onExport?.(format, dataToExport);
    },
    [selectedRows, data, processedData, exportConfig, getRowId],
  );

  // Get cell value
  const getCellValue = useCallback((row: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(row);
    }

    const value = column.accessor
      ? typeof column.accessor === "function"
        ? column.accessor(row)
        : row[column.accessor]
      : row[column.id];

    return value;
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-zinc-400">Loading...</span>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-red-400 mb-2">Error loading data</div>
        <div className="text-sm text-zinc-500">{error.message}</div>
      </div>
    );
  }

  // Render empty state
  if (data.length === 0) {
    return (
      empty || (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="text-zinc-400 mb-2">No data available</div>
          <div className="text-sm text-zinc-500">
            Try adjusting your search or filters
          </div>
        </div>
      )
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          {/* Search */}
          {search.enabled && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <Input
                placeholder={search.placeholder || "Search..."}
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
          )}

          {/* Filters */}
          {filters.enabled && (
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              Filters
              {Object.keys(activeFilters).length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {Object.keys(activeFilters).length}
                </Badge>
              )}
            </Button>
          )}
        </div>

        {/* Export and bulk actions */}
        <div className="flex items-center gap-2">
          {exportConfig.enabled && (
            <Select onValueChange={handleExport}>
              <SelectTrigger className="w-auto">
                <Download className="h-4 w-4 mr-2" />
                Export
              </SelectTrigger>
              <SelectContent>
                {exportConfig.formats?.map((format) => (
                  <SelectItem key={format} value={format}>
                    Export as {format.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {bulkActions.enabled && selectedRows.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">
                {selectedRows.size} selected
              </span>
              {bulkActions.actions?.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || "outline"}
                  size="sm"
                  onClick={() =>
                    action.onClick(
                      data.filter((row) => selectedRows.has(getRowId(row))),
                    )
                  }
                >
                  {action.icon}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && filters.enabled && (
        <div className="p-4 border border-zinc-800 rounded-lg bg-zinc-900/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filters.availableFilters?.map((filter) => (
              <div key={filter.id} className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  {filter.label}
                </label>
                {filter.type === "select" && (
                  <Select
                    value={activeFilters[filter.id] || ""}
                    onValueChange={(value) =>
                      handleFilter({
                        ...activeFilters,
                        [filter.id]: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.options?.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filter.type === "text" && (
                  <Input
                    value={activeFilters[filter.id] || ""}
                    onChange={(e) =>
                      handleFilter({
                        ...activeFilters,
                        [filter.id]: e.target.value,
                      })
                    }
                    placeholder="Filter..."
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <Table ref={tableRef}>
          <TableHeader>
            <TableRow className="bg-zinc-900/50">
              {/* Selection column */}
              {selection.enabled && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      selectedRows.size === paginatedData.length &&
                      paginatedData.length > 0
                    }
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}

              {/* Data columns */}
              {columns.map((column) => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "whitespace-nowrap",
                    column.headerClassName,
                    column.sortable &&
                      sorting.enabled &&
                      "cursor-pointer hover:bg-zinc-800/50",
                  )}
                  style={{
                    width: column.width,
                    minWidth: column.minWidth,
                    maxWidth: column.maxWidth,
                  }}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.header}</span>
                    {column.sortable && sorting.enabled && (
                      <div className="flex flex-col">
                        {sortConfig?.column === column.id ? (
                          sortConfig.direction === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-zinc-500" />
                        )}
                      </div>
                    )}
                  </div>
                </TableHead>
              ))}

              {/* Actions column */}
              {actions.enabled && (
                <TableHead className="w-12">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow
                key={getRowId(row)}
                className={cn("hover:bg-zinc-800/30", rowClassName?.(row))}
              >
                {/* Selection cell */}
                {selection.enabled && (
                  <TableCell>
                    <Checkbox
                      checked={selectedRows.has(getRowId(row))}
                      onCheckedChange={(checked) =>
                        handleSelectionChange(getRowId(row), checked as boolean)
                      }
                    />
                  </TableCell>
                )}

                {/* Data cells */}
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    className={cn(column.className)}
                    style={{
                      width: column.width,
                      minWidth: column.minWidth,
                      maxWidth: column.maxWidth,
                    }}
                  >
                    {getCellValue(row, column)}
                  </TableCell>
                ))}

                {/* Actions cell */}
                {actions.enabled && (
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {actions.actions?.map((action, actionIndex) => (
                        <Button
                          key={actionIndex}
                          variant="ghost"
                          size="sm"
                          onClick={() => action.onClick(row)}
                          className="h-8 w-8 p-0"
                        >
                          {action.icon}
                        </Button>
                      ))}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.enabled && paginationInfo && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Showing {paginationInfo.startIndex} to {paginationInfo.endIndex} of{" "}
            {paginationInfo.totalItems} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!paginationInfo.hasPreviousPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from(
                { length: paginationInfo.totalPages },
                (_, i) => i + 1,
              ).map((page) => (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                  className="w-8 h-8 p-0"
                >
                  {page}
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!paginationInfo.hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
