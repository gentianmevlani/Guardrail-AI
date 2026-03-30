'use client';

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}

function FAQItem({ question, answer, isOpen, onToggle }: FAQItemProps) {
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
      className="relative rounded-2xl transition-all duration-500 ease-out group isolate"
      style={{
        ['--pointer-x' as string]: pointerPos.x.toFixed(3),
        ['--pointer-y' as string]: pointerPos.y.toFixed(3),
      }}
    >
      <div className="absolute inset-0 rounded-2xl bg-slate-950/40 backdrop-blur-2xl -z-30" />
      
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/10 via-transparent to-white/5 opacity-50 -z-20 pointer-events-none" />

      <div 
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10 pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at calc(50% + calc(var(--pointer-x) * 50%)) calc(50% + calc(var(--pointer-y) * 50%)), rgba(59, 130, 246, 0.25), transparent 80%)`,
        }}
      />
      
      <div className="absolute inset-0 rounded-2xl border border-white/20 pointer-events-none -z-10" />
      <div 
        className="absolute inset-0 rounded-2xl border border-transparent pointer-events-none -z-10"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 40%, rgba(255,255,255,0.1) 100%) border-box',
          mask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)',
          maskComposite: 'exclude',
          WebkitMaskComposite: 'xor',
          opacity: 0.6
        }}
      />

      <button
        onClick={onToggle}
        className="w-full px-6 py-5 flex items-center justify-between text-left group transition-all duration-300 relative z-10"
      >
        <span className="font-semibold text-white pr-4 group-hover:text-slate-100 transition-colors">
          {question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-slate-400 flex-shrink-0 transition-all duration-300",
            isOpen ? "rotate-180 text-blue-400" : "group-hover:text-slate-300"
          )}
        />
      </button>
      
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out relative z-10",
          isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div 
          className="px-6 pb-5 text-slate-300 leading-relaxed pt-4 border-t border-white/10"
        >
          {answer}
        </div>
      </div>
    </div>
  );
}

interface FAQAccordionProps {
  faqs: Array<{ question: string; answer: string }>;
}

export function FAQAccordion({ faqs }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {faqs.map((faq, index) => (
        <FAQItem
          key={index}
          question={faq.question}
          answer={faq.answer}
          isOpen={openIndex === index}
          onToggle={() => handleToggle(index)}
        />
      ))}
    </div>
  );
}
