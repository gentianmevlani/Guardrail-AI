"use client";

import { useEffect, useState } from "react";

interface LoadingAnnouncerProps {
  isLoading: boolean;
  loadingMessage?: string;
  completedMessage?: string;
  errorMessage?: string;
  hasError?: boolean;
}

/**
 * LoadingAnnouncer - Accessibility component for announcing loading states to screen readers
 * 
 * Usage:
 * <LoadingAnnouncer 
 *   isLoading={isLoading} 
 *   loadingMessage="Loading data..."
 *   completedMessage="Data loaded successfully"
 *   errorMessage="Failed to load data"
 *   hasError={hasError}
 * />
 */
export function LoadingAnnouncer({
  isLoading,
  loadingMessage = "Loading...",
  completedMessage = "Content loaded",
  errorMessage = "An error occurred",
  hasError = false,
}: LoadingAnnouncerProps) {
  const [announcement, setAnnouncement] = useState<string>("");

  useEffect(() => {
    if (isLoading) {
      setAnnouncement(loadingMessage);
    } else if (hasError) {
      setAnnouncement(errorMessage);
    } else {
      setAnnouncement(completedMessage);
    }
  }, [isLoading, hasError, loadingMessage, completedMessage, errorMessage]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

interface ProgressAnnouncerProps {
  progress: number;
  label?: string;
  announceInterval?: number;
}

/**
 * ProgressAnnouncer - Announces progress updates to screen readers at intervals
 * 
 * Usage:
 * <ProgressAnnouncer progress={75} label="Upload progress" announceInterval={25} />
 */
export function ProgressAnnouncer({
  progress,
  label = "Progress",
  announceInterval = 25,
}: ProgressAnnouncerProps) {
  const [lastAnnounced, setLastAnnounced] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const roundedProgress = Math.floor(progress / announceInterval) * announceInterval;
    
    if (roundedProgress > lastAnnounced || progress === 100) {
      setLastAnnounced(roundedProgress);
      if (progress === 100) {
        setAnnouncement(`${label}: Complete`);
      } else {
        setAnnouncement(`${label}: ${roundedProgress}%`);
      }
    }
  }, [progress, lastAnnounced, announceInterval, label]);

  return (
    <div
      role="progressbar"
      aria-live="polite"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

export default LoadingAnnouncer;
