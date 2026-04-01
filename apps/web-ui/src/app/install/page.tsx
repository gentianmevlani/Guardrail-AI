"use client";

import { motion } from "framer-motion";
import {
  Apple,
  ArrowLeft,
  Box,
  Check,
  Copy,
  Cpu,
  Download,
  Globe,
  Monitor,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

type Platform = "macos" | "linux" | "windows" | "docker" | "npm";

interface InstallMethod {
  id: Platform;
  name: string;
  icon: React.ReactNode;
  commands: string[];
  description: string;
}

const installMethods: InstallMethod[] = [
  {
    id: "npm",
    name: "npm / pnpm / yarn",
    icon: <Box className="w-6 h-6" />,
    description: "Install globally via your preferred package manager",
    commands: [
      "# Using npm\nnpm install -g guardrail-cli-tool",
      "# Using pnpm\npnpm add -g guardrail-cli-tool",
      "# Using yarn\nyarn global add guardrail-cli-tool",
    ],
  },
  {
    id: "macos",
    name: "macOS",
    icon: <Apple className="w-6 h-6" />,
    description: "Install via Homebrew (recommended for macOS)",
    commands: [
      "# Install via Homebrew\nbrew tap guardrail/tap\nbrew install guardrail",
      "# Or download the binary directly\ncurl -fsSL https://get.guardrailai.dev | sh",
    ],
  },
  {
    id: "linux",
    name: "Linux",
    icon: <Terminal className="w-6 h-6" />,
    description: "Install via script or package manager",
    commands: [
      "# Quick install script\ncurl -fsSL https://get.guardrailai.dev | sh",
      "# Debian/Ubuntu\nwget -qO- https://get.guardrailai.dev/deb | sudo bash\nsudo apt install guardrail",
      "# Fedora/RHEL\nwget -qO- https://get.guardrailai.dev/rpm | sudo bash\nsudo dnf install guardrail",
    ],
  },
  {
    id: "windows",
    name: "Windows",
    icon: <Monitor className="w-6 h-6" />,
    description: "Install via Scoop, Chocolatey, or npm",
    commands: [
      "# Using Scoop\nscoop bucket add guardrail https://github.com/guardrail/scoop-bucket\nscoop install guardrail",
      "# Using Chocolatey\nchoco install guardrail",
      "# Using npm (requires Node.js)\nnpm install -g guardrail-cli-tool",
    ],
  },
  {
    id: "docker",
    name: "Docker",
    icon: <Cpu className="w-6 h-6" />,
    description: "Run guardrail in a container",
    commands: [
      "# Pull the official image\ndocker pull guardrail/cli:latest",
      "# Run a scan\ndocker run -v $(pwd):/app guardrail/cli scan /app",
      "# Use in CI/CD\ndocker run --rm -v $(pwd):/app \\\n  -e GUARDRAIL_API_KEY=$GUARDRAIL_API_KEY \\\n  guardrail/cli ship --check",
    ],
  },
];

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.replace(/^#.*\n/gm, "").trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden">
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 z-10 p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
      >
        {copied ? (
          <Check className="w-4 h-4 text-emerald-400" />
        ) : (
          <Copy className="w-4 h-4 text-white/60" />
        )}
      </button>
      <pre className="bg-gray-900 border border-white/10 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-white/90 font-mono whitespace-pre-wrap">
          {code}
        </code>
      </pre>
    </div>
  );
}

export default function InstallPage() {
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("npm");
  const currentMethod = installMethods.find((m) => m.id === selectedPlatform)!;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Home</span>
            </Link>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-transparent">
              guardrail
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 border-b border-gray-800">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-2 text-emerald-400 text-sm mb-6">
              <Download className="w-4 h-4" />
              Installation Guide
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Install guardrail
            </h1>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Get guardrail running on your machine in under a minute. Choose
              your preferred installation method below.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Platform Selector */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6 text-center">
              Select Your Platform
            </h2>

            {/* Platform Tabs */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {installMethods.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setSelectedPlatform(method.id)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                    selectedPlatform === method.id
                      ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                      : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {method.icon}
                  <span className="font-medium">{method.name}</span>
                </button>
              ))}
            </div>

            {/* Installation Instructions */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                  {currentMethod.icon}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white">
                    {currentMethod.name}
                  </h3>
                  <p className="text-sm text-white/60">
                    {currentMethod.description}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {currentMethod.commands.map((cmd, index) => (
                  <CodeBlock key={index} code={cmd} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Verify Installation */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Verify Installation
            </h2>
            <p className="text-white/70 mb-6">
              After installation, verify that guardrail is working correctly:
            </p>
            <CodeBlock
              code={`# Check version
guardrail --version

# Run help
guardrail --help

# Initialize in your project
cd your-project
guardrail init`}
            />
          </motion.div>
        </div>
      </section>

      {/* Authentication */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              Authentication (Optional)
            </h2>
            <p className="text-white/70 mb-6">
              For cloud features, team collaboration, and enhanced scanning,
              authenticate with your guardrail account:
            </p>
            <CodeBlock
              code={`# Login to your guardrail account
guardrail auth login

# Or set your API key directly
export GUARDRAIL_API_KEY=your_api_key_here

# Verify authentication
guardrail auth status`}
            />

            <div className="mt-6 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-blue-400 text-sm">
                <strong>Note:</strong> Basic scanning works without
                authentication. Sign up for a free account at{" "}
                <Link href="/" className="underline hover:text-blue-300">
                  guardrailai.dev
                </Link>{" "}
                to unlock team features and cloud dashboards.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* VS Code Extension */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">
              IDE Extensions
            </h2>

            <div className="grid md:grid-cols-2 gap-4">
              <Link
                href="/vscode"
                className="group rounded-lg border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                    <Globe className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    VS Code Extension
                  </h3>
                </div>
                <p className="text-white/60 text-sm">
                  Real-time feedback and inline suggestions as you code.
                </p>
              </Link>

              <a
                href="https://github.com/guardrail/mcp-server"
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-lg border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">
                    MCP Server
                  </h3>
                </div>
                <p className="text-white/60 text-sm">
                  Use guardrail with Claude Desktop, Cursor, and other AI
                  assistants.
                </p>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Next Steps */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Next Steps</h2>

            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  title: "Read the Docs",
                  href: "/docs",
                  desc: "Learn all features",
                },
                {
                  title: "Join Community",
                  href: "/community",
                  desc: "Get help & share",
                },
                {
                  title: "View Dashboard",
                  href: "/dashboard",
                  desc: "Manage your scans",
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all text-center"
                >
                  <h3 className="font-semibold text-white mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/60">{item.desc}</p>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-4 sm:px-6 lg:px-8 py-8">
        <div className="container mx-auto max-w-7xl text-center text-white/50 text-sm">
          © {new Date().getFullYear()} guardrail. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
