"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Cpu, Download, CheckCircle, Code, Zap, ArrowRight, Play, Settings, BookOpen } from "lucide-react";
import { motion } from "motion/react";

export function MCPPage() {
  const [installedTools, setInstalledTools] = useState<string[]>(["security-scan", "code-analysis"]);

  const features = [
    {
      title: "Real-time Scanning",
      description: "Scan your code as you write with instant feedback",
      icon: Zap,
      color: "from-yellow-500 to-orange-500",
    },
    {
      title: "IDE Integration",
      description: "Works seamlessly with VS Code, Cursor, and more",
      icon: Code,
      color: "from-blue-500 to-cyan-500",
    },
    {
      title: "AI-Powered Fixes",
      description: "Get intelligent suggestions to fix security issues",
      icon: Cpu,
      color: "from-purple-500 to-pink-500",
    },
    {
      title: "Custom Rules",
      description: "Define your own security rules and policies",
      icon: Settings,
      color: "from-green-500 to-emerald-500",
    },
  ];

  const mcpTools = [
    {
      id: "security-scan",
      name: "Security Scanner",
      description: "Real-time vulnerability detection in your code",
      category: "Security",
      version: "1.2.0",
      downloads: "2.4K",
      installed: true,
      commands: ["scan", "fix", "explain"],
    },
    {
      id: "code-analysis",
      name: "Code Quality Analyzer",
      description: "Analyze code quality and maintainability",
      category: "Quality",
      version: "1.1.5",
      downloads: "1.8K",
      installed: true,
      commands: ["analyze", "refactor", "optimize"],
    },
    {
      id: "dependency-check",
      name: "Dependency Checker",
      description: "Check for vulnerable dependencies",
      category: "Security",
      version: "1.0.8",
      downloads: "1.5K",
      installed: false,
      commands: ["check", "update", "audit"],
    },
    {
      id: "compliance",
      name: "Compliance Validator",
      description: "Validate code against compliance standards",
      category: "Compliance",
      version: "0.9.3",
      downloads: "892",
      installed: false,
      commands: ["validate", "report", "certify"],
    },
    {
      id: "ai-assistant",
      name: "AI Security Assistant",
      description: "AI-powered security recommendations",
      category: "AI",
      version: "2.0.1",
      downloads: "3.1K",
      installed: false,
      commands: ["ask", "explain", "suggest"],
    },
    {
      id: "git-hooks",
      name: "Git Hooks Manager",
      description: "Automated security checks in git workflows",
      category: "DevOps",
      version: "1.3.2",
      downloads: "1.2K",
      installed: false,
      commands: ["setup", "enable", "disable"],
    },
  ];

  const installationSteps = [
    {
      title: "Install MCP Server",
      command: "npm install -g @guardrail/mcp-server",
      description: "Install the guardrail MCP server globally",
    },
    {
      title: "Configure Your IDE",
      command: "guardrail mcp init",
      description: "Initialize MCP configuration for your IDE",
    },
    {
      title: "Install Tools",
      command: "guardrail mcp install <tool-name>",
      description: "Install specific MCP tools",
    },
    {
      title: "Start Server",
      command: "guardrail mcp start",
      description: "Start the MCP server",
    },
  ];

  const supportedIDEs = [
    { name: "VS Code", status: "Fully Supported", icon: "💙" },
    { name: "Cursor", status: "Fully Supported", icon: "✨" },
    { name: "Windsurf", status: "Fully Supported", icon: "🌊" },
    { name: "Zed", status: "Beta", icon: "⚡" },
    { name: "JetBrains IDEs", status: "Coming Soon", icon: "🚀" },
  ];

  const getCategoryColor = (category: string) => {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      Security: { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
      Quality: { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
      Compliance: { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
      AI: { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
      DevOps: { text: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/30" },
    };
    return colors[category] || { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30" };
  };

  const stats = [
    { 
      label: "Available Tools", 
      value: mcpTools.length.toString(), 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: Cpu
    },
    { 
      label: "Installed", 
      value: installedTools.length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
    },
    { 
      label: "Total Downloads", 
      value: "11.8K", 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Download
    },
    { 
      label: "Supported IDEs", 
      value: supportedIDEs.length.toString(), 
      color: "text-cyan-400",
      bg: "from-cyan-500/20 to-blue-500/20",
      icon: Code
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
              <Cpu className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                MCP Plugin
              </h1>
              <p className="text-zinc-400">Model Context Protocol integration for AI-powered development</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <BookOpen className="w-4 h-4 mr-2" />
              Documentation
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Download className="w-4 h-4 mr-2" />
              Install
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

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Key Features</CardTitle>
            <CardDescription className="text-zinc-400">
              Powerful capabilities for AI-assisted development
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-blue-500/30 hover:bg-zinc-800 transition-all"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.color} bg-opacity-20 flex items-center justify-center mb-3`}>
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-medium text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-zinc-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Installation Guide */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Download className="w-5 h-5 text-blue-400" />
              Quick Setup
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Get started in 4 simple steps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {installationSteps.map((step, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-blue-400">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white mb-2">{step.title}</h4>
                    <code className="block text-sm text-cyan-400 font-mono mb-2 p-2 rounded bg-black border border-zinc-800">
                      {step.command}
                    </code>
                    <p className="text-xs text-zinc-500">{step.description}</p>
                  </div>
                  {index < installationSteps.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-zinc-600" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Available Tools */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Available MCP Tools</CardTitle>
            <CardDescription className="text-zinc-400">
              Extend your AI assistant with powerful security tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {mcpTools.map((tool, index) => {
                const categoryColor = getCategoryColor(tool.category);
                const isInstalled = installedTools.includes(tool.id);
                
                return (
                  <motion.div
                    key={tool.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 + index * 0.05 }}
                  >
                    <Card className="border-zinc-800 bg-zinc-800/50 hover:border-zinc-700 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-white">{tool.name}</h3>
                              {isInstalled && (
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={`text-xs ${categoryColor.bg} ${categoryColor.text} ${categoryColor.border}`}>
                                {tool.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                                v{tool.version}
                              </Badge>
                            </div>
                            <p className="text-sm text-zinc-400 mb-3">{tool.description}</p>
                            
                            {/* Commands */}
                            <div className="mb-3">
                              <p className="text-xs text-zinc-500 mb-1.5">Commands:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {tool.commands.map((cmd) => (
                                  <code key={cmd} className="text-xs px-2 py-0.5 rounded bg-zinc-900 text-cyan-400 font-mono">
                                    {cmd}
                                  </code>
                                ))}
                              </div>
                            </div>

                            <p className="text-xs text-zinc-500">{tool.downloads} downloads</p>
                          </div>
                        </div>
                        
                        <Button 
                          variant={isInstalled ? "outline" : "default"}
                          size="sm" 
                          className={isInstalled 
                            ? "w-full border-zinc-700 text-zinc-400"
                            : "w-full bg-blue-600 hover:bg-blue-500 text-white"
                          }
                          onClick={() => {
                            if (!isInstalled) {
                              setInstalledTools([...installedTools, tool.id]);
                            }
                          }}
                        >
                          {isInstalled ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Installed
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" />
                              Install
                            </>
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Supported IDEs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Code className="w-5 h-5 text-green-400" />
              Supported IDEs
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Works with your favorite development environment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {supportedIDEs.map((ide, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ide.icon}</span>
                    <span className="text-sm font-medium text-white">{ide.name}</span>
                  </div>
                  <Badge 
                    className={
                      ide.status === "Fully Supported" 
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : ide.status === "Beta"
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                        : "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    }
                  >
                    {ide.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
