'use client';

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  iconElement?: React.ReactNode;
  showIconBlur?: boolean;
  borderWidth?: number;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  glowColor = 'rgba(59, 130, 246, 0.5)',
  iconElement,
  showIconBlur = true,
  borderWidth = 1,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pointerPos, setPointerPos] = useState({ x: -10, y: -10 });

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const relativeX = e.clientX - centerX;
      const relativeY = e.clientY - centerY;
      const x = relativeX / (rect.width / 2);
      const y = relativeY / (rect.height / 2);
      setPointerPos({ x, y });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return (
    <article
      ref={cardRef}
      className={cn(
        'glass-card relative rounded-2xl cursor-pointer transition-all duration-150 ease-out',
        'hover:translate-y-[-2px] hover:scale-[1.01] active:translate-y-[1px] active:scale-[0.99]',
        className
      )}
      style={{
        ['--pointer-x' as string]: pointerPos.x.toFixed(3),
        ['--pointer-y' as string]: pointerPos.y.toFixed(3),
        ['--glow-color' as string]: glowColor,
        ['--border-width' as string]: borderWidth,
        containerType: 'size',
      }}
    >
      <div className="glass-card-inner absolute inset-0 rounded-2xl overflow-hidden">
        {showIconBlur && iconElement && (
          <div 
            className="glass-card-blur absolute inset-0 grid place-items-center pointer-events-none"
            style={{
              filter: 'blur(28px) saturate(5) brightness(1.3) contrast(1.4)',
              transform: `translate(calc(var(--pointer-x, -10) * 50cqi), calc(var(--pointer-y, -10) * 50cqh)) scale(3.4)`,
              opacity: 0.25,
              willChange: 'transform, filter',
            }}
          >
            {iconElement}
          </div>
        )}
      </div>
      
      <div 
        className="glass-card-border absolute inset-0 rounded-2xl pointer-events-none z-10"
        style={{
          border: `${borderWidth}px solid transparent`,
          backdropFilter: 'blur(0px) saturate(4.2) brightness(2.5) contrast(2.5)',
          WebkitBackdropFilter: 'blur(0px) saturate(4.2) brightness(2.5) contrast(2.5)',
          mask: 'linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box',
          WebkitMask: 'linear-gradient(#fff 0 100%) border-box, linear-gradient(#fff 0 100%) padding-box',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          clipPath: 'inset(0 round 16px)',
        }}
      />

      <div className="glass-card-content relative z-[1]">
        {children}
      </div>
    </article>
  );
};

export const GlassCardSimple: React.FC<{
  children: React.ReactNode;
  className?: string;
  hoverScale?: boolean;
  dark?: boolean;
}> = ({ children, className, hoverScale = true, dark = false }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pointerPos, setPointerPos] = useState({ x: -10, y: -10 });

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = card.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const relativeX = e.clientX - centerX;
      const relativeY = e.clientY - centerY;
      const x = Math.max(-1, Math.min(1, relativeX / (rect.width / 2)));
      const y = Math.max(-1, Math.min(1, relativeY / (rect.height / 2)));
      setPointerPos({ x, y });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative rounded-3xl transition-all duration-500 ease-out group isolate',
        hoverScale && 'hover:scale-[1.02] hover:-translate-y-2',
        className
      )}
      style={{
        ['--pointer-x' as string]: pointerPos.x.toFixed(3),
        ['--pointer-y' as string]: pointerPos.y.toFixed(3),
      }}
    >
      <div className={cn(
        "absolute inset-0 rounded-3xl backdrop-blur-2xl -z-30",
        dark ? "bg-black/80" : "bg-slate-950/40"
      )} />
      
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-50 -z-20 pointer-events-none" />

      <div 
        className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at calc(50% + calc(var(--pointer-x) * 50%)) calc(50% + calc(var(--pointer-y) * 50%)), rgba(59, 130, 246, 0.25), transparent 80%)`,
        }}
      />
      
      <div className="absolute inset-0 rounded-3xl border border-white/20 pointer-events-none -z-10" />
      <div 
        className="absolute inset-0 rounded-3xl border border-transparent pointer-events-none -z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 40%, rgba(255,255,255,0.1) 100%) border-box',
          mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          opacity: 0.6
        }}
      />
      
      <div className="relative z-10 h-full">
        {children}
      </div>
    </div>
  );
};
