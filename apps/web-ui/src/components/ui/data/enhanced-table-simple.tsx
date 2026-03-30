"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger
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
    Search
} from "lucide-react";
import React, { useCallback, useMemo, useState } from "react";

// Simple column definition
export interface Column<T = any> {
  id: string;
  header: string;
  accessor?: keyof T;
  sortable?: boolean;
  cell?: (row: T) => React.ReactNode;
  className?: string;
}

// Enhanced table props
interface EnhancedTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: Error | null;
  
  // Search
  searchable?: boolean;
  searchPlaceholder?: string;
  
  // Pagination
  paginated?: boolean;
  pageSize?: number;
  
  // Sorting
  sortable?: boolean;
  
  // Export
  exportable?: boolean;
  onExport?: (format: string, data: T[]) => void;
  
  className?: string;
}

export function EnhancedTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error = null,
  searchable = true,
  searchPlaceholder = "Search...",
  paginated = true,
  pageSize = 10,
  sortable = true,
  exportable = true,
  onExport,
  className
}: EnhancedTableProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ column: string; direction: "asc" | "desc" } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = [...data];
    
    // Apply search
    if (searchable && searchQuery) {
      filtered = filtered.filter(row => {
        return columns.some(column => {
          const value = column.accessor ? row[column.accessor] : row[column.id];
          return String(value).toLowerCase().includes(searchQuery.toLowerCase());
        });
      });
    }
    
    // Apply sorting
    if (sortable && sortConfig) {
      filtered.sort((a, b) => {
        const aValue = sortConfig.column ? a[sortConfig.column] : "";
        const bValue = sortConfig.column ? b[sortConfig.column] : "";
        
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    
    return filtered;
  }, [data, searchable, searchQuery, sortable, sortConfig, columns]);
  
  // Pagination
  const paginatedData = useMemo(() => {
    if (!paginated) return processedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, paginated, currentPage, pageSize]);
  
  // Pagination info
  const paginationInfo = useMemo(() => {
    if (!paginated) return null;
    
    const totalItems = processedData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    return {
      totalItems,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1,
      startIndex: totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0,
      endIndex: Math.min(currentPage * pageSize, totalItems)
    };
  }, [processedData.length, paginated, currentPage, pageSize]);
  
  // Event handlers
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);
  
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;
    
    let newDirection: "asc" | "desc" = "asc";
    if (sortConfig?.column === columnId && sortConfig.direction === "asc") {
      newDirection = "desc";
    }
    
    setSortConfig({ column: columnId, direction: newDirection });
  }, [sortable, sortConfig]);
  
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);
  
  const handleExport = useCallback((format: string) => {
    onExport?.(format, processedData);
  }, [onExport, processedData]);
  
  // Get cell value
  const getCellValue = useCallback((row: T, column: Column<T>) => {
    if (column.cell) {
      return column.cell(row);
    }
    
    const value = column.accessor ? row[column.accessor] : row[column.id];
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
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-zinc-400 mb-2">No data available</div>
        <div className="text-sm text-zinc-500">Try adjusting your search criteria</div>
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with search and actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search */}
        {searchable && (
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
        
        {/* Export */}
        {exportable && (
          <Select onValueChange={handleExport}>
            <SelectTrigger className="w-auto">
              <Download className="h-4 w-4 mr-2" />
              Export
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">Export as CSV</SelectItem>
              <SelectItem value="json">Export as JSON</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>
      
      {/* Table */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-zinc-900/50">
              {columns.map(column => (
                <TableHead
                  key={column.id}
                  className={cn(
                    "whitespace-nowrap",
                    column.sortable && sortable && "cursor-pointer hover:bg-zinc-800/50"
                  )}
                  onClick={() => column.sortable && handleSort(column.id)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.header}</span>
                    {column.sortable && sortable && (
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow key={index} className="hover:bg-zinc-800/30">
                {columns.map(column => (
                  <TableCell key={column.id} className={column.className}>
                    {getCellValue(row, column)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {paginated && paginationInfo && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-zinc-400">
            Showing {paginationInfo.startIndex} to {paginationInfo.endIndex} of {paginationInfo.totalItems} results
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
              {Array.from({ length: Math.min(paginationInfo.totalPages, 5) }, (_, i) => {
                let pageNum = i + 1;
                if (paginationInfo.totalPages > 5) {
                  if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= paginationInfo.totalPages - 2) {
                    pageNum = paginationInfo.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                }
                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
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
