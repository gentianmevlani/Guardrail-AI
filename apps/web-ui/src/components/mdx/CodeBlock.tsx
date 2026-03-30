"use client";

import { Check, Copy, Play, Terminal } from "lucide-react";
import { useState } from "react";
import { logger } from "@/lib/logger";

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  filename?: string;
  highlightLines?: number[];
  collapsible?: boolean;
  title?: string;
  interactive?: boolean;
  expectedOutput?: string;
}

export default function CodeBlock({
  code,
  language = "bash",
  showLineNumbers = false,
  filename,
  highlightLines = [],
  collapsible = false,
  title,
  interactive = false,
  expectedOutput,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showOutput, setShowOutput] = useState(false);

  const handleCopy = async () => {
    // Remove line numbers if they're displayed
    const codeToCopy = showLineNumbers
      ? code.split('\n').map(line => line.replace(/^\s*\d+\s*/, '')).join('\n')
      : code;

    await navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);

    // Track copy event for analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'code_copy', {
        language,
        filename,
      });
    }
  };

  const handleRunCommand = () => {
    if (interactive && language === 'bash') {
      // In a real implementation, this could open a terminal or run the command
      logger.debug('Running command', {
        command: code.trim(),
        language,
        component: 'CodeBlock'
      });
    }
  };

  const lines = code.split('\n');
  const maxLineNumber = lines.length;

  return (
    <div className="relative group rounded-lg overflow-hidden border border-white/10 bg-gray-900">
      {/* Header */}
      {(title || filename || interactive) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-gray-800/50">
          <div className="flex items-center gap-2">
            {language === 'bash' && <Terminal className="w-4 h-4 text-emerald-400" />}
            {title && (
              <span className="text-sm font-medium text-white/80">{title}</span>
            )}
            {filename && (
              <span className="text-sm text-white/60 font-mono">{filename}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {interactive && language === 'bash' && (
              <button
                onClick={handleRunCommand}
                className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                Run
              </button>
            )}
            {collapsible && (
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Copy Button */}
      <div className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4 text-white/60" />
          )}
        </button>
      </div>

      {/* Code Content */}
      <div className={`overflow-x-auto ${isCollapsed ? 'max-h-32' : ''}`}>
        <pre className="p-4 text-sm text-white/90 font-mono">
          <code>
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const isHighlighted = highlightLines.includes(lineNumber);
              
              return (
                <div
                  key={index}
                  className={`
                    ${isHighlighted ? 'bg-emerald-500/10 -mx-4 px-4' : ''}
                    ${showLineNumbers ? 'flex' : ''}
                  `}
                >
                  {showLineNumbers && (
                    <span className="inline-block w-8 text-right mr-4 text-white/30 select-none">
                      {lineNumber}
                    </span>
                  )}
                  <span>{line || ' '}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>

      {/* Expected Output */}
      {expectedOutput && (
        <div className="border-t border-white/10">
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="w-full px-4 py-2 text-left text-sm text-white/60 hover:text-white transition-colors flex items-center justify-between bg-gray-800/30"
          >
            <span className="flex items-center gap-2">
              <span className={`transform transition-transform ${showOutput ? 'rotate-90' : ''}`}>▶</span>
              Expected output
            </span>
          </button>
          {showOutput && (
            <div className="px-4 py-3 bg-emerald-500/5 border-t border-emerald-500/20">
              <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap">
                {expectedOutput}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Language Badge */}
      <div className="absolute bottom-2 right-2 text-xs text-white/40 uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity">
        {language}
      </div>
    </div>
  );
}
