"use client";

import { ChevronLeft, ChevronRight, Quote, Star } from "lucide-react";
import { useEffect, useState } from "react";

interface Testimonial {
  name: string;
  quote: string;
  rating: number;
  avatar?: string;
}

interface Carousel3DProps {
  testimonials: Testimonial[];
  autoRotate?: boolean;
  rotateInterval?: number;
}

export function Carousel3D({
  testimonials,
  autoRotate = true,
  rotateInterval = 5000,
}: Carousel3DProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const goToPrev = () => {
    setCurrentIndex(
      (prev) => (prev - 1 + testimonials.length) % testimonials.length,
    );
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (autoRotate && !isHovered) {
      const interval = setInterval(goToNext, rotateInterval);
      return () => clearInterval(interval);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRotate, isHovered, currentIndex, rotateInterval]);

  const getSlideStyle = (index: number) => {
    const position = index - currentIndex;
    const absPosition = Math.abs(position);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    let rotateY = position * (isMobile ? 30 : 50);
    let translateZ = -absPosition * (isMobile ? 100 : 200);
    let translateX = position * (isMobile ? 200 : 320);
    let opacity = 1;
    let scale = 1;
    let zIndex = 10;

    if (position === 0) {
      rotateY = 0;
      translateZ = 0;
      translateX = 0;
      opacity = 1;
      scale = 1.1;
      zIndex = 20;
    } else if (absPosition === 1) {
      opacity = 0.6;
      scale = 0.9;
      zIndex = 15;
    } else if (absPosition === 2) {
      opacity = 0.3;
      scale = 0.8;
      zIndex = 10;
    } else {
      opacity = 0;
      scale = 0.7;
      zIndex = 5;
    }

    return {
      transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
      opacity,
      zIndex,
      transition: "all 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  };

  return (
    <div
      className="relative w-full h-[500px] flex items-center justify-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative w-full h-full" style={{ perspective: "1200px" }}>
        <div className="relative w-full h-full flex items-center justify-center preserve-3d">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="absolute w-[350px]"
              style={getSlideStyle(index)}
            >
              <div
                className="rounded-2xl p-8 backdrop-blur-md transition-all duration-300 overflow-hidden relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 shadow-2xl shadow-slate-900/50"
                style={{
                  border: "1px solid rgba(148, 163, 184, 0.3)",
                  boxShadow:
                    "0 20px 60px -15px rgba(100, 116, 139, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(0, 0, 0, 0.2)",
                }}
              >
                <div
                  className="absolute inset-0 opacity-50 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)",
                  }}
                />

                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: `
                      linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
                    `,
                    backgroundSize: "20px 20px",
                  }}
                />

                <div className="mb-6 relative z-10">
                  <Quote className="h-10 w-10 text-blue-400/50 drop-shadow-lg" />
                </div>

                <div className="flex gap-1 mb-4 relative z-10">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={[
                        "h-4 w-4",
                        i < testimonial.rating
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-slate-700",
                      ].join(" ")}
                    />
                  ))}
                </div>

                <p className="text-slate-200 leading-relaxed mb-6 min-h-[120px] relative z-10 drop-shadow">
                  &quot;{testimonial.quote}&quot;
                </p>

                <div
                  className="flex items-center gap-3 pt-4 relative z-10"
                  style={{
                    borderTop: "1px solid rgba(100, 116, 139, 0.3)",
                  }}
                >
                  <div
                    className="flex items-center justify-center h-12 w-12 rounded-full bg-gradient-to-br from-blue-600 via-blue-500 to-blue-600"
                    style={{
                      border: "1px solid rgba(96, 165, 250, 0.4)",
                      boxShadow:
                        "0 4px 16px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <span className="text-lg font-semibold text-white drop-shadow-lg">
                      {testimonial.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-white drop-shadow-lg">
                      {testimonial.name}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={goToPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center h-12 w-12 rounded-full backdrop-blur-md transition-all duration-300 group bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        style={{
          border: "1px solid rgba(148, 163, 184, 0.4)",
          boxShadow:
            "0 4px 20px rgba(71, 85, 105, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
        aria-label="Previous testimonial"
      >
        <ChevronLeft className="h-6 w-6 text-slate-300 group-hover:text-white transition-colors" />
      </button>
      <button
        onClick={goToNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center h-12 w-12 rounded-full backdrop-blur-md transition-all duration-300 group bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
        style={{
          border: "1px solid rgba(148, 163, 184, 0.4)",
          boxShadow:
            "0 4px 20px rgba(71, 85, 105, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
        }}
        aria-label="Next testimonial"
      >
        <ChevronRight className="h-6 w-6 text-slate-300 group-hover:text-white transition-colors" />
      </button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-2">
        {testimonials.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={[
              "h-2 rounded-full transition-all duration-300",
              index === currentIndex
                ? "w-8 bg-blue-500"
                : "w-2 bg-gray-700 hover:bg-gray-600",
            ].join(" ")}
            aria-label={`Go to testimonial ${index + 1}`}
          />
        ))}
      </div>

      {autoRotate && !isHovered && (
        <div className="absolute top-4 right-4 z-30">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md text-xs text-slate-300 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900"
            style={{
              border: "1px solid rgba(148, 163, 184, 0.3)",
              boxShadow:
                "0 4px 12px rgba(71, 85, 105, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Auto-rotating
          </div>
        </div>
      )}
    </div>
  );
}
