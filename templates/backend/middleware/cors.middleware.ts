/**
 * CORS Configuration Middleware
 * 
 * Essential CORS setup that AI agents often miss
 * Properly configured for production
 */

import { Request, Response, NextFunction } from 'express';

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * CORS Middleware
 */
export const corsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const origin = req.headers.origin;

  // Allow requests with no origin (mobile apps, Postman, etc.)
  if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (isDevelopment || allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
    ].join(', '));
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }

  next();
};

/**
 * Security Headers Middleware
 */
export const securityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // XSS Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (adjust as needed)
  if (!isDevelopment) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
  }

  next();
};

