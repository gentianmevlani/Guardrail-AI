/**
 * Mobile Edge Cases
 * 
 * What AI app builders forget: Small devices, virtual keyboards, landscape
 */

import React, { useEffect, useState } from 'react';
import './MobileEdgeCases.css';

/**
 * Detect mobile device
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || window.innerWidth < 768
      );
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Detect virtual keyboard
 */
export function useVirtualKeyboard(): boolean {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const initialHeight = window.innerHeight;

    const handleResize = () => {
      const currentHeight = window.innerHeight;
      // If height decreased significantly, keyboard is likely open
      setKeyboardOpen(currentHeight < initialHeight * 0.75);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return keyboardOpen;
}

/**
 * Mobile-optimized container
 */
export const MobileContainer: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  const isMobile = useIsMobile();
  const keyboardOpen = useVirtualKeyboard();

  return (
    <div
      className={`mobile-container ${isMobile ? 'mobile' : ''} ${
        keyboardOpen ? 'keyboard-open' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * Safe area insets for notched devices
 */
export const SafeArea: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div className={`safe-area ${className}`}>
      {children}
    </div>
  );
};

