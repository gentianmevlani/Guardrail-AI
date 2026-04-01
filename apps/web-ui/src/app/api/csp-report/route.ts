import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';

// CSP Violation Report interface
interface CSPReport {
  'csp-report'?: {
    'document-uri'?: string;
    'violated-directive'?: string;
    'effective-directive'?: string;
    'original-policy'?: string;
    'blocked-uri'?: string;
    'status-code'?: number;
    'source-file'?: string;
    'line-number'?: number;
    'column-number'?: number;
  };
}

// In production, send to logging service (Sentry, LogRocket, DataDog, etc.)
async function logCSPViolation(report: CSPReport['csp-report']) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    logger.warn('[CSP Violation]', { report: JSON.stringify(report, null, 2) });
  }

  // In production, you might want to:
  // 1. Send to Sentry: Sentry.captureMessage('CSP Violation', { extra: report });
  // 2. Send to your analytics/logging service
  // 3. Store in database for review
  
  // Example: Send to external logging endpoint
  const loggingEndpoint = process.env.CSP_REPORT_ENDPOINT;
  if (loggingEndpoint) {
    try {
      await fetch(loggingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'csp-violation',
          timestamp: new Date().toISOString(),
          report,
        }),
      });
    } catch (error) {
      logger.logUnknownError('Failed to send CSP report to logging endpoint', error);
    }
  }
}

export async function POST(request: Request) {
  try {
    // Parse the CSP report
    const contentType = request.headers.get('content-type') || '';
    
    let report: CSPReport;
    
    if (contentType.includes('application/csp-report')) {
      report = await request.json();
    } else if (contentType.includes('application/json')) {
      report = await request.json();
    } else {
      // Some browsers send as text
      const text = await request.text();
      try {
        report = JSON.parse(text);
      } catch {
        return NextResponse.json(
          { error: 'Invalid report format' },
          { status: 400 }
        );
      }
    }

    // Validate report structure
    if (!report['csp-report']) {
      return NextResponse.json(
        { error: 'Missing csp-report field' },
        { status: 400 }
      );
    }

    // Filter out noise (browser extensions, etc.)
    const blockedUri = report['csp-report']['blocked-uri'] || '';
    const noisePatterns = [
      'chrome-extension://',
      'moz-extension://',
      'safari-extension://',
      'ms-browser-extension://',
      'about:',
      'data:',
    ];
    
    const isNoise = noisePatterns.some(pattern => blockedUri.startsWith(pattern));
    
    if (!isNoise) {
      await logCSPViolation(report['csp-report']);
    }

    // Return 204 No Content (standard for report endpoints)
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.logUnknownError('CSP report processing error', error);
    return new NextResponse(null, { status: 204 }); // Still return 204 to prevent browser retries
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
