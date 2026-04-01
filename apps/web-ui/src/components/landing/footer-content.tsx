import React from "react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { EnterpriseForm } from "./enterprise-form";

export const footerModalContent: Record<string, { title: string; content: React.ReactNode }> = {
  "Enterprise": {
    title: "Enterprise Plan Inquiry",
    content: <EnterpriseForm />,
  },
  "Features": {
    title: "Features",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          guardrail provides comprehensive guardrails for AI-powered development.
        </p>
        <ul className="space-y-2 text-white/60">
          <li>• AI Agent Sandbox - Isolate and validate AI code</li>
          <li>• Real-Time Guardian - Live quality monitoring</li>
          <li>• Smart Code Search - Semantic codebase search</li>
          <li>• Security & Compliance - Automated scanning</li>
          <li>• Issue Prediction - Catch problems early</li>
          <li>• Multi-Repo Intelligence - Team-wide patterns</li>
        </ul>
        <Button
          onClick={() => {
            document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white text-black hover:bg-white/90"
        >
          View All Features →
        </Button>
      </div>
    ),
  },
  "Pricing": {
    title: "Pricing",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Flexible pricing for teams of all sizes. Start free and upgrade anytime.
        </p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h4 className="font-semibold text-white mb-2">Starter</h4>
            <p className="text-2xl font-bold text-white">$29<span className="text-sm text-white/60">/mo</span></p>
            <p className="text-sm text-white/60 mt-2">Perfect for individuals</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-xs text-emerald-400 mb-1">Most Popular</div>
            <h4 className="font-semibold text-white mb-2">Team</h4>
            <p className="text-2xl font-bold text-white">$99<span className="text-sm text-white/60">/mo</span></p>
            <p className="text-sm text-white/60 mt-2">Perfect for small teams</p>
          </div>
        </div>
        <Button
          onClick={() => {
            document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="bg-white text-black hover:bg-white/90 w-full"
        >
          See All Plans →
        </Button>
      </div>
    ),
  },
  "Documentation": {
    title: "Documentation",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Comprehensive guides and API reference to help you get the most out of guardrail.
        </p>
        <div className="space-y-3">
          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">Getting Started</div>
              <div className="text-sm text-white/60">Installation and setup guide</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>
          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">API Reference</div>
              <div className="text-sm text-white/60">Complete API documentation</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>
          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">Best Practices</div>
              <div className="text-sm text-white/60">Tips and recommendations</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>
        </div>
      </div>
    ),
  },
  "Contact": {
    title: "Contact Us",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Have questions or need support? Get in touch with us at:
        </p>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-6 text-center">
          <div className="text-white/60 text-sm mb-2">Email</div>
          <a
            href="mailto:support@guardrailai.dev"
            className="text-2xl font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            support@guardrailai.dev
          </a>
        </div>
        <div className="text-sm text-white/60 text-center">
          We typically respond within 24 hours
        </div>
      </div>
    ),
  },
  "About": {
    title: "About guardrail",
    content: (
      <div className="space-y-4">
        <p className="text-white/70 leading-relaxed">
          guardrail is an open-source platform that brings professional development guardrails to AI-powered coding. We provide tools and workflows that help teams ship faster while maintaining code quality, security, and architectural integrity.
        </p>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h4 className="font-semibold text-white mb-2">Our Mission</h4>
          <p className="text-sm text-white/70">
            To empower developers to confidently use AI assistants in production environments through transparent, locally-run validation and security checks. Stop shipping mock data, untested code, and architectural drift.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-semibold text-white">What We Offer</h4>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <div>
                <span className="text-white font-medium">CLI Tools:</span> Security scanning, compliance checking, and code quality validation
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <div>
                <span className="text-white font-medium">MCP Server:</span> Direct integration with Claude Desktop, Cursor, and other AI assistants
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <div>
                <span className="text-white font-medium">Ship Check:</span> GO/NO-GO deployment validation with detailed reports
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-emerald-400 mt-0.5">•</span>
              <div>
                <span className="text-white font-medium">Reality Mode:</span> Mock data detection and prevention
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="font-semibold text-white mb-2">Open Source</h4>
          <p className="text-sm text-white/70">
            guardrail is open source and available on{" "}
            <a
              href="https://github.com/guardiavault-oss/guardrail"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              GitHub
            </a>
            . All analysis runs locally - your code never leaves your infrastructure.
          </p>
        </div>
      </div>
    ),
  },
  "Blog": {
    title: "Blog",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Insights, tutorials, and updates from the guardrail team on AI-powered development, security best practices, and product updates.
        </p>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
          <h4 className="font-semibold text-white mb-2">Latest Posts</h4>
          <ul className="space-y-2 text-sm text-white/70 text-left mb-4">
            <li>• Introducing guardrail: AI Development Guardrails</li>
            <li>• Why Mock Data Detection Matters</li>
            <li>• Ship Check: GO/NO-GO Validation</li>
            <li>• CI/CD Integration Guide</li>
            <li>• Security Best Practices for AI Code</li>
            <li>• Using the MCP Server with Claude Desktop</li>
          </ul>
          <Button
            onClick={() => window.location.href = "/blog"}
            className="bg-white text-black hover:bg-white/90 w-full"
          >
            Read All Posts →
          </Button>
        </div>

        <div className="text-sm text-white/60 text-center">
          Follow us on{" "}
          <a
            href="https://twitter.com/Guardrail_ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Twitter/X
          </a>{" "}
          for updates
        </div>
      </div>
    ),
  },
  "Installation Guide": {
    title: "Installation Guide",
    content: (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-white/70">
          Get guardrail up and running in minutes. Choose between the CLI for command-line workflows or the MCP Server for AI assistant integration.
        </p>

        <div className="space-y-6">
          {/* CLI Installation */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <h3 className="font-bold text-white text-lg mb-3">guardrail CLI</h3>
            <p className="text-sm text-white/70 mb-3">
              Security scanning command-line tool for your development workflow
            </p>

            <h4 className="font-semibold text-white mb-2 text-sm">Installation</h4>
            <div className="rounded-lg bg-black/40 p-3 font-mono text-xs mb-3">
              <div className="text-white/60"># Install globally</div>
              <div className="text-emerald-400">npm install -g @guardrail/cli</div>
            </div>

            <h4 className="font-semibold text-white mb-2 text-sm">Usage</h4>
            <div className="rounded-lg bg-black/40 p-3 font-mono text-xs">
              <div className="text-white/60"># Run security scan</div>
              <div className="text-emerald-400">guardrail scan</div>
              <div className="text-white/60 mt-2"># Check compliance</div>
              <div className="text-emerald-400">guardrail compliance</div>
            </div>
          </div>

          {/* MCP Server Installation */}
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <h3 className="font-bold text-white text-lg mb-3">guardrail MCP Server</h3>
            <p className="text-sm text-white/70 mb-3">
              Professional guardrails for AI assistants (Claude Desktop, Cursor, Windsurf, VS Code)
            </p>

            <h4 className="font-semibold text-white mb-2 text-sm">1. Install Package</h4>
            <div className="rounded-lg bg-black/40 p-3 font-mono text-xs mb-3">
              <div className="text-emerald-400">npm install -g @guardrail/mcp-server</div>
            </div>

            <h4 className="font-semibold text-white mb-2 text-sm">2. Configure Your Editor</h4>
            <div className="space-y-2 text-xs">
              <details className="group">
                <summary className="cursor-pointer text-white/80 hover:text-white font-medium">
                  Claude Desktop
                </summary>
                <div className="mt-2 ml-3 space-y-2">
                  <p className="text-white/60">Edit claude_desktop_config.json:</p>
                  <ul className="text-white/60 space-y-1 text-xs">
                    <li>• macOS: ~/Library/Application Support/Claude/</li>
                    <li>• Windows: %APPDATA%\Claude\</li>
                    <li>• Linux: ~/.config/claude/</li>
                  </ul>
                  <div className="rounded-lg bg-black/40 p-3 font-mono text-xs">
                    <div className="text-white/60">&#123;</div>
                    <div className="text-white/60">  "mcpServers": &#123;</div>
                    <div className="text-white/60">    "guardrail": &#123;</div>
                    <div className="text-white/60">      "command": "npx",</div>
                    <div className="text-white/60">      "args": ["-y", "@guardrail/mcp-server"]</div>
                    <div className="text-white/60">    &#125;</div>
                    <div className="text-white/60">  &#125;</div>
                    <div className="text-white/60">&#125;</div>
                  </div>
                </div>
              </details>

              <details className="group">
                <summary className="cursor-pointer text-white/80 hover:text-white font-medium">
                  Cursor
                </summary>
                <div className="mt-2 ml-3 space-y-2">
                  <p className="text-white/60">Create .cursor/mcp.json in project root:</p>
                  <div className="rounded-lg bg-black/40 p-3 font-mono text-xs">
                    <div className="text-white/60">&#123;</div>
                    <div className="text-white/60">  "mcpServers": &#123;</div>
                    <div className="text-white/60">    "guardrail": &#123;</div>
                    <div className="text-white/60">      "command": "npx",</div>
                    <div className="text-white/60">      "args": ["-y", "@guardrail/mcp-server"]</div>
                    <div className="text-white/60">    &#125;</div>
                    <div className="text-white/60">  &#125;</div>
                    <div className="text-white/60">&#125;</div>
                  </div>
                </div>
              </details>

              <details className="group">
                <summary className="cursor-pointer text-white/80 hover:text-white font-medium">
                  VS Code / Windsurf
                </summary>
                <div className="mt-2 ml-3 space-y-2">
                  <p className="text-white/60">Similar configuration - see documentation</p>
                </div>
              </details>
            </div>

            <h4 className="font-semibold text-white mb-2 mt-3 text-sm">3. Restart Editor</h4>
            <p className="text-xs text-white/60">
              Restart your editor and the AI assistant will have access to guardrail tools!
            </p>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <h4 className="font-semibold text-white mb-2">Available MCP Tools</h4>
            <ul className="space-y-1 text-xs text-white/70">
              <li>• Ship Check - GO/NO-GO deployment validation</li>
              <li>• Reality Mode - Mock data detection</li>
              <li>• Security Scan - OWASP compliance checking</li>
              <li>• Architecture Analysis - Project health scoring</li>
              <li>• Design System Validation - UI consistency checks</li>
            </ul>
          </div>
        </div>

        <Button
          onClick={() => window.open("https://github.com/guardiavault-oss/guardrail", "_blank")}
          className="bg-white text-black hover:bg-white/90 w-full"
        >
          View Full Documentation →
        </Button>
      </div>
    ),
  },
  "API Documentation": {
    title: "API Documentation",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Comprehensive API reference for integrating guardrail into your workflow.
        </p>

        <div className="space-y-3">
          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">REST API Reference</div>
              <div className="text-sm text-white/60">Complete HTTP API documentation</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">GraphQL API</div>
              <div className="text-sm text-white/60">Query your data with GraphQL</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">Webhooks</div>
              <div className="text-sm text-white/60">Real-time event notifications</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">SDK Libraries</div>
              <div className="text-sm text-white/60">Node.js, Python, Go, and more</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>
        </div>

        <div className="rounded-lg bg-black/40 p-4">
          <h4 className="font-semibold text-white mb-2">Quick Example</h4>
          <div className="font-mono text-sm">
            <div className="text-white/60">// Initialize the client</div>
            <div className="text-white">import guardrail from '@guardrail/sdk';</div>
            <div className="text-white mt-2">const client = new guardrail(&#123;</div>
            <div className="text-white">  apiKey: process.env.Guardrail_KEY</div>
            <div className="text-white">&#125;);</div>
            <div className="text-white mt-2">// Run a scan</div>
            <div className="text-white">const result = await client.scan(&#123;</div>
            <div className="text-white">  repo: 'my-repo',</div>
            <div className="text-white">  branch: 'main'</div>
            <div className="text-white">&#125;);</div>
          </div>
        </div>

        <Button
          onClick={() => window.open("https://guardrailai.dev/docs/api", "_blank")}
          className="bg-white text-black hover:bg-white/90 w-full"
        >
          View Full API Docs →
        </Button>
      </div>
    ),
  },
  "Community": {
    title: "Community",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Join thousands of developers building better code with AI.
        </p>

        <div className="space-y-3">
          <a href="https://discord.gg/guardrail" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Discord Community</div>
                <div className="text-sm text-white/60">15K+ active developers</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="https://github.com/guardrail-ai/guardrail" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">GitHub Discussions</div>
                <div className="text-sm text-white/60">Feature requests & support</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="https://twitter.com/Guardrail_ai" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </div>
              <div>
                <div className="text-white font-medium">Twitter/X</div>
                <div className="text-sm text-white/60">Latest updates & tips</div>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>
        </div>

        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <h4 className="font-semibold text-white mb-2">Community Resources</h4>
          <ul className="space-y-2 text-sm text-white/70">
            <li>• Weekly community calls every Thursday at 2pm PT</li>
            <li>• Monthly contributor spotlight and awards</li>
            <li>• Exclusive swag for active contributors</li>
            <li>• Access to beta features and early releases</li>
          </ul>
        </div>
      </div>
    ),
  },
  "Support": {
    title: "Support",
    content: (
      <div className="space-y-4">
        <p className="text-white/70">
          Get help from our team or explore self-service resources.
        </p>

        <div className="space-y-3">
          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">📚 Documentation</div>
              <div className="text-sm text-white/60">Comprehensive guides and tutorials</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">💬 Live Chat</div>
              <div className="text-sm text-white/60">Talk to our team (Enterprise only)</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">📧 Email Support</div>
              <div className="text-sm text-white/60">support@guardrailai.dev</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>

          <a href="#" className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-all group">
            <div>
              <div className="text-white font-medium">🐛 Report a Bug</div>
              <div className="text-sm text-white/60">GitHub Issues tracker</div>
            </div>
            <ExternalLink className="h-4 w-4 text-white/40 group-hover:text-emerald-400 transition-colors" />
          </a>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="font-semibold text-white mb-2">Support Hours</h4>
          <div className="space-y-1 text-sm text-white/70">
            <div className="flex justify-between">
              <span>Community Support:</span>
              <span className="text-white">24/7 via Discord</span>
            </div>
            <div className="flex justify-between">
              <span>Email Support:</span>
              <span className="text-white">Mon-Fri, 9am-6pm PT</span>
            </div>
            <div className="flex justify-between">
              <span>Enterprise Support:</span>
              <span className="text-white">24/7 with SLA</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-black/40 p-4">
          <h4 className="font-semibold text-white mb-2">Status</h4>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            <span className="text-sm text-white/70">All systems operational</span>
          </div>
          <a href="#" className="text-sm text-emerald-400 hover:text-emerald-300 mt-2 inline-block">
            View status page →
          </a>
        </div>
      </div>
    ),
  },
  "Privacy Policy": {
    title: "Privacy Policy",
    content: (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-sm text-white/60">Last updated: January 1, 2026</p>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold text-white mb-2">1. Introduction</h3>
            <p className="text-white/70 leading-relaxed">
              guardrail, Inc. ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">2. Information We Collect</h3>
            <p className="text-white/70 leading-relaxed mb-2">We collect information that you provide directly to us, including:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Account information (name, email, company)</li>
              <li>• Payment information (processed securely via Stripe)</li>
              <li>• Repository metadata and code analysis results</li>
              <li>• Usage data and analytics</li>
              <li>• Communications with our support team</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">3. How We Use Your Information</h3>
            <p className="text-white/70 leading-relaxed mb-2">We use your information to:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Provide, maintain, and improve our services</li>
              <li>• Process transactions and send related information</li>
              <li>• Send technical notices and support messages</li>
              <li>• Respond to your comments and questions</li>
              <li>• Detect, prevent, and address fraud and abuse</li>
              <li>• Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">4. Data Security</h3>
            <p className="text-white/70 leading-relaxed">
              We implement industry-standard security measures to protect your information. Your code is analyzed locally or in isolated environments and never shared with third parties. All data transmission is encrypted using TLS 1.3. We maintain SOC 2 Type II compliance.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">5. Data Retention</h3>
            <p className="text-white/70 leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide services. You may request deletion of your data at any time by contacting privacy@guardrailai.dev. We will delete your data within 30 days, except where required by law.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">6. Third-Party Services</h3>
            <p className="text-white/70 leading-relaxed mb-2">We use the following third-party services:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Stripe for payment processing</li>
              <li>• GitHub/GitLab for repository integration</li>
              <li>• Sentry for error tracking</li>
              <li>• PostHog for analytics</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">7. Your Rights</h3>
            <p className="text-white/70 leading-relaxed mb-2">You have the right to:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Access your personal data</li>
              <li>• Correct inaccurate data</li>
              <li>• Request deletion of your data</li>
              <li>• Export your data</li>
              <li>• Opt-out of marketing communications</li>
              <li>• Object to processing of your data</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">8. GDPR Compliance</h3>
            <p className="text-white/70 leading-relaxed">
              For users in the European Economic Area (EEA), we comply with GDPR. We process data based on legitimate interests, contract performance, or consent. You have additional rights under GDPR including data portability and the right to lodge a complaint with a supervisory authority.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">9. CCPA Compliance</h3>
            <p className="text-white/70 leading-relaxed">
              For California residents, we comply with the California Consumer Privacy Act (CCPA). We do not sell your personal information. You have the right to know what information we collect, request deletion, and opt-out of any sale.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">10. Children's Privacy</h3>
            <p className="text-white/70 leading-relaxed">
              Our service is not intended for children under 13. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, please contact us immediately.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">11. Changes to This Policy</h3>
            <p className="text-white/70 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date. Continued use of our service constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">12. Contact Us</h3>
            <p className="text-white/70 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-2 text-white/60">
              <div>Email: privacy@guardrailai.dev</div>
              <div>Address: guardrail, Inc., 123 Developer St, San Francisco, CA 94105</div>
            </div>
          </section>
        </div>
      </div>
    ),
  },
  "Terms of Service": {
    title: "Terms of Service",
    content: (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-sm text-white/60">Last updated: January 1, 2026</p>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold text-white mb-2">1. Acceptance of Terms</h3>
            <p className="text-white/70 leading-relaxed">
              By accessing or using guardrail's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, you may not use our services. We reserve the right to modify these terms at any time.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">2. Description of Service</h3>
            <p className="text-white/70 leading-relaxed">
              guardrail provides AI-powered code analysis, security scanning, and development guardrails. We offer various subscription tiers with different features and usage limits. Service availability and features may vary by plan.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">3. User Accounts</h3>
            <p className="text-white/70 leading-relaxed mb-2">You are responsible for:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Maintaining the confidentiality of your account credentials</li>
              <li>• All activities that occur under your account</li>
              <li>• Notifying us immediately of any unauthorized access</li>
              <li>• Providing accurate and complete registration information</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-2">
              You must be at least 18 years old to create an account. One person or legal entity may not maintain more than one free account.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">4. Acceptable Use</h3>
            <p className="text-white/70 leading-relaxed mb-2">You agree not to:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• Violate any laws or regulations</li>
              <li>• Infringe on intellectual property rights</li>
              <li>• Upload malicious code or viruses</li>
              <li>• Attempt to gain unauthorized access to our systems</li>
              <li>• Use the service to harass, abuse, or harm others</li>
              <li>• Reverse engineer or decompile our software</li>
              <li>• Resell or redistribute our services without permission</li>
              <li>• Use automated systems to access the service excessively</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">5. Intellectual Property</h3>
            <p className="text-white/70 leading-relaxed">
              You retain all rights to your code and data. By using our service, you grant us a limited license to process your code for the purpose of providing our services. We retain all rights to our software, algorithms, and service infrastructure.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">6. Payment Terms</h3>
            <p className="text-white/70 leading-relaxed">
              Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by law. We reserve the right to change our pricing with 30 days notice. Failure to pay may result in service suspension or termination.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">7. Service Level Agreement</h3>
            <p className="text-white/70 leading-relaxed">
              We strive for 99.9% uptime for paid plans. Enterprise customers receive dedicated SLA terms. We are not liable for downtime due to circumstances beyond our reasonable control, including force majeure events.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">8. Data and Privacy</h3>
            <p className="text-white/70 leading-relaxed">
              Your use of our service is also governed by our Privacy Policy. We implement industry-standard security measures but cannot guarantee absolute security. You are responsible for backing up your data.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">9. Termination</h3>
            <p className="text-white/70 leading-relaxed">
              You may cancel your account at any time. We may suspend or terminate your account for violations of these terms, non-payment, or illegal activity. Upon termination, your right to use the service immediately ceases. We will provide data export options for 30 days post-termination.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">10. Disclaimers</h3>
            <p className="text-white/70 leading-relaxed">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE. YOU USE THE SERVICE AT YOUR OWN RISK.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">11. Limitation of Liability</h3>
            <p className="text-white/70 leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, guardrail SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE PAST 12 MONTHS.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">12. Indemnification</h3>
            <p className="text-white/70 leading-relaxed">
              You agree to indemnify and hold guardrail harmless from any claims, damages, or expenses arising from your use of the service, your violation of these terms, or your violation of any rights of another party.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">13. Dispute Resolution</h3>
            <p className="text-white/70 leading-relaxed">
              These terms are governed by the laws of the State of California. Any disputes will be resolved through binding arbitration in San Francisco, California, except for injunctive relief which may be sought in court.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">14. Changes to Terms</h3>
            <p className="text-white/70 leading-relaxed">
              We may modify these terms at any time. Material changes will be notified via email or through the service. Continued use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">15. Contact</h3>
            <p className="text-white/70 leading-relaxed">
              Questions about these terms? Contact us at legal@guardrailai.dev or guardrail, Inc., 123 Developer St, San Francisco, CA 94105.
            </p>
          </section>
        </div>
      </div>
    ),
  },
  "Cookie Policy": {
    title: "Cookie Policy",
    content: (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto">
        <p className="text-sm text-white/60">Last updated: January 1, 2026</p>

        <div className="space-y-4 text-sm">
          <section>
            <h3 className="font-semibold text-white mb-2">1. What Are Cookies?</h3>
            <p className="text-white/70 leading-relaxed">
              Cookies are small text files that are stored on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our service.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">2. Types of Cookies We Use</h3>

            <div className="space-y-3 mt-2">
              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <h4 className="text-white font-medium mb-1">Essential Cookies (Required)</h4>
                <p className="text-white/60">
                  These cookies are necessary for the website to function properly. They enable core functionality such as security, authentication, and session management.
                </p>
                <div className="mt-2 text-xs text-white/50">
                  Examples: session tokens, authentication cookies, security cookies
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <h4 className="text-white font-medium mb-1">Analytics Cookies (Optional)</h4>
                <p className="text-white/60">
                  These cookies help us understand how visitors interact with our website by collecting and reporting information anonymously. We use PostHog for analytics.
                </p>
                <div className="mt-2 text-xs text-white/50">
                  Examples: page views, session duration, feature usage
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <h4 className="text-white font-medium mb-1">Preference Cookies (Optional)</h4>
                <p className="text-white/60">
                  These cookies remember your preferences and choices to provide a more personalized experience.
                </p>
                <div className="mt-2 text-xs text-white/50">
                  Examples: language preference, theme selection, UI settings
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <h4 className="text-white font-medium mb-1">Marketing Cookies (Optional)</h4>
                <p className="text-white/60">
                  These cookies track your online activity to help advertisers deliver more relevant advertising or limit how many times you see an ad.
                </p>
                <div className="mt-2 text-xs text-white/50">
                  Examples: third-party advertising cookies, conversion tracking
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">3. Third-Party Cookies</h3>
            <p className="text-white/70 leading-relaxed mb-2">We use the following third-party services that may set cookies:</p>
            <ul className="space-y-1 text-white/60 ml-4">
              <li>• <span className="text-white">PostHog</span> - Product analytics and feature flags</li>
              <li>• <span className="text-white">Stripe</span> - Payment processing</li>
              <li>• <span className="text-white">GitHub/GitLab</span> - Authentication and integration</li>
              <li>• <span className="text-white">Sentry</span> - Error tracking and monitoring</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">4. How to Control Cookies</h3>
            <p className="text-white/70 leading-relaxed mb-2">
              You have several options to manage cookies:
            </p>

            <div className="space-y-2 text-white/60 ml-4">
              <div>
                <span className="text-white font-medium">Browser Settings:</span> Most browsers allow you to refuse or delete cookies through their settings. Note that disabling cookies may affect functionality.
              </div>
              <div>
                <span className="text-white font-medium">Cookie Preferences:</span> You can manage your cookie preferences through our cookie banner or settings panel.
              </div>
              <div>
                <span className="text-white font-medium">Opt-Out Tools:</span> Use browser extensions or industry opt-out tools to manage tracking cookies.
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">5. Cookie Duration</h3>
            <p className="text-white/70 leading-relaxed">
              Cookies may be "session" cookies (deleted when you close your browser) or "persistent" cookies (remain on your device for a set period or until you delete them).
            </p>
            <div className="mt-2 space-y-1 text-white/60">
              <div>• Session cookies: Deleted when browser closes</div>
              <div>• Persistent cookies: 30 days to 2 years, depending on purpose</div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">6. Do Not Track</h3>
            <p className="text-white/70 leading-relaxed">
              Some browsers include a "Do Not Track" (DNT) feature that signals websites you visit that you do not want your online activity tracked. We respect DNT signals and will not track users who have DNT enabled.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">7. Cookie Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-white/10">
                <thead className="bg-white/5">
                  <tr>
                    <th className="p-2 text-left text-white border-b border-white/10">Cookie Name</th>
                    <th className="p-2 text-left text-white border-b border-white/10">Purpose</th>
                    <th className="p-2 text-left text-white border-b border-white/10">Duration</th>
                  </tr>
                </thead>
                <tbody className="text-white/60">
                  <tr className="border-b border-white/10">
                    <td className="p-2">session_token</td>
                    <td className="p-2">Authentication</td>
                    <td className="p-2">Session</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">csrf_token</td>
                    <td className="p-2">Security</td>
                    <td className="p-2">Session</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">theme_preference</td>
                    <td className="p-2">UI Preference</td>
                    <td className="p-2">1 year</td>
                  </tr>
                  <tr className="border-b border-white/10">
                    <td className="p-2">analytics_id</td>
                    <td className="p-2">Analytics</td>
                    <td className="p-2">2 years</td>
                  </tr>
                  <tr>
                    <td className="p-2">cookie_consent</td>
                    <td className="p-2">Cookie Preferences</td>
                    <td className="p-2">1 year</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">8. Updates to This Policy</h3>
            <p className="text-white/70 leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in our practices or legal requirements. The "Last updated" date at the top indicates when this policy was last revised.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">9. Contact Us</h3>
            <p className="text-white/70 leading-relaxed">
              If you have questions about our use of cookies, please contact us at:
            </p>
            <div className="mt-2 text-white/60">
              <div>Email: privacy@guardrailai.dev</div>
              <div>Address: guardrail, Inc., 123 Developer St, San Francisco, CA 94105</div>
            </div>
          </section>
        </div>

        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <h4 className="font-semibold text-white mb-2">Manage Cookie Preferences</h4>
          <p className="text-sm text-white/70 mb-3">
            You can update your cookie preferences at any time through your account settings.
          </p>
          <Button className="bg-white text-black hover:bg-white/90 w-full">
            Cookie Settings →
          </Button>
        </div>
      </div>
    ),
  },
};
