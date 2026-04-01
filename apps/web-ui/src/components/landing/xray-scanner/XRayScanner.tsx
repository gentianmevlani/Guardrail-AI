"use client";

import { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { ScanLine } from "./ScanLine";
import { CodeMockup } from "./CodeMockup";

export function XRayScanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Scan line Y position: 0% → 100% of container
  const scanY = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  // Clip path reveals scanned layer as scan passes
  const clipPath = useTransform(
    scrollYProgress,
    [0, 1],
    ["inset(0 0 100% 0)", "inset(0 0 0% 0)"]
  );

  return (
    <section ref={containerRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen overflow-hidden">
        {/* Section header */}
        <div className="absolute top-8 left-0 right-0 z-20 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-3xl md:text-5xl font-bold text-white mb-2"
          >
            Code X-Ray
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-slate-400 text-lg"
          >
            Scroll to scan for vulnerabilities
          </motion.p>
        </div>

        {/* Clean layer (always visible) */}
        <div className="absolute inset-0">
          <CodeMockup variant="clean" />
        </div>

        {/* Scanned layer (revealed by clip) */}
        <motion.div className="absolute inset-0" style={{ clipPath }}>
          <CodeMockup variant="scanned" />
        </motion.div>

        {/* Scan line */}
        <motion.div
          className="absolute left-0 right-0 h-1 z-10"
          style={{ top: scanY }}
        >
          <ScanLine />
        </motion.div>

        {/* Progress indicator */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20
                     bg-slate-800/80 backdrop-blur-sm rounded-full px-4 py-2
                     border border-slate-700/50"
        >
          <motion.span
            className="text-cyan-400 text-sm font-mono"
            style={{
              opacity: useTransform(scrollYProgress, [0, 0.1], [1, 1]),
            }}
          >
            {/* Show scan progress */}
            <motion.span>
              Scan Progress:{" "}
              <motion.span
                style={{
                  // This will be a static display, actual percentage shown via CSS
                }}
              >
                ↓ Scroll to scan
              </motion.span>
            </motion.span>
          </motion.span>
        </motion.div>
      </div>
    </section>
  );
}
