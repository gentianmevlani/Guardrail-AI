"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Code,
  FileWarning,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { Button } from "./button";

interface ValidationFinding {
  id: string;
  type: "error" | "warning" | "info" | "success";
  title: string;
  description: string;
  codeSnippet?: {
    before: string;
    after?: string;
    language: string;
    lineNumber?: number;
  };
  explanation: string;
  confidence: number;
  learnMore?: string;
}

interface AIExplainabilityCardProps {
  findings: ValidationFinding[];
  overallScore: number;
  modelVersion?: string;
}

const findingTypeConfig = {
  error: {
    icon: XCircle,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Critical Issue",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Info",
  },
  success: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Passed",
  },
};

function FindingCard({
  finding,
  index,
}: {
  finding: ValidationFinding;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = findingTypeConfig[finding.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-lg border ${config.border} ${config.bg} overflow-hidden`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-start gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <config.icon className={`h-5 w-5 mt-0.5 ${config.color}`} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-medium ${config.color}`}>
              {config.label}
            </span>
            <span className="text-xs text-zinc-500">
              {Math.round(finding.confidence * 100)}% confidence
            </span>
          </div>
          <h4 className="text-sm font-medium text-white mt-1">
            {finding.title}
          </h4>
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
            {finding.description}
          </p>
        </div>

        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        </motion.div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/10">
              {/* Code snippet */}
              {finding.codeSnippet && (
                <div className="mt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Code className="h-4 w-4 text-zinc-500" />
                    <span className="text-xs font-medium text-zinc-400">
                      {finding.codeSnippet.lineNumber
                        ? `Line ${finding.codeSnippet.lineNumber}`
                        : "Code"}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {/* Before */}
                    <div className="relative">
                      <span className="absolute -left-1 top-0 text-xs text-red-400/70">
                        −
                      </span>
                      <pre className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs font-mono text-red-300 overflow-x-auto">
                        {finding.codeSnippet.before}
                      </pre>
                    </div>

                    {/* After (suggested fix) */}
                    {finding.codeSnippet.after && (
                      <>
                        <div className="flex items-center justify-center">
                          <ArrowRight className="h-4 w-4 text-zinc-600" />
                        </div>
                        <div className="relative">
                          <span className="absolute -left-1 top-0 text-xs text-emerald-400/70">
                            +
                          </span>
                          <pre className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-xs font-mono text-emerald-300 overflow-x-auto">
                            {finding.codeSnippet.after}
                          </pre>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* AI Explanation */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Brain className="h-4 w-4 text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-xs font-medium text-purple-400 mb-1">
                      AI Explanation
                    </h5>
                    <p className="text-sm text-zinc-300 leading-relaxed">
                      {finding.explanation}
                    </p>
                  </div>
                </div>
              </div>

              {/* Learn more */}
              {finding.learnMore && (
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-amber-400" />
                  <a
                    href={finding.learnMore}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Learn more about this issue →
                  </a>
                </div>
              )}

              {/* Quick actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs border-zinc-700"
                >
                  Ignore Once
                </Button>
                {finding.codeSnippet?.after && (
                  <Button
                    size="sm"
                    className="text-xs bg-emerald-600 hover:bg-emerald-700"
                  >
                    Apply Fix
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function AIExplainabilityCard({
  findings,
  overallScore,
  modelVersion = "guardrail AI v2.0",
}: AIExplainabilityCardProps) {
  const errorCount = findings.filter((f) => f.type === "error").length;
  const warningCount = findings.filter((f) => f.type === "warning").length;

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Brain className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-white">AI Analysis Results</h3>
            <p className="text-xs text-zinc-500">{modelVersion}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {errorCount > 0 && (
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm text-red-400">
                {errorCount} critical
              </span>
            </div>
          )}
          {warningCount > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="text-sm text-amber-400">
                {warningCount} warnings
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Findings list */}
      <div className="space-y-2">
        {findings.map((finding, index) => (
          <FindingCard key={finding.id} finding={finding} index={index} />
        ))}

        {findings.length === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-white font-medium">All checks passed!</p>
            <p className="text-sm text-zinc-500 mt-1">
              No issues detected in this code
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Demo data export for testing
export const DEMO_FINDINGS: ValidationFinding[] = [
  {
    id: "1",
    type: "error",
    title: "Potential SQL Injection Vulnerability",
    description:
      "User input is directly interpolated into SQL query without sanitization",
    codeSnippet: {
      before: `const query = \`SELECT * FROM users WHERE id = \${userId}\`;`,
      after: `const query = await db.query('SELECT * FROM users WHERE id = $1', [userId]);`,
      language: "typescript",
      lineNumber: 42,
    },
    explanation:
      "This code constructs a SQL query by directly embedding user-supplied input (userId) into the query string using template literals. This pattern is vulnerable to SQL injection attacks where malicious users could manipulate the query to access unauthorized data or execute destructive commands. The fix uses parameterized queries which properly escape user input.",
    confidence: 0.96,
    learnMore: "https://owasp.org/www-community/attacks/SQL_Injection",
  },
  {
    id: "2",
    type: "warning",
    title: "Hardcoded API Key Detected",
    description: "API credentials should not be stored directly in source code",
    codeSnippet: {
      before: `const apiKey = "sk-1234567890abcdef";`,
      after: `const apiKey = process.env.API_KEY;`,
      language: "typescript",
      lineNumber: 15,
    },
    explanation:
      "Hardcoding API keys in source code poses a security risk as they can be exposed through version control systems, logs, or when code is shared. Environment variables provide a secure way to manage sensitive credentials without embedding them in code.",
    confidence: 0.92,
    learnMore:
      "https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning",
  },
  {
    id: "3",
    type: "info",
    title: "Consider Using Async/Await",
    description: "Promise chain could be simplified with async/await syntax",
    codeSnippet: {
      before: `fetchData().then(data => process(data)).catch(err => handle(err));`,
      after: `try {\n  const data = await fetchData();\n  process(data);\n} catch (err) {\n  handle(err);\n}`,
      language: "typescript",
      lineNumber: 28,
    },
    explanation:
      "While the current promise chain is functional, async/await syntax generally produces more readable code that's easier to debug and maintain. This is a code quality suggestion rather than a security issue.",
    confidence: 0.78,
  },
];
