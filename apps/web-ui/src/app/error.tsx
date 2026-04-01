'use client';

import { logger } from '@/lib/logger';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Mail, Bug } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorId] = useState(() => Math.random().toString(36).substring(2, 11));

  useEffect(() => {
    logger.error('Unhandled error:', {
      error: error.message,
      stack: error.stack,
      digest: error.digest,
      errorId,
    });
  }, [error, errorId]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <Card className="bg-card border-border max-w-lg w-full">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-red-500/10 mx-auto">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-foreground">Something Went Wrong</h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. We&apos;ve been notified and are looking into it.
              </p>
            </div>
            
            {process.env.NODE_ENV === 'development' && (
              <div className="bg-muted/50 rounded-lg p-4 text-left">
                <p className="text-xs font-mono text-muted-foreground mb-2">Error ID: {errorId}</p>
                <p className="text-xs font-mono text-red-400 break-all">{error.message}</p>
                {error.stack && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">Stack trace</summary>
                    <pre className="text-xs text-muted-foreground mt-2 overflow-auto max-h-32">
                      {error.stack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button onClick={reset}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </Button>
              <Button variant="outline" asChild>
                <Link href="/dashboard">
                  <Home className="w-4 h-4 mr-2" />
                  Go to Dashboard
                </Link>
              </Button>
            </div>

            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">Still having issues?</p>
              <div className="flex gap-3 justify-center">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="mailto:support@guardrail.io?subject=Error Report&body=Error ID: ${errorId}">
                    <Mail className="w-4 h-4 mr-2" />
                    Contact Support
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="https://github.com/guardrail/issues" target="_blank">
                    <Bug className="w-4 h-4 mr-2" />
                    Report Bug
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

