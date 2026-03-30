/**
 * Authentication Type Definitions
 *
 * Shared types for authenticated requests across all routes.
 * Eliminates `any` type usage for user data.
 */

import { FastifyRequest } from "fastify";

/** JWT payload structure */
export interface JWTPayload {
  userId: string;
  email?: string;
  sub?: string;
  iat?: number;
  exp?: number;
}

/** Authenticated user data attached to requests */
export interface AuthUser {
  id: string;
  userId?: string; // Alias for backwards compatibility
  /** Optional where JWT or partial session omits email */
  email?: string;
  name?: string;
  role?: string;
  subscriptionTier?: string;
}

/** Request with authenticated user */
export interface AuthenticatedRequest extends FastifyRequest {
  user?: AuthUser;
  userId?: string;
  userEmail?: string;
  token?: string;
}

/** Query parameters for list endpoints */
export interface ListQueryParams {
  limit?: string;
  offset?: string;
  page?: string;
  status?: string;
  verdict?: string;
  repo?: string;
  type?: string;
  search?: string;
}

/** Standard API response */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

/** Pagination response */
export interface PaginatedResponse<T> extends ApiResponse<T> {
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Type guard to check if request has authenticated user
 */
export function isAuthenticated(
  request: FastifyRequest,
): request is AuthenticatedRequest & { user: AuthUser } {
  return !!(request as AuthenticatedRequest).user?.id;
}

/**
 * Extract user from request with type safety
 */
export function getAuthUser(request: FastifyRequest): AuthUser | undefined {
  return (request as AuthenticatedRequest).user;
}

/**
 * Get user ID from request (handles both .user.id and .userId patterns)
 */
export function getUserId(request: FastifyRequest): string | undefined {
  const req = request as AuthenticatedRequest;
  return req.user?.id || req.userId;
}
