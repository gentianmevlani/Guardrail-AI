"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Terminal, Copy, CheckCircle, Download, Code, BookOpen, Zap, Package } from "lucide-react";
import { motion } from "motion/react";

export function CLIPage() {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const installCommands = [
    {
      id: "npm",
      title: "npm",
      command: "npm install -g @guardrail/cli",
      description: "Install via npm package manager",
    },
    {
      id: "yarn",
      title: "Yarn",
      command: "yarn global add @guardrail/cli",
      description: "Install via Yarn package manager",
    },
    {
      id: "brew",
      title: "Homebrew",
      command: "brew install guardrail",
      description: "Install via Homebrew (macOS/Linux)",
    },
    {
      id: "curl",
      title: "Direct Install",
      command: "curl -fsSL https://get.guardrailai.dev | sh",
      description: "Direct installation script",
    },
  ];

  const quickStartCommands = [
    {
      title: "Authenticate",
      command: "guardrail auth login",
      description: "Login to your guardrail account",
    },
    {
      title: "Initialize Project",
      command: "guardrail init",
      description: "Initialize guardrail in your project",
    },
    {
      title: "Run Security Scan",
      command: "guardrail scan --type security",
      description: "Run a security vulnerability scan",
    },
    {
      title: "Ship Check",
      command: "guardrail ship",
      description: "Run pre-deployment checks",
    },
  ];

  const commands = [
    {
      category: "Authentication",
      items: [
        { cmd: "guardrail auth login", desc: "Login to your account" },
        { cmd: "guardrail auth logout", desc: "Logout from your account" },
        { cmd: "guardrail auth whoami", desc: "Display current user" },
      ],
    },
    {
      category: "Scanning",
      items: [
        { cmd: "guardrail scan", desc: "Run a full scan" },
        { cmd: "guardrail scan --type security", desc: "Security scan only" },
        { cmd: "guardrail scan --type quality", desc: "Code quality scan" },
        { cmd: "guardrail scan --ci", desc: "CI-optimized scan" },
        { cmd: "guardrail scan --watch", desc: "Watch mode for continuous scanning" },
      ],
    },
    {
      category: "Ship Check",
      items: [
        { cmd: "guardrail ship", desc: "Run pre-deployment checks" },
        { cmd: "guardrail ship --strict", desc: "Fail on any issues" },
        { cmd: "guardrail ship --fix", desc: "Auto-fix issues where possible" },
      ],
    },
    {
      category: "Reports",
      items: [
        { cmd: "guardrail report", desc: "Generate a report" },
        { cmd: "guardrail report --format pdf", desc: "Generate PDF report" },
        { cmd: "guardrail report --format json", desc: "Generate JSON report" },
      ],
    },
    {
      category: "Configuration",
      items: [
        { cmd: "guardrail init", desc: "Initialize configuration" },
        { cmd: "guardrail config list", desc: "List configuration" },
        { cmd: "guardrail config set <key> <value>", desc: "Set configuration value" },
      ],
    },
    {
      category: "CI/CD Integration",
      items: [
        { cmd: "guardrail ci setup", desc: "Setup CI/CD integration" },
        { cmd: "guardrail ci github-action", desc: "Generate GitHub Action config" },
        { cmd: "guardrail ci gitlab", desc: "Generate GitLab CI config" },
      ],
    },
  ];

  const integrationExamples = [
    {
      title: "GitHub Actions",
      language: "yaml",
      code: `name: guardrail Security Scan
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: guardrail/scan-action@v1
        with:
          api-key: \${{ secrets.GUARDRAIL_API_KEY }}`,
    },
    {
      title: "GitLab CI",
      language: "yaml",
      code: `guardrail-scan:
  image: guardrail/cli:latest
  script:
    - guardrail auth login --token $GUARDRAIL_TOKEN
    - guardrail scan --ci
  only:
    - merge_requests`,
    },
    {
      title: "package.json Scripts",
      language: "json",
      code: `{
  "scripts": {
    "security": "guardrail scan --type security",
    "prescan": "guardrail auth whoami",
    "scan": "guardrail scan",
    "ship": "guardrail ship"
  }
}`,
    },
  ];

  const stats = [
    { 
      label: "Version", 
      value: "2.4.1", 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Package
    },
    { 
      label: "Commands", 
      value: "47", 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: Terminal
    },
    { 
      label: "Weekly Downloads", 
      value: "12.5K", 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: Download
    },
    { 
      label: "Integrations", 
      value: "8", 
      color: "text-cyan-400",
      bg: "from-cyan-500/20 to-blue-500/20",
      icon: Zap
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Terminal className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                CLI Tool
              </h1>
              <p className="text-zinc-400">Command-line interface for security scanning</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <BookOpen className="w-4 h-4 mr-2" />
              Documentation
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.05 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400">{stat.label}</p>
                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.bg}`}>
                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Installation */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-cyan-400" />
              Installation
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Choose your preferred installation method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {installCommands.map((install) => (
                <div
                  key={install.id}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className="text-xs border-cyan-500/50 text-cyan-400">
                      {install.title}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(install.command, install.id)}
                      className="h-7"
                    >
                      {copiedCommand === install.id ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <code className="block text-sm text-cyan-400 font-mono mb-2">
                    {install.command}
                  </code>
                  <p className="text-xs text-zinc-500">{install.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Start */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Quick Start
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Get started with these essential commands
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {quickStartCommands.map((cmd, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-400">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white mb-1">{cmd.title}</p>
                      <code className="text-xs text-cyan-400 font-mono">{cmd.command}</code>
                      <p className="text-xs text-zinc-500 mt-1">{cmd.description}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(cmd.command, `quick-${index}`)}
                  >
                    {copiedCommand === `quick-${index}` ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Command Reference */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-purple-400" />
              Command Reference
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Complete list of available commands
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {commands.map((category, catIndex) => (
                <div key={catIndex}>
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-blue-400" />
                    {category.category}
                  </h3>
                  <div className="space-y-2">
                    {category.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors group"
                      >
                        <div className="flex-1">
                          <code className="text-sm text-cyan-400 font-mono">{item.cmd}</code>
                          <p className="text-xs text-zinc-500 mt-1">{item.desc}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(item.cmd, `cmd-${catIndex}-${itemIndex}`)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          {copiedCommand === `cmd-${catIndex}-${itemIndex}` ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* CI/CD Integration Examples */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-400" />
              CI/CD Integration
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Example configurations for popular CI/CD platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {integrationExamples.map((example, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-white">{example.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                        {example.language}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(example.code, `example-${index}`)}
                      >
                        {copiedCommand === `example-${index}` ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <pre className="p-4 rounded-lg bg-black border border-zinc-800 overflow-x-auto">
                    <code className="text-sm text-cyan-400 font-mono">{example.code}</code>
                  </pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
