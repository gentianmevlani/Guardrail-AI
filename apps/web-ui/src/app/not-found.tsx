"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <Card className="bg-card border-border max-w-md w-full">
        <CardContent className="py-12">
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-muted/50 mx-auto">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-bold text-foreground">404</h1>
              <h2 className="text-xl text-muted-foreground">Page Not Found</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
              It may have been deleted or the URL might be incorrect.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button asChild>
                <Link href="/">
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Link>
              </Button>
              <Button variant="outline" onClick={() => window.history.back()}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go Back
              </Button>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Looking for something specific?</p>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard">
                  <Search className="w-4 h-4 mr-2" />
                  Visit Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
