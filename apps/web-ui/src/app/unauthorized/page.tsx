'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldX, Home, LogIn, Mail } from 'lucide-react';

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <Card className="bg-card border-border max-w-md w-full">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 mx-auto">
              <ShieldX className="w-10 h-10 text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-foreground">403</h1>
              <h2 className="text-xl text-muted-foreground">Access Denied</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              You don&apos;t have permission to access this resource. This may require
              authentication or additional permissions.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild>
                <Link href="/api/auth/login">
                  <LogIn className="w-4 h-4 mr-2" />
                  Sign In
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Link>
              </Button>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Need help?</p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="mailto:support@guardrail.io">
                  <Mail className="w-4 h-4 mr-2" />
                  Contact Support
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
