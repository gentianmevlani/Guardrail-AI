'use client';

import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

interface ParallaxTransitionProps {
  children: React.ReactNode;
}

export function ParallaxTransition({ children }: ParallaxTransitionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const opacity = useTransform(scrollYProgress, [0, 0.8, 1], [1, 1, 0.7]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [0, 8]);
  const z = useTransform(scrollYProgress, [0, 1], [0, -100]);

  return (
    <div ref={containerRef} className="relative" style={{ perspective: '1200px' }}>
      <motion.div
        style={{
          y,
          scale,
          opacity,
          rotateX,
          z,
          transformStyle: 'preserve-3d',
          transformOrigin: 'center top',
          willChange: 'transform, opacity'
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

interface ParallaxRevealProps {
  children: React.ReactNode;
}

export function ParallaxReveal({ children }: ParallaxRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "start center"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ["80px", "0px"]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);
  const opacity = useTransform(scrollYProgress, [0, 0.3, 1], [0, 0.5, 1]);
  const rotateX = useTransform(scrollYProgress, [0, 1], [-5, 0]);

  return (
    <div ref={containerRef} style={{ perspective: '1200px' }}>
      <motion.div
        style={{
          y,
          scale,
          opacity,
          rotateX,
          transformStyle: 'preserve-3d',
          transformOrigin: 'center bottom',
          willChange: 'transform, opacity'
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
