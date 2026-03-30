"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
  show: boolean;
}

export function SplashScreen({ onComplete, show }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  useEffect(() => {
    if (show && videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked, skip splash
        setTimeout(onComplete, 500);
      });
    }
  }, [show, onComplete]);

  const handleVideoEnd = () => {
    setVideoEnded(true);
    setTimeout(onComplete, 300);
  };

  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setVideoEnded(true);
    setTimeout(onComplete, 100);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
        >
          <div className="relative flex items-center justify-center">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-3xl scale-150" />
            <video
              ref={videoRef}
              src="/splash-video.mp4"
              className="w-96 h-96 max-w-[50vw] max-h-[50vh] object-contain rounded-lg shadow-2xl relative z-10 border border-white/10"
              muted
              playsInline
              onEnded={handleVideoEnd}
            />
          </div>
          
          {/* Skip button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            onClick={handleSkip}
            className="absolute bottom-8 right-8 px-4 py-2 text-sm text-white/60 hover:text-white border border-white/20 hover:border-white/40 rounded-full backdrop-blur-sm transition-colors"
          >
            Skip
          </motion.button>

          {/* Loading indicator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-12 left-1/2 transform -translate-x-1/2"
          >
            <div className="flex items-center gap-3 text-white/80">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse delay-75" />
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse delay-150" />
              </div>
              <span className="text-sm font-medium tracking-wide">Initializing guardrail...</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
