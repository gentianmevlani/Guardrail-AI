/**
 * GSAP Animation Setup Template
 * 
 * Complete GSAP setup with common animations that AI agents often miss
 */

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { TextPlugin } from 'gsap/TextPlugin';

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger, TextPlugin);

/**
 * Fade In Animation
 * Use: fadeIn(element, duration, delay)
 */
export function fadeIn(
  element: HTMLElement | string,
  duration: number = 0.6,
  delay: number = 0
) {
  return gsap.fromTo(
    element,
    { opacity: 0, y: 20 },
    {
      opacity: 1,
      y: 0,
      duration,
      delay,
      ease: 'power2.out',
    }
  );
}

/**
 * Slide In Animation
 * Use: slideIn(element, direction, duration)
 */
export function slideIn(
  element: HTMLElement | string,
  direction: 'left' | 'right' | 'up' | 'down' = 'left',
  duration: number = 0.6
) {
  const directions = {
    left: { x: -100, y: 0 },
    right: { x: 100, y: 0 },
    up: { x: 0, y: 100 },
    down: { x: 0, y: -100 },
  };

  return gsap.fromTo(
    element,
    { ...directions[direction], opacity: 0 },
    {
      x: 0,
      y: 0,
      opacity: 1,
      duration,
      ease: 'power2.out',
    }
  );
}

/**
 * Scale In Animation
 * Use: scaleIn(element, duration)
 */
export function scaleIn(
  element: HTMLElement | string,
  duration: number = 0.5
) {
  return gsap.fromTo(
    element,
    { scale: 0, opacity: 0 },
    {
      scale: 1,
      opacity: 1,
      duration,
      ease: 'back.out(1.7)',
    }
  );
}

/**
 * Stagger Animation
 * Use: staggerIn(selector, delay, duration)
 */
export function staggerIn(
  selector: string,
  staggerDelay: number = 0.1,
  duration: number = 0.6
) {
  return gsap.fromTo(
    selector,
    { opacity: 0, y: 30 },
    {
      opacity: 1,
      y: 0,
      duration,
      stagger: staggerDelay,
      ease: 'power2.out',
    }
  );
}

/**
 * Scroll Trigger Animation
 * Use: scrollReveal(element, trigger)
 */
export function scrollReveal(
  element: HTMLElement | string,
  trigger?: HTMLElement | string
) {
  return gsap.fromTo(
    element,
    { opacity: 0, y: 50 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: trigger || element,
        start: 'top 80%',
        toggleActions: 'play none none reverse',
      },
    }
  );
}

/**
 * Hover Scale Animation
 * Use: hoverScale(element, scale)
 */
export function hoverScale(
  element: HTMLElement | string,
  scale: number = 1.05
) {
  const el = typeof element === 'string' ? document.querySelector(element) : element;
  if (!el) return;

  el.addEventListener('mouseenter', () => {
    gsap.to(element, {
      scale,
      duration: 0.3,
      ease: 'power2.out',
    });
  });

  el.addEventListener('mouseleave', () => {
    gsap.to(element, {
      scale: 1,
      duration: 0.3,
      ease: 'power2.out',
    });
  });
}

/**
 * Text Reveal Animation
 * Use: textReveal(element, text)
 */
export function textReveal(
  element: HTMLElement | string,
  text: string,
  duration: number = 1
) {
  return gsap.to(element, {
    duration,
    text: {
      value: text,
    },
    ease: 'none',
  });
}

/**
 * Loading Spinner Animation
 * Use: loadingSpinner(element)
 */
export function loadingSpinner(element: HTMLElement | string) {
  return gsap.to(element, {
    rotation: 360,
    duration: 1,
    repeat: -1,
    ease: 'none',
  });
}

/**
 * Pulse Animation
 * Use: pulse(element, scale)
 */
export function pulse(
  element: HTMLElement | string,
  scale: number = 1.1
) {
  return gsap.to(element, {
    scale,
    duration: 0.5,
    repeat: -1,
    yoyo: true,
    ease: 'power1.inOut',
  });
}

/**
 * Timeline Builder
 * Use: createTimeline() for complex animations
 */
export function createTimeline() {
  return gsap.timeline();
}

// Export default animation presets
export const animations = {
  fadeIn,
  slideIn,
  scaleIn,
  staggerIn,
  scrollReveal,
  hoverScale,
  textReveal,
  loadingSpinner,
  pulse,
  createTimeline,
};

