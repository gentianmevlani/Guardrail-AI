'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView, MotionValue } from 'framer-motion';
import { cn } from '@/lib/utils';

/**
 * ScrollGlowSection - Creates a pulsing glow effect when the section enters view
 * Similar to the "inset 0 0 50px 2px #00ADEF" effect from the example
 */
interface ScrollGlowSectionProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  glowIntensity?: number;
  pulseOnEnter?: boolean;
}

export function ScrollGlowSection({
  children,
  className,
  glowColor = 'rgba(59, 130, 246, 0.5)',
  glowIntensity = 50,
  pulseOnEnter = true,
}: ScrollGlowSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.3 });
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
    }
  }, [isInView, hasAnimated]);

  return (
    <motion.div
      ref={ref}
      className={cn('relative', className)}
      initial={{ 
        opacity: 0, 
        boxShadow: `inset 0 0 0px 0px ${glowColor}` 
      }}
      animate={isInView ? {
        opacity: 1,
        boxShadow: pulseOnEnter && hasAnimated ? [
          `inset 0 0 0px 0px ${glowColor}`,
          `inset 0 0 ${glowIntensity}px 2px ${glowColor}`,
          `inset 0 0 0px 0px ${glowColor}`,
        ] : `inset 0 0 0px 0px ${glowColor}`,
      } : {
        opacity: 0,
        boxShadow: `inset 0 0 0px 0px ${glowColor}`,
      }}
      transition={{ 
        duration: 1.5, 
        ease: 'easeOut',
        boxShadow: { duration: 2, times: [0, 0.5, 1] }
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScrollStackSection - Creates a stacking card effect as you scroll
 * Each section "sticks" and the next one slides over it
 */
interface ScrollStackSectionProps {
  children: React.ReactNode;
  className?: string;
  index?: number;
  total?: number;
  stickyOffset?: number;
}

export function ScrollStackSection({
  children,
  className,
  index = 0,
  total = 1,
  stickyOffset = 0,
}: ScrollStackSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.85 + (index * 0.02)]);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 1, 0.3]);
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '10%']);
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, -5]);

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const scaleSpring = useSpring(scale, springConfig);
  const opacitySpring = useSpring(opacity, springConfig);

  return (
    <div 
      ref={ref} 
      className={cn('relative', className)}
      style={{ 
        zIndex: total - index,
        perspective: '1200px',
      }}
    >
      <motion.div
        style={{
          scale: scaleSpring,
          opacity: opacitySpring,
          y,
          rotateX,
          transformOrigin: 'center top',
          transformStyle: 'preserve-3d',
        }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * ScrollFadeSection - Fades sections in/out with blur as you scroll
 */
interface ScrollFadeSectionProps {
  children: React.ReactNode;
  className?: string;
  fadeDirection?: 'up' | 'down' | 'left' | 'right';
  blurOnExit?: boolean;
}

export function ScrollFadeSection({
  children,
  className,
  fadeDirection = 'up',
  blurOnExit = true,
}: ScrollFadeSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.2 });
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (isInView && !hasEntered) {
      setHasEntered(true);
    }
  }, [isInView, hasEntered]);

  const directionMap = {
    up: { x: 0, y: 60 },
    down: { x: 0, y: -60 },
    left: { x: 60, y: 0 },
    right: { x: -60, y: 0 },
  };

  const { x: initialX, y: initialY } = directionMap[fadeDirection];

  return (
    <div ref={ref} className={cn('relative', className)}>
      <motion.div
        initial={{ 
          opacity: 0, 
          x: initialX, 
          y: initialY,
          filter: 'blur(8px)'
        }}
        animate={isInView ? { 
          opacity: 1, 
          x: 0, 
          y: 0,
          filter: 'blur(0px)'
        } : { 
          opacity: 0, 
          x: initialX, 
          y: initialY,
          filter: blurOnExit ? 'blur(8px)' : 'blur(0px)'
        }}
        transition={{ 
          duration: 0.8, 
          ease: [0.22, 1, 0.36, 1]
        }}
        className="will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  );
}

/**
 * SectionDivider - Animated divider between sections with glow
 */
interface SectionDividerProps {
  className?: string;
  color?: string;
}

export function SectionDivider({ 
  className, 
  color = 'rgba(59, 130, 246, 0.5)' 
}: SectionDividerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: false, amount: 0.5 });

  return (
    <motion.div
      ref={ref}
      className={cn('relative h-px w-full overflow-hidden', className)}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : { opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={isInView ? { 
          scaleX: 1, 
          opacity: [0, 1, 0.7],
          boxShadow: [
            `0 0 0px ${color}`,
            `0 0 20px ${color}`,
            `0 0 10px ${color}`,
          ]
        } : { 
          scaleX: 0, 
          opacity: 0 
        }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      />
    </motion.div>
  );
}

/**
 * ScrollProgressGlow - Creates a glowing border that animates with scroll progress
 */
interface ScrollProgressGlowProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}

export function ScrollProgressGlow({
  children,
  className,
  glowColor = 'rgba(59, 130, 246, 0.6)',
}: ScrollProgressGlowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const glowIntensity = useTransform(scrollYProgress, [0, 0.5, 1], [0, 40, 0]);
  const borderOpacity = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.1, 0.5, 0.5, 0.1]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none"
        style={{
          boxShadow: useTransform(glowIntensity, (v) => `inset 0 0 ${v}px 1px ${glowColor}`),
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: useTransform(borderOpacity, (v) => `rgba(59, 130, 246, ${v})`),
        }}
      />
      {children}
    </div>
  );
}

/**
 * FullPageSection - A full viewport height section with scroll-snap behavior
 * and entrance/exit animations
 */
interface FullPageSectionProps {
  children: React.ReactNode;
  className?: string;
  bgColor?: string;
  glowOnEnter?: boolean;
  glowColor?: string;
}

export function FullPageSection({
  children,
  className,
  bgColor,
  glowOnEnter = true,
  glowColor = 'rgba(59, 130, 246, 0.4)',
}: FullPageSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { amount: 0.4 });
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const scale = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0.95, 1, 1, 0.95]);
  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.5, 1, 1, 0.5]);
  const y = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [50, 0, 0, -50]);

  const springConfig = { stiffness: 60, damping: 20 };
  const scaleSpring = useSpring(scale, springConfig);
  const ySpring = useSpring(y, springConfig);

  return (
    <div 
      ref={ref} 
      className={cn('relative min-h-screen', className)}
      style={{ backgroundColor: bgColor }}
    >
      <motion.div
        style={{
          scale: scaleSpring,
          opacity,
          y: ySpring,
        }}
        className="will-change-transform h-full"
      >
        {glowOnEnter && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-3xl"
            initial={{ boxShadow: `inset 0 0 0px 0px ${glowColor}` }}
            animate={isInView ? {
              boxShadow: [
                `inset 0 0 0px 0px ${glowColor}`,
                `inset 0 0 60px 3px ${glowColor}`,
                `inset 0 0 20px 1px ${glowColor}`,
              ],
            } : {
              boxShadow: `inset 0 0 0px 0px ${glowColor}`,
            }}
            transition={{ duration: 2, times: [0, 0.4, 1] }}
          />
        )}
        {children}
      </motion.div>
    </div>
  );
}

/**
 * ParallaxLayer - Create depth with multiple moving layers
 */
interface ParallaxLayerProps {
  children: React.ReactNode;
  className?: string;
  speed?: number; // -1 to 1, negative = opposite direction
  zIndex?: number;
}

export function ParallaxLayer({
  children,
  className,
  speed = 0.5,
  zIndex = 0,
}: ParallaxLayerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  const y = useTransform(scrollYProgress, [0, 1], [`${-speed * 100}px`, `${speed * 100}px`]);
  const ySpring = useSpring(y, { stiffness: 100, damping: 30 });

  return (
    <div ref={ref} className={cn('relative', className)} style={{ zIndex }}>
      <motion.div style={{ y: ySpring }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}

/**
 * TextRevealScroll - Reveals text word by word as you scroll
 */
interface TextRevealScrollProps {
  text: string;
  className?: string;
  wordClassName?: string;
}

export function TextRevealScroll({
  text,
  className,
  wordClassName,
}: TextRevealScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.4'],
  });

  const words = text.split(' ');

  return (
    <div 
      ref={containerRef} 
      className={cn('flex flex-wrap gap-x-2 gap-y-1 py-12', className)}
    >
      {words.map((word, i) => (
        <Word 
          key={i} 
          word={word} 
          index={i}
          total={words.length}
          progress={scrollYProgress}
          className={wordClassName}
        />
      ))}
    </div>
  );
}

function Word({ 
  word, 
  index,
  total,
  progress,
  className,
}: { 
  word: string; 
  index: number;
  total: number;
  progress: MotionValue<number>;
  className?: string;
}) {
  const wordDuration = 0.25;
  const start = (index / total) * (1 - wordDuration);
  const end = start + wordDuration;
  
  const opacity = useTransform(progress, [start, end], [0.1, 1]);
  const y = useTransform(progress, [start, end], [15, 0]);
  const scale = useTransform(progress, [start, end], [0.9, 1]);
  const blur = useTransform(progress, [start, end], [4, 0]);

  const opacitySpring = useSpring(opacity, { stiffness: 100, damping: 30 });
  const ySpring = useSpring(y, { stiffness: 100, damping: 30 });
  const scaleSpring = useSpring(scale, { stiffness: 100, damping: 30 });

  return (
    <motion.span
      style={{ 
        opacity: opacitySpring,
        y: ySpring,
        scale: scaleSpring,
        filter: useTransform(blur, (v) => `blur(${v}px)`),
      }}
      className={cn('inline-block transition-all', className)}
    >
      {word}
    </motion.span>
  );
}

/**
 * PulsingGlow - Icon container with animated glow effect
 */
interface PulsingGlowProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PulsingGlow({
  children,
  className,
  color = '#3B82F6',
  size = 'md',
}: PulsingGlowProps) {
  const sizeMap = {
    sm: 'w-16 h-16',
    md: 'w-24 h-24',
    lg: 'w-32 h-32',
  };

  return (
    <motion.div
      className={cn(
        sizeMap[size],
        'rounded-full flex items-center justify-center',
        className
      )}
      style={{ backgroundColor: `${color}15` }}
      animate={{
        boxShadow: [
          `0 0 20px ${color}30`,
          `0 0 40px ${color}50`,
          `0 0 20px ${color}30`,
        ],
      }}
      transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * OrbitingElements - Decorative elements that orbit around a center point
 */
interface OrbitingElementsProps {
  count?: number;
  radius?: number;
  color?: string;
  duration?: number;
  className?: string;
}

export function OrbitingElements({
  count = 4,
  radius = 60,
  color = '#3B82F6',
  duration = 8,
  className,
}: OrbitingElementsProps) {
  const elements = Array.from({ length: count }, (_, i) => i);
  
  return (
    <div className={cn('absolute inset-0 pointer-events-none', className)}>
      {elements.map((i) => {
        const angle = (360 / count) * i;
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
            style={{ backgroundColor: color }}
            animate={{
              x: [
                Math.cos((angle * Math.PI) / 180) * radius,
                Math.cos(((angle + 360) * Math.PI) / 180) * radius,
              ],
              y: [
                Math.sin((angle * Math.PI) / 180) * radius,
                Math.sin(((angle + 360) * Math.PI) / 180) * radius,
              ],
              opacity: [0.3, 1, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration,
              repeat: Infinity,
              ease: 'linear',
              delay: i * (duration / count),
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * FloatingParticles - Particles that float up and fade out
 */
interface FloatingParticlesProps {
  count?: number;
  color?: string;
  className?: string;
}

export function FloatingParticles({
  count = 6,
  color = '#3B82F6',
  className,
}: FloatingParticlesProps) {
  const particles = Array.from({ length: count }, (_, i) => i);

  return (
    <div className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}>
      {particles.map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ 
            backgroundColor: color,
            left: `${20 + (i * 60) / count}%`,
            bottom: 0,
          }}
          animate={{
            y: [0, -100, -200],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeOut',
          }}
        />
      ))}
    </div>
  );
}

/**
 * AnimatedProgressBar - Smooth animated progress bar
 */
interface AnimatedProgressBarProps {
  progress: number;
  color?: string;
  className?: string;
  height?: number;
}

export function AnimatedProgressBar({
  progress,
  color = '#3B82F6',
  className,
  height = 4,
}: AnimatedProgressBarProps) {
  return (
    <div 
      className={cn('w-full bg-gray-800 rounded-full overflow-hidden', className)}
      style={{ height }}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

/**
 * StepTransition - Animated content transition for multi-step flows
 */
interface StepTransitionProps {
  children: React.ReactNode;
  stepKey: string | number;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
}

export function StepTransition({
  children,
  stepKey,
  direction = 'right',
  className,
}: StepTransitionProps) {
  const directionMap = {
    left: { enter: { x: -50 }, exit: { x: 50 } },
    right: { enter: { x: 50 }, exit: { x: -50 } },
    up: { enter: { y: -50 }, exit: { y: 50 } },
    down: { enter: { y: 50 }, exit: { y: -50 } },
  };

  const { enter, exit } = directionMap[direction];

  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, ...enter, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, ...exit, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * GlowingBorder - Element with animated glowing border
 */
interface GlowingBorderProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
  intensity?: number;
}

export function GlowingBorder({
  children,
  color = '#3B82F6',
  className,
  intensity = 20,
}: GlowingBorderProps) {
  return (
    <motion.div
      className={cn('relative rounded-2xl', className)}
      animate={{
        boxShadow: [
          `0 0 ${intensity}px ${color}20, inset 0 0 ${intensity}px ${color}10`,
          `0 0 ${intensity * 2}px ${color}40, inset 0 0 ${intensity * 1.5}px ${color}20`,
          `0 0 ${intensity}px ${color}20, inset 0 0 ${intensity}px ${color}10`,
        ],
      }}
      transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
    >
      {children}
    </motion.div>
  );
}

/**
 * ScrollSnapContainer - Container that enables scroll snapping between sections
 */
interface ScrollSnapContainerProps {
  children: React.ReactNode;
  className?: string;
  snapType?: 'mandatory' | 'proximity';
}

export function ScrollSnapContainer({
  children,
  className,
  snapType = 'proximity',
}: ScrollSnapContainerProps) {
  return (
    <div 
      className={cn('scroll-snap-container', className)}
      style={{
        scrollSnapType: `y ${snapType}`,
        overflowY: 'auto',
        height: '100vh',
      }}
    >
      {children}
    </div>
  );
}

/**
 * ScrollSnapSection - Individual section within scroll snap container
 */
interface ScrollSnapSectionProps {
  children: React.ReactNode;
  className?: string;
  snapAlign?: 'start' | 'center' | 'end';
}

export function ScrollSnapSection({
  children,
  className,
  snapAlign = 'start',
}: ScrollSnapSectionProps) {
  return (
    <div 
      className={cn('scroll-snap-section', className)}
      style={{
        scrollSnapAlign: snapAlign,
        minHeight: '100vh',
      }}
    >
      {children}
    </div>
  );
}
