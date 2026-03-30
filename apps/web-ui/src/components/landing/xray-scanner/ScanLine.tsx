"use client";

import styles from "./styles.module.css";

export function ScanLine() {
  return (
    <div className="relative w-full h-full">
      {/* Core line */}
      <div className={`absolute inset-0 bg-cyan-400 ${styles.scanLineGlow}`} />
      
      {/* Glow layers */}
      <div className="absolute inset-0 bg-cyan-400 blur-sm" />
      <div className="absolute -inset-1 bg-cyan-400/50 blur-md" />
      <div className="absolute -inset-2 bg-cyan-400/30 blur-xl" />
      
      {/* Scan field effect - gradient above the line */}
      <div 
        className="absolute left-0 right-0 h-32 -top-32 
                   bg-gradient-to-b from-transparent to-cyan-400/10
                   pointer-events-none"
      />
      
      {/* Scan field effect - gradient below the line */}
      <div 
        className="absolute left-0 right-0 h-16 top-full
                   bg-gradient-to-t from-transparent to-cyan-400/5
                   pointer-events-none"
      />
    </div>
  );
}
