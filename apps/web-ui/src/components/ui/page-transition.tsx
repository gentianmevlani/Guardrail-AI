/**
 * Page Transition Component
 * Smooth page transitions for dashboard navigation
 */

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { pageVariants, fadeVariants, slideUpVariants } from '@/lib/animations';

// =============================================================================
// PAGE TRANSITION WRAPPER
// =============================================================================

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'fade' | 'slide' | 'scale' | 'none';
}

export function PageTransition({
  children,
  className,
  variant = 'slide',
}: PageTransitionProps) {
  const pathname = usePathname();

  const variants = {
    fade: fadeVariants,
    slide: slideUpVariants,
    scale: {
      hidden: { opacity: 0, scale: 0.95 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 1.05 },
    },
    none: {},
  };

  if (variant === 'none') {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        variants={variants[variant]}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{
          duration: 0.3,
          ease: [0.4, 0.0, 0.2, 1],
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// STAGGER PAGE TRANSITION
// =============================================================================

interface StaggerPageTransitionProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerPageTransition({
  children,
  className,
  staggerDelay = 0.1,
}: StaggerPageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: staggerDelay,
              delayChildren: 0.1,
            },
          },
          exit: {
            opacity: 0,
            transition: {
              staggerChildren: 0.05,
              staggerDirection: -1,
            },
          },
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// =============================================================================
// ROUTE CHANGE PROGRESS BAR
// =============================================================================

export function RouteProgressBar() {
  const [isLoading, setIsLoading] = React.useState(false);
  const pathname = usePathname();
  const prevPathname = React.useRef(pathname);

  React.useEffect(() => {
    if (pathname !== prevPathname.current) {
      setIsLoading(true);
      prevPathname.current = pathname;

      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-teal-500 via-cyan-500 to-emerald-500"
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{ transformOrigin: '0%' }}
        />
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// CONTENT SECTION TRANSITION
// =============================================================================

interface ContentSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function ContentSection({
  children,
  className,
  delay = 0,
}: ContentSectionProps) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// ANIMATED CONTAINER
// =============================================================================

interface AnimatedContainerProps {
  children: React.ReactNode;
  className?: string;
  stagger?: boolean;
  staggerDelay?: number;
  delay?: number;
}

export function AnimatedContainer({
  children,
  className,
  stagger = false,
  staggerDelay = 0.1,
  delay = 0,
}: AnimatedContainerProps) {
  if (stagger) {
    return (
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: staggerDelay,
              delayChildren: delay,
            },
          },
        }}
        initial="hidden"
        animate="visible"
        className={className}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// FADE IN VIEW (Scroll-triggered animation)
// =============================================================================

interface FadeInViewProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}

export function FadeInView({
  children,
  className,
  delay = 0,
  threshold = 0.1,
}: FadeInViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: threshold }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// SLIDE IN VIEW (Scroll-triggered animation from side)
// =============================================================================

interface SlideInViewProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'left' | 'right' | 'up' | 'down';
  delay?: number;
  threshold?: number;
}

export function SlideInView({
  children,
  className,
  direction = 'up',
  delay = 0,
  threshold = 0.1,
}: SlideInViewProps) {
  const directions = {
    left: { x: -50, y: 0 },
    right: { x: 50, y: 0 },
    up: { x: 0, y: 30 },
    down: { x: 0, y: -30 },
  };

  return (
    <motion.div
      initial={{ opacity: 0, ...directions[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, amount: threshold }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// =============================================================================
// SCALE IN VIEW (Scroll-triggered scale animation)
// =============================================================================

interface ScaleInViewProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  threshold?: number;
}

export function ScaleInView({
  children,
  className,
  delay = 0,
  threshold = 0.1,
}: ScaleInViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: threshold }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
