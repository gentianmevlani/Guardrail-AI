/**
 * Search Utilities
 * 
 * Essential search/filtering helpers that AI agents often miss
 * Consistent search across all endpoints
 */

export interface SearchParams {
  search?: string;
  q?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Parse search parameters from query
 */
export const parseSearchParams = (query: any): SearchParams => {
  const search = query.search || query.q;
  const sortBy = query.sortBy || query.sort_by;
  const sortOrder = (query.sortOrder || query.sort_order || 'desc') as 'asc' | 'desc';

  // Extract filters (everything that's not a known param)
  const knownParams = ['search', 'q', 'sortBy', 'sort_by', 'sortOrder', 'sort_order', 'page', 'limit'];
  const filters: Record<string, any> = {};

  Object.keys(query).forEach((key) => {
    if (!knownParams.includes(key) && query[key] !== undefined && query[key] !== '') {
      filters[key] = query[key];
    }
  });

  return {
    search,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    sortBy,
    sortOrder: ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc',
  };
};

/**
 * Build SQL WHERE clause for search
 */
export const buildSearchWhere = (
  searchParams: SearchParams,
  searchableFields: string[],
  tableAlias: string = ''
): { where: string; params: any[] } => {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // Text search
  if (searchParams.search && searchableFields.length > 0) {
    const searchConditions = searchableFields.map((field) => {
      const fieldName = tableAlias ? `${tableAlias}.${field}` : field;
      params.push(`%${searchParams.search}%`);
      return `${fieldName} ILIKE $${paramIndex++}`;
    });
    conditions.push(`(${searchConditions.join(' OR ')})`);
  }

  // Filters
  if (searchParams.filters) {
    Object.entries(searchParams.filters).forEach(([key, value]) => {
      const fieldName = tableAlias ? `${tableAlias}.${key}` : key;
      params.push(value);
      conditions.push(`${fieldName} = $${paramIndex++}`);
    });
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  return { where, params };
};

/**
 * Build SQL ORDER BY clause
 */
export const buildSortOrder = (
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
  defaultSort: string = 'created_at',
  tableAlias: string = ''
): string => {
  const field = sortBy || defaultSort;
  const fieldName = tableAlias ? `${tableAlias}.${field}` : field;
  const order = sortOrder.toUpperCase();
  return `ORDER BY ${fieldName} ${order}`;
};

