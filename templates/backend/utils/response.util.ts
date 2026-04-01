/**
 * Standardized API Response Utilities
 * 
 * Essential for consistent API responses
 * AI agents often create inconsistent response formats
 */

import { Response } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

/**
 * Success Response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error Response
 */
export const sendError = (
  res: Response,
  error: string,
  statusCode: number = 400,
  code?: string
) => {
  return res.status(statusCode).json({
    success: false,
    error,
    code: code || 'ERROR',
  });
};

/**
 * Paginated Response
 */
export const sendPaginated = <T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number
) => {
  const totalPages = Math.ceil(total / limit);

  return sendSuccess(res, data, 200, {
    page,
    limit,
    total,
    totalPages,
  });
};

/**
 * Created Response
 */
export const sendCreated = <T>(res: Response, data: T) => {
  return sendSuccess(res, data, 201);
};

/**
 * No Content Response
 */
export const sendNoContent = (res: Response) => {
  return res.status(204).end();
};

