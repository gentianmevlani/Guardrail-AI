/**
 * JWT Utilities
 *
 * Essential JWT token generation and validation
 * AI agents often miss refresh token implementation
 */

import jwt from "jsonwebtoken";

// STRICT: No fallbacks for secrets - fail hard if missing
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`FATAL: ${key} environment variable is required.`);
  }
  return value;
}

const JWT_SECRET = getRequiredEnv("JWT_SECRET");
const JWT_REFRESH_SECRET = getRequiredEnv("JWT_REFRESH_SECRET");
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  [key: string]: any;
}

/**
 * Generate access token
 */
export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

/**
 * Generate refresh token
 */
export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN,
  });
};

/**
 * Generate token pair
 */
export const generateTokenPair = (payload: TokenPayload) => {
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
};

/**
 * Verify access token
 */
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
};

/**
 * Decode token without verification (for debugging)
 */
export const decodeToken = (token: string): any => {
  return jwt.decode(token);
};
