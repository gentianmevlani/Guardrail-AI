/**
 * Animation Hooks
 * Custom hooks for common animation patterns
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useInView } from 'framer-motion';
import { AnimationControls, useAnimation } from 'framer-motion';

// =============================================================================
// REDUCED MOTION HOOK
// =============================================================================

/**
 * Hook to detect user's reduced motion preference
 */
export const useReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
};

// =============================================================================
// SCROLL ANIMATION HOOKS
// =============================================================================

/**
 * Hook to animate element when it enters viewport
 */
export const useScrollAnimation = (options?: {
  threshold?: number;
  triggerOnce?: boolean;
}) => {
  const { threshold = 0.1, triggerOnce = true } = options || {};
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, {
    amount: threshold,
    once: triggerOnce,
  });

  return { ref, isInView };
};

/**
 * Hook to animate on scroll with custom controls
 */
export const useScrollAnimationControls = (options?: {
  threshold?: number;
  triggerOnce?: boolean;
}) => {
  const { threshold = 0.1, triggerOnce = true } = options || {};
  const ref = useRef<HTMLElement>(null);
  const controls = useAnimation();
  const isInView = useInView(ref, {
    amount: threshold,
    once: triggerOnce,
  });

  useEffect(() => {
    if (isInView) {
      controls.start('visible');
    } else if (!triggerOnce) {
      controls.start('hidden');
    }
  }, [isInView, controls, triggerOnce]);

  return { ref, controls, isInView };
};

// =============================================================================
// HOVER HOOKS
// =============================================================================

/**
 * Hook for hover state management with animations
 */
export const useHoverAnimation = () => {
  const [isHovered, setIsHovered] = useState(false);
  const controls = useAnimation();

  const handleHoverStart = useCallback(() => {
    setIsHovered(true);
    controls.start('hover');
  }, [controls]);

  const handleHoverEnd = useCallback(() => {
    setIsHovered(false);
    controls.start('rest');
  }, [controls]);

  return {
    isHovered,
    controls,
    handleHoverStart,
    handleHoverEnd,
    hoverProps: {
      onHoverStart: handleHoverStart,
      onHoverEnd: handleHoverEnd,
    },
  };
};

// =============================================================================
// STAGGER ANIMATION HOOKS
// =============================================================================

/**
 * Hook for stagger animations in lists
 */
export const useStaggerAnimation = (itemCount: number, staggerDelay: number = 0.1) => {
  const controls = useAnimation();

  const startAnimation = useCallback(() => {
    controls.start((i) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * staggerDelay,
      },
    }));
  }, [controls, staggerDelay]);

  return { controls, startAnimation };
};

// =============================================================================
// MOUNT/UNMOUNT ANIMATION HOOKS
// =============================================================================

/**
 * Hook to handle mount animations with delay
 */
export const useMountAnimation = (delay: number = 0) => {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay * 1000);

    return () => clearTimeout(timer);
  }, [delay]);

  return shouldRender;
};

/**
 * Hook for delayed visibility (useful for skeleton loaders)
 */
export const useDelayedVisibility = (delay: number = 300) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return isVisible;
};

// =============================================================================
// COUNTER ANIMATION HOOK
// =============================================================================

/**
 * Hook to animate number counting
 */
export const useCountAnimation = (
  end: number,
  duration: number = 2000,
  start: number = 0
) => {
  const [count, setCount] = useState(start);
  const countRef = useRef(start);
  const requestRef = useRef<number>();
  const startTimeRef = useRef<number>();

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const progress = timestamp - startTimeRef.current;
      const percentage = Math.min(progress / duration, 1);

      // Easing function (easeOutExpo)
      const easeOut = 1 - Math.pow(2, -10 * percentage);
      const currentCount = Math.floor(start + (end - start) * easeOut);

      if (currentCount !== countRef.current) {
        countRef.current = currentCount;
        setCount(currentCount);
      }

      if (percentage < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    },
    [start, end, duration]
  );

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [animate]);

  return count;
};

// =============================================================================
// LOADING STATE HOOK
// =============================================================================

/**
 * Hook for loading states with minimum display time
 */
export const useLoadingState = (
  isLoading: boolean,
  minDuration: number = 500
): boolean => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isLoading) {
      setShowLoading(true);
    } else {
      timerRef.current = setTimeout(() => {
        setShowLoading(false);
      }, minDuration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isLoading, minDuration]);

  return showLoading;
};

// =============================================================================
// SEQUENTIAL ANIMATION HOOK
// =============================================================================

/**
 * Hook for sequential animations
 */
export const useSequentialAnimation = (steps: number, delay: number = 1000) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (currentStep < steps) {
      const timer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [currentStep, steps, delay]);

  const reset = useCallback(() => {
    setCurrentStep(0);
  }, []);

  return { currentStep, reset, isComplete: currentStep >= steps };
};

// =============================================================================
// PARALLAX HOOK
// =============================================================================

/**
 * Hook for parallax scroll effects
 */
export const useParallax = (speed: number = 0.5) => {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!ref.current) return;

      const rect = ref.current.getBoundingClientRect();
      const scrolled = window.pageYOffset + rect.top;
      const parallaxOffset = scrolled * speed;

      setOffset(parallaxOffset);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial calculation

    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return { ref, offset };
};

// =============================================================================
// GESTURE ANIMATION HOOK
// =============================================================================

/**
 * Hook for drag gesture animations
 */
export const useDragControls = () => {
  const [isDragging, setIsDragging] = useState(false);
  const controls = useAnimation();

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    controls.start({ x: 0, y: 0 });
  }, [controls]);

  return {
    isDragging,
    controls,
    dragProps: {
      drag: true as const,
      dragControls: controls,
      onDragStart: handleDragStart,
      onDragEnd: handleDragEnd,
      dragElastic: 0.1,
      dragConstraints: { left: 0, right: 0, top: 0, bottom: 0 },
    },
  };
};

// =============================================================================
// ANIMATION PRESET HOOK
// =============================================================================

/**
 * Hook to get animation props based on preset
 */
export const useAnimationPreset = (preset: 'fade' | 'slide' | 'scale' | 'pop') => {
  const presets = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
    },
    slide: {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
    },
    scale: {
      initial: { opacity: 0, scale: 0.9 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.9 },
    },
    pop: {
      initial: { opacity: 0, scale: 0.5 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.5 },
    },
  };

  return presets[preset];
};

// =============================================================================
// VIEWPORT SIZE HOOK (for responsive animations)
// =============================================================================

/**
 * Hook to track viewport size for responsive animations
 */
export const useViewportSize = () => {
  const [size, setSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

// =============================================================================
// CYCLE ANIMATION HOOK
// =============================================================================

/**
 * Hook to cycle through animation states
 */
export const useCycleAnimation = <T extends string>(states: T[]) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % states.length);
  }, [states.length]);

  const previous = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + states.length) % states.length);
  }, [states.length]);

  const goto = useCallback((index: number) => {
    setCurrentIndex(index);
  }, []);

  return {
    current: states[currentIndex],
    currentIndex,
    next,
    previous,
    goto,
  };
};
