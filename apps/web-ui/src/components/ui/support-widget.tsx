"use client";

import { useState } from "react";
import {
  MessageCircle,
  X,
  Send,
  Bug,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface SupportWidgetProps {
  runId?: string;
  context?: Record<string, string>;
}

export function SupportWidget({ runId, context }: SupportWidgetProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "report" | "help">("menu");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    // In production, this would send to support API
    // Support request: { message, runId, context }
    setSubmitted(true);
    setTimeout(() => {
      setOpen(false);
      setSubmitted(false);
      setMessage("");
      setMode("menu");
    }, 2000);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 z-40"
        title="Help & Support"
      >
        <MessageCircle className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-gradient-to-r from-blue-950/50 to-purple-950/50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-white">
            {mode === "menu"
              ? "Help & Support"
              : mode === "report"
                ? "Report Issue"
                : "Get Help"}
          </span>
        </div>
        <button
          onClick={() => {
            if (mode !== "menu") {
              setMode("menu");
            } else {
              setOpen(false);
            }
          }}
          className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {mode === "menu" && (
          <div className="space-y-2">
            <button
              onClick={() => setMode("report")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-red-500/20">
                <Bug className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-200 text-sm">
                  Report an Issue
                </p>
                <p className="text-xs text-zinc-500">
                  Something not working correctly?
                </p>
              </div>
            </button>

            <button
              onClick={() => setMode("help")}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-blue-500/20">
                <HelpCircle className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-200 text-sm">Get Help</p>
                <p className="text-xs text-zinc-500">
                  Questions about guardrail?
                </p>
              </div>
            </button>

            <a
              href="https://docs.guardrail.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <BookOpen className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="font-medium text-zinc-200 text-sm">
                  Documentation
                </p>
                <p className="text-xs text-zinc-500">Read the docs</p>
              </div>
            </a>
          </div>
        )}

        {(mode === "report" || mode === "help") && !submitted && (
          <div className="space-y-4">
            {runId && mode === "report" && (
              <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <p className="text-xs text-zinc-500 mb-1">
                  This report will include:
                </p>
                <div className="text-xs font-mono text-zinc-400">
                  <p>Run ID: {runId}</p>
                  {context &&
                    Object.entries(context).map(([k, v]) => (
                      <p key={k}>
                        {k}: {v}
                      </p>
                    ))}
                </div>
              </div>
            )}

            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                mode === "report"
                  ? "Describe the issue..."
                  : "What do you need help with?"
              }
              className="w-full h-24 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 resize-none"
            />

            <Button
              onClick={handleSubmit}
              disabled={!message.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500"
            >
              <Send className="w-4 h-4 mr-2" />
              {mode === "report" ? "Submit Report" : "Send Message"}
            </Button>
          </div>
        )}

        {submitted && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm text-zinc-200 font-medium">Message sent!</p>
            <p className="text-xs text-zinc-500 mt-1">
              We'll get back to you soon.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
