'use client';

import { useEffect, useState } from 'react';

interface StaticBackgroundProps {
  className?: string;
  variant?: 'gradient' | 'dots' | 'grid';
  opacity?: number;
}

export function StaticBackground({ 
  className = '', 
  variant = 'gradient',
  opacity = 1 
}: StaticBackgroundProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`absolute inset-0 bg-black ${className}`} />
    );
  }

  const backgrounds = {
    gradient: (
      <div 
        className={`absolute inset-0 bg-gradient-to-br from-blue-950 via-black to-cyan-950 ${className}`}
        style={{ opacity }}
      />
    ),
    dots: (
      <div 
        className={`absolute inset-0 bg-black ${className}`}
        style={{ opacity }}
      >
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle, rgba(59, 130, 246, 0.3) 1px, transparent 1px)`,
            backgroundSize: '50px 50px',
          }}
        />
      </div>
    ),
    grid: (
      <div 
        className={`absolute inset-0 bg-black ${className}`}
        style={{ opacity }}
      >
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '100px 100px',
          }}
        />
      </div>
    ),
  };

  return backgrounds[variant];
}
