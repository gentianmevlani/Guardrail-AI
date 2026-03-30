/**
 * Search with Filters
 * 
 * What AI app builders forget: Advanced search with filters, sorting, pagination
 */

import React, { useState } from 'react';
import { Search, Filter, X, SlidersHorizontal } from 'lucide-react';
import './SearchWithFilters.css';

export interface SearchFilters {
  query: string;
  category?: string;
  tags?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  sortBy?: 'relevance' | 'date' | 'popularity';
  minPrice?: number;
  maxPrice?: number;
}

export const SearchWithFilters: React.FC<{
  onSearch: (filters: SearchFilters) => void;
  categories?: string[];
}> = ({ onSearch, categories = [] }) => {
  const [filters, setFilters] = useState<SearchFilters>({
    query: '',
    sortBy: 'relevance',
  });
  const [showFilters, setShowFilters] = useState(false);

  const handleSearch = () => {
    onSearch(filters);
  };

  const handleReset = () => {
    setFilters({
      query: '',
      sortBy: 'relevance',
    });
    onSearch({ query: '', sortBy: 'relevance' });
  };

  const activeFiltersCount = [
    filters.category,
    filters.tags?.length,
    filters.dateRange,
    filters.minPrice,
    filters.maxPrice,
  ].filter(Boolean).length;

  return (
    <div className="search-with-filters">
      {/* Search bar */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search..."
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            className="search-input"
          />
          {filters.query && (
            <button
              onClick={() => setFilters({ ...filters, query: '' })}
              className="search-clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`search-filters-toggle ${showFilters ? 'active' : ''} ${activeFiltersCount > 0 ? 'has-filters' : ''}`}
        >
          <SlidersHorizontal className="w-5 h-5" />
          {activeFiltersCount > 0 && (
            <span className="search-filters-badge">{activeFiltersCount}</span>
          )}
        </button>
        <button onClick={handleSearch} className="search-button">
          Search
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="search-filters-panel">
          {/* Category filter */}
          {categories.length > 0 && (
            <div className="search-filter-group">
              <label>Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) =>
                  setFilters({ ...filters, category: e.target.value || undefined })
                }
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort */}
          <div className="search-filter-group">
            <label>Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  sortBy: e.target.value as SearchFilters['sortBy'],
                })
              }
            >
              <option value="relevance">Relevance</option>
              <option value="date">Newest First</option>
              <option value="popularity">Most Popular</option>
            </select>
          </div>

          {/* Price range */}
          <div className="search-filter-group">
            <label>Price Range</label>
            <div className="search-price-range">
              <input
                type="number"
                placeholder="Min"
                value={filters.minPrice || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    minPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
              <span>to</span>
              <input
                type="number"
                placeholder="Max"
                value={filters.maxPrice || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
                  })
                }
              />
            </div>
          </div>

          {/* Date range */}
          <div className="search-filter-group">
            <label>Date Range</label>
            <div className="search-date-range">
              <input
                type="date"
                value={filters.dateRange?.from || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dateRange: {
                      ...filters.dateRange,
                      from: e.target.value,
                      to: filters.dateRange?.to || '',
                    },
                  })
                }
              />
              <span>to</span>
              <input
                type="date"
                value={filters.dateRange?.to || ''}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    dateRange: {
                      from: filters.dateRange?.from || '',
                      to: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>

          {/* Reset */}
          <div className="search-filters-actions">
            <button onClick={handleReset} className="search-button search-button--secondary">
              Reset Filters
            </button>
            <button onClick={handleSearch} className="search-button">
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

