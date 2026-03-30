"use client";

import {
  ArrowRight,
  CheckCircle,
  Download,
  Shield,
  Zap,
  Eye,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function VSCodePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-8">
              <Shield className="w-4 h-4" />
              VS Code Extension
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              guardrail for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                VS Code
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Stop AI-generated code from lying to you. Inline diagnostics,
              score badge, and CI integration — all inside your editor.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="vscode:extension/guardrail-ai.guardrail"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Download className="w-5 h-5" />
                Install Extension
              </a>
              <Link
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                See Features
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Score Badge Demo */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Score Badge in Your Status Bar
                </h2>
                <p className="text-slate-300 mb-6">
                  See your workspace health at a glance. Traffic light scoring
                  shows you exactly where you stand:
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-green-500/20 border border-green-500/40 rounded flex items-center justify-center text-green-400 font-mono text-sm">
                      80+
                    </div>
                    <span className="text-slate-300">Ready to ship</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-yellow-500/20 border border-yellow-500/40 rounded flex items-center justify-center text-yellow-400 font-mono text-sm">
                      50-79
                    </div>
                    <span className="text-slate-300">Needs attention</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 bg-red-500/20 border border-red-500/40 rounded flex items-center justify-center text-red-400 font-mono text-sm">
                      &lt;50
                    </div>
                    <span className="text-slate-300">Critical issues</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
                  <div className="flex items-center justify-between border-b border-slate-700 pb-3 mb-3">
                    <span className="text-slate-400">Status Bar</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Score: 85/100</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400">Ln 42, Col 8</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              What It Catches
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: AlertTriangle,
                  title: "Hardcoded Secrets",
                  description:
                    "API keys, passwords, and tokens that should be in env vars",
                  color: "red",
                },
                {
                  icon: Eye,
                  title: "Mock Data in Prod",
                  description:
                    "Fake data that looks real but will break in production",
                  color: "red",
                },
                {
                  icon: Zap,
                  title: "Silent Failures",
                  description:
                    "Empty catch blocks that swallow errors silently",
                  color: "red",
                },
                {
                  icon: Shield,
                  title: "Missing Auth",
                  description: "Admin routes without authentication checks",
                  color: "yellow",
                },
                {
                  icon: CheckCircle,
                  title: "Hallucinated Imports",
                  description:
                    "AI-generated imports for packages that don't exist",
                  color: "yellow",
                },
                {
                  icon: Eye,
                  title: "Debug Code",
                  description: "console.log statements left in production code",
                  color: "blue",
                },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-slate-600 transition-colors"
                >
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                      feature.color === "red"
                        ? "bg-red-500/20 text-red-400"
                        : feature.color === "yellow"
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-slate-400 text-sm">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Commands */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Keyboard Shortcuts
            </h2>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-6 py-4 text-slate-300 font-medium">
                      Command
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-medium">
                      Shortcut
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cmd: "Scan Workspace", key: "Ctrl+Shift+G" },
                    { cmd: "Validate AI Code", key: "Ctrl+Shift+V" },
                    { cmd: "Analyze Selection", key: "Ctrl+Shift+R" },
                    { cmd: "AI Intent Verify", key: "Ctrl+Shift+I" },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-700/50 last:border-0"
                    >
                      <td className="px-6 py-4 text-white">{row.cmd}</td>
                      <td className="px-6 py-4">
                        <code className="px-2 py-1 bg-slate-700 rounded text-cyan-400 text-sm">
                          {row.key}
                        </code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Ship with Confidence?
            </h2>
            <p className="text-slate-300 mb-8">
              Install guardrail and see your workspace health score in seconds.
            </p>
            <a
              href="vscode:extension/guardrail-ai.guardrail"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors"
            >
              <Download className="w-5 h-5" />
              Install for VS Code
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center text-slate-400 text-sm">
          © 2026 guardrail. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
