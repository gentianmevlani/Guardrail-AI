"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { useState } from "react";

interface OnboardingSettingsProps {
  isComplete: boolean;
  isSkipped: boolean;
  completedAt?: Date | null;
  skippedAt?: Date | null;
  onReset: () => Promise<void>;
}

export function OnboardingSettings({
  isComplete,
  isSkipped,
  completedAt,
  skippedAt,
  onReset,
}: OnboardingSettingsProps) {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    setIsResetting(true);
    try {
      await onReset();
    } finally {
      setIsResetting(false);
    }
  };

  const getStatusBadge = () => {
    if (isComplete) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    }
    if (isSkipped) {
      return (
        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          Skipped
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
        In Progress
      </Badge>
    );
  };

  const getStatusDate = () => {
    if (completedAt) {
      return `Completed on ${new Date(completedAt).toLocaleDateString()}`;
    }
    if (skippedAt) {
      return `Skipped on ${new Date(skippedAt).toLocaleDateString()}`;
    }
    return null;
  };

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-zinc-100">Onboarding</CardTitle>
            <CardDescription className="text-zinc-500">
              Manage your onboarding experience
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {getStatusDate() && (
          <p className="text-sm text-zinc-500">{getStatusDate()}</p>
        )}

        <div className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700">
          <div>
            <p className="text-sm font-medium text-zinc-200">
              Restart Onboarding
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Go through the setup wizard again to connect new repos or learn
              about features
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isResetting}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {isResetting ? (
              <span className="animate-spin mr-2">⏳</span>
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            {isResetting ? "Resetting..." : "Restart"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
