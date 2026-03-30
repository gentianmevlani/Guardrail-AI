"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logger } from "@/lib/logger";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Clock,
  Copy,
  Cpu,
  Eye,
  EyeOff,
  Key,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../../context/auth-context";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function APIKeyPage() {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPaid, setIsPaid] = useState(true);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/api-key`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
      }
    } catch (error) {
      logger.debug("Failed to load API key");
    }
  };

  const generateApiKey = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/api-key`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.apiKey) {
        setApiKey(data.apiKey);
        setShowApiKey(true);
      }
    } catch (error) {
      logger.error("Failed to generate API key");
    } finally {
      setGenerating(false);
    }
  };

  const revokeApiKey = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/api-key`, {
        method: "DELETE",
        credentials: "include",
      });
      setApiKey(null);
      setShowApiKey(false);
    } catch (error) {
      logger.error("Failed to revoke API key");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
            <Key className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">API Key</h1>
            <p className="text-muted-foreground">
              Manage your API key for CLI and MCP integrations
            </p>
          </div>
        </div>
      </div>

      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Key className="h-5 w-5 text-amber-400" />
            Your API Key
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Use this key to authenticate the CLI and MCP plugin. Keep it secure
            and never share it publicly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isPaid ? (
            <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Lock className="h-6 w-6 text-amber-400" />
              <div className="flex-1">
                <p className="font-medium text-amber-400">Upgrade Required</p>
                <p className="text-sm text-muted-foreground">
                  API keys are available on Pro and Enterprise plans
                </p>
              </div>
              <Link href="/pricing">
                <Button className="bg-amber-500 hover:bg-amber-600 text-black">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          ) : apiKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={showApiKey ? apiKey : "•".repeat(40)}
                    readOnly
                    className="bg-card/50 border text-white font-mono pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => copyToClipboard(apiKey, "api-key")}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      {copied === "api-key" ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={generateApiKey}
                  disabled={generating}
                  className="border text-foreground/80 hover:bg-muted"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${generating ? "animate-spin" : ""}`}
                  />
                  Regenerate
                </Button>
                <Button
                  variant="outline"
                  onClick={revokeApiKey}
                  className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  Revoke Key
                </Button>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Regenerating will invalidate your current key and require
                updating all integrations
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                You don't have an API key yet. Generate one to use the CLI and
                MCP plugin.
              </p>
              <Button
                onClick={generateApiKey}
                disabled={generating}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Generate API Key
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/cli" className="block">
          <Card className="bg-card/40 border backdrop-blur-sm hover:border-emerald-500/50 transition-all group h-full">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 group-hover:bg-emerald-500/20 transition-colors">
                  <Terminal className="h-6 w-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                    CLI Tool
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Use your API key with the command-line tool for local
                    scanning and CI/CD integration
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/mcp" className="block">
          <Card className="bg-card/40 border backdrop-blur-sm hover:border-purple-500/50 transition-all group h-full">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30 group-hover:bg-purple-500/20 transition-colors">
                  <Cpu className="h-6 w-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-white mb-1 flex items-center gap-2">
                    MCP Plugin
                    <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Configure your API key in AI-powered IDEs like Cursor and
                    Windsurf
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card className="bg-card/40 border backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            Security Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-muted">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">
                  Never commit to git
                </h4>
                <p className="text-xs text-muted-foreground">
                  Store your API key in environment variables or secrets
                  managers
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-muted">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">
                  Rotate regularly
                </h4>
                <p className="text-xs text-muted-foreground">
                  Regenerate your API key periodically for enhanced security
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-muted">
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">
                  Monitor usage
                </h4>
                <p className="text-xs text-muted-foreground">
                  Check the audit log for any suspicious activity
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-muted">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium text-white text-sm">
                  Revoke if compromised
                </h4>
                <p className="text-xs text-muted-foreground">
                  Immediately revoke and regenerate if your key is exposed
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Key className="h-6 w-6 text-blue-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-white">API Key Format</h3>
              <p className="text-sm text-muted-foreground">
                Your API key starts with{" "}
                <code className="bg-muted px-1 rounded text-xs">gr_</code>{" "}
                followed by your tier identifier and a unique token
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 rounded bg-card border">
            <code className="text-sm text-muted-foreground">
              gr_<span className="text-blue-400">pro</span>_
              <span className="text-muted-foreground/70">
                xxxxxxxxxxxxxxxxxxxxxxxx
              </span>
            </code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
