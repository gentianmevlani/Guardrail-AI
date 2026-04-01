import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { randomBytes } from 'crypto';

const API_KEY_COOKIE = 'gr_api_key';

function maskApiKey(apiKey: string): string {
  if (apiKey.length < 12) {
    return 'gr_****';
  }
  const lastFour = apiKey.slice(-4);
  return `gr_****${lastFour}`;
}

function generateSecureApiKey(): string {
  const randomPart = randomBytes(16).toString('hex');
  return `gr_${randomPart}`;
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.cookies.get(API_KEY_COOKIE)?.value;
    
    if (!apiKey) {
      return NextResponse.json({ apiKey: null });
    }
    
    return NextResponse.json({ apiKey: maskApiKey(apiKey) });
  } catch (error) {
    logger.error('Failed to get API key:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve API key' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = generateSecureApiKey();
    
    const response = NextResponse.json({ apiKey });
    
    response.cookies.set(API_KEY_COOKIE, apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
    
    return response;
  } catch (error) {
    logger.error('Failed to generate API key:', error);
    return NextResponse.json(
      { error: 'Failed to generate API key' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const response = NextResponse.json({ success: true });
    
    response.cookies.delete(API_KEY_COOKIE);
    
    return response;
  } catch (error) {
    logger.error('Failed to revoke API key:', error);
    return NextResponse.json(
      { error: 'Failed to revoke API key' },
      { status: 500 }
    );
  }
}
