/**
 * Animated Button Component
 * Enhanced button with micro-interactions, haptic feedback, and smooth animations
 */

'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { useHaptic, type HapticStyle } from '@/hooks/useHaptic';
import { spring, buttonPress, hoverLift } from '@/lib/animations';

// =============================================================================
// BUTTON VARIANTS
// =============================================================================

const animatedButtonVariants = cva(
  'relative inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 overflow-hidden',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40',
        destructive:
          'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40',
        outline:
          'border-2 border-teal-500/30 bg-background/50 backdrop-blur-sm hover:bg-teal-500/10 hover:border-teal-500',
        secondary:
          'bg-gradient-to-br from-charcoal-700 to-charcoal-800 text-white shadow-lg hover:shadow-xl',
        ghost: 'hover:bg-teal-500/10 hover:text-teal-500',
        link: 'text-teal-500 underline-offset-4 hover:underline',
        gradient:
          'bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500 text-white shadow-lg hover:shadow-2xl',
        glow: 'bg-teal-500 text-white shadow-lg shadow-teal-500/50 hover:shadow-teal-500/70 hover:shadow-2xl',
        glass:
          'bg-white/10 backdrop-blur-md border border-white/20 text-white shadow-lg hover:bg-white/20',
        shimmer:
          'bg-gradient-to-r from-teal-400 via-teal-500 to-teal-400 bg-[length:200%_100%] text-white shadow-lg hover:shadow-xl animate-shimmer',
      },
      size: {
        default: 'h-11 px-6 py-2.5',
        sm: 'h-9 rounded-md px-4 text-xs',
        lg: 'h-14 rounded-xl px-10 text-base',
        xl: 'h-16 rounded-xl px-12 text-lg',
        icon: 'h-11 w-11',
        'icon-sm': 'h-9 w-9',
        'icon-lg': 'h-14 w-14',
      },
      animation: {
        none: '',
        lift: 'hover:-translate-y-0.5',
        scale: 'active:scale-95',
        pulse: 'hover:animate-pulse',
        bounce: 'hover:animate-bounce',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      animation: 'scale',
    },
  }
);

// =============================================================================
// BUTTON INTERFACE
// =============================================================================

export interface AnimatedButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'size'>,
    VariantProps<typeof animatedButtonVariants> {
  asChild?: boolean;
  haptic?: boolean;
  hapticStyle?: HapticStyle;
  ripple?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  pulseOnMount?: boolean;
}

// =============================================================================
// ANIMATED BUTTON COMPONENT
// =============================================================================

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  (
    {
      className,
      variant,
      size,
      animation,
      asChild = false,
      haptic = true,
      hapticStyle = 'light',
      ripple = true,
      loading = false,
      loadingText,
      icon,
      iconPosition = 'left',
      pulseOnMount = false,
      children,
      onClick,
      onMouseDown,
      ...props
    },
    ref
  ) => {
    const [ripples, setRipples] = React.useState<
      Array<{ x: number; y: number; id: number }>
    >([]);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const hapticFeedback = useHaptic({ enabled: haptic });

    // Combine refs
    React.useImperativeHandle(ref, () => buttonRef.current!);

    // Handle ripple effect
    const handleRipple = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (!ripple || loading || props.disabled) return;

        const button = buttonRef.current;
        if (!button) return;

        const rect = button.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const id = Date.now();

        setRipples((prev) => [...prev, { x, y, id }]);

        // Remove ripple after animation
        setTimeout(() => {
          setRipples((prev) => prev.filter((r) => r.id !== id));
        }, 600);
      },
      [ripple, loading, props.disabled]
    );

    // Handle click with haptics
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (loading || props.disabled) {
          event.preventDefault();
          return;
        }

        // Trigger haptic feedback
        if (haptic) {
          hapticFeedback.trigger(hapticStyle);
        }

        // Call original onClick
        onClick?.(event);
      },
      [loading, props.disabled, haptic, hapticFeedback, hapticStyle, onClick]
    );

    // Handle mouse down
    const handleMouseDown = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        handleRipple(event);
        onMouseDown?.(event);
      },
      [handleRipple, onMouseDown]
    );

    // Animation variants
    const variants = {
      initial: pulseOnMount ? { scale: 1.1, opacity: 0 } : { scale: 1, opacity: 1 },
      animate: { scale: 1, opacity: 1 },
      hover: { scale: 1.02, y: -2 },
      tap: buttonPress,
    };

    const Comp = asChild ? Slot : motion.button;

    return (
      // Framer Motion + Radix Slot: prop sets diverge for `asChild`
      // @ts-expect-error — motion.button vs Slot
      <Comp
        ref={buttonRef}
        className={cn(animatedButtonVariants({ variant, size, animation, className }))}
        variants={variants}
        initial="initial"
        animate="animate"
        whileHover={!loading && !props.disabled ? 'hover' : undefined}
        whileTap={!loading && !props.disabled ? 'tap' : undefined}
        transition={spring.smooth}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        disabled={loading || props.disabled}
        {...props}
      >
        {/* Ripple effects */}
        {ripples.map(({ x, y, id }) => (
          <span
            key={id}
            className="absolute rounded-full bg-white/30 pointer-events-none"
            style={{
              left: x,
              top: y,
              width: 0,
              height: 0,
              animation: 'ripple 600ms ease-out',
            }}
          />
        ))}

        {/* Loading spinner */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-current/10"
          >
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          </motion.div>
        )}

        {/* Button content */}
        <span
          className={cn(
            'flex items-center gap-2 transition-opacity',
            loading && 'opacity-0'
          )}
        >
          {icon && iconPosition === 'left' && (
            <motion.span
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {icon}
            </motion.span>
          )}
          {loading && loadingText ? loadingText : (children as React.ReactNode)}
          {icon && iconPosition === 'right' && (
            <motion.span
              initial={{ x: 10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {icon}
            </motion.span>
          )}
        </span>

        {/* Shine effect on hover (for certain variants) */}
        {(variant === 'gradient' || variant === 'glow') && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            initial={{ x: '-100%' }}
            whileHover={{ x: '100%' }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
          />
        )}
      </Comp>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';

// =============================================================================
// BUTTON GROUP COMPONENT
// =============================================================================

interface ButtonGroupProps {
  children: React.ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  className,
  orientation = 'horizontal',
  spacing = 'sm',
}) => {
  const spacingClasses = {
    none: 'gap-0',
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const orientationClasses = {
    horizontal: 'flex-row',
    vertical: 'flex-col',
  };

  return (
    <div
      className={cn(
        'flex',
        orientationClasses[orientation],
        spacingClasses[spacing],
        className
      )}
    >
      {children}
    </div>
  );
};

// =============================================================================
// PRESET BUTTON COMPONENTS
// =============================================================================

const PrimaryButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="default" {...props} />);
PrimaryButton.displayName = 'PrimaryButton';

const SecondaryButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="secondary" {...props} />);
SecondaryButton.displayName = 'SecondaryButton';

const OutlineButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="outline" {...props} />);
OutlineButton.displayName = 'OutlineButton';

const GhostButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="ghost" {...props} />);
GhostButton.displayName = 'GhostButton';

const DestructiveButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="destructive" {...props} />);
DestructiveButton.displayName = 'DestructiveButton';

const GradientButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="gradient" {...props} />);
GradientButton.displayName = 'GradientButton';

const GlowButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="glow" {...props} />);
GlowButton.displayName = 'GlowButton';

const GlassButton = React.forwardRef<
  HTMLButtonElement,
  Omit<AnimatedButtonProps, 'variant'>
>((props, ref) => <AnimatedButton ref={ref} variant="glass" {...props} />);
GlassButton.displayName = 'GlassButton';

// =============================================================================
// ICON BUTTON COMPONENT
// =============================================================================

interface IconButtonProps extends Omit<AnimatedButtonProps, 'children'> {
  icon: React.ReactNode;
  'aria-label': string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, size = 'icon', ...props }, ref) => {
    return (
      <AnimatedButton ref={ref} size={size} {...props}>
        {icon}
      </AnimatedButton>
    );
  }
);
IconButton.displayName = 'IconButton';

// =============================================================================
// EXPORTS
// =============================================================================

export {
  AnimatedButton,
  ButtonGroup,
  PrimaryButton,
  SecondaryButton,
  OutlineButton,
  GhostButton,
  DestructiveButton,
  GradientButton,
  GlowButton,
  GlassButton,
  IconButton,
  animatedButtonVariants,
};

// =============================================================================
// ADD RIPPLE ANIMATION TO GLOBAL STYLES
// =============================================================================

// Add this to your global CSS:
/*
@keyframes ripple {
  to {
    width: 500px;
    height: 500px;
    opacity: 0;
    transform: translate(-50%, -50%);
  }
}
*/
