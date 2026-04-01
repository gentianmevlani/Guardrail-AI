"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { LiquidMetalButton } from "@/components/landing/liquid-metal-button";
import {
  Code,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Shield,
  PlayCircle,
  FileText,
  Terminal,
  Wand2,
  MessageSquare,
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { GlassCardSimple } from "@/components/landing/glass-card";

export default function MCPPage() {
  const heroRef = useRef(null);
  const toolsRef = useRef(null);
  const editorsRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });
  const toolsInView = useInView(toolsRef, { once: true, amount: 0.2 });
  const editorsInView = useInView(editorsRef, { once: true, amount: 0.2 });

  const mcpTools = [
    {
      name: "ship_check",
      description: "Run a complete GO/NO-GO audit and get a detailed report",
      example: "Check if my app is ready to ship",
    },
    {
      name: "ai_agent_test",
      description: "Autonomous AI testing with generated fix prompts",
      example: "Run AI agent tests on my authentication flow",
    },
    {
      name: "reality_mode_test",
      description: "Browser-based testing with Playwright integration",
      example: "Test my signup form like a real user",
    },
    {
      name: "mockproof_scan",
      description: "Detect mock data and demo routes in production code",
      example: "Find any mock providers in my codebase",
    },
    {
      name: "generate_context",
      description: "Generate AI context files for better code understanding",
      example: "Generate context for this project",
    },
    {
      name: "launch_checklist",
      description: "Pre-launch verification wizard with actionable items",
      example: "Run the launch checklist",
    },
  ];

  const nlCommands = [
    { cmd: "what's my status", desc: "Get project health overview" },
    { cmd: "run ai agent", desc: "Autonomous AI testing" },
    { cmd: "run reality mode", desc: "Browser testing" },
    { cmd: "block demo patterns", desc: "Find mock data" },
    { cmd: "launch checklist", desc: "Pre-launch checks" },
    { cmd: "fix it", desc: "Auto-fix issues" },
  ];

  const editors = [
    {
      name: "Cursor",
      status: "Full Support",
      config: "~/.cursor/mcp.json",
    },
    {
      name: "VS Code",
      status: "Full Support",
      config: ".vscode/mcp.json",
    },
    {
      name: "Claude Desktop",
      status: "Full Support",
      config: "claude_desktop_config.json",
    },
    {
      name: "Windsurf",
      status: "Full Support",
      config: "~/.windsurf/mcp.json",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/products/cli">
                <Button
                  variant="ghost"
                  className="text-gray-400 hover:text-white"
                >
                  CLI
                </Button>
              </Link>
              <MagneticButton>
                <LiquidMetalButton size="sm">Get Started</LiquidMetalButton>
              </MagneticButton>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={heroInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <Badge className="mb-6 bg-purple-500/20 text-purple-300 border-purple-500/30">
              <Code className="h-3 w-3 mr-1" />
              Model Context Protocol
            </Badge>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold mb-6 tracking-tight">
              Never leave
              <br />
              <span className="text-purple-400">your editor.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              The guardrail MCP plugin brings powerful code analysis, testing,
              and security scanning directly into your favorite AI-powered
              editor.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm text-gray-400">
              <span className="text-white font-medium">Cursor</span>
              <span>•</span>
              <span className="text-white font-medium">VS Code</span>
              <span>•</span>
              <span className="text-white font-medium">Claude Desktop</span>
              <span>•</span>
              <span className="text-white font-medium">Windsurf</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Tools Section */}
      <section
        ref={toolsRef}
        className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-purple-950/20"
      >
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={toolsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              MCP Tools
            </h2>
            <p className="text-lg text-gray-400">
              Powerful tools accessible through natural language.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {mcpTools.map((tool, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={toolsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
              >
                <GlassCardSimple className="p-6 h-full border border-white/10 hover:border-purple-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <code className="text-purple-400 font-mono font-semibold">
                      {tool.name}
                    </code>
                    <Cpu className="h-4 w-4 text-gray-500" />
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    {tool.description}
                  </p>
                  <div className="p-3 rounded bg-black/50 border border-white/10">
                    <div className="flex items-center gap-2 text-xs">
                      <MessageSquare className="h-3 w-3 text-purple-400" />
                      <span className="text-gray-300 italic">
                        &quot;{tool.example}&quot;
                      </span>
                    </div>
                  </div>
                </GlassCardSimple>
              </motion.div>
            ))}
          </div>

          {/* Natural Language Commands */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={toolsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <GlassCardSimple className="p-8 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-6">
                <Sparkles className="h-6 w-6 text-purple-400" />
                <h3 className="text-xl font-semibold">
                  Natural Language Commands
                </h3>
              </div>
              <p className="text-gray-400 mb-6">
                Just ask in plain English. The MCP plugin understands what you
                need.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {nlCommands.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-black/50 border border-white/10"
                  >
                    <div className="text-purple-300 text-sm font-medium mb-1">
                      &quot;{item.cmd}&quot;
                    </div>
                    <div className="text-gray-500 text-xs">{item.desc}</div>
                  </div>
                ))}
              </div>
            </GlassCardSimple>
          </motion.div>
        </div>
      </section>

      {/* Editors Section */}
      <section ref={editorsRef} className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={editorsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              Works Everywhere
            </h2>
            <p className="text-lg text-gray-400">
              One plugin, all your favorite AI-powered editors.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {editors.map((editor, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={editorsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
              >
                <GlassCardSimple className="p-6 text-center border border-white/10 hover:border-purple-500/30 transition-colors">
                  <h3 className="text-lg font-semibold mb-2">{editor.name}</h3>
                  <Badge className="mb-3 bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                    {editor.status}
                  </Badge>
                  <div className="text-xs text-gray-500 font-mono">
                    {editor.config}
                  </div>
                </GlassCardSimple>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Installation Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <GlassCardSimple className="p-8 border border-purple-500/20">
            <h2 className="text-2xl font-display font-bold mb-6 text-center">
              Quick Setup
            </h2>
            <div className="space-y-4">
              <div className="p-4 rounded bg-black/50 border border-white/10">
                <div className="text-xs text-gray-500 mb-2">
                  1. Install the CLI
                </div>
                <code className="text-purple-300 text-sm">
                  npm install -g @guardrail/cli
                </code>
              </div>
              <div className="p-4 rounded bg-black/50 border border-white/10">
                <div className="text-xs text-gray-500 mb-2">
                  2. Initialize MCP config
                </div>
                <code className="text-purple-300 text-sm">
                  guardrail mcp init
                </code>
              </div>
              <div className="p-4 rounded bg-black/50 border border-white/10">
                <div className="text-xs text-gray-500 mb-2">
                  3. Restart your editor
                </div>
                <code className="text-gray-400 text-sm">
                  The MCP plugin will be automatically detected
                </code>
              </div>
            </div>
          </GlassCardSimple>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <GlassCardSimple className="p-12 text-center border border-purple-500/20">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Ready to supercharge your editor?
            </h2>
            <p className="text-gray-400 mb-8">
              Install the MCP plugin and start using guardrail with natural
              language.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton>
                <LiquidMetalButton size="lg">
                  Install MCP Plugin →
                </LiquidMetalButton>
              </MagneticButton>
              <Link href="/docs/mcp">
                <Button
                  variant="outline"
                  className="border-white/20 hover:bg-white/10"
                >
                  Read Documentation
                </Button>
              </Link>
            </div>
          </GlassCardSimple>
        </div>
      </section>
    </main>
  );
}
