import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { listUserRepositories } from '@/lib/github';

// Prevent static generation - this route requires runtime environment variables
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const repos = await listUserRepositories();
    return NextResponse.json({ repos });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error('GitHub repos error:', error);
    if (error.message === 'GitHub not connected') {
      return NextResponse.json({ error: 'GitHub not connected', connected: false }, { status: 401 });
    }
    return NextResponse.json({ error: 'Failed to fetch repositories' }, { status: 500 });
  }
}
