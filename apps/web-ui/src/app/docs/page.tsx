"use client";

import InteractiveCodeBlock from "@/components/docs/InteractiveCodeBlock";
import SearchModal from "@/components/docs/SearchModal";
import { useSearchModal } from "@/hooks/useSearchModal";
import { motion } from "framer-motion";
import {
    ArrowLeft,
    Book,
    Check,
    CheckCircle,
    ChevronRight,
    Code,
    Copy,
    GitBranch,
    Search,
    Settings,
    Shield,
    Terminal,
    Zap
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

interface DocSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  items: {
    title: string;
    href: string;
    description?: string;
  }[];
}

const docSections: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <Zap className="w-5 h-5" />,
    items: [
      {
        title: "Introduction",
        href: "#introduction",
        description: "What is guardrail and why use it",
      },
      {
        title: "Quick Start",
        href: "#quickstart",
        description: "Get up and running in 5 minutes",
      },
      {
        title: "Installation",
        href: "/install",
        description: "Detailed installation guide",
      },
      {
        title: "Configuration",
        href: "#configuration",
        description: "Configure guardrail for your project",
      },
    ],
  },
  {
    id: "cli",
    title: "CLI Reference",
    icon: <Terminal className="w-5 h-5" />,
    items: [
      {
        title: "guardrail scan",
        href: "#cli-scan",
        description: "Run security and quality scans",
      },
      {
        title: "guardrail ship",
        href: "#cli-ship",
        description: "Pre-deployment validation",
      },
      {
        title: "guardrail reality",
        href: "#cli-reality",
        description: "Detect mock/placeholder data",
      },
      {
        title: "guardrail init",
        href: "#cli-init",
        description: "Initialize guardrail in your project",
      },
    ],
  },
  {
    id: "features",
    title: "Features",
    icon: <Shield className="w-5 h-5" />,
    items: [
      {
        title: "Security Scanning",
        href: "#security",
        description: "OWASP Top 10 and vulnerability detection",
      },
      {
        title: "Reality Mode",
        href: "#reality-mode",
        description: "Mock data and placeholder detection",
      },
      {
        title: "Ship Check",
        href: "#ship-check",
        description: "GO/NO-GO deployment validation",
      },
      {
        title: "AI Guardrails",
        href: "#ai-guardrails",
        description: "LLM output validation",
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    icon: <GitBranch className="w-5 h-5" />,
    items: [
      {
        title: "GitHub Actions",
        href: "#github-actions",
        description: "CI/CD integration with GitHub",
      },
      {
        title: "GitLab CI",
        href: "#gitlab-ci",
        description: "CI/CD integration with GitLab",
      },
      {
        title: "VS Code Extension",
        href: "#vscode",
        description: "Real-time feedback in your editor",
      },
      {
        title: "MCP Server",
        href: "#mcp",
        description: "Claude Desktop and Cursor integration",
      },
    ],
  },
  {
    id: "api",
    title: "API Reference",
    icon: <Code className="w-5 h-5" />,
    items: [
      {
        title: "REST API",
        href: "#rest-api",
        description: "HTTP API endpoints",
      },
      {
        title: "Authentication",
        href: "#auth",
        description: "API keys and OAuth",
      },
      {
        title: "Webhooks",
        href: "#webhooks",
        description: "Event notifications",
      },
      {
        title: "Rate Limits",
        href: "#rate-limits",
        description: "API usage limits",
      },
    ],
  },
  {
    id: "advanced",
    title: "Advanced",
    icon: <Settings className="w-5 h-5" />,
    items: [
      {
        title: "Custom Rules",
        href: "#custom-rules",
        description: "Create custom scanning rules",
      },
      {
        title: "Policy Profiles",
        href: "#policies",
        description: "Define security policies",
      },
      {
        title: "Self-Hosting",
        href: "#self-hosting",
        description: "Deploy guardrail on-premise",
      },
      {
        title: "Enterprise Setup",
        href: "#enterprise",
        description: "Multi-tenant configuration",
      },
    ],
  },
];

const codeExamples = {
  installation: `# Install via npm
npm install -g @guardrail/cli

# Or via Homebrew (macOS)
brew install guardrail

# Verify installation
guardrail --version`,
  quickstart: `# Initialize guardrail in your project
guardrail init

# Run a comprehensive scan
guardrail scan .

# Check if code is ready to ship
guardrail ship --check

# Detect mock/placeholder data
guardrail reality --scan`,
  githubAction: `name: guardrail Check
on: [push, pull_request]

jobs:
  guardrail:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run guardrail
        uses: guardrail/action@v1
        with:
          scan-path: ./src
          fail-on: high
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}`,
  configuration: `// guardrail.config.js
module.exports = {
  // Scanning options
  scan: {
    paths: ['src', 'lib'],
    exclude: ['node_modules', 'dist', '**/*.test.ts'],
    severity: 'medium', // minimum severity to report
  },
  
  // Reality Mode settings
  reality: {
    enabled: true,
    patterns: ['TODO', 'FIXME', 'mock', 'placeholder'],
    strictMode: false,
  },
  
  // Ship Check configuration
  ship: {
    requirePassing: ['security', 'reality'],
    blockOn: ['critical', 'high'],
    notifications: {
      slack: process.env.SLACK_WEBHOOK_URL,
    },
  },
};`,
};

function CodeBlock({
  code,
  language = "bash",
}: {
  code: string;
  language?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg overflow-hidden">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={handleCopy}
          className="p-2 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4 text-white/60" />
          )}
        </button>
      </div>
      <pre className="bg-gray-900 border border-white/10 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-white/90 font-mono">{code}</code>
      </pre>
    </div>
  );
}

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("introduction");
  const searchModal = useSearchModal();

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

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 border-r border-gray-800 min-h-[calc(100vh-65px)] sticky top-[65px] hidden lg:block overflow-y-auto">
          <div className="p-4">
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                placeholder="Search docs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={searchModal.open}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-white/40">
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-white/10 rounded">K</kbd>
              </div>
            </div>

            {/* Navigation */}
            <nav className="space-y-6">
              {docSections.map((section) => (
                <div key={section.id}>
                  <h3 className="flex items-center gap-2 text-white/60 text-sm font-semibold uppercase tracking-wider mb-3">
                    {section.icon}
                    {section.title}
                  </h3>
                  <ul className="space-y-1">
                    {section.items.map((item) => (
                      <li key={item.title}>
                        <a
                          href={item.href}
                          onClick={() =>
                            setActiveSection(item.href.replace("#", ""))
                          }
                          className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                            activeSection === item.href.replace("#", "")
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "text-white/70 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          {item.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-12 py-12 max-w-4xl">
          {/* Introduction */}
          <section id="introduction" className="mb-16">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium mb-4">
                <Book className="w-4 h-4" />
                Documentation
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Welcome to guardrail
              </h1>
              <p className="text-xl text-white/70 leading-relaxed mb-8">
                guardrail is a comprehensive platform for adding safety
                guardrails to AI-powered development. It helps teams ship faster
                while maintaining code quality, security standards, and
                preventing common AI coding mistakes.
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-8">
                {[
                  {
                    icon: <Shield className="w-6 h-6" />,
                    title: "Security First",
                    desc: "OWASP Top 10 scanning",
                  },
                  {
                    icon: <Zap className="w-6 h-6" />,
                    title: "Fast & Accurate",
                    desc: "Sub-second scan times",
                  },
                  {
                    icon: <GitBranch className="w-6 h-6" />,
                    title: "CI/CD Ready",
                    desc: "Native integrations",
                  },
                ].map((feature) => (
                  <div
                    key={feature.title}
                    className="rounded-lg border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="text-emerald-400 mb-2">{feature.icon}</div>
                    <h3 className="font-semibold text-white mb-1">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-white/60">{feature.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </section>

          {/* Quick Start */}
          <section id="quickstart" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">Quick Start</h2>
            <p className="text-white/70 mb-6">
              Get guardrail up and running in your project in just a few
              commands.
            </p>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">
                    1
                  </span>
                  Install the CLI
                </h3>
                <InteractiveCodeBlock
                  command="npm install -g @guardrail/cli"
                  description="Install via npm"
                  expectedOutput={`✓ Successfully installed @guardrail-cli-tool@1.2.0
✓ Added 15 packages in 2.3s
✓ guardrail CLI is now available globally`}
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-sm">
                    2
                  </span>
                  Run Your First Scan
                </h3>
                <InteractiveCodeBlock
                  command="guardrail scan ."
                  description="Scan current directory"
                  expectedOutput={`🔍 Scanning 42 files...
✓ Found 3 issues (1 high, 2 medium)
⚠️  High: Potential API key exposure in src/config.js:12
⚠️  Medium: Mock data detected in src/utils/test-data.ts:45
⚠️  Medium: TODO comment in src/app.js:89

📊 Score: 78/100 🟡 Ready with warnings

💡 Run 'guardrail scan --fix' to auto-fix issues`}
                />
              </div>
            </div>
          </section>

          {/* Configuration */}
          <section id="configuration" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">
              Configuration
            </h2>
            <p className="text-white/70 mb-6">
              Create a{" "}
              <code className="bg-white/10 px-2 py-1 rounded text-emerald-400">
                guardrail.config.js
              </code>{" "}
              file in your project root to customize guardrail's behavior.
            </p>
            <CodeBlock
              code={codeExamples.configuration}
              language="javascript"
            />
          </section>

          {/* CLI Reference */}
          <section id="cli-scan" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">
              CLI Reference
            </h2>

            <div className="space-y-8">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                  guardrail scan
                </h3>
                <p className="text-white/70 mb-4">
                  Run security and code quality scans on your codebase.
                </p>
                <CodeBlock
                  code={`guardrail scan [path] [options]

Options:
  --severity <level>    Minimum severity to report (low|medium|high|critical)
  --format <type>       Output format (json|table|sarif)
  --exclude <patterns>  Glob patterns to exclude
  --ci                  CI mode - exits with non-zero on findings
  --fix                 Auto-fix issues where possible`}
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6">
                <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  guardrail ship
                </h3>
                <p className="text-white/70 mb-4">
                  Pre-deployment validation to ensure code is ready to ship.
                </p>
                <CodeBlock
                  code={`guardrail ship [options]

Options:
  --check              Run all checks without deploying
  --block-on <level>   Block deployment on severity level
  --report             Generate detailed report
  --notify             Send notifications on completion`}
                />
              </div>
            </div>
          </section>

          {/* GitHub Actions */}
          <section id="github-actions" className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">
              GitHub Actions Integration
            </h2>
            <p className="text-white/70 mb-6">
              Add guardrail to your CI/CD pipeline with our official GitHub
              Action.
            </p>
            <CodeBlock code={codeExamples.githubAction} language="yaml" />
          </section>

          {/* Next Steps */}
          <section className="mb-16">
            <h2 className="text-3xl font-bold text-white mb-6">Next Steps</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Installation Guide",
                  href: "/install",
                  desc: "Detailed installation instructions",
                },
                {
                  title: "API Reference",
                  href: "#rest-api",
                  desc: "Integrate with your tools",
                },
                {
                  title: "Join Community",
                  href: "/community",
                  desc: "Get help and share ideas",
                },
                {
                  title: "Get Support",
                  href: "/support",
                  desc: "Contact our team",
                },
              ].map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-lg border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.05] hover:border-emerald-500/30 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {item.title}
                      </h3>
                      <p className="text-sm text-white/60">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-4 sm:px-6 lg:px-8 py-8">
        <div className="container mx-auto max-w-7xl text-center text-white/50 text-sm">
          © {new Date().getFullYear()} guardrail. All rights reserved.
        </div>
      </footer>

      {/* Search Modal */}
      <SearchModal isOpen={searchModal.isOpen} onClose={searchModal.close} />
    </div>
  );
}
