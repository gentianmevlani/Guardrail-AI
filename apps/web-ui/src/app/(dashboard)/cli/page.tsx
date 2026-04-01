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
  Check,
  Copy,
  Download,
  ExternalLink,
  Package,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export const dynamic = "force-dynamic";

export default function CLIPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadCLI = (platform: 'windows' | 'macos' | 'linux') => {
    const urls = {
      windows: 'https://github.com/guardiavault-oss/guardrail/releases/latest/download/guardrail-windows.exe',
      macos: 'https://github.com/guardiavault-oss/guardrail/releases/latest/download/guardrail-macos',
      linux: 'https://github.com/guardiavault-oss/guardrail/releases/latest/download/guardrail-linux'
    };
    
    window.open(urls[platform], '_blank');
  };

  const downloadMCP = () => {
    window.open('https://github.com/guardiavault-oss/guardrail/releases/latest/download/guardrail-mcp-server.tar.gz', '_blank');
  };

  const downloadVSCode = () => {
    window.open('https://marketplace.visualstudio.com/items?itemName=guardrail-ai.guardrail', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">CLI & Tools</h1>
          <p className="text-muted-foreground">
            Download the guardrail CLI and MCP server for local development.{" "}
            <Link href="/integrations" className="text-teal-400 hover:underline">
              Connect every platform →
            </Link>
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={downloadVSCode} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            VS Code Extension
          </Button>
        </div>
      </div>

      {/* Download Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-400" />
              guardrail CLI
            </CardTitle>
            <CardDescription>
              Command-line interface for scanning and validation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Download the CLI for your platform:</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => downloadCLI('windows')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Package className="w-4 h-4 mr-2" />
                Windows
              </Button>
              <Button
                size="sm"
                onClick={() => downloadCLI('macos')}
                className="bg-gray-800 hover:bg-gray-700"
              >
                <Package className="w-4 h-4 mr-2" />
                macOS
              </Button>
              <Button
                size="sm"
                onClick={() => downloadCLI('linux')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <Package className="w-4 h-4 mr-2" />
                Linux
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Or install with npm: <code className="bg-muted px-2 py-1 rounded">npm install -g guardrail-cli-tool</code></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-purple-400" />
              MCP Server
            </CardTitle>
            <CardDescription>
              Model Context Protocol server for AI assistants
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Connect guardrail to Claude Desktop, Cursor, and other MCP-enabled tools:</p>
            </div>
            <Button onClick={downloadMCP} className="w-full bg-purple-600 hover:bg-purple-700">
              <Download className="w-4 h-4 mr-2" />
              Download MCP Server
            </Button>
            <div className="text-xs text-muted-foreground">
              <p>Or install with npm: <code className="bg-muted px-2 py-1 rounded">npm install @guardrail/mcp-server</code></p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/40 border backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-green-400" />
              VS Code Extension
            </CardTitle>
            <CardDescription>
              Real-time validation and inline diagnostics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Get guardrail directly in your editor:</p>
            </div>
            <Button onClick={downloadVSCode} className="w-full bg-green-600 hover:bg-green-700">
              <ExternalLink className="w-4 h-4 mr-2" />
              Install Extension
            </Button>
            <div className="text-xs text-muted-foreground">
              <p>Search "guardrail" in VS Code extensions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Start */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">Quick Start</CardTitle>
          <CardDescription className="text-muted-foreground">
            Get up and running in minutes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-foreground mb-3">1. Authenticate</h4>
              <pre className="text-sm bg-card border border-border rounded p-3 text-blue-400">
                <button
                  onClick={() => copyToClipboard("guardrail auth --key YOUR_API_KEY", "auth")}
                  className="absolute top-2 right-2 p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                  aria-label={copied === "auth" ? "Copied to clipboard" : "Copy command"}
                  aria-live="polite"
                >
                  {copied === "auth" ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
                guardrail auth --key YOUR_API_KEY
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-3">2. Scan your project</h4>
              <pre className="text-sm bg-card border border-border rounded p-3 text-blue-400">
                <button
                  onClick={() => copyToClipboard("guardrail scan", "scan")}
                  className="absolute top-2 right-2 p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                  aria-label={copied === "scan" ? "Copied to clipboard" : "Copy command"}
                  aria-live="polite"
                >
                  {copied === "scan" ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
                guardrail scan
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-3">3. Get results</h4>
              <p className="text-sm text-muted-foreground">
                View detailed reports and recommendations in your dashboard
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MCP Configuration */}
      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white">MCP Configuration</CardTitle>
          <CardDescription className="text-muted-foreground">
            Set up the Model Context Protocol server
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2">Claude Desktop</h4>
              <pre className="text-sm bg-card border border-border rounded p-3 text-purple-400">
                <button
                  onClick={() => copyToClipboard('{\"mcpServers\": {\"guardrail\": {\"command\": \"node path/to/guardrail-mcp-server\"}}}', "claude")}
                  className="absolute top-2 right-2 p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                  aria-label={copied === "claude" ? "Copied to clipboard" : "Copy config"}
                  aria-live="polite"
                >
                  {copied === "claude" ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
                {`{"mcpServers": {"guardrail": {"command": "node path/to/guardrail-mcp-server"}}}`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">Cursor</h4>
              <pre className="text-sm bg-card border border-border rounded p-3 text-purple-400">
                <button
                  onClick={() => copyToClipboard('{"name": "guardrail", "command": "node path/to/guardrail-mcp-server"}', "cursor")}
                  className="absolute top-2 right-2 p-1.5 rounded bg-muted hover:bg-muted/80 transition-colors"
                  aria-label={copied === "cursor" ? "Copied to clipboard" : "Copy config"}
                  aria-live="polite"
                >
                  {copied === "cursor" ? (
                    <Check className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                </button>
                {`{"name": "guardrail", "command": "node path/to/guardrail-mcp-server"}`}
              </pre>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>For other MCP-enabled tools, use the server command: <code className="bg-muted px-2 py-1 rounded">guardrail-mcp</code></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
