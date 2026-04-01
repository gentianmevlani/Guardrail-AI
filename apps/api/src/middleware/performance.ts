/**
 * Performance middleware for API optimization
 *
 * This module provides compression, caching, and pagination safety
 * middleware to improve API performance and maintainability.
 */

import compress from "@fastify/compress";
import { FastifyReply, FastifyRequest } from "fastify";
import { logger } from "../logger";

// ============================================================================
// COMPRESSION MIDDLEWARE
// ============================================================================

export const compressionConfig = {
  // Compress responses larger than 1KB
  threshold: 1024,
  
  // Supported encodings
  encodings: ["gzip", "deflate", "br"],
  
  // Don't compress these content types (already compressed)
  skipCompress: [
    "image/*",
    "video/*",
    "audio/*",
    "application/zip",
    "application/gzip",
  ],
  
  // Compression level (1-9, where 9 is maximum compression)
  level: 6,
  
  // Window size for gzip compression
  windowBits: 15,
  
  // Memory level for gzip compression
  memLevel: 8,
};

// ============================================================================
// CACHE HEADERS MIDDLEWARE
// ============================================================================

interface CacheConfig {
  // Cache duration in seconds
  maxAge?: number;
  
  // Whether to allow shared caches (CDNs, proxies)
  shared?: boolean;
  
  // Whether to revalidate with the server
  mustRevalidate?: boolean;
  
  // Whether to allow stale responses while revalidating
  staleWhileRevalidate?: number;
  
  // ETag generation
  etag?: boolean;
  
  // Vary header for cache keys
  vary?: string[];
}

// Default cache configurations for different endpoint types
export const cacheConfigs = {
  // Static data that changes rarely (pricing, feature lists, etc)
  static: {
    maxAge: 86400, // 24 hours
    shared: true,
    mustRevalidate: false,
    staleWhileRevalidate: 3600, // 1 hour
    etag: true,
    vary: ["Accept", "Accept-Encoding"],
  },
  
  // User-specific data that changes occasionally
  user: {
    maxAge: 300, // 5 minutes
    shared: false, // Never cache user-specific data in shared caches
    mustRevalidate: true,
    etag: true,
    vary: ["Accept", "Accept-Encoding", "Authorization"],
  },
  
  // Real-time data that changes frequently
  realtime: {
    maxAge: 0, // No caching
    shared: false,
    mustRevalidate: true,
    etag: false,
  },
  
  // Public data that changes periodically
  public: {
    maxAge: 1800, // 30 minutes
    shared: true,
    mustRevalidate: true,
    staleWhileRevalidate: 300, // 5 minutes
    etag: true,
    vary: ["Accept", "Accept-Encoding"],
  },
  
  // API documentation and schemas
  docs: {
    maxAge: 3600, // 1 hour
    shared: true,
    mustRevalidate: false,
    staleWhileRevalidate: 600, // 10 minutes
    etag: true,
    vary: ["Accept", "Accept-Encoding"],
  },
};

/**
 * Apply cache headers based on configuration
 */
export function applyCacheHeaders(config: CacheConfig) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Set Cache-Control header
    const directives = [];
    
    if (config.maxAge !== undefined) {
      if (config.shared) {
        directives.push(`public, max-age=${config.maxAge}`);
      } else {
        directives.push(`private, max-age=${config.maxAge}`);
      }
    }
    
    if (config.mustRevalidate) {
      directives.push("must-revalidate");
    }
    
    if (config.staleWhileRevalidate) {
      directives.push(`stale-while-revalidate=${config.staleWhileRevalidate}`);
    }
    
    if (directives.length > 0) {
      reply.header("Cache-Control", directives.join(", "));
    }
    
    // Set Vary header if specified
    if (config.vary && config.vary.length > 0) {
      reply.header("Vary", config.vary.join(", "));
    }
    
    // Generate ETag if enabled
    if (config.etag && !reply.getHeader("ETag")) {
      const payload = (reply as any).payload;
      if (payload && typeof payload === "object") {
        // Simple hash-based ETag
        const hash = Buffer.from(JSON.stringify(payload))
          .toString("base64")
          .slice(0, 16);
        reply.header("ETag", `"${hash}"`);
      }
    }
  };
}

/**
 * Route-specific cache middleware
 */
export function cacheMiddleware(type: keyof typeof cacheConfigs) {
  const config = cacheConfigs[type];
  return applyCacheHeaders(config);
}

// ============================================================================
// PAGINATION SAFETY MIDDLEWARE
// ============================================================================

interface PaginationOptions {
  // Maximum allowed limit
  maxLimit?: number;
  
  // Default limit
  defaultLimit?: number;
  
  // Maximum allowed page
  maxPage?: number;
}

const defaultPaginationOptions: PaginationOptions = {
  maxLimit: 100,
  defaultLimit: 20,
  maxPage: 10000, // Prevent excessive pagination
};

/**
 * Validate and clamp pagination parameters
 */
export function validatePagination(
  query: any,
  options: PaginationOptions = {}
) {
  const opts = { ...defaultPaginationOptions, ...options };
  
  // Parse and validate page
  let page = 1;
  if (query.page) {
    const parsedPage = parseInt(query.page, 10);
    page = isNaN(parsedPage) || parsedPage < 1 ? 1 : Math.min(parsedPage, opts.maxPage!);
  }
  
  // Parse and validate limit
  let limit = opts.defaultLimit!;
  if (query.limit) {
    const parsedLimit = parseInt(query.limit, 10);
    limit = isNaN(parsedLimit) || parsedLimit < 1 ? opts.defaultLimit! : Math.min(parsedLimit, opts.maxLimit!);
  }
  
  // Calculate offset
  const offset = (page - 1) * limit;
  
  return {
    page,
    limit,
    offset,
    // Include original values for debugging
    original: {
      page: query.page,
      limit: query.limit,
    },
  };
}

/**
 * Middleware to automatically validate pagination parameters
 */
export function paginationSafety(options: PaginationOptions = {}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.query) {
      const pagination = validatePagination(request.query, options);
      
      // Update request query with validated values
      (request.query as any).page = pagination.page.toString();
      (request.query as any).limit = pagination.limit.toString();
      (request.query as any).offset = pagination.offset.toString();
      
      // Add pagination metadata to request for handlers
      (request as any).pagination = pagination;
    }
  };
}

// ============================================================================
// PERFORMANCE MIDDLEWARE REGISTRATION
// ============================================================================

/**
 * Register all performance middleware with Fastify
 */
export async function registerPerformanceMiddleware(fastify: any) {
  // Register compression plugin
  await fastify.register(compress, compressionConfig);
  
  // Add global hooks for performance monitoring
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    // Add request start time for performance tracking
    (request as any).startTime = Date.now();
  });
  
  fastify.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    // Log slow requests
    const startTime = (request as any).startTime;
    if (startTime) {
      const duration = Date.now() - startTime;
      
      // Log requests taking longer than 1 second
      if (duration > 1000) {
        logger.warn({ method: request.method, url: request.url, duration, component: 'performance-monitoring' }, 'Slow request detected');
      }
      
      // Add performance headers
      reply.header("X-Response-Time", `${duration}ms`);
      
      // Add response size header
      const contentLength = reply.getHeader("content-length");
      if (contentLength) {
        reply.header("X-Response-Size", contentLength);
      }
    }
  });
  
  // Add compression ratio header for compressed responses
  fastify.addHook("onSend", async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
    const contentEncoding = reply.getHeader("content-encoding");
    const contentLength = reply.getHeader("content-length");
    
    if (contentEncoding && payload && contentLength) {
      const originalSize = Buffer.byteLength(JSON.stringify(payload), "utf8");
      const compressedSize = parseInt(contentLength.toString(), 10);
      
      if (originalSize > compressedSize) {
        const ratio = Math.round((1 - compressedSize / originalSize) * 100);
        reply.header("X-Compression-Ratio", `${ratio}%`);
      }
    }
    
    return payload;
  });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine cache type based on route characteristics
 */
export function getCacheTypeForRoute(routeOptions: {
  isPublic?: boolean;
  isUserSpecific?: boolean;
  isRealtime?: boolean;
  isStatic?: boolean;
  isDocumentation?: boolean;
}): keyof typeof cacheConfigs {
  if (routeOptions.isDocumentation) return "docs";
  if (routeOptions.isStatic) return "static";
  if (routeOptions.isRealtime) return "realtime";
  if (routeOptions.isUserSpecific) return "user";
  if (routeOptions.isPublic) return "public";
  
  // Default to user-specific for safety
  return "user";
}

/**
 * Apply appropriate caching based on route metadata
 */
export function autoCache(routeOptions: any = {}) {
  const cacheType = getCacheTypeForRoute(routeOptions);
  return cacheMiddleware(cacheType);
}
