"use client";

import { ReactNode, useEffect, useRef, useState } from "react";

interface LazyBackgroundProps {
  children: ReactNode;
  /** Placeholder shown before background loads */
  placeholder?: ReactNode;
  /** Root margin for intersection observer (default: "200px") */
  rootMargin?: string;
  /** Minimum delay before showing background (ms) - helps with initial paint */
  minDelay?: number;
  className?: string;
}

/**
 * Lazy-loads heavy background components (Three.js, WebGL, etc.)
 * Only renders children when visible in viewport + after minDelay
 * Significantly improves FCP and TTI by deferring heavy components
 */
export function LazyBackground({
  children,
  placeholder = null,
  rootMargin = "200px",
  minDelay = 1000,
  className,
}: LazyBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Intersection observer for visibility
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0 },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [rootMargin]);

  // Delay rendering to not block initial paint
  useEffect(() => {
    if (!isVisible) return;

    const timer = setTimeout(() => {
      setIsReady(true);
    }, minDelay);

    return () => clearTimeout(timer);
  }, [isVisible, minDelay]);

  return (
    <div ref={containerRef} className={className}>
      {isReady ? children : placeholder}
    </div>
  );
}

/**
 * Simple fade-in wrapper for lazy-loaded content
 */
export function FadeIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transition: "opacity 0.5s ease-out",
      }}
    >
      {children}
    </div>
  );
}
