/**
 * Empty State Component
 * 
 * Reusable empty state UI for when lists/tables have no data.
 * Provides consistent UX across the dashboard.
 */

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Main title */
  title: string;
  /** Description text */
  description: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  /** Optional secondary action */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Custom className for the card */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <Card className={`bg-card/50 border-border ${className || ""}`}>
      <CardContent className="pt-12 pb-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/50">
            <Icon className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {description}
            </p>
          </div>
          {(action || secondaryAction) && (
            <div className="flex items-center gap-3 pt-2">
              {action && (
                <Button
                  onClick={action.onClick}
                  size="sm"
                  className="gap-2"
                >
                  {action.icon && <action.icon className="w-4 h-4" />}
                  {action.label}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  onClick={secondaryAction.onClick}
                  variant="outline"
                  size="sm"
                >
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
