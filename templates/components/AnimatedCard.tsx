/**
 * Animated Card Component
 * 
 * Beautiful card with hover effects, entrance animations, and transitions
 * Includes all the polish that AI agents often miss
 */

import React, { useEffect, useRef } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import './AnimatedCard.css';

export interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
  delay?: number;
  onClick?: () => void;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  hover = true,
  glow = false,
  delay = 0,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 30 });
  const springY = useSpring(y, { stiffness: 300, damping: 30 });

  useEffect(() => {
    if (!hover || !ref.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      x.set((e.clientX - centerX) * 0.05);
      y.set((e.clientY - centerY) * 0.05);
    };

    const handleMouseLeave = () => {
      x.set(0);
      y.set(0);
    };

    const card = ref.current;
    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hover, x, y]);

  return (
    <motion.div
      ref={ref}
      className={`animated-card ${glow ? 'animated-card--glow' : ''} ${className}`}
      onClick={onClick}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      whileHover={hover ? { scale: 1.02, y: -5 } : {}}
      style={{
        x: springX,
        y: springY,
      }}
    >
      <div className="animated-card__content">{children}</div>
      {glow && <div className="animated-card__glow" />}
    </motion.div>
  );
};

export default AnimatedCard;

