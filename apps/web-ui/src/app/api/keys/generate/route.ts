import { NextResponse } from 'next/server';
import { randomBytes, createHash } from 'crypto';
import { cookies } from 'next/headers';

// Rate limiting state (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX = 5; // Max 5 key generations per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

export async function POST(request: Request) {
  // Check authentication via session cookie
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value || cookieStore.get('token')?.value;
  
  if (!sessionToken) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  // Rate limiting based on session token hash
  const sessionHash = createHash('sha256').update(sessionToken).digest('hex').slice(0, 16);
  if (!checkRateLimit(sessionHash)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Maximum 5 key generations per hour.' },
      { status: 429, headers: { 'Retry-After': '3600' } }
    );
  }

  // Generate a cryptographically secure API key
  // Format: gr_<32 random bytes as base64url> (vc = guardrail)
  const apiKey = `gr_${randomBytes(32).toString('base64url')}`;
  
  // Generate key hash for storage (only store hash, never the raw key)
  const keyHash = createHash('sha256').update(apiKey).digest('hex');
  const keyPrefix = apiKey.slice(0, 10); // Store prefix for identification

  // TODO: Store the API key hash in the database with user association
  // await db.apiKey.create({ 
  //   userId, 
  //   keyHash, 
  //   prefix: keyPrefix,
  //   createdAt: new Date(),
  //   lastUsedAt: null 
  // });

  // Return with security headers
  const response = NextResponse.json({ 
    apiKey,
    prefix: keyPrefix,
    message: 'Store this key securely - it will not be shown again'
  });
  
  // Prevent caching of API key response
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  
  return response;
}
