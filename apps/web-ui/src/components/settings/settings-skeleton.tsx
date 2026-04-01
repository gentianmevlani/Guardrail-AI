"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SettingsSkeleton() {
  return (
    <Card className="bg-card border-border glass-card">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Switches skeleton */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-11 rounded-full" />
          </div>
        ))}
        
        {/* Input skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
        
        {/* Button skeleton */}
        <Skeleton className="h-10 w-40" />
      </CardContent>
    </Card>
  );
}

export function WebhooksSkeleton() {
  return (
    <Card className="bg-card border-border glass-card">
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="border border-border rounded-lg p-4 bg-muted/30 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-64" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function SecuritySkeleton() {
  return (
    <Card className="bg-card border-border glass-card">
      <CardHeader className="space-y-2">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-72" />
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
