"use client";

import { Check, ChevronDown, ChevronUp, Copy, Play, Terminal } from "lucide-react";
import { useState } from "react";

interface InteractiveCodeBlockProps {
  command: string;
  expectedOutput?: string;
  description?: string;
  workingDirectory?: string;
  showRunButton?: boolean;
}

export default function InteractiveCodeBlock({
  command,
  expectedOutput,
  description,
  workingDirectory = "$",
  showRunButton = true,
}: InteractiveCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = async () => {
    setIsRunning(true);
    // Simulate command execution
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsRunning(false);
    setShowOutput(true);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden border border-white/10 bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          {description && (
            <span className="text-sm font-medium text-white/80">{description}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showRunButton && (
            <button
              onClick={handleRun}
              disabled={isRunning}
              className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <div className="w-3 h-3 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Run in terminal
                </>
              )}
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
            title={copied ? "Copied!" : "Copy command"}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4 text-white/60" />
            )}
          </button>
        </div>
      </div>

      {/* Command */}
      <div className="p-4">
        <div className="flex items-center gap-2 font-mono text-sm">
          <span className="text-emerald-400">{workingDirectory}</span>
          <span className="text-white/90">{command}</span>
        </div>
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
            {showOutput ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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

      {/* Running Indicator */}
      {isRunning && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-800 rounded-lg border border-white/10">
            <div className="w-4 h-4 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-sm">Executing command...</span>
          </div>
        </div>
      )}
    </div>
  );
}
