/**
 * Usage Check API Endpoint
 * 
 * Server-authoritative quota checking.
 * CLI MUST call this before performing quota-consuming actions.
 * 
 * POST /api/usage/check
 * Body: { action: 'scan' | 'reality' | 'agent' }
 * Returns: { allowed: boolean, current: number, limit: number, remaining: number }
 */

import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

// Tier limits (should match packages/core/src/tier-config.ts)
const TIER_LIMITS: Record<string, { scans: number; reality: number; agent: number }> = {
  free: { scans: 10, reality: 0, agent: 0 },
  starter: { scans: 100, reality: 20, agent: 0 },
  pro: { scans: 500, reality: 100, agent: 50 },
  compliance: { scans: 1000, reality: 200, agent: 100 },
};

interface UsageCheckRequest {
  action: 'scan' | 'scan_truth' | 'reality' | 'agent' | 'fix' | 'gate';
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', allowed: false },
        { status: 401 }
      );
    }

    const apiKey = authHeader.slice(7);
    const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();

    // Validate API key and get user/org info
    const userInfo = await validateApiKey(apiKey);
    if (!userInfo) {
      return NextResponse.json(
        { error: 'Invalid API key', allowed: false },
        { status: 401 }
      );
    }

    const body = await request.json() as UsageCheckRequest;
    const { action } = body;

    // Map action to quota type
    const quotaType = mapActionToQuotaType(action);
    
    // Get current usage for this billing period
    const usage = await getCurrentUsage(userInfo.orgId, quotaType);
    
    // Get tier limits
    const limits = TIER_LIMITS[userInfo.tier] || TIER_LIMITS.free;
    const limit = limits[quotaType as keyof typeof limits] ?? 0;

    // Check if allowed
    const allowed = limit === -1 || usage < limit;
    const remaining = limit === -1 ? -1 : Math.max(0, limit - usage);

    return NextResponse.json({
      allowed,
      current: usage,
      limit,
      remaining,
      tier: userInfo.tier,
      requestId,
    });

  } catch (error) {
    logger.logUnknownError('Usage check error', error);
    return NextResponse.json(
      { error: 'Internal server error', allowed: true }, // Allow on error for UX
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
  // In production, this would query the database
  // For now, return mock data based on API key prefix
  if (!apiKey || apiKey.length < 10) {
    return null;
  }

  // Mock tier detection (in production, query DB)
  let tier = 'free';
  if (apiKey.includes('pro') || apiKey.startsWith('gsk_pro_')) {
    tier = 'pro';
  } else if (apiKey.includes('starter') || apiKey.startsWith('gsk_starter_')) {
    tier = 'starter';
  } else if (apiKey.includes('compliance') || apiKey.startsWith('gsk_compliance_')) {
    tier = 'compliance';
  } else if (apiKey.includes('enterprise') || apiKey.startsWith('gsk_enterprise_')) {
    tier = 'compliance';
  }

  return {
    orgId: 'org_' + apiKey.slice(0, 8),
    tier,
    userId: 'user_' + apiKey.slice(0, 8),
  };
}

async function getCurrentUsage(orgId: string, quotaType: string): Promise<number> {
  // In production, query database for current billing period usage
  // For now, return 0 (allowing all actions)
  
  // This would be something like:
  // const result = await db.usage.aggregate({
  //   where: {
  //     orgId,
  //     type: quotaType,
  //     timestamp: { gte: billingPeriodStart },
  //   },
  //   _sum: { count: true },
  // });
  // return result._sum.count || 0;

  return 0;
}
