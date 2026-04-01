/**
 * Pagination Utilities
 * 
 * Essential pagination helpers that AI agents often miss
 * Consistent pagination across all endpoints
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Parse pagination from query params
 */
export const parsePagination = (query: any): PaginationParams => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));

  return { page, limit };
};

/**
 * Calculate pagination metadata
 */
export const calculatePagination = (
  page: number,
  limit: number,
  total: number
) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
  };
};

/**
 * Get SQL offset for pagination
 */
export const getOffset = (page: number, limit: number): number => {
  return (page - 1) * limit;
};

/**
 * Format paginated response
 */
export const formatPaginatedResponse = <T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginationResult<T> => {
  return {
    data,
    pagination: calculatePagination(page, limit, total),
  };
};

