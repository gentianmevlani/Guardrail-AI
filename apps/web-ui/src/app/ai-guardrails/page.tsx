"use client";

import {
  ArrowRight,
  Bot,
  CheckCircle,
  Shield,
  XCircle,
  AlertTriangle,
  Sparkles,
  Code,
  Zap,
  Layers,
  Box,
  ShieldAlert,
  BadgeCheck,
  History,
} from "lucide-react";
import Link from "next/link";

export default function AIGuardrailsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-transparent to-transparent" />

        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-400 text-sm mb-8">
              <Bot className="w-4 h-4" />
              AI Safety for Developers
            </div>

            <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
              AI Guardrails for{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                Code Safety
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              AI coding assistants hallucinate. They generate imports that don't
              exist, mock data that looks real, and patterns that break in
              production. guardrail catches them all.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/vscode"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Shield className="w-5 h-5" />
                Get VS Code Extension
              </Link>
              <Link
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                How It Works
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-4">
              The Problem with AI-Generated Code
            </h2>
            <p className="text-slate-400 text-center mb-12 max-w-2xl mx-auto">
              AI assistants like Copilot, Cursor, and ChatGPT generate code that{" "}
              <em>looks</em> correct but often isn't. Here's what they get
              wrong:
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  icon: XCircle,
                  title: "Hallucinated Imports",
                  problem: "AI invents package names that don't exist",
                  example:
                    'import { validateSchema } from "json-validator-pro"',
                  reality: 'Package "json-validator-pro" doesn\'t exist on npm',
                },
                {
                  icon: AlertTriangle,
                  title: "Fake Success Patterns",
                  problem: "Code that looks like it saves data but doesn't",
                  example: "onClick={() => saveToDatabase(data)}",
                  reality:
                    "saveToDatabase() is a no-op that just logs to console",
                },
                {
                  icon: Code,
                  title: "Mock Data in Production",
                  problem: "Placeholder data that should be replaced",
                  example: 'const user = { id: 123, email: "test@test.com" }',
                  reality: "Hardcoded test data ships to production",
                },
                {
                  icon: Shield,
                  title: "Missing Auth Checks",
                  problem: "Admin routes without authentication",
                  example: 'router.get("/admin/users", getAllUsers)',
                  reality: "No middleware checking if user is authenticated",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-slate-400 text-sm mb-4">{item.problem}</p>
                  <div className="bg-slate-900 rounded-lg p-3 mb-3">
                    <code className="text-red-400 text-sm">{item.example}</code>
                  </div>
                  <p className="text-slate-500 text-sm">
                    <span className="text-yellow-400">Reality:</span>{" "}
                    {item.reality}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Defense in depth — @guardrail/ai-guardrails */}
      <section className="py-16 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-4">
              Defense in depth
            </h2>
            <p className="text-slate-400 text-center mb-10 max-w-2xl mx-auto">
              The Guardrail stack layers controls so agents can’t skip straight to production: sandbox
              permissions, injection checks, output validation, and an audit trail.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  icon: Box,
                  title: "Sandbox",
                  text: "Checkpoint and intercept actions; enforce allowed tools and resource limits per agent.",
                },
                {
                  icon: ShieldAlert,
                  title: "Injection",
                  text: "Detect prompt-injection and untrusted instructions before they reach your model or tools.",
                },
                {
                  icon: BadgeCheck,
                  title: "Validation",
                  text: "Multi-stage pipeline: syntax, imports, hallucination checks, intent alignment, security.",
                },
                {
                  icon: History,
                  title: "Audit",
                  text: "Queryable audit log and reports for compliance and post-incident review.",
                },
              ].map((row) => (
                <div
                  key={row.title}
                  className="bg-slate-800/40 rounded-xl border border-slate-700/80 p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2 text-purple-400">
                    <row.icon className="w-5 h-5 shrink-0" />
                    <h3 className="text-sm font-semibold text-white">{row.title}</h3>
                  </div>
                  <p className="text-slate-400 text-sm leading-relaxed">{row.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              How guardrail Protects You
            </h2>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  icon: Code,
                  title: "Static Analysis",
                  description:
                    "Scans your code for patterns known to cause production issues: hardcoded secrets, mock data, missing error handling.",
                },
                {
                  step: "2",
                  icon: Sparkles,
                  title: "AI Validation",
                  description:
                    "Truth Pack lists real symbols and routes; validation checks imports against that ground truth and catches hallucinated APIs.",
                },
                {
                  step: "3",
                  icon: Zap,
                  title: "Reality Testing",
                  description:
                    "Runs your app with Playwright, clicking buttons and filling forms to catch fake success patterns.",
                },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="w-16 h-16 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-purple-400">
                      {item.step}
                    </span>
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

      {/* Truth Pack — same story as CLI */}
      <section className="py-16 border-t border-slate-800 bg-slate-900/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Layers className="w-6 h-6 text-purple-400" />
              <h2 className="text-2xl font-bold text-white text-center">
                Truth Pack — ground truth for your repo
              </h2>
            </div>
            <p className="text-slate-400 text-center mb-8 max-w-2xl mx-auto">
              Before an AI touches your code, index what actually exists: symbols, routes, and
              dependencies under{" "}
              <code className="text-purple-300 bg-slate-800/80 px-1.5 py-0.5 rounded text-sm">
                .guardrail-context/
              </code>
              . The Guardrail CLI, Reality Sniff scoring, and the Context Engine MCP all read the
              same files—no duplicate sources of truth.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Guardrail CLI</h3>
                <pre className="text-xs text-emerald-400/90 overflow-x-auto p-3 bg-slate-950 rounded-lg border border-slate-800">
                  guardrail scan --with-context
                </pre>
                <p className="text-slate-500 text-xs mt-2">
                  Refreshes the Truth Pack, then runs Reality Sniff with route/symbol-weighted
                  scoring.
                </p>
              </div>
              <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Context Engine (MCP)</h3>
                <pre className="text-xs text-sky-400/90 overflow-x-auto p-3 bg-slate-950 rounded-lg border border-slate-800">
                  guardrail-context index{"\n"}
                  guardrail-context serve
                </pre>
                <p className="text-slate-500 text-xs mt-2">
                  Same directory. Exposes{" "}
                  <code className="text-slate-400">symbols.exists</code>,{" "}
                  <code className="text-slate-400">verify.fast</code>, and more to your IDE.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Why Not Just Use Tests?
            </h2>

            <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left px-6 py-4 text-slate-300 font-medium">
                      Issue
                    </th>
                    <th className="text-center px-6 py-4 text-slate-300 font-medium">
                      Unit Tests
                    </th>
                    <th className="text-center px-6 py-4 text-slate-300 font-medium">
                      guardrail
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      issue: "Hallucinated imports",
                      tests: false,
                      guardrail: true,
                    },
                    {
                      issue: "Hardcoded secrets",
                      tests: false,
                      guardrail: true,
                    },
                    {
                      issue: "Mock data in prod",
                      tests: false,
                      guardrail: true,
                    },
                    {
                      issue: "Buttons that do nothing",
                      tests: false,
                      guardrail: true,
                    },
                    {
                      issue: "Missing auth checks",
                      tests: "⚠️",
                      guardrail: true,
                    },
                    {
                      issue: "API wiring issues",
                      tests: "⚠️",
                      guardrail: true,
                    },
                  ].map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-700/50 last:border-0"
                    >
                      <td className="px-6 py-4 text-white">{row.issue}</td>
                      <td className="px-6 py-4 text-center">
                        {row.tests === true ? (
                          <CheckCircle className="w-5 h-5 text-green-400 mx-auto" />
                        ) : row.tests === false ? (
                          <XCircle className="w-5 h-5 text-red-400 mx-auto" />
                        ) : (
                          <span className="text-yellow-400">{row.tests}</span>
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

            <p className="text-slate-400 text-center mt-6 text-sm">
              Tests verify <em>your</em> logic works. guardrail verifies{" "}
              <em>AI-generated</em> code is real.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Stop AI Code from Lying to You
            </h2>
            <p className="text-slate-300 mb-8">
              Install guardrail and validate every AI-generated line before it
              ships.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/vscode"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors"
              >
                <Shield className="w-5 h-5" />
                Get VS Code Extension
              </Link>
              <a
                href="https://github.com/guardrail-ai/guardrail-vscode"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
              >
                View on GitHub
                <ArrowRight className="w-5 h-5" />
              </a>
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
