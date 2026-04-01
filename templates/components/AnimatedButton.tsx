/**
 * Animated Button Component
 * 
 * Beautiful button with animations that AI agents often miss
 * Includes: hover effects, click animations, loading states, ripple effects
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import './AnimatedButton.css';

export interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rippleId = useRef(0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 500, damping: 30 });
  const springY = useSpring(y, { stiffness: 500, damping: 30 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!buttonRef.current || disabled || loading) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      x.set((e.clientX - centerX) * 0.1);
      y.set((e.clientY - centerY) * 0.1);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
    };

    const button = buttonRef.current;
    if (button) {
      button.addEventListener('mousemove', handleMouseMove);
      button.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      if (button) {
        button.removeEventListener('mousemove', handleMouseMove);
        button.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [disabled, loading, x, y]);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || loading) return;

    // Ripple effect
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newRipple = {
        id: rippleId.current++,
        x,
        y,
      };

      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
      }, 600);
    }

    onClick?.();
  };

  const baseClasses = `animated-button animated-button--${variant} animated-button--${size} ${
    fullWidth ? 'animated-button--full-width' : ''
  } ${disabled ? 'animated-button--disabled' : ''} ${loading ? 'animated-button--loading' : ''} ${className}`;

  return (
    <motion.button
      ref={buttonRef}
      className={baseClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : {}}
      whileTap={!disabled && !loading ? { scale: 0.98 } : {}}
      style={{
        x: springX,
        y: springY,
      }}
    >
      {/* Ripple effects */}
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          className="animated-button__ripple"
          initial={{ scale: 0, opacity: 0.6 }}
          animate={{ scale: 4, opacity: 0 }}
          exit={{ opacity: 0 }}
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        />
      ))}

      {/* Content */}
      <span className="animated-button__content">
        {loading ? (
          <>
            <motion.span
              className="animated-button__spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && (
              <span className="animated-button__icon animated-button__icon--left">
                {icon}
              </span>
            )}
            <span>{children}</span>
            {icon && iconPosition === 'right' && (
              <span className="animated-button__icon animated-button__icon--right">
                {icon}
              </span>
            )}
          </>
        )}
      </span>

      {/* Shine effect */}
      <motion.span
        className="animated-button__shine"
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6 }}
      />
    </motion.button>
  );
};

export default AnimatedButton;

