"use client";

import { ReactNode, useState } from "react";
import { motion } from "framer-motion";

interface LiquidMetalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  width?: number | string;
  height?: number | string;
}

export function LiquidMetalButton({
  children,
  onClick,
  size = "md",
  className = "",
  width,
  height,
}: LiquidMetalButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sizeConfig = {
    sm: { width: 140, height: 44 },
    md: { width: 200, height: 56 },
    lg: { width: 240, height: 64 },
  };

  const config = {
    width: width || sizeConfig[size].width,
    height: height || sizeConfig[size].height,
  };

  const borderWidth = 1.5;

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative cursor-pointer ${className}`}
      style={{
        width: config.width,
        height: config.height,
        borderRadius: "9999px",
        padding: borderWidth,
        background: isHovered
          ? "linear-gradient(135deg, #e8e8e8 0%, #a8a8a8 20%, #ffffff 40%, #888888 60%, #d0d0d0 80%, #b0b0b0 100%)"
          : "linear-gradient(135deg, #c0c0c0 0%, #808080 25%, #e0e0e0 50%, #707070 75%, #a0a0a0 100%)",
        boxShadow: isHovered
          ? "0 0 12px rgba(255, 255, 255, 0.4), 0 0 24px rgba(200, 200, 200, 0.2)"
          : "0 0 8px rgba(255, 255, 255, 0.15)",
        transition: "all 0.3s ease",
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Inner dark fill */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "9999px",
          background: "linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%)",
          zIndex: 1,
        }}
      />

      {/* Button text */}
      <span 
        className="absolute inset-0 flex items-center justify-center text-white font-semibold"
        style={{
          textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
          letterSpacing: "0.02em",
          zIndex: 2,
        }}
      >
        {children}
      </span>
    </motion.button>
  );
}
