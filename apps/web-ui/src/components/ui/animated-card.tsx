/**
 * Animated Card Component
 * Beautiful cards with hover effects and micro-interactions
 */

'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useHaptic } from '@/hooks/useHaptic';
import { cardHover, hoverLift } from '@/lib/animations';

/** DOM drag handlers conflict with Framer Motion's drag gesture types */
type DivHTMLWithoutDomDrag = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  | "onDrag"
  | "onDragEnd"
  | "onDragStart"
  | "onDragLeave"
  | "onDragOver"
  | "onDragEnter"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
>;

// =============================================================================
// ANIMATED CARD
// =============================================================================

interface AnimatedCardProps extends Omit<HTMLMotionProps<'div'>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> {
  hover?: boolean;
  clickable?: boolean;
  glow?: boolean;
  glass?: boolean;
  bordered?: boolean;
  haptic?: boolean;
  delay?: number;
}

export const AnimatedCard = React.forwardRef<HTMLDivElement, AnimatedCardProps>(
  (
    {
      children,
      className,
      hover = true,
      clickable = false,
      glow = false,
      glass = false,
      bordered = true,
      haptic = false,
      delay = 0,
      onClick,
      ...props
    },
    ref
  ) => {
    const hapticFeedback = useHaptic({ enabled: haptic });

    const handleClick = React.useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        if (haptic) {
          hapticFeedback.trigger('light');
        }
        onClick?.(e);
      },
      [haptic, hapticFeedback, onClick]
    );

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.4, ease: [0.4, 0.0, 0.2, 1] }}
        whileHover={
          hover
            ? {
                y: -8,
                transition: { duration: 0.2, ease: 'easeOut' },
              }
            : undefined
        }
        whileTap={clickable ? { scale: 0.98 } : undefined}
        onClick={handleClick}
        className={cn(
          'rounded-lg p-6 transition-all duration-300',
          bordered && 'border border-charcoal-700',
          glass
            ? 'bg-white/5 backdrop-blur-md'
            : 'bg-charcoal-800/50',
          hover && 'hover:shadow-xl hover:shadow-teal-500/10',
          glow && 'hover:shadow-2xl hover:shadow-teal-500/20',
          clickable && 'cursor-pointer',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

AnimatedCard.displayName = 'AnimatedCard';

// =============================================================================
// CARD HEADER
// =============================================================================

interface CardHeaderProps extends DivHTMLWithoutDomDrag {
  animated?: boolean;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, animated = true, ...props }, ref) => {
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className={cn('mb-4', className)}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cn('mb-4', className)} {...props}>
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// =============================================================================
// CARD TITLE
// =============================================================================

interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className, as: Component = 'h3', ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn('text-lg font-semibold text-foreground', className)}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

CardTitle.displayName = 'CardTitle';

// =============================================================================
// CARD DESCRIPTION
// =============================================================================

interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {}

export const CardDescription = React.forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

// =============================================================================
// CARD CONTENT
// =============================================================================

interface CardContentProps extends DivHTMLWithoutDomDrag {
  animated?: boolean;
}

export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className, animated = false, ...props }, ref) => {
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className={className}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// =============================================================================
// CARD FOOTER
// =============================================================================

interface CardFooterProps extends DivHTMLWithoutDomDrag {
  animated?: boolean;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, animated = true, ...props }, ref) => {
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className={cn('mt-4 pt-4 border-t border-charcoal-700', className)}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn('mt-4 pt-4 border-t border-charcoal-700', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// =============================================================================
// STAT CARD
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  delay?: number;
  className?: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  description,
  icon,
  trend,
  trendValue,
  delay = 0,
  className,
  onClick,
}) => {
  const trendColors = {
    up: 'text-success',
    down: 'text-destructive',
    neutral: 'text-muted-foreground',
  };

  const trendIcons = {
    up: '↑',
    down: '↓',
    neutral: '→',
  };

  return (
    <AnimatedCard
      delay={delay}
      clickable={!!onClick}
      hover
      onClick={onClick}
      className={className}
    >
      <div className="flex items-start justify-between mb-4">
        <CardDescription>{title}</CardDescription>
        {icon && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
            className="p-2 bg-teal-500/10 rounded-lg"
          >
            {icon}
          </motion.div>
        )}
      </div>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: delay + 0.1, duration: 0.3 }}
        className="text-3xl font-bold text-foreground mb-2"
      >
        {value}
      </motion.div>
      {description && <CardDescription>{description}</CardDescription>}
      {trend && trendValue && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delay + 0.3, duration: 0.3 }}
          className={cn('flex items-center gap-1 text-sm mt-2', trendColors[trend])}
        >
          <span>{trendIcons[trend]}</span>
          <span>{trendValue}</span>
        </motion.div>
      )}
    </AnimatedCard>
  );
};

// =============================================================================
// GRID LAYOUT
// =============================================================================

interface CardGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  columns = 3,
  className,
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.1,
          },
        },
      }}
      className={cn('grid gap-6', gridClasses[columns], className)}
    >
      {children}
    </motion.div>
  );
};

// =============================================================================
// FEATURE CARD
// =============================================================================

interface FeatureCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  href?: string;
  delay?: number;
  className?: string;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  href,
  delay = 0,
  className,
}) => {
  const CardWrapper = href ? motion.a : motion.div;
  const wrapperProps = href ? { href } : {};

  return (
    <CardWrapper
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
      className={cn(
        'block rounded-lg border border-charcoal-700 bg-charcoal-800/50 p-6 transition-all hover:shadow-xl hover:shadow-teal-500/10',
        href && 'cursor-pointer',
        className
      )}
      {...wrapperProps}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: delay + 0.1, type: 'spring', stiffness: 200 }}
          className="mb-4 inline-flex p-3 bg-teal-500/10 rounded-lg"
        >
          {icon}
        </motion.div>
      )}
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </CardWrapper>
  );
};
