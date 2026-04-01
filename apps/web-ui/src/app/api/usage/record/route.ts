/**
 * Usage Record API Endpoint
 * 
 * Server-authoritative usage recording with idempotency.
 * Uses X-Idempotency-Key to prevent double-counting on retries.
 * 
 * POST /api/usage/record
 * Body: { action: string, count: number, requestId: string }
 * Returns: { success: boolean, newUsage: number, remaining: number }
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

// In-memory idempotency cache (in production, use Redis)
const idempotencyCache = new Map<string, { result: unknown; timestamp: number }>();
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Tier limits
const TIER_LIMITS: Record<string, { scans: number; reality: number; agent: number }> = {
  free: { scans: 10, reality: 0, agent: 0 },
  starter: { scans: 100, reality: 20, agent: 0 },
  pro: { scans: 500, reality: 100, agent: 50 },
  compliance: { scans: 1000, reality: 200, agent: 100 },
};

interface UsageRecordRequest {
  action: 'scan' | 'scan_truth' | 'reality' | 'agent' | 'fix' | 'gate';
  count?: number;
  requestId?: string;
  timestamp?: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const idempotencyKey = request.headers.get('X-Idempotency-Key') || 
                           request.headers.get('X-Request-ID');

    // Check idempotency cache
    if (idempotencyKey) {
      const cached = idempotencyCache.get(idempotencyKey);
      if (cached && Date.now() - cached.timestamp < IDEMPOTENCY_TTL) {
        return NextResponse.json(cached.result);
      }
    }

    // Validate API key
    const userInfo = await validateApiKey(apiKey);
    if (!userInfo) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const body = await request.json() as UsageRecordRequest;
    const { action, count = 1, requestId } = body;

    // Map action to quota type
    const quotaType = mapActionToQuotaType(action);

    // Get current usage
    const currentUsage = await getCurrentUsage(userInfo.orgId, quotaType);
    
    // Get tier limits
    const limits = TIER_LIMITS[userInfo.tier] || TIER_LIMITS.free;
    const limit = limits[quotaType as keyof typeof limits] ?? 0;

    // Check if this would exceed quota
    if (limit !== -1 && currentUsage + count > limit) {
      const result = {
        success: false,
        error: 'Quota exceeded',
        current: currentUsage,
        limit,
        remaining: 0,
      };
      
      if (idempotencyKey) {
        idempotencyCache.set(idempotencyKey, { result, timestamp: Date.now() });
      }
      
      return NextResponse.json(result, { status: 402 });
    }

    // Record usage
    const newUsage = await recordUsage(userInfo.orgId, quotaType, count, requestId);
    const remaining = limit === -1 ? -1 : Math.max(0, limit - newUsage);

    const result = {
      success: true,
      newUsage,
      remaining,
      requestId: requestId || idempotencyKey,
    };

    // Cache for idempotency
    if (idempotencyKey) {
      idempotencyCache.set(idempotencyKey, { result, timestamp: Date.now() });
    }

    // Clean old cache entries periodically
    cleanIdempotencyCache();

    return NextResponse.json(result);

  } catch (error) {
    logger.logUnknownError('Usage record error', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function mapActionToQuotaType(action: string): string {
  switch (action) {
    case 'scan':
    case 'scan_truth':
    case 'gate':
      return 'scans';
    case 'reality':
      return 'reality';
    case 'agent':
    case 'fix':
      return 'agent';
    default:
      return 'scans';
  }
}

async function validateApiKey(apiKey: string): Promise<{ orgId: string; tier: string; userId: string } | null> {
  if (!apiKey || apiKey.length < 10) {
    return null;
  }

  // Mock tier detection
  let tier = 'free';
  if (apiKey.includes('pro')) tier = 'pro';
  else if (apiKey.includes('starter')) tier = 'starter';
  else if (apiKey.includes('compliance')) tier = 'compliance';
  else if (apiKey.includes('enterprise')) tier = 'compliance';

  return {
    orgId: 'org_' + apiKey.slice(0, 8),
    tier,
    userId: 'user_' + apiKey.slice(0, 8),
  };
}

async function getCurrentUsage(orgId: string, quotaType: string): Promise<number> {
  // In production, query database
  return 0;
}

async function recordUsage(
  orgId: string, 
  quotaType: string, 
  count: number,
  requestId?: string
): Promise<number> {
  // In production, insert into database:
  // await db.usageRecord.create({
  //   data: {
  //     orgId,
  //     type: quotaType,
  //     count,
  //     requestId,
  //     timestamp: new Date(),
  //   },
  // });
  
  // Return new total
  return count;
}

function cleanIdempotencyCache() {
  const now = Date.now();
  const entries = Array.from(idempotencyCache.entries());
  for (const [key, value] of entries) {
    if (now - value.timestamp > IDEMPOTENCY_TTL) {
      idempotencyCache.delete(key);
    }
  }
}
