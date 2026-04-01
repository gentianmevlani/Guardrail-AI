/**
 * Loading State Component
 * 
 * Beautiful loading states that AI agents often miss
 * Multiple variants for different use cases
 */

import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import './LoadingState.css';

export interface LoadingStateProps {
  variant?: 'spinner' | 'skeleton' | 'dots' | 'pulse';
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  message = 'Loading...',
  fullScreen = false,
  size = 'md',
  className = '',
}) => {
  const containerClass = fullScreen
    ? `loading-state loading-state--fullscreen ${className}`
    : `loading-state ${className}`;

  return (
    <div className={containerClass}>
      <div className="loading-state__container">
        {variant === 'spinner' && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className={`loading-state__spinner loading-state__spinner--${size}`}
          >
            <Loader2 className="w-full h-full" />
          </motion.div>
        )}

        {variant === 'dots' && (
          <div className="loading-state__dots">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="loading-state__dot"
                animate={{
                  y: [0, -10, 0],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              />
            ))}
          </div>
        )}

        {variant === 'pulse' && (
          <motion.div
            className={`loading-state__pulse loading-state__pulse--${size}`}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
            }}
          />
        )}

        {variant === 'skeleton' && (
          <div className="loading-state__skeleton">
            <div className="loading-state__skeleton-line loading-state__skeleton-line--title" />
            <div className="loading-state__skeleton-line" />
            <div className="loading-state__skeleton-line loading-state__skeleton-line--short" />
          </div>
        )}

        {message && variant !== 'skeleton' && (
          <p className="loading-state__message">{message}</p>
        )}
      </div>
    </div>
  );
};

/**
 * Page Loading Component
 */
export const PageLoading: React.FC<{ message?: string }> = ({ message = 'Loading page...' }) => {
  return (
    <LoadingState
      variant="spinner"
      message={message}
      fullScreen
      size="lg"
    />
  );
};

/**
 * Button Loading Component
 */
export const ButtonLoading: React.FC = () => {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="button-loading"
    >
      <RefreshCw className="w-4 h-4" />
    </motion.div>
  );
};

export default LoadingState;

