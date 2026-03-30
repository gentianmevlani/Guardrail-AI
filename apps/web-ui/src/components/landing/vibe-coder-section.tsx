"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Rocket,
  Zap,
  Terminal,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Code,
  Shield,
} from "lucide-react";

export function VibeCoderSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/20 via-black to-black" />

      <div className="container mx-auto max-w-6xl relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <Badge className="mb-4 bg-purple-500/20 text-purple-400 border-purple-500/30">
            <Sparkles className="w-3 h-3 mr-1" />
            For Vibe Coders
          </Badge>

          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            You build with AI.
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              We make sure it works.
            </span>
          </h2>

          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            AI writes code fast. But does it actually work? guardrail catches
            the stuff that looks right but isn't.
          </p>
        </motion.div>

        {/* The Problem */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* AI Generated Code Issues */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl bg-red-950/20 border border-red-800/30"
          >
            <div className="flex items-center gap-2 mb-4">
              <Bot className="w-5 h-5 text-red-400" />
              <h3 className="text-lg font-semibold text-red-400">
                AI Code Problems
              </h3>
            </div>

            <div className="space-y-3">
              {[
                { icon: "🔑", text: "API keys hardcoded in the source" },
                { icon: "🎭", text: "Save buttons that don't save anything" },
                { icon: "🔓", text: "Admin routes with no authentication" },
                { icon: "📡", text: "API calls to endpoints that don't exist" },
                { icon: "💳", text: "Stripe in test mode, ready to go live" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* What guardrail Does */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-800/30"
          >
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-emerald-400">
                guardrail Catches It
              </h3>
            </div>

            <div className="space-y-3">
              {[
                { icon: "✅", text: "Moves secrets to .env automatically" },
                { icon: "✅", text: "Verifies buttons actually do something" },
                { icon: "✅", text: "Checks all routes have proper auth" },
                { icon: "✅", text: "Maps frontend to backend endpoints" },
                { icon: "✅", text: "Detects test mode before you go live" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-gray-300">
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Traffic Light System */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <h3 className="text-2xl font-bold text-white text-center mb-8">
            Simple Traffic Light Scoring
          </h3>

          <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
            <div className="p-6 rounded-xl bg-emerald-950/30 border border-emerald-800/50 text-center">
              <div className="text-5xl mb-3">🟢</div>
              <h4 className="text-lg font-bold text-emerald-400">Ship It!</h4>
              <p className="text-sm text-gray-400 mt-1">80+ score</p>
              <p className="text-xs text-gray-500 mt-2">Your app is ready</p>
            </div>

            <div className="p-6 rounded-xl bg-amber-950/30 border border-amber-800/50 text-center">
              <div className="text-5xl mb-3">🟡</div>
              <h4 className="text-lg font-bold text-amber-400">Almost</h4>
              <p className="text-sm text-gray-400 mt-1">50-79 score</p>
              <p className="text-xs text-gray-500 mt-2">A few things to fix</p>
            </div>

            <div className="p-6 rounded-xl bg-red-950/30 border border-red-800/50 text-center">
              <div className="text-5xl mb-3">🔴</div>
              <h4 className="text-lg font-bold text-red-400">Fix First</h4>
              <p className="text-sm text-gray-400 mt-1">&lt;50 score</p>
              <p className="text-xs text-gray-500 mt-2">
                Critical issues found
              </p>
            </div>
          </div>
        </motion.div>

        {/* Quick Start */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-8 rounded-2xl bg-gradient-to-r from-blue-950/30 to-purple-950/30 border border-blue-800/30"
        >
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">
                One Command. No Config.
              </h3>
              <p className="text-gray-400 mb-4">
                Just run this in your project folder. That's it.
              </p>

              <div className="p-4 rounded-lg bg-black/50 border border-gray-800 font-mono">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                  <Terminal className="w-4 h-4" />
                  Terminal
                </div>
                <code className="text-emerald-400 text-lg">
                  npx guardrail ship
                </code>
              </div>

              <p className="text-sm text-gray-500 mt-3">
                Add <code className="text-purple-400">--fix</code> to auto-fix
                safe issues
              </p>
            </div>

            <div className="flex-1">
              <div className="p-4 rounded-lg bg-black/30 border border-gray-800">
                <div className="text-sm text-gray-500 mb-2">Output:</div>
                <div className="space-y-2 font-mono text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🟢</span>
                    <span className="text-emerald-400 font-bold">
                      Ready to ship!
                    </span>
                  </div>
                  <div className="text-gray-400">Score: 85/100</div>
                  <div className="text-gray-500">• No exposed secrets</div>
                  <div className="text-gray-500">• All routes protected</div>
                  <div className="text-gray-500">• APIs verified</div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <Button
            size="lg"
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-6 text-lg rounded-full"
          >
            <Rocket className="w-5 h-5 mr-2" />
            Try It Free
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
          <p className="text-sm text-gray-500 mt-4">
            No account needed. Just run the command.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
