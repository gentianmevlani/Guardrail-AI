"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

// Animation Types
export type AnimationType = 
  | "fade-in"
  | "slide-up"
  | "slide-down"
  | "slide-left"
  | "slide-right"
  | "scale-in"
  | "rotate-in"
  | "bounce-in"
  | "flip-in"
  | "pulse";

// Animation Component
interface AnimatedProps {
  children: React.ReactNode;
  type?: AnimationType;
  duration?: number;
  delay?: number;
  className?: string;
  onAnimationEnd?: () => void;
}

export function Animated({
  children,
  type = "fade-in",
  duration = 300,
  delay = 0,
  className,
  onAnimationEnd
}: AnimatedProps) {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (isVisible && elementRef.current) {
      const element = elementRef.current;
      
      // Add animation classes
      element.classList.add("animate");
      
      // Set CSS variables
      element.style.setProperty("--animation-duration", `${duration}ms`);
      
      // Add specific animation class
      element.classList.add(`animate-${type}`);
      
      // Listen for animation end
      const handleAnimationEnd = () => {
        element.classList.remove("animate", `animate-${type}`);
        onAnimationEnd?.();
      };
      
      element.addEventListener("animationend", handleAnimationEnd);
      
      return () => {
        element.removeEventListener("animationend", handleAnimationEnd);
      };
    }
  }, [isVisible, type, duration, onAnimationEnd]);

  return (
    <div
      ref={elementRef}
      className={cn("animate-initial", className)}
    >
      {children}
    </div>
  );
}

// Staggered Animation for Lists
interface StaggeredAnimationProps {
  children: React.ReactNode[];
  type?: AnimationType;
  staggerDelay?: number;
  duration?: number;
  className?: string;
}

export function StaggeredAnimation({
  children,
  type = "fade-in",
  staggerDelay = 100,
  duration = 300,
  className
}: StaggeredAnimationProps) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <Animated
          key={index}
          type={type}
          delay={index * staggerDelay}
          duration={duration}
        >
          {child}
        </Animated>
      ))}
    </div>
  );
}

// Progress Animation
interface ProgressAnimationProps {
  value: number;
  max?: number;
  className?: string;
  showPercentage?: boolean;
  color?: "blue" | "green" | "red" | "yellow" | "purple";
}

export function ProgressAnimation({
  value,
  max = 100,
  className,
  showPercentage = true,
  color = "blue"
}: ProgressAnimationProps) {
  const percentage = Math.min((value / max) * 100, 100);

  const colorClasses = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    red: "bg-red-500",
    yellow: "bg-amber-500",
    purple: "bg-purple-500"
  };

  return (
    <div className={cn("relative w-full h-2 bg-zinc-800 rounded-full overflow-hidden", className)}>
      <div
        className={cn(
          "h-full transition-all duration-500 ease-out rounded-full",
          colorClasses[color]
        )}
        style={{ width: `${percentage}%` }}
      />
      {showPercentage && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-medium text-white drop-shadow-lg">
            {Math.round(percentage)}%
          </span>
        </div>
      )}
    </div>
  );
}

// Loading Dots Animation
export function LoadingDots({
  count = 3,
  className,
  size = "sm"
}: {
  count?: number;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    xs: "w-1 h-1",
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-3 h-3"
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={cn(
            sizeClasses[size],
            "bg-blue-500 rounded-full animate-pulse"
          )}
          style={{
            animationDelay: `${index * 0.2}s`
          }}
        />
      ))}
    </div>
  );
}

// Pulse Animation
interface PulseProps {
  children: React.ReactNode;
  className?: string;
  intensity?: "light" | "medium" | "strong";
}

export function Pulse({
  children,
  className,
  intensity = "medium"
}: PulseProps) {
  const intensityClasses = {
    light: "animate-pulse-light",
    medium: "animate-pulse",
    strong: "animate-pulse-strong"
  };

  return (
    <div className={cn(intensityClasses[intensity], className)}>
      {children}
    </div>
  );
}

// Hover Animation
interface HoverAnimationProps {
  children: React.ReactNode;
  hoverScale?: number;
  hoverRotate?: number;
  hoverBrightness?: number;
  className?: string;
}

export function HoverAnimation({
  children,
  hoverScale = 1.05,
  hoverRotate = 0,
  hoverBrightness = 1.1,
  className
}: HoverAnimationProps) {
  return (
    <div
      className={cn(
        "transition-all duration-200 ease-out hover:scale-105 hover:brightness-110",
        className
      )}
      style={{
        "--hover-scale": hoverScale,
        "--hover-rotate": `${hoverRotate}deg`,
        "--hover-brightness": hoverBrightness
      } as any}
    >
      {children}
    </div>
  );
}

// Morph Animation
interface MorphAnimationProps {
  children: React.ReactNode;
  className?: string;
}

export function MorphAnimation({
  children,
  className
}: MorphAnimationProps) {
  return (
    <div className={cn("morph-animation", className)}>
      {children}
    </div>
  );
}

// Shimmer Effect
interface ShimmerProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

export function Shimmer({
  className,
  width = "100%",
  height = "1rem",
  borderRadius = "0.375rem"
}: ShimmerProps) {
  return (
    <div
      className={cn(
        "shimmer-loading",
        className
      )}
      style={{
        width,
        height,
        borderRadius
      }}
    />
  );
}

// Skeleton Loading Animation
export function SkeletonLoader({
  lines = 3,
  className
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-zinc-800 rounded animate-pulse"
          style={{
            animationDelay: `${index * 0.1}s`
          }}
        />
      ))}
    </div>
  );
}

// Counter Animation
interface CounterAnimationProps {
  end: number;
  duration?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

export function CounterAnimation({
  end,
  duration = 2000,
  className,
  prefix,
  suffix
}: CounterAnimationProps) {
  const [count, setCount] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    setIsAnimating(true);
    const startTime = Date.now();
    const endTime = startTime + duration;

    const animate = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / duration, 1);
      const current = Math.floor(progress * end);
      
      setCount(current);
      
      if (now < endTime) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
        setIsAnimating(false);
      }
    };

    requestAnimationFrame(animate);
  }, [end, duration]);

  return (
    <span className={cn("font-mono", className)}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
      {isAnimating && (
        <span className="inline-block w-1 h-1 bg-blue-500 rounded-full animate-pulse ml-2" />
      )}
    </span>
  );
}

// Typewriter Animation
interface TypewriterProps {
  text: string;
  speed?: number;
  className?: string;
  cursor?: boolean;
}

export function Typewriter({
  text,
  speed = 50,
  className,
  cursor = true
}: TypewriterProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let index = 0;
    setIsTyping(true);
    
    const typeWriter = () => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
        timeoutId = setTimeout(typeWriter, speed);
      } else {
        setIsTyping(false);
        if (cursor) {
          timeoutId = setTimeout(() => setShowCursor(false), 1000);
        }
      }
    };

    typeWriter();

    return () => {
      clearTimeout(timeoutId);
    };
  }, [text, speed, cursor]);

  return (
    <span className={cn("font-mono", className)}>
      {displayedText}
      {cursor && showCursor && (
        <span className="inline-block w-0.5 h-5 bg-white animate-pulse ml-1" />
      )}
    </span>
  );
}

// Floating Animation
interface FloatingProps {
  children: React.ReactNode;
  duration?: number;
  amplitude?: number;
  className?: string;
}

export function Floating({
  children,
  duration = 3000,
  amplitude = 10,
  className
}: FloatingProps) {
  return (
    <div
      className={cn("animate-float", className)}
      style={{
        animationDuration: `${duration}ms`,
        "--float-amplitude": `${amplitude}px`
      } as any}
    >
      {children}
    </div>
  );
}

// Ripple Effect
interface RippleProps {
  children: React.ReactNode;
  className?: string;
}

export function Ripple({ children, className }: RippleProps) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; size: number }>>([]);

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const size = 20;
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;
    const id = Date.now();

    const newRipple = { id, x, y, size };
    setRipples(prev => [...prev, newRipple]);

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== id));
    }, 600);
  };

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      onClick={createRipple}
    >
      {children}
      {ripples.map(ripple => (
        <span
          key={ripple.id}
          className="absolute rounded-full bg-white opacity-30 animate-ripple"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
          }}
        />
      ))}
    </div>
  );
}

// CSS for animations
export const animationCSS = `
  /* Animation base styles */
  .animate-initial {
    opacity: 0;
    transform: translateY(20px);
  }

  .animate {
    animation-fill-mode: both;
  }

  /* Fade animations */
  .animate-fade-in {
    animation-name: fadeIn;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-out {
    animation-name: fadeOut;
  }

  @keyframes fadeOut {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-20px);
    }
  }

  /* Slide animations */
  .animate-slide-up {
    animation-name: slideUp;
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-down {
    animation-name: slideDown;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-left {
    animation-name: slideLeft;
  }

  @keyframes slideLeft {
    from {
      opacity: 0;
      transform: translateX(30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .animate-slide-right {
    animation-name: slideRight;
  }

  @keyframes slideRight {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* Scale animations */
  .animate-scale-in {
    animation-name: scaleIn;
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  .animate-scale-out {
    animation-name: scaleOut;
  }

  @keyframes scaleOut {
    from {
      opacity: 1;
      transform: scale(1);
    }
    to {
      opacity: 0;
      transform: scale(0.9);
    }
  }

  /* Rotate animations */
  .animate-rotate-in {
    animation-name: rotateIn;
  }

  @keyframes rotateIn {
    from {
      opacity: 0;
      transform: rotate(-180deg);
    }
    to {
      opacity: 1;
      transform: rotate(0deg);
    }
  }

  /* Bounce animation */
  .animate-bounce-in {
    animation-name: bounceIn;
  }

  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3);
    }
    50% {
      opacity: 1;
      transform: scale(1.05);
    }
    70% {
      transform: scale(0.9);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Flip animation */
  .animate-flip-in {
    animation-name: flipIn;
  }

  @keyframes flipIn {
    from {
      opacity: 0;
      transform: perspective(400px) rotateY(90deg);
    }
    to {
      opacity: 1;
      transform: perspective(400px) rotateY(0deg);
    }
  }

  /* Pulse animations */
  .animate-pulse-light {
    animation: pulse-light 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-light {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  .animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }

  .animate-pulse-strong {
    animation: pulse-strong 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-strong {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
  }

  /* Shimmer loading */
  .shimmer-loading {
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.1),
      transparent
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* Float animation */
  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(var(--float-amplitude, -10px));
    }
  }

  /* Ripple effect */
  .animate-ripple {
    animation: ripple 0.6s ease-out;
  }

  @keyframes ripple {
    from {
      transform: scale(0);
      opacity: 1;
    }
    to {
      transform: scale(4);
      opacity: 0;
    }
  }

  /* Morph animation */
  .morph-animation {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .morph-animation:hover {
    transform: scale(1.05) rotate(2deg);
  }

  /* Hover effects */
  .hover\\:scale-105:hover {
    transform: scale(1.05);
  }

  .hover\\:rotate-3:hover {
    transform: rotate(3deg);
  }

  .hover\\:brightness-110:hover {
    filter: brightness(1.1);
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .animate,
    .animate-fade-in,
    .animate-slide-up,
    .animate-slide-down,
    .animate-slide-left,
    .animate-slide-right,
    .animate-scale-in,
    .animate-rotate-in,
    .animate-bounce-in,
    .animate-flip-in,
    .animate-pulse,
    .animate-pulse-light,
    .animate-pulse-strong,
    .shimmer-loading,
    .animate-float,
    .animate-ripple {
      animation: none;
      transition: none;
    }
  }
`;
