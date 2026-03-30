"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchMCPStatus } from "@/lib/api";
import { logger } from "@/lib/logger";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bug,
  Check,
  CheckCircle,
  ChevronRight,
  Code,
  Copy,
  Cpu,
  ExternalLink,
  FileSearch,
  Key,
  Plug,
  RefreshCw,
  Settings,
  Shield,
  Sparkles,
  Terminal,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// Force dynamic rendering
export const dynamic = "force-dynamic";

// MCP Server Status Type
interface MCPStatus {
  connected: boolean;
  version: string;
  tools: number;
  lastPing: string | null;
  uptime: string;
}

// Tool Category Type
interface ToolCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  tools: MCPTool[];
}

interface MCPTool {
  name: string;
  description: string;
  tier: "free" | "pro";
  category: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
  }[];
  example?: string;
}

// Comprehensive MCP Tools organized by category
const MCP_TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "scanning",
    name: "Code Scanning",
    icon: <FileSearch className="h-5 w-5" />,
    description: "Analyze code for security issues and vulnerabilities",
    tools: [
      {
        name: "guardrail.ship",
        description:
          "Quick health check — 'Is my app ready?' Plain English, traffic light score",
        tier: "free",
        category: "scanning",
        parameters: [
          {
            name: "projectPath",
            type: "string",
            required: false,
            description: "Path to project root",
          },
          {
            name: "fix",
            type: "boolean",
            required: false,
            description: "Auto-fix problems where possible",
          },
        ],
        example: '"Run a ship check on this project"',
      },
      {
        name: "guardrail.scan",
        description:
          "Deep scan — technical analysis of secrets, auth, mocks, routes",
        tier: "free",
        category: "scanning",
        parameters: [
          {
            name: "projectPath",
            type: "string",
            required: false,
            description: "Path to project root",
          },
          {
            name: "profile",
            type: "string",
            required: false,
            description: "Check profile: quick, full, ship, ci, security",
          },
          {
            name: "format",
            type: "string",
            required: false,
            description: "Output format: text, json, html, sarif",
          },
        ],
        example: '"Scan this project for security issues"',
      },
      {
        name: "guardrail.gate",
        description: "Enforce truth in CI — fail builds on policy violations",
        tier: "free",
        category: "scanning",
        parameters: [
          {
            name: "policy",
            type: "string",
            required: false,
            description: "Policy: default, strict, ci",
          },
          {
            name: "sarif",
            type: "boolean",
            required: false,
            description: "Generate SARIF for GitHub",
          },
        ],
        example: '"Run gate check with strict policy"',
      },
    ],
  },
  {
    id: "testing",
    name: "Testing & Verification",
    icon: <Bug className="h-5 w-5" />,
    description: "Browser testing and runtime verification",
    tools: [
      {
        name: "guardrail.reality",
        description:
          "Browser testing — clicks buttons, fills forms, finds broken UI with Playwright",
        tier: "free",
        category: "testing",
        parameters: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "Target URL to test",
          },
          {
            name: "auth",
            type: "string",
            required: false,
            description: "Auth credentials (email:password)",
          },
          {
            name: "flows",
            type: "array",
            required: false,
            description: "Flow packs: auth, ui, forms, ecommerce",
          },
          {
            name: "headed",
            type: "boolean",
            required: false,
            description: "Run browser in visible mode",
          },
        ],
        example: '"Test my app at localhost:3000 with auth flow"',
      },
      {
        name: "guardrail.dev-test",
        description:
          "AI Agent — autonomous testing that explores your app and generates fix prompts",
        tier: "pro",
        category: "testing",
        parameters: [
          {
            name: "url",
            type: "string",
            required: true,
            description: "Target URL to test",
          },
          {
            name: "goal",
            type: "string",
            required: false,
            description: "Natural language goal for the AI agent",
          },
          {
            name: "headed",
            type: "boolean",
            required: false,
            description: "Run browser in visible mode",
          },
        ],
        example: '"Run AI agent to test all features"',
      },
      {
        name: "guardrail.proof",
        description:
          "Premium verification — mocks (static) or reality (runtime with Playwright)",
        tier: "pro",
        category: "testing",
        parameters: [
          {
            name: "mode",
            type: "string",
            required: true,
            description: "Proof mode: mocks or reality",
          },
          {
            name: "url",
            type: "string",
            required: false,
            description: "Base URL for reality mode",
          },
          {
            name: "flow",
            type: "string",
            required: false,
            description: "Flow to test: auth, checkout, dashboard",
          },
        ],
        example: '"Run mockproof scan on this project"',
      },
    ],
  },
  {
    id: "fixing",
    name: "Auto-Fix & Remediation",
    icon: <Wrench className="h-5 w-5" />,
    description: "Automatically fix detected issues",
    tools: [
      {
        name: "guardrail.fix",
        description: "Apply safe patches — preview plan then apply fixes",
        tier: "free",
        category: "fixing",
        parameters: [
          {
            name: "plan",
            type: "boolean",
            required: false,
            description: "Show fix plan without applying (dry run)",
          },
          {
            name: "apply",
            type: "boolean",
            required: false,
            description: "Apply fixes from plan",
          },
          {
            name: "scope",
            type: "string",
            required: false,
            description: "Fix scope: all, secrets, auth, mocks, routes",
          },
          {
            name: "risk",
            type: "string",
            required: false,
            description: "Risk tolerance: safe, moderate, aggressive",
          },
        ],
        example: '"Show me a fix plan for this project"',
      },
      {
        name: "guardrail.validate",
        description:
          "Validate AI-generated code for hallucinations, intent mismatch, and quality issues",
        tier: "pro",
        category: "fixing",
        parameters: [
          {
            name: "code",
            type: "string",
            required: true,
            description: "The code content to validate",
          },
          {
            name: "intent",
            type: "string",
            required: false,
            description: "The user's original request/intent",
          },
        ],
        example: '"Validate this code against my intent"',
      },
    ],
  },
  {
    id: "reporting",
    name: "Reports & Artifacts",
    icon: <BarChart3 className="h-5 w-5" />,
    description: "Generate reports, badges, and documentation",
    tools: [
      {
        name: "guardrail.report",
        description:
          "Access scan artifacts — summary, full report, SARIF export",
        tier: "free",
        category: "reporting",
        parameters: [
          {
            name: "type",
            type: "string",
            required: false,
            description: "Report type: summary, full, sarif, html",
          },
          {
            name: "runId",
            type: "string",
            required: false,
            description: "Specific run ID (defaults to last run)",
          },
        ],
        example: '"Show me the last scan report"',
      },
      {
        name: "guardrail.badge",
        description:
          "Ship Badge — generate a badge for README/PR showing scan status",
        tier: "free",
        category: "reporting",
        parameters: [
          {
            name: "format",
            type: "string",
            required: false,
            description: "Badge format: svg, md, html",
          },
          {
            name: "style",
            type: "string",
            required: false,
            description: "Badge style: flat, flat-square",
          },
        ],
        example: '"Generate a ship badge for my README"',
      },
      {
        name: "guardrail.status",
        description: "Server status — health, versions, config, last run info",
        tier: "free",
        category: "reporting",
        parameters: [],
        example: '"What is my project status?"',
      },
    ],
  },
  {
    id: "automation",
    name: "Automation & CI/CD",
    icon: <Workflow className="h-5 w-5" />,
    description: "Continuous protection and automation",
    tools: [
      {
        name: "guardrail.autopilot",
        description:
          "Autopilot — continuous protection with weekly reports, auto-PRs, deploy blocking",
        tier: "pro",
        category: "automation",
        parameters: [
          {
            name: "action",
            type: "string",
            required: false,
            description: "Action: status, enable, disable, digest",
          },
          {
            name: "slack",
            type: "string",
            required: false,
            description: "Slack webhook URL for notifications",
          },
          {
            name: "email",
            type: "string",
            required: false,
            description: "Email for weekly digest",
          },
        ],
        example: '"Enable autopilot with Slack notifications"',
      },
      {
        name: "guardrail.context",
        description:
          "AI Context — generate rules files for Cursor, Windsurf, Copilot to understand your codebase",
        tier: "free",
        category: "automation",
        parameters: [
          {
            name: "platform",
            type: "string",
            required: false,
            description: "Target: all, cursor, windsurf, copilot, claude",
          },
        ],
        example: '"Generate AI context rules for Cursor"',
      },
    ],
  },
];

const MCP_FEATURES = [
  {
    tier: "free",
    features: [
      {
        name: "Severity summaries",
        description: "Counts by severity; detailed findings require Starter+",
      },
      {
        name: "Basic secret detection",
        description: "Flags hardcoded keys without exposing full context on Free",
      },
      {
        name: "CLI & IDE entry points",
        description: "Run scans from the terminal or your editor",
      },
    ],
  },
  {
    tier: "starter",
    features: [
      {
        name: "Full issue detail",
        description: "Paths, rules, messages, and snippets in MCP responses",
      },
      {
        name: "Reality & ship",
        description: "MockProof gates and supply-chain checks",
      },
      {
        name: "No auto-fix",
        description: "Review and fix manually — auto-fix unlocks on Pro+",
      },
    ],
  },
  {
    tier: "pro",
    features: [
      {
        name: "AI-powered auto-fix",
        description: "One-click remediation for supported issues",
      },
      {
        name: "Context-aware scanning",
        description: "Understands your entire codebase context",
      },
      {
        name: "Agent & MCP automation",
        description: "Autopilot and MCP tools for deeper workflows",
      },
    ],
  },
  {
    tier: "compliance",
    features: [
      {
        name: "Framework mappings",
        description: "SOC2, HIPAA, GDPR, PCI, NIST, ISO 27001",
      },
      {
        name: "Audit-ready exports",
        description: "PDF reports and deploy hooks for evidence",
      },
      {
        name: "Team seats & projects",
        description: "Higher limits for org-wide rollout",
      },
    ],
  },
];

const IDE_INTEGRATIONS = [
  {
    id: "cursor",
    name: "Cursor",
    description: "AI-first code editor with native MCP support",
    logo: "/logos/cursor.png",
    color: "from-purple-500 to-indigo-500",
    configPath: "~/.cursor/mcp.json",
    status: "recommended",
    steps: [
      "Open Cursor Settings (Cmd/Ctrl + ,)",
      "Navigate to MCP section or open ~/.cursor/mcp.json",
      "Add the guardrail MCP server configuration",
      "Restart Cursor to apply changes",
    ],
  },
  {
    id: "windsurf",
    name: "Windsurf",
    description: "Codeium's AI-powered IDE with MCP integration",
    logo: "/logos/windsurf.png",
    color: "from-cyan-500 to-blue-500",
    configPath: "~/.windsurf/mcp_config.json",
    status: "recommended",
    steps: [
      "Open Windsurf Settings",
      "Go to Extensions > MCP Configuration",
      "Add the guardrail MCP server configuration",
      "Restart Windsurf to apply changes",
    ],
  },
  {
    id: "vscode",
    name: "VS Code",
    description: "Microsoft's popular code editor with extension support",
    logo: "/logos/vscode.png",
    color: "from-blue-500 to-blue-600",
    configPath: "~/.vscode/mcp-servers.json",
    status: "available",
    steps: [
      "Install the MCP extension from VS Code marketplace",
      "Open Command Palette (Cmd/Ctrl + Shift + P)",
      "Run 'MCP: Configure Servers'",
      "Add the guardrail configuration and reload",
    ],
  },
];

const MCP_TOOLS = [
  {
    name: "ship_check",
    description: "GO/NO-GO verdict with report output",
    tier: "free",
  },
  {
    name: "ai_agent_test",
    description: "Autonomous AI testing + fix prompts",
    tier: "pro",
  },
  {
    name: "reality_mode_test",
    description: "Run Reality Mode (Playwright) for a flow",
    tier: "free",
  },
  {
    name: "mockproof_scan",
    description: "Production import graph scan + violations",
    tier: "free",
  },
  {
    name: "block_demo_patterns",
    description: "Find demo-success patterns in code",
    tier: "free",
  },
  {
    name: "launch_checklist",
    description: "Pre-launch verification wizard",
    tier: "free",
  },
  {
    name: "generate_badge",
    description: "Create Ship Badge artifacts",
    tier: "free",
  },
  {
    name: "scan_security",
    description: "Run full security scan on the current file or project",
    tier: "free",
  },
  {
    name: "detect_secrets",
    description: "Scan for hardcoded secrets, API keys, and credentials",
    tier: "free",
  },
  {
    name: "suggest_fix",
    description: "Get AI-powered fix suggestions for security issues",
    tier: "pro",
  },
  {
    name: "check_compliance",
    description: "Validate against SOC2, GDPR, HIPAA, PCI frameworks",
    tier: "pro",
  },
];

const NL_COMMANDS = [
  {
    cmd: "what's my status",
    desc: "Project health check with traffic light score",
  },
  { cmd: "run ai agent", desc: "AI-powered autonomous testing" },
  { cmd: "run reality mode", desc: "Browser testing with Playwright" },
  { cmd: "block demo patterns", desc: "Find demo-success patterns" },
  { cmd: "launch checklist", desc: "Pre-launch verification" },
  { cmd: "enable mockproof gate", desc: "Block mock data in prod" },
  { cmd: "generate ship badge", desc: "Create status badge" },
  { cmd: "fix it", desc: "Auto-fix detected issues" },
];

const MCP_CONFIG_TEMPLATE = `{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["-y", "@guardrail/mcp-server"],
      "env": {
        "GUARDRAIL_API_KEY": "YOUR_API_KEY"
      }
    }
  }
}`;

export default function MCPPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedIDE, setSelectedIDE] = useState<
    (typeof IDE_INTEGRATIONS)[0] | null
  >(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [mcpStatus, setMcpStatus] = useState<MCPStatus>({
    connected: false,
    version: "2.0.0",
    tools: 13,
    lastPing: null,
    uptime: "—",
  });

  // Fetch real MCP status from API
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await fetchMCPStatus();
        if (status) {
          setMcpStatus(status);
        }
      } catch (error) {
        logger.logUnknownError("Failed to fetch MCP status", error);
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const getConfigForIDE = (ideId: string) => {
    const baseConfig = {
      mcpServers: {
        guardrail: {
          command: "npx",
          args: ["-y", "@guardrail/mcp-server"],
          env: {
            GUARDRAIL_API_KEY: "YOUR_API_KEY",
          },
        },
      },
    };
    return JSON.stringify(baseConfig, null, 2);
  };

  const handleConnect = (ide: (typeof IDE_INTEGRATIONS)[0]) => {
    setSelectedIDE(ide);
    setCurrentStep(0);
  };

  const handleCloseModal = () => {
    setSelectedIDE(null);
    setCurrentStep(0);
  };

  const totalTools = MCP_TOOL_CATEGORIES.reduce(
    (acc, cat) => acc + cat.tools.length,
    0,
  );
  const freeTools = MCP_TOOL_CATEGORIES.reduce(
    (acc, cat) => acc + cat.tools.filter((t) => t.tier === "free").length,
    0,
  );
  const proTools = MCP_TOOL_CATEGORIES.reduce(
    (acc, cat) => acc + cat.tools.filter((t) => t.tier === "pro").length,
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <Cpu className="h-8 w-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">MCP Server</h1>
            <p className="text-muted-foreground">
              Model Context Protocol — AI-native security for your IDE.{" "}
              <Link href="/integrations" className="text-teal-400 hover:underline">
                Cross-platform env & CI →
              </Link>
            </p>
          </div>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 border">
            <div
              className={`w-2 h-2 rounded-full ${mcpStatus.connected ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`}
            />
            <span className="text-sm text-muted-foreground">
              {mcpStatus.connected ? "Server Ready" : "Offline"}
            </span>
            <Badge
              variant="outline"
              className="text-xs border text-muted-foreground"
            >
              v{mcpStatus.version}
            </Badge>
          </div>
          <Link href="/settings">
            <Button
              variant="outline"
              size="sm"
              className="border text-muted-foreground hover:text-foreground"
            >
              <Key className="h-4 w-4 mr-2" />
              API Key
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{totalTools}</p>
                <p className="text-xs text-muted-foreground">Total Tools</p>
              </div>
              <Code className="h-8 w-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{freeTools}</p>
                <p className="text-xs text-muted-foreground">Free Tools</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">{proTools}</p>
                <p className="text-xs text-muted-foreground">Pro Tools</p>
              </div>
              <Zap className="h-8 w-8 text-blue-400/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-white">3</p>
                <p className="text-xs text-muted-foreground">Supported IDEs</p>
              </div>
              <Terminal className="h-8 w-8 text-amber-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="bg-card/50 border p-1">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="tools"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Code className="h-4 w-4 mr-2" />
            Tools
          </TabsTrigger>
          <TabsTrigger
            value="setup"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <Settings className="h-4 w-4 mr-2" />
            Setup
          </TabsTrigger>
          <TabsTrigger
            value="docs"
            className="data-[state=active]:bg-purple-600 data-[state=active]:text-white"
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Docs
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold text-white mb-2">
                    AI-Native Security in Your IDE
                  </h2>
                  <p className="text-muted-foreground mb-4">
                    The MCP plugin brings guardrail's security analysis directly
                    into your AI-powered IDE, providing real-time vulnerability
                    detection and fix suggestions as you code.
                  </p>
                  <div className="flex gap-3">
                    <Link href="/settings">
                      <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                        Get API Key
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>
                    <a
                      href="https://docs.guardrail.dev/mcp"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button
                        variant="outline"
                        className="border text-foreground/80 hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Documentation
                      </Button>
                    </a>
                  </div>
                </div>
                <div className="hidden lg:block">
                  <div className="text-6xl">🧠</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                What is MCP?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The{" "}
                <strong className="text-white">
                  Model Context Protocol (MCP)
                </strong>{" "}
                is an open standard that enables AI assistants to securely
                access external tools and data sources. By connecting guardrail
                through MCP, your AI coding assistant gains the ability to:
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-card/50 border">
                  <Shield className="h-6 w-6 text-emerald-400 mb-2" />
                  <h4 className="font-medium text-white mb-1">
                    Analyze Code Security
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Detect vulnerabilities in real-time as you write code
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-card/50 border">
                  <Zap className="h-6 w-6 text-amber-400 mb-2" />
                  <h4 className="font-medium text-white mb-1">Suggest Fixes</h4>
                  <p className="text-xs text-muted-foreground">
                    Get AI-powered remediation suggestions instantly
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-card/50 border">
                  <FileSearch className="h-6 w-6 text-blue-400 mb-2" />
                  <h4 className="font-medium text-white mb-1">Scan Projects</h4>
                  <p className="text-xs text-muted-foreground">
                    Run comprehensive security scans from your editor
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Supported IDEs</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {IDE_INTEGRATIONS.map((ide) => (
                <Card
                  key={ide.id}
                  className="bg-card/40 border backdrop-blur-sm hover:border-primary/30 transition-all group"
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className="p-3 rounded-xl bg-background border">
                        <Terminal className="h-12 w-12 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <h3 className="font-semibold text-white">
                            {ide.name}
                          </h3>
                          {ide.status === "recommended" && (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {ide.description}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground/70 font-mono">
                        {ide.configPath}
                      </div>
                      <Button
                        onClick={() => handleConnect(ide)}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                      >
                        <Plug className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-emerald-400" />
                Quick Tool Reference
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Popular tools your AI assistant can use
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {MCP_TOOL_CATEGORIES.slice(0, 2)
                  .flatMap((cat) => cat.tools.slice(0, 2))
                  .map((tool) => (
                    <div
                      key={tool.name}
                      className="flex items-center justify-between p-3 rounded-lg bg-card/50 border hover:border-primary/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedTool(tool)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-purple-400 font-mono">
                            {tool.name}
                          </code>
                          {tool.tier === "pro" && (
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                              Pro
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {tool.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
              </div>
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  className="border"
                  onClick={() => setActiveTab("tools")}
                >
                  View All {totalTools} Tools
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-400" />
                Quick Configuration
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Add this to your IDE's MCP configuration file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="bg-card border rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="text-foreground/80">
                    {MCP_CONFIG_TEMPLATE}
                  </code>
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(MCP_CONFIG_TEMPLATE, "config")}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                >
                  {copied === "config" ? (
                    <>
                      <Check className="h-4 w-4 mr-1 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>
                  Replace{" "}
                  <code className="bg-muted px-1 rounded">YOUR_API_KEY</code>{" "}
                  with your actual API key
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="grid gap-6">
            {MCP_TOOL_CATEGORIES.map((category) => (
              <Card
                key={category.id}
                className="bg-card/40 border backdrop-blur-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                      {category.icon}
                    </div>
                    <div>
                      <CardTitle className="text-white text-lg">
                        {category.name}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground">
                        {category.description}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {category.tools.map((tool) => (
                      <div
                        key={tool.name}
                        className="p-4 rounded-lg bg-card/50 border hover:border-purple-500/30 transition-all cursor-pointer"
                        onClick={() => setSelectedTool(tool)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <code className="text-sm text-purple-400 font-mono font-semibold">
                                {tool.name}
                              </code>
                              {tool.tier === "pro" && (
                                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                                  Pro
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {tool.description}
                            </p>
                            {tool.example && (
                              <p className="text-xs text-muted-foreground/70 mt-2 italic">
                                Try: {tool.example}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {IDE_INTEGRATIONS.map((ide) => (
              <Card
                key={ide.id}
                className="bg-card/40 border backdrop-blur-sm hover:border-primary/30 transition-all"
              >
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <div className="p-3 rounded-xl bg-background border">
                      <Terminal className="h-12 w-12 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <h3 className="font-semibold text-white">{ide.name}</h3>
                        {ide.status === "recommended" && (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-xs">
                            Recommended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {ide.description}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground/70 font-mono">
                      {ide.configPath}
                    </div>
                    <Button
                      onClick={() => handleConnect(ide)}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    >
                      <Plug className="h-4 w-4 mr-2" />
                      Setup Guide
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-400" />
                MCP Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <pre className="bg-card border rounded-lg p-4 overflow-x-auto text-sm">
                  <code className="text-foreground/80">
                    {MCP_CONFIG_TEMPLATE}
                  </code>
                </pre>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    copyToClipboard(MCP_CONFIG_TEMPLATE, "setup-config")
                  }
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                >
                  {copied === "setup-config" ? (
                    <>
                      <Check className="h-4 w-4 mr-1 text-emerald-400" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-cyan-400" />
                Quick Start Steps
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    step: 1,
                    title: "Get API Key",
                    desc: "Generate from Settings page",
                  },
                  {
                    step: 2,
                    title: "Copy Config",
                    desc: "Copy the MCP configuration above",
                  },
                  {
                    step: 3,
                    title: "Add to IDE",
                    desc: "Paste into your IDE's MCP config file",
                  },
                  {
                    step: 4,
                    title: "Restart IDE",
                    desc: "Reload to activate the MCP server",
                  },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-semibold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Docs Tab */}
        <TabsContent value="docs" className="space-y-6">
          <Card className="bg-card/40 border backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                What is MCP?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The{" "}
                <strong className="text-white">
                  Model Context Protocol (MCP)
                </strong>{" "}
                is an open standard that enables AI assistants to securely
                access external tools and data sources.
              </p>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-card/50 border">
                  <Shield className="h-6 w-6 text-emerald-400 mb-2" />
                  <h4 className="font-medium text-white mb-1">
                    Analyze Security
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Detect vulnerabilities in real-time
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-card/50 border">
                  <Zap className="h-6 w-6 text-amber-400 mb-2" />
                  <h4 className="font-medium text-white mb-1">Suggest Fixes</h4>
                  <p className="text-xs text-muted-foreground">
                    AI-powered remediation
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-card/50 border">
                  <FileSearch className="h-6 w-6 text-blue-400 mb-2" />
                  <h4 className="font-medium text-white mb-1">Scan Projects</h4>
                  <p className="text-xs text-muted-foreground">
                    Comprehensive security scans
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <span className="text-xl">💬</span>
                Natural Language Commands
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Run via CLI:{" "}
                <code className="text-blue-400">
                  guardrail "your command here"
                </code>
              </p>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
                {NL_COMMANDS.map((item) => (
                  <div
                    key={item.cmd}
                    className="p-3 rounded-lg bg-card/50 border"
                  >
                    <code className="text-sm text-blue-400 font-mono block mb-1">
                      "{item.cmd}"
                    </code>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {MCP_FEATURES.map((tierGroup) => (
              <Card
                key={tierGroup.tier}
                className={`bg-card/40 border backdrop-blur-sm ${
                  tierGroup.tier === "pro" ? "ring-1 ring-blue-500/50" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-white capitalize">
                      {tierGroup.tier}
                    </CardTitle>
                    {tierGroup.tier === "pro" && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                        Popular
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tierGroup.features.map((feature) => (
                    <div key={feature.name} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-white">
                          {feature.name}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground pl-6">
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Tool Detail Modal */}
      <Dialog
        open={selectedTool !== null}
        onOpenChange={(open) => !open && setSelectedTool(null)}
      >
        <DialogContent className="bg-card border text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              <Code className="h-6 w-6 text-purple-400" />
              {selectedTool?.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {selectedTool?.description}
            </DialogDescription>
          </DialogHeader>
          {selectedTool && (
            <div className="space-y-4 mt-4">
              {selectedTool.parameters &&
                selectedTool.parameters.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground/80 mb-2">
                      Parameters
                    </h4>
                    <div className="space-y-2">
                      {selectedTool.parameters.map((param) => (
                        <div
                          key={param.name}
                          className="p-3 rounded-lg bg-muted/50 border"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm text-purple-400">
                              {param.name}
                            </code>
                            <Badge
                              variant="outline"
                              className="text-xs border text-muted-foreground"
                            >
                              {param.type}
                            </Badge>
                            {param.required && (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {param.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              {selectedTool.example && (
                <div>
                  <h4 className="text-sm font-medium text-foreground/80 mb-2">
                    Example Usage
                  </h4>
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <code className="text-sm text-emerald-400">
                      {selectedTool.example}
                    </code>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* IDE Setup Modal */}
      <Dialog
        open={selectedIDE !== null}
        onOpenChange={(open) => !open && handleCloseModal()}
      >
        <DialogContent className="bg-card border text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl">
              {selectedIDE && (
                <>
                  <Terminal className="h-6 w-6 text-purple-400" />
                  Connect guardrail to {selectedIDE.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Follow these steps to enable guardrail security scanning in your
              IDE
            </DialogDescription>
          </DialogHeader>

          {selectedIDE && (
            <div className="space-y-6 mt-4">
              <div className="space-y-3">
                {selectedIDE.steps.map((step, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      index === currentStep
                        ? "bg-purple-500/10 border-purple-500/30"
                        : index < currentStep
                          ? "bg-emerald-500/10 border-emerald-500/30"
                          : "bg-card/50 border"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index < currentStep
                          ? "bg-emerald-500 text-white"
                          : index === currentStep
                            ? "bg-purple-500 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index < currentStep ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <span
                      className={
                        index <= currentStep
                          ? "text-white"
                          : "text-muted-foreground"
                      }
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground/80">
                  MCP Configuration
                </h4>
                <div className="relative">
                  <pre className="p-4 rounded-lg bg-background border text-sm overflow-x-auto font-mono text-emerald-400">
                    {getConfigForIDE(selectedIDE.id)}
                  </pre>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      copyToClipboard(
                        getConfigForIDE(selectedIDE.id),
                        "modal-config",
                      )
                    }
                    className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
                  >
                    {copied === "modal-config" ? (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Add this to{" "}
                  <code className="text-purple-400">
                    {selectedIDE.configPath}
                  </code>
                </p>
              </div>

              <div className="flex items-center gap-3">
                {currentStep < selectedIDE.steps.length - 1 ? (
                  <Button
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    Next Step <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleCloseModal}
                    className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Done
                  </Button>
                )}
                {currentStep > 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="border text-foreground/80 hover:bg-muted"
                  >
                    Back
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
