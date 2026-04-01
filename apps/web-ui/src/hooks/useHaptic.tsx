/**
 * Haptic Feedback Hook
 * Provides tactile feedback for user interactions across web and mobile
 */

import { logger } from '@/lib/logger';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error'
  | 'rigid'
  | 'soft';

export type VibrationPattern = number | number[];

// =============================================================================
// HAPTIC PATTERNS
// =============================================================================

const HAPTIC_PATTERNS: Record<HapticStyle, VibrationPattern> = {
  light: 10,
  medium: 20,
  heavy: 40,
  selection: 5,
  success: [10, 50, 10],
  warning: [20, 100, 20],
  error: [30, 100, 30, 100, 30],
  rigid: 15,
  soft: 8,
};

// =============================================================================
// HAPTIC ENGINE DETECTION
// =============================================================================

interface HapticCapabilities {
  vibration: boolean;
  tapticEngine: boolean;
  androidVibrator: boolean;
}

const SSR_CAPABILITIES: HapticCapabilities = {
  vibration: false,
  tapticEngine: false,
  androidVibrator: false,
};

/**
 * Detects device haptic capabilities (browser only — safe for SSR)
 */
const detectHapticCapabilities = (): HapticCapabilities => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return SSR_CAPABILITIES;
  }

  const hasVibration = 'vibrate' in navigator;

  const hasTapticEngine =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

  const hasAndroidVibrator =
    /Android/.test(navigator.userAgent) && hasVibration;

  return {
    vibration: hasVibration,
    tapticEngine: hasTapticEngine,
    androidVibrator: hasAndroidVibrator,
  };
};

// =============================================================================
// HAPTIC HOOK
// =============================================================================

export interface UseHapticOptions {
  enabled?: boolean;
  respectUserPreference?: boolean;
}

export interface UseHapticReturn {
  trigger: (style?: HapticStyle) => void;
  triggerPattern: (pattern: VibrationPattern) => void;
  isSupported: boolean;
  isEnabled: boolean;
  capabilities: HapticCapabilities;
  enable: () => void;
  disable: () => void;
  toggle: () => void;
}

/**
 * Hook for triggering haptic feedback
 */
export const useHaptic = (options: UseHapticOptions = {}): UseHapticReturn => {
  const { enabled: initialEnabled = true, respectUserPreference = true } = options;

  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [capabilities] = useState(() => detectHapticCapabilities());
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    if (!respectUserPreference) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [respectUserPreference]);

  // Check if device supports any form of haptic feedback
  const isSupported = capabilities.vibration || capabilities.tapticEngine;

  /**
   * Triggers haptic feedback with a specific style
   */
  const trigger = useCallback(
    (style: HapticStyle = 'light') => {
      // Don't trigger if disabled or user prefers reduced motion
      if (!isEnabled || !isSupported || (respectUserPreference && prefersReducedMotion)) {
        return;
      }

      const pattern = HAPTIC_PATTERNS[style];

      try {
        // Try iOS Haptic Feedback API (if available)
        if (capabilities.tapticEngine && 'vibrate' in navigator) {
          navigator.vibrate(pattern);
        }
        // Try standard Vibration API
        else if (capabilities.vibration && 'vibrate' in navigator) {
          navigator.vibrate(pattern);
        }
      } catch (error) {
        // Silently fail - haptics are non-critical
        logger.debug('Haptic feedback failed', { error });
      }
    },
    [isEnabled, isSupported, respectUserPreference, prefersReducedMotion, capabilities]
  );

  /**
   * Triggers haptic feedback with a custom pattern
   */
  const triggerPattern = useCallback(
    (pattern: VibrationPattern) => {
      if (!isEnabled || !isSupported || (respectUserPreference && prefersReducedMotion)) {
        return;
      }

      try {
        if ('vibrate' in navigator) {
          navigator.vibrate(pattern);
        }
      } catch (error) {
        logger.debug('Haptic feedback failed', { error });
      }
    },
    [isEnabled, isSupported, respectUserPreference, prefersReducedMotion]
  );

  /**
   * Enable haptic feedback
   */
  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  /**
   * Disable haptic feedback
   */
  const disable = useCallback(() => {
    setIsEnabled(false);
  }, []);

  /**
   * Toggle haptic feedback
   */
  const toggle = useCallback(() => {
    setIsEnabled((prev) => !prev);
  }, []);

  return {
    trigger,
    triggerPattern,
    isSupported,
    isEnabled,
    capabilities,
    enable,
    disable,
    toggle,
  };
};

// =============================================================================
// PREBUILT HAPTIC TRIGGERS
// =============================================================================

/**
 * Hook for button press haptics
 */
export const useButtonHaptic = (style: HapticStyle = 'light') => {
  const haptic = useHaptic();

  const onPress = useCallback(() => {
    haptic.trigger(style);
  }, [haptic, style]);

  return {
    onPress,
    onTouchStart: onPress,
    onClick: onPress,
  };
};

/**
 * Hook for success action haptics
 */
export const useSuccessHaptic = () => {
  const haptic = useHaptic();

  return useCallback(() => {
    haptic.trigger('success');
  }, [haptic]);
};

/**
 * Hook for error action haptics
 */
export const useErrorHaptic = () => {
  const haptic = useHaptic();

  return useCallback(() => {
    haptic.trigger('error');
  }, [haptic]);
};

/**
 * Hook for warning action haptics
 */
export const useWarningHaptic = () => {
  const haptic = useHaptic();

  return useCallback(() => {
    haptic.trigger('warning');
  }, [haptic]);
};

/**
 * Hook for selection haptics
 */
export const useSelectionHaptic = () => {
  const haptic = useHaptic();

  return useCallback(() => {
    haptic.trigger('selection');
  }, [haptic]);
};

// =============================================================================
// WEB VIBRATION HELPERS
// =============================================================================

/**
 * Helper to create custom vibration patterns
 */
export const createVibrationPattern = (
  ...intervals: Array<{ duration: number; pause?: number }>
): number[] => {
  const pattern: number[] = [];
  intervals.forEach(({ duration, pause = 0 }) => {
    pattern.push(duration, pause);
  });
  return pattern;
};

/**
 * Predefined haptic patterns for common UI interactions
 */
export const HapticPatterns = {
  // Single taps
  tap: HAPTIC_PATTERNS.light,
  click: HAPTIC_PATTERNS.medium,
  press: HAPTIC_PATTERNS.heavy,

  // Selections
  select: HAPTIC_PATTERNS.selection,
  toggle: [5, 30, 5],

  // Notifications
  notification: [10, 50, 10, 50, 10],
  alert: [30, 50, 30, 50, 30],

  // Feedback
  success: HAPTIC_PATTERNS.success,
  error: HAPTIC_PATTERNS.error,
  warning: HAPTIC_PATTERNS.warning,

  // Navigation
  pageChange: [15],
  swipe: [8, 20, 8],
  scroll: [5],

  // Special
  longPress: [50, 100, 50],
  doubleClick: [10, 50, 10],
  refresh: [20, 50, 20, 50, 20],
} as const;

// =============================================================================
// REACT COMPONENT HELPERS
// =============================================================================

/**
 * HOC to add haptic feedback to any component
 */
export const withHaptic = <P extends object>(
  Component: React.ComponentType<P>,
  style: HapticStyle = 'light'
) => {
  return (props: P) => {
    const hapticProps = useButtonHaptic(style);
    return <Component {...props} {...hapticProps} />;
  };
};

/**
 * Provider context for global haptic settings
 */
interface HapticContextValue {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const HapticContext = createContext<HapticContextValue | null>(null);

export const HapticProvider: React.FC<{
  children: React.ReactNode;
  defaultEnabled?: boolean;
}> = ({ children, defaultEnabled = true }) => {
  const [enabled, setEnabled] = useState(defaultEnabled);

  return (
    <HapticContext.Provider value={{ enabled, setEnabled }}>{children}</HapticContext.Provider>
  );
};

export const useHapticContext = () => {
  const context = useContext(HapticContext);
  if (!context) {
    throw new Error('useHapticContext must be used within HapticProvider');
  }
  return context;
};
