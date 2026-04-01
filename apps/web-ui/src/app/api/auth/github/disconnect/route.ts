import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  // GitHub disconnection is handled by removing the environment variable
  // This endpoint just returns success since we can't actually remove env vars at runtime
  return NextResponse.json({
    success: true,
    message: 'To disconnect GitHub, remove the GITHUB_ACCESS_TOKEN environment variable from your deployment settings.'
  });
}
