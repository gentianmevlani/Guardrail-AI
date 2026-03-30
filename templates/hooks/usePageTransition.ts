/**
 * Page Transition Hook
 * 
 * Beautiful page transitions that AI agents often miss
 */

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { gsap } from 'gsap';

export function usePageTransition() {
  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    // Fade in on mount
    gsap.fromTo(
      'body',
      { opacity: 0 },
      { opacity: 1, duration: 0.3, ease: 'power2.out' }
    );
  }, []);

  useEffect(() => {
    // Transition on route change
    setIsTransitioning(true);
    
    const tl = gsap.timeline({
      onComplete: () => setIsTransitioning(false),
    });

    tl.to('.page-content', {
      opacity: 0,
      y: -20,
      duration: 0.2,
      ease: 'power2.in',
    })
    .set('.page-content', { y: 20 })
    .to('.page-content', {
      opacity: 1,
      y: 0,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, [location.pathname]);

  return { isTransitioning };
}

/**
 * Fade transition
 */
export function useFadeTransition(duration: number = 0.5) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 50);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isVisible) {
      gsap.to('.fade-transition', {
        opacity: 1,
        duration,
        ease: 'power2.out',
      });
    }
  }, [isVisible, duration]);

  return isVisible;
}

/**
 * Slide transition
 */
export function useSlideTransition(direction: 'left' | 'right' | 'up' | 'down' = 'left') {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), 50);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isVisible) {
      const directions = {
        left: { x: 0 },
        right: { x: 0 },
        up: { y: 0 },
        down: { y: 0 },
      };

      const from = {
        left: { x: -100 },
        right: { x: 100 },
        up: { y: -100 },
        down: { y: 100 },
      };

      gsap.fromTo(
        '.slide-transition',
        { ...from[direction], opacity: 0 },
        { ...directions[direction], opacity: 1, duration: 0.6, ease: 'power2.out' }
      );
    }
  }, [isVisible, direction]);

  return isVisible;
}

