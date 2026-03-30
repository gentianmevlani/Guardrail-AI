"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface MetallicButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function MetallicButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
}: MetallicButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const baseClasses = `
    relative overflow-hidden rounded-full font-semibold
    transition-all duration-300 ease-out
    ${sizeClasses[size]}
    ${className}
  `;

  const primaryGradient = `
    bg-gradient-to-r from-zinc-200 via-white to-zinc-300
    text-black
    shadow-[0_0_20px_rgba(255,255,255,0.3),inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-1px_0_rgba(0,0,0,0.1)]
    hover:shadow-[0_0_30px_rgba(255,255,255,0.5),inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(0,0,0,0.15)]
    hover:from-white hover:via-zinc-100 hover:to-zinc-200
  `;

  const secondaryGradient = `
    bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800
    text-white
    border border-zinc-600
    shadow-[0_0_15px_rgba(255,255,255,0.1),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.3)]
    hover:shadow-[0_0_25px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.4)]
    hover:from-zinc-700 hover:via-zinc-600 hover:to-zinc-700
  `;

  return (
    <motion.button
      onClick={onClick}
      className={`${baseClasses} ${variant === "primary" ? primaryGradient : secondaryGradient}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Metallic shine effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
        initial={{ x: "-100%" }}
        whileHover={{ x: "100%" }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
