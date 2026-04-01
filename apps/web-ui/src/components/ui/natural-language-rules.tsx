"use client";

import {
  deleteRule as apiDeleteRule,
  toggleRule as apiToggleRule,
  getRules,
  parseNaturalLanguageRule,
  type GuardrailRule,
} from "@/lib/guardrails-api";
import { logger } from "@/lib/logger";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  FileCode,
  Lock,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "./button";

const EXAMPLE_RULES = [
  "Block any code that accesses the filesystem",
  "Warn if AI suggests using eval() or Function()",
  "Prevent hardcoded API keys or secrets",
  "Block database queries without parameterization",
  "Warn on logger.debug('Validating code:', code);",
  "Block code that makes external HTTP requests",
  "Prevent imports from unknown npm packages",
  "Warn if functions exceed 50 lines",
];

const categoryConfig = {
  security: { icon: Shield, color: "text-red-400", bg: "bg-red-500/20" },
  quality: { icon: Sparkles, color: "text-blue-400", bg: "bg-blue-500/20" },
  behavior: { icon: Lock, color: "text-purple-400", bg: "bg-purple-500/20" },
  custom: { icon: FileCode, color: "text-zinc-400", bg: "bg-zinc-500/20" },
};

const severityConfig = {
  block: { label: "Block", color: "text-red-400", bg: "bg-red-500/20" },
  warn: { label: "Warn", color: "text-amber-400", bg: "bg-amber-500/20" },
  info: { label: "Info", color: "text-blue-400", bg: "bg-blue-500/20" },
};

interface NaturalLanguageRulesProps {
  rules?: GuardrailRule[];
  onRulesChange?: (rules: GuardrailRule[]) => void;
}

export function NaturalLanguageRules({
  rules: initialRules = [],
  onRulesChange,
}: NaturalLanguageRulesProps) {
  const [rules, setRules] = useState<GuardrailRule[]>(initialRules);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateRules = (newRules: GuardrailRule[]) => {
    setRules(newRules);
    onRulesChange?.(newRules);
  };

  // Load rules from API on mount
  useEffect(() => {
    async function loadRules() {
      try {
        const apiRules = await getRules();
        if (apiRules.length > 0) {
          setRules(apiRules);
        }
      } catch (error) {
        logger.error("Failed to load rules from API:", error);
      }
    }
    if (initialRules.length === 0) {
      loadRules();
    }
  }, [initialRules.length]);

  const addRule = async () => {
    if (!inputValue.trim()) return;

    setIsProcessing(true);
    try {
      // Use real API to parse natural language
      const result = await parseNaturalLanguageRule(inputValue);
      updateRules([...rules, result.rule]);
      setInputValue("");
      setShowSuggestions(false);
    } catch (error) {
      logger.error("Failed to create rule:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const removeRule = async (id: string) => {
    try {
      await apiDeleteRule(id);
      updateRules(rules.filter((r) => r.id !== id));
    } catch (error) {
      logger.error("Failed to delete rule:", error);
    }
  };

  const toggleRule = async (id: string) => {
    try {
      const updated = await apiToggleRule(id);
      if (updated) {
        updateRules(rules.map((r) => (r.id === id ? updated : r)));
      } else {
        // Fallback to local toggle if API fails
        updateRules(
          rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
        );
      }
    } catch (error) {
      logger.error("Failed to toggle rule:", error);
    }
  };

  const applySuggestion = (suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Wand2
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
              aria-hidden="true"
            />
            <label htmlFor="guardrail-input" className="sr-only">
              Describe a guardrail in plain English
            </label>
            <input
              ref={inputRef}
              id="guardrail-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => e.key === "Enter" && addRule()}
              placeholder="Describe a guardrail in plain English..."
              aria-label="Describe a guardrail in plain English"
              aria-describedby="guardrail-suggestions"
              aria-expanded={showSuggestions && !inputValue}
              aria-haspopup="listbox"
              className="w-full pl-10 pr-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>
          <Button
            onClick={addRule}
            disabled={!inputValue.trim() || isProcessing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6"
            aria-label={
              isProcessing ? "Processing rule..." : "Add guardrail rule"
            }
          >
            {isProcessing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Processing...</span>
              </motion.div>
            ) : (
              <>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Add rule</span>
              </>
            )}
          </Button>
        </div>

        {/* Suggestions dropdown */}
        <AnimatePresence>
          {showSuggestions && !inputValue && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-10 overflow-hidden"
              role="listbox"
              id="guardrail-suggestions"
              aria-label="Rule suggestions"
            >
              <div className="p-2 border-b border-zinc-800">
                <span
                  className="text-xs text-zinc-500 uppercase tracking-wider"
                  id="suggestions-label"
                >
                  Suggestions
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {EXAMPLE_RULES.map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => applySuggestion(suggestion)}
                    className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-800 focus:bg-zinc-800 focus:outline-none transition-colors flex items-center gap-2"
                    role="option"
                    aria-selected={false}
                  >
                    <ChevronRight
                      className="h-3 w-3 text-zinc-600"
                      aria-hidden="true"
                    />
                    {suggestion}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rules list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {rules.map((rule, index) => {
            const catConfig = categoryConfig[rule.category];
            const sevConfig = severityConfig[rule.severity];

            return (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20, height: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`group p-4 rounded-lg border transition-all ${
                  rule.enabled
                    ? "bg-zinc-900/50 border-zinc-700"
                    : "bg-zinc-900/20 border-zinc-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {/* Category icon */}
                    <div className={`p-2 rounded-lg ${catConfig.bg} mt-0.5`}>
                      <catConfig.icon
                        className={`h-4 w-4 ${catConfig.color}`}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Natural language */}
                      <p
                        className={`text-sm ${rule.enabled ? "text-white" : "text-zinc-500"}`}
                      >
                        {rule.naturalLanguage}
                      </p>

                      {/* Generated pattern */}
                      {rule.pattern && (
                        <code className="block mt-1 text-xs text-zinc-500 font-mono bg-zinc-800/50 px-2 py-1 rounded truncate">
                          {rule.pattern}
                        </code>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Severity badge */}
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${sevConfig.bg} ${sevConfig.color}`}
                    >
                      {sevConfig.label}
                    </span>

                    {/* Toggle */}
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        rule.enabled
                          ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      } focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      aria-label={
                        rule.enabled
                          ? `Disable rule: ${rule.naturalLanguage}`
                          : `Enable rule: ${rule.naturalLanguage}`
                      }
                      aria-pressed={rule.enabled}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="p-1.5 rounded-lg bg-zinc-800 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
                      aria-label={`Delete rule: ${rule.naturalLanguage}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {rules.length === 0 && (
          <div className="text-center py-8 text-zinc-500" role="status">
            <Wand2
              className="h-8 w-8 mx-auto mb-2 opacity-50"
              aria-hidden="true"
            />
            <p>No guardrails configured</p>
            <p className="text-sm">Describe rules in plain English above</p>
          </div>
        )}
      </div>
    </div>
  );
}
