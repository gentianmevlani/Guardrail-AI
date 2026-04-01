"use client";

import {
  ArrowRight,
  Play,
  CheckCircle,
  XCircle,
  Monitor,
  MousePointer,
  FormInput,
  AlertTriangle,
  Video,
  FileJson,
} from "lucide-react";
import Link from "next/link";

export default function RealityModePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-green-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-sm mb-8">
              <Play className="w-4 h-4" />
              Browser Testing
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              Reality Mode:{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400">
                Test Like a Real User
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Static analysis can't catch buttons that do nothing. Reality Mode
              uses Playwright to actually click your UI, fill forms, and prove
              your app works—or doesn't.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/#pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Play className="w-5 h-5" />
                Try Reality Mode
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                See How It Works
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* What It Does */}
      <section id="how-it-works" className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-4">
              What Reality Mode Does
            </h2>
            <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
              Reality Mode launches a real browser and interacts with your app
              exactly like a user would—then reports what actually happened.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Monitor,
                  title: "Discovers Routes",
                  description:
                    "Crawls all links and navigation to find every page",
                },
                {
                  icon: MousePointer,
                  title: "Clicks Buttons",
                  description: "Interacts with every clickable element safely",
                },
                {
                  icon: FormInput,
                  title: "Fills Forms",
                  description: "Submits forms with smart test data",
                },
                {
                  icon: AlertTriangle,
                  title: "Catches Errors",
                  description:
                    "Records console errors, network failures, exceptions",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center"
                >
                  <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Scoring System */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Reality Score (0-100)
            </h2>

            <div className="space-y-6">
              {[
                {
                  category: "Coverage",
                  points: 40,
                  description: "Routes visited, elements tested, forms filled",
                  color: "blue",
                },
                {
                  category: "Functionality",
                  points: 35,
                  description: "Actions that worked, forms that submitted",
                  color: "green",
                },
                {
                  category: "Stability",
                  points: 15,
                  description: "Error penalty (3 pts per error)",
                  color: "yellow",
                },
                {
                  category: "UX",
                  points: 10,
                  description: "Elements that responded to interaction",
                  color: "purple",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">
                      {item.category}
                    </h3>
                    <span
                      className={`text-2xl font-bold ${
                        item.color === "blue"
                          ? "text-blue-400"
                          : item.color === "green"
                            ? "text-green-400"
                            : item.color === "yellow"
                              ? "text-yellow-400"
                              : "text-purple-400"
                      }`}
                    >
                      {item.points} pts
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                  <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        item.color === "blue"
                          ? "bg-blue-500"
                          : item.color === "green"
                            ? "bg-green-500"
                            : item.color === "yellow"
                              ? "bg-yellow-500"
                              : "bg-purple-500"
                      }`}
                      style={{ width: `${item.points}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CLI Usage */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              CLI Commands
            </h2>

            <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-800/50">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-400 text-sm ml-2">Terminal</span>
              </div>
              <div className="p-6 font-mono text-sm space-y-4">
                <div>
                  <span className="text-slate-500"># Basic scan</span>
                  <div className="text-green-400">
                    guardrail reality --url https://myapp.com
                  </div>
                </div>
                <div>
                  <span className="text-slate-500"># With authentication</span>
                  <div className="text-green-400">
                    guardrail reality --url https://myapp.com --auth
                    email:password
                  </div>
                </div>
                <div>
                  <span className="text-slate-500"># With flow packs</span>
                  <div className="text-green-400">
                    guardrail reality --url https://myapp.com --flows
                    auth,checkout
                  </div>
                </div>
                <div>
                  <span className="text-slate-500">
                    # CI mode (JUnit + SARIF)
                  </span>
                  <div className="text-green-400">
                    guardrail reality --url https://myapp.com --ci --threshold
                    80
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Output Files */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              What You Get
            </h2>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: FileJson,
                  file: "reality-report.html",
                  description: "Visual HTML report with screenshots",
                },
                {
                  icon: FileJson,
                  file: "explorer-results.json",
                  description: "JSON results for programmatic access",
                },
                {
                  icon: FileJson,
                  file: "junit-results.xml",
                  description: "JUnit XML for CI test reporters",
                },
                {
                  icon: FileJson,
                  file: "reality-results.sarif",
                  description: "SARIF for GitHub Code Scanning",
                },
                {
                  icon: Video,
                  file: "videos/",
                  description: "Screen recordings of the test run",
                },
                {
                  icon: FileJson,
                  file: "trace.zip",
                  description: "Playwright trace for debugging",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <item.icon className="w-5 h-5 text-green-400" />
                    <code className="text-cyan-400 text-sm">{item.file}</code>
                  </div>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Reality Mode vs. Traditional Testing
            </h2>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left px-6 py-4 text-slate-300 font-medium">
                      Capability
                    </th>
                    <th className="text-center px-6 py-4 text-slate-300 font-medium">
                      E2E Tests
                    </th>
                    <th className="text-center px-6 py-4 text-slate-300 font-medium">
                      Reality Mode
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cap: "Zero configuration", e2e: false, reality: true },
                    { cap: "Auto-discovers routes", e2e: false, reality: true },
                    { cap: "Tests all buttons", e2e: false, reality: true },
                    { cap: "Catches console errors", e2e: "⚠️", reality: true },
                    {
                      cap: "Network failure detection",
                      e2e: "⚠️",
                      reality: true,
                    },
                    { cap: "Mock data detection", e2e: false, reality: true },
                    { cap: "Video recording", e2e: "⚠️", reality: true },
                    { cap: "CI integration", e2e: true, reality: true },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-700/50 last:border-0"
                    >
                      <td className="px-6 py-4 text-white">{row.cap}</td>
                      <td className="px-6 py-4 text-center">
                        {row.e2e === true ? (
                          <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                        ) : row.e2e === false ? (
                          <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-yellow-400">{row.e2e}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
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
              See What's Really Happening
            </h2>
            <p className="text-slate-300 mb-8">
              Stop guessing if your app works. Let Reality Mode prove it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/#pricing"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Play className="w-5 h-5" />
                Get Started
              </Link>
              <Link
                href="/vscode"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                VS Code Extension
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
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
