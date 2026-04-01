'use client';

import { useEffect, useRef } from 'react';
import Lenis from '@studio-freight/lenis';
import { useReducedMotion } from '@/hooks/useMediaQuery';

interface SmoothScrollProviderProps {
  children: React.ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Expose lenis instance globally for debugging
    if (typeof window !== 'undefined') {
      (window as any).lenis = lenis;
    }

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [prefersReducedMotion]);

  return <>{children}</>;
}
