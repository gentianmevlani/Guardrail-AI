'use client';

import { useRef, useState, useEffect } from "react";

export function MagneticButton({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const distance = Math.sqrt(x * x + y * y);
      const maxDistance = 60;
      
      if (distance < maxDistance) {
        const strength = (maxDistance - distance) / maxDistance;
        setPos({ x: x * strength * 0.3, y: y * strength * 0.3 });
        setIsHovered(true);
      } else {
        setPos({ x: 0, y: 0 });
        setIsHovered(false);
      }
    };

    const handleMouseLeave = () => {
      setPos({ x: 0, y: 0 });
      setIsHovered(false);
    };

    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return (
    <div ref={ref} className="inline-block">
      <div
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: isHovered ? "transform 0.15s ease-out" : "transform 0.4s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
