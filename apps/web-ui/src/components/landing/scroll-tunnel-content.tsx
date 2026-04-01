"use client";

import { motion, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface ContentSection {
  id: string;
  type: "text" | "image";
  content: string;
  title?: string;
  imageUrl?: string;
  startProgress: number;
  endProgress: number;
}

// guardrail-themed content sections
const sections: ContentSection[] = [
  {
    id: "intro",
    type: "text",
    title: "Ship with Confidence",
    content: "AI-powered code analysis that catches what others miss",
    startProgress: 0,
    endProgress: 0.12,
  },
  {
    id: "reality",
    type: "text",
    title: "Reality Mode",
    content: "Test your app like a real user would",
    startProgress: 0.15,
    endProgress: 0.27,
  },
  {
    id: "mockproof",
    type: "text",
    title: "MockProof",
    content: "Detect fake features before they ship",
    startProgress: 0.3,
    endProgress: 0.42,
  },
  {
    id: "airlock",
    type: "text",
    title: "Airlock",
    content: "Secure deployment gates for AI-generated code",
    startProgress: 0.45,
    endProgress: 0.57,
  },
  {
    id: "compliance",
    type: "text",
    title: "Compliance",
    content: "SOC2, HIPAA, GDPR, PCI compliance checks",
    startProgress: 0.6,
    endProgress: 0.72,
  },
  {
    id: "autopilot",
    type: "text",
    title: "Autopilot",
    content: "Continuous monitoring and protection",
    startProgress: 0.75,
    endProgress: 0.87,
  },
];

export function ScrollTunnelContent() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const [activeSection, setActiveSection] = useState<number>(0);

  useEffect(() => {
    const currentProgress = scrollYProgress.get();
    const newActiveSection = sections.findIndex(
      (section) =>
        currentProgress >= section.startProgress &&
        currentProgress <= section.endProgress,
    );
    if (newActiveSection !== -1) {
      setActiveSection(newActiveSection);
    }
  }, [scrollYProgress]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center"
      style={{ perspective: "1000px" }}
    >
      {sections.map((section, index) => {
        const isActive = index === activeSection;
        const progress = scrollYProgress.get();

        // Calculate animation values based on scroll progress
        let scale = 0.05;
        let opacity = 0;
        let zIndex = 0;
        let blur = 10;

        if (
          progress >= section.startProgress &&
          progress <= section.endProgress
        ) {
          const sectionProgress =
            (progress - section.startProgress) /
            (section.endProgress - section.startProgress);

          if (sectionProgress < 0.3) {
            // Approach phase
            const approachProgress = sectionProgress / 0.3;
            scale = 0.05 + (1 - 0.05) * approachProgress;
            opacity = approachProgress;
            blur = 10 * (1 - approachProgress);
            zIndex = 10;
          } else if (sectionProgress < 0.7) {
            // Hold phase
            scale = 1;
            opacity = 1;
            blur = 0;
            zIndex = 20;
          } else {
            // Exit phase
            const exitProgress = (sectionProgress - 0.7) / 0.3;
            scale = 1 + (1.5 - 1) * exitProgress;
            opacity = 1 - exitProgress;
            blur = 5 * exitProgress;
            zIndex = 10 - 10 * exitProgress;
          }
        }

        return (
          <motion.div
            key={section.id}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-8"
            style={{
              transformStyle: "preserve-3d",
              scale,
              opacity,
              zIndex,
              filter: `blur(${blur}px)`,
            }}
          >
            {section.type === "text" && (
              <div className="max-w-4xl w-full">
                <div
                  className="backdrop-blur-xl bg-white/5 rounded-3xl p-12 shadow-2xl border border-white/10"
                  style={{
                    boxShadow:
                      "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 20px rgba(255, 255, 255, 0.05)",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))",
                  }}
                >
                  <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    {section.title}
                  </h2>
                  <p className="text-xl md:text-2xl text-gray-300 leading-relaxed">
                    {section.content}
                  </p>
                </div>
              </div>
            )}
            {section.type === "image" && section.imageUrl && (
              <div className="max-w-4xl w-full">
                <div
                  className="backdrop-blur-xl bg-white/5 rounded-3xl p-8 shadow-2xl border border-white/10"
                  style={{
                    boxShadow:
                      "0 8px 32px 0 rgba(31, 38, 135, 0.37), inset 0 0 20px rgba(255, 255, 255, 0.05)",
                    background:
                      "linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={section.imageUrl}
                    alt={section.title}
                    className="w-full h-auto rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
