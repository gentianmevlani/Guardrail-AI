/**
 * Animation Utilities & Variants Library
 * Centralized animation configurations for consistent micro-interactions
 */

import { Variants, Transition } from 'framer-motion';

// =============================================================================
// SPRING CONFIGURATIONS
// =============================================================================

export const spring = {
  // Ultra-smooth spring for premium feel
  smooth: {
    type: 'spring' as const,
    stiffness: 260,
    damping: 20,
  },
  // Bouncy spring for playful interactions
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 17,
  },
  // Gentle spring for subtle movements
  gentle: {
    type: 'spring' as const,
    stiffness: 120,
    damping: 14,
  },
  // Snappy spring for instant feedback
  snappy: {
    type: 'spring' as const,
    stiffness: 500,
    damping: 30,
  },
  // Molasses spring for dramatic effects
  slow: {
    type: 'spring' as const,
    stiffness: 80,
    damping: 15,
  },
} as const;

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

export const easing = {
  // Apple-style easing curves
  easeInOut: [0.4, 0.0, 0.2, 1],
  easeOut: [0.0, 0.0, 0.2, 1],
  easeIn: [0.4, 0.0, 1, 1],
  // Material Design curves
  standard: [0.4, 0.0, 0.2, 1],
  decelerate: [0.0, 0.0, 0.2, 1],
  accelerate: [0.4, 0.0, 1, 1],
  // Custom curves
  smooth: [0.25, 0.1, 0.25, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
  elastic: [0.68, -0.6, 0.32, 1.6],
} as const;

// =============================================================================
// DURATION PRESETS
// =============================================================================

export const duration = {
  instant: 0.1,
  fast: 0.2,
  normal: 0.3,
  medium: 0.4,
  slow: 0.5,
  slower: 0.7,
  slowest: 1.0,
} as const;

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

export const transition: Record<string, Transition> = {
  default: {
    duration: duration.normal,
    ease: easing.easeInOut,
  },
  smooth: {
    duration: duration.medium,
    ease: easing.smooth,
  },
  fast: {
    duration: duration.fast,
    ease: easing.easeOut,
  },
  bouncy: spring.bouncy,
  gentle: spring.gentle,
} as const;

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

/**
 * Fade animations
 */
export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/**
 * Slide animations
 */
export const slideUpVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideDownVariants: Variants = {
  hidden: { opacity: 0, y: -20 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 20 },
};

export const slideLeftVariants: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
};

export const slideRightVariants: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

/**
 * Scale animations
 */
export const scaleVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const scaleUpVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.1 },
};

export const popVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: spring.bouncy,
  },
  exit: { opacity: 0, scale: 0.5 },
};

/**
 * Hover & Tap Interactions
 */
export const hoverLift = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -4,
    scale: 1.02,
    transition: spring.smooth,
  },
  tap: {
    y: -2,
    scale: 0.98,
    transition: spring.snappy,
  },
};

export const hoverScale = {
  rest: { scale: 1 },
  hover: {
    scale: 1.05,
    transition: spring.smooth,
  },
  tap: {
    scale: 0.95,
    transition: spring.snappy,
  },
};

export const hoverGlow = {
  rest: {
    boxShadow: '0 0 0 rgba(20, 184, 166, 0)',
  },
  hover: {
    boxShadow: '0 8px 30px rgba(20, 184, 166, 0.3)',
    transition: transition.smooth,
  },
};

/**
 * Button press interaction
 */
export const buttonPress = {
  scale: 0.95,
  transition: spring.snappy,
};

/**
 * Card hover interaction
 */
export const cardHover: Variants = {
  rest: {
    y: 0,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  hover: {
    y: -8,
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    transition: spring.smooth,
  },
};

/**
 * List stagger animations
 */
/** Note: avoid opacity:0 in "hidden" — if Framer never completes, lists stay invisible. */
export const listContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
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
};

export const listItemVariants: Variants = {
  hidden: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring.smooth,
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.9,
  },
};

/**
 * Page transition variants
 */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 20,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: duration.medium,
      ease: easing.easeOut,
      staggerChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: {
      duration: duration.fast,
      ease: easing.easeIn,
    },
  },
};

/**
 * Modal/Dialog variants
 */
export const modalOverlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.fast },
  },
  exit: {
    opacity: 0,
    transition: { duration: duration.fast },
  },
};

export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: spring.smooth,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: transition.fast,
  },
};

/**
 * Drawer variants (slide from side)
 */
export const drawerVariants: Variants = {
  hidden: { x: '100%' },
  visible: {
    x: 0,
    transition: spring.smooth,
  },
  exit: {
    x: '100%',
    transition: transition.fast,
  },
};

/**
 * Notification/Toast variants
 */
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -100,
    scale: 0.8,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: spring.bouncy,
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: transition.fast,
  },
};

/**
 * Expand/Collapse variants
 */
export const expandVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: {
      height: spring.smooth,
      opacity: { duration: duration.fast, delay: 0.1 },
    },
  },
};

/**
 * Skeleton loading variants
 */
export const skeletonVariants: Variants = {
  loading: {
    opacity: [0.5, 1, 0.5],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const shimmerVariants: Variants = {
  shimmer: {
    x: ['-100%', '100%'],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

/**
 * Attention-grabbing variants
 */
export const pulseVariants: Variants = {
  pulse: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const shakeVariants: Variants = {
  shake: {
    x: [0, -10, 10, -10, 10, 0],
    transition: {
      duration: 0.5,
      ease: 'easeInOut',
    },
  },
};

export const bounceVariants: Variants = {
  bounce: {
    y: [0, -20, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Number counter variants
 */
export const counterVariants: Variants = {
  initial: {
    y: 20,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
    transition: spring.bouncy,
  },
};

/**
 * Floating animation (continuous)
 */
export const floatingVariants: Variants = {
  float: {
    y: [0, -10, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

/**
 * Rotate animation (continuous)
 */
export const rotateVariants: Variants = {
  rotate: {
    rotate: 360,
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Creates a custom stagger container
 */
export const createStagger = (staggerTime: number = 0.1, delayTime: number = 0) => ({
  visible: {
    transition: {
      staggerChildren: staggerTime,
      delayChildren: delayTime,
    },
  },
});

/**
 * Creates a custom delay
 */
export const withDelay = (delay: number, variants: Variants) => ({
  ...variants,
  visible: {
    ...variants.visible,
    transition: {
      ...(variants.visible as any).transition,
      delay,
    },
  },
});

/**
 * Combines multiple variants
 */
export const combineVariants = (...variants: Variants[]): Variants => {
  return variants.reduce((acc, curr) => ({
    ...acc,
    ...curr,
  }), {});
};

/**
 * Creates responsive transition based on reduced motion preference
 */
export const respectMotionPreference = (
  enabledTransition: Transition,
  prefersReducedMotion: boolean = false
): Transition => {
  if (prefersReducedMotion) {
    return { duration: 0.01 };
  }
  return enabledTransition;
};
