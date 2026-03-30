"use client";

import { useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MagneticButton } from "@/components/landing/magnetic-button";
import { LiquidMetalButton } from "@/components/landing/liquid-metal-button";
import {
  Terminal,
  ArrowLeft,
  CheckCircle2,
  Zap,
  Shield,
  PlayCircle,
  FileText,
  GitBranch,
  Package,
  Lock,
  Activity,
  Code,
  Copy,
  ChevronRight,
} from "lucide-react";
import { motion, useInView } from "framer-motion";
import { GlassCardSimple } from "@/components/landing/glass-card";

export default function CLIPage() {
  const heroRef = useRef(null);
  const commandsRef = useRef(null);
  const featuresRef = useRef(null);
  const heroInView = useInView(heroRef, { once: true });
  const commandsInView = useInView(commandsRef, { once: true, amount: 0.2 });
  const featuresInView = useInView(featuresRef, { once: true, amount: 0.2 });

  const commands = [
    {
      name: "guardrail ship",
      description: "Zero-config audit with GO/NO-GO verdict",
      flags: ["--fix", "--json", "--ci"],
      example: "guardrail ship --fix",
    },
    {
      name: "guardrail scan",
      description: "Static code analysis for security issues",
      flags: ["--severity", "--output", "--ignore"],
      example: "guardrail scan --severity high",
    },
    {
      name: "guardrail reality",
      description: "Browser testing with Playwright",
      flags: ["--url", "--auth", "--flows", "--ci", "--threshold"],
      example: "guardrail reality --url https://myapp.com --flows auth",
    },
    {
      name: "guardrail context",
      description: "Generate AI context for your codebase",
      flags: ["--prune", "--max-tokens", "--diff", "--file"],
      example: "guardrail context --prune --max-tokens 8000",
    },
    {
      name: "guardrail gate",
      description: "CI/CD deploy blocking based on scan results",
      flags: ["--threshold", "--block", "--allow"],
      example: "guardrail gate --threshold 80",
    },
    {
      name: "guardrail autopilot",
      description: "Continuous protection on every push",
      flags: ["--schedule", "--notify", "--auto-pr"],
      example: "guardrail autopilot --schedule weekly",
    },
  ];

  const features = [
    {
      icon: Shield,
      title: "Security Scanning",
      description: "Detect vulnerabilities, exposed secrets, and security misconfigurations automatically.",
    },
    {
      icon: PlayCircle,
      title: "Reality Mode",
      description: "Test your app like a real user with Playwright-powered browser automation.",
    },
    {
      icon: FileText,
      title: "Context Generation",
      description: "Generate 26 context files for AI assistants, analyzing 1000+ files intelligently.",
    },
    {
      icon: GitBranch,
      title: "CI/CD Integration",
      description: "Block deploys, generate SARIF reports, and integrate with GitHub Actions.",
    },
    {
      icon: Zap,
      title: "Auto-Fix",
      description: "Automatically fix detected issues with AI-generated patches.",
    },
    {
      icon: Lock,
      title: "MockProof Gate",
      description: "Prevent mock data and demo routes from reaching production.",
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/products/mcp">
                <Button variant="ghost" className="text-gray-400 hover:text-white">
                  MCP Plugin
                </Button>
              </Link>
              <MagneticButton>
                <LiquidMetalButton size="sm">
                  Get Started
                </LiquidMetalButton>
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
            <Badge className="mb-6 bg-blue-500/20 text-blue-300 border-blue-500/30">
              <Terminal className="h-3 w-3 mr-1" />
              Command Line Interface
            </Badge>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold mb-6 tracking-tight">
              One command.
              <br />
              <span className="text-blue-400">Complete insight.</span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              The guardrail CLI gives you instant visibility into your codebase health,
              security vulnerabilities, and production readiness.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <GlassCardSimple className="px-6 py-3 font-mono text-sm">
                <span className="text-gray-500">$</span>{" "}
                <span className="text-blue-300">npm install -g @guardrail/cli</span>
              </GlassCardSimple>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Commands Section */}
      <section ref={commandsRef} className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-blue-950/20">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={commandsInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              Powerful Commands
            </h2>
            <p className="text-lg text-gray-400">
              Everything you need to ship with confidence.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {commands.map((cmd, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={commandsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
              >
                <GlassCardSimple className="p-6 h-full border border-white/10 hover:border-blue-500/30 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <code className="text-blue-400 font-mono font-semibold">{cmd.name}</code>
                    <button className="text-gray-500 hover:text-white transition-colors">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">{cmd.description}</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {cmd.flags.map((flag, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-white/5 text-xs text-gray-400 font-mono">
                        {flag}
                      </span>
                    ))}
                  </div>
                  <div className="p-3 rounded bg-black/50 font-mono text-xs">
                    <span className="text-gray-500">$</span>{" "}
                    <span className="text-green-400">{cmd.example}</span>
                  </div>
                </GlassCardSimple>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section ref={featuresRef} className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl sm:text-5xl font-display font-bold mb-4">
              Built for Modern Teams
            </h2>
            <p className="text-lg text-gray-400">
              Enterprise-grade features, developer-friendly experience.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={featuresInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * idx }}
              >
                <GlassCardSimple className="p-6 h-full border border-white/10">
                  <feature.icon className="h-8 w-8 text-blue-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-400">{feature.description}</p>
                </GlassCardSimple>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-4xl">
          <GlassCardSimple className="p-12 text-center border border-blue-500/20">
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
              Ready to ship with confidence?
            </h2>
            <p className="text-gray-400 mb-8">
              Install the CLI and run your first scan in under a minute.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <MagneticButton>
                <LiquidMetalButton size="lg">
                  Install CLI →
                </LiquidMetalButton>
              </MagneticButton>
              <Link href="/docs/cli">
                <Button variant="outline" className="border-white/20 hover:bg-white/10">
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
