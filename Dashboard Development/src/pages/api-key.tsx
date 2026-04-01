"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Key, Plus, Copy, CheckCircle, Eye, EyeOff, Trash2, Clock, Shield } from "lucide-react";
import { motion } from "motion/react";

export function APIKeyPage() {
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const apiKeys = [
    {
      id: "key-1",
      name: "Production API Key",
      key: "grd_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      created: "2024-01-15",
      lastUsed: "5 minutes ago",
      usage: 2847,
      limit: 10000,
      scopes: ["read", "write", "scan", "deploy"],
      status: "active",
    },
    {
      id: "key-2",
      name: "Development API Key",
      key: "grd_test_z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4",
      created: "2024-01-10",
      lastUsed: "2 hours ago",
      usage: 456,
      limit: 5000,
      scopes: ["read", "scan"],
      status: "active",
    },
    {
      id: "key-3",
      name: "CI/CD Pipeline Key",
      key: "grd_live_m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9",
      created: "2024-01-05",
      lastUsed: "30 minutes ago",
      usage: 8234,
      limit: 50000,
      scopes: ["read", "scan", "report"],
      status: "active",
    },
    {
      id: "key-4",
      name: "Legacy API Key",
      key: "grd_live_old1234567890abcdefghijklmnopqrst",
      created: "2023-12-01",
      lastUsed: "30 days ago",
      usage: 0,
      limit: 10000,
      scopes: ["read"],
      status: "expired",
    },
  ];

  const scopes = [
    { name: "read", description: "Read access to resources", color: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
    { name: "write", description: "Write access to resources", color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
    { name: "scan", description: "Run security scans", color: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
    { name: "deploy", description: "Deploy applications", color: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
    { name: "report", description: "Generate reports", color: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/30" },
    { name: "admin", description: "Administrative access", color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
  ];

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 12)}${"•".repeat(20)}${key.substring(key.length - 8)}`;
  };

  const stats = [
    { 
      label: "Total API Keys", 
      value: apiKeys.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Key
    },
    { 
      label: "Active Keys", 
      value: apiKeys.filter(k => k.status === "active").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
    },
    { 
      label: "Total Requests", 
      value: (apiKeys.reduce((sum, k) => sum + k.usage, 0) / 1000).toFixed(1) + "K", 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: Shield
    },
    { 
      label: "Rate Limit", 
      value: (apiKeys.reduce((sum, k) => sum + k.limit, 0) / 1000).toFixed(0) + "K/mo", 
      color: "text-cyan-400",
      bg: "from-cyan-500/20 to-blue-500/20",
      icon: Clock
    },
  ];

  const usageExample = `// Initialize guardrail SDK
import { guardrail } from '@guardrail/sdk';

const client = new guardrail({
  apiKey: 'YOUR_API_KEY_HERE'
});

// Run a security scan
const result = await client.scan({
  repository: 'owner/repo',
  type: 'security'
});

console.log(result);`;

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
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30">
              <Key className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                API Keys
              </h1>
              <p className="text-zinc-400">Manage API keys for programmatic access</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4 mr-2" />
            Create New Key
          </Button>
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

      {/* Security Notice */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-xl">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-amber-400 mb-1">Security Best Practices</h3>
                <p className="text-sm text-zinc-400">
                  Keep your API keys secure. Never commit them to version control or share them publicly. 
                  Use environment variables and rotate keys regularly.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* API Keys List */}
      <div className="space-y-3">
        {apiKeys.map((apiKey, index) => (
          <motion.div
            key={apiKey.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.05 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all">
              <CardContent className="p-4">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-white">{apiKey.name}</h3>
                        <Badge className={
                          apiKey.status === "active" 
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            : "bg-red-500/20 text-red-400 border-red-500/30"
                        }>
                          {apiKey.status}
                        </Badge>
                      </div>
                      
                      {/* API Key Display */}
                      <div className="flex items-center gap-2 mb-3">
                        <code className="flex-1 text-sm font-mono text-cyan-400 bg-black p-2 rounded border border-zinc-800">
                          {showKey[apiKey.id] ? apiKey.key : maskKey(apiKey.key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowKey({ ...showKey, [apiKey.id]: !showKey[apiKey.id] })}
                        >
                          {showKey[apiKey.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(apiKey.key, apiKey.id)}
                        >
                          {copiedKey === apiKey.id ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Scopes */}
                      <div className="mb-3">
                        <p className="text-xs text-zinc-500 mb-1.5">Scopes:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {apiKey.scopes.map((scope) => {
                            const scopeConfig = scopes.find(s => s.name === scope);
                            return (
                              <Badge 
                                key={scope} 
                                className={scopeConfig ? `text-xs ${scopeConfig.bg} ${scopeConfig.color} ${scopeConfig.border}` : ""}
                              >
                                {scope}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>

                      {/* Usage Stats */}
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <p className="text-xs text-zinc-500">Created</p>
                          <p className="text-sm text-zinc-300">{apiKey.created}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Last Used</p>
                          <p className="text-sm text-zinc-300">{apiKey.lastUsed}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Usage</p>
                          <p className="text-sm text-zinc-300">
                            {apiKey.usage.toLocaleString()} / {apiKey.limit.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Usage Progress Bar */}
                      <div className="mt-3">
                        <div className="w-full bg-zinc-800 rounded-full h-1.5">
                          <div 
                            className={`h-1.5 rounded-full ${
                              (apiKey.usage / apiKey.limit) >= 0.9 ? "bg-gradient-to-r from-red-500 to-pink-500" :
                              (apiKey.usage / apiKey.limit) >= 0.7 ? "bg-gradient-to-r from-yellow-500 to-orange-500" :
                              "bg-gradient-to-r from-blue-500 to-cyan-500"
                            }`}
                            style={{ width: `${(apiKey.usage / apiKey.limit) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
                    <Button variant="ghost" size="sm" className="h-8 text-blue-400 hover:text-blue-300">
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-zinc-400 hover:text-zinc-300">
                      Rotate
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300 ml-auto">
                      <Trash2 className="w-3 h-3 mr-1" />
                      Revoke
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Available Scopes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Available Scopes</CardTitle>
            <CardDescription className="text-zinc-400">
              Understanding API key permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {scopes.map((scope) => (
                <div
                  key={scope.name}
                  className={`p-3 rounded-lg border ${scope.border} ${scope.bg}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${scope.bg} ${scope.color} ${scope.border}`}>
                      {scope.name}
                    </Badge>
                  </div>
                  <p className="text-sm text-zinc-400">{scope.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Usage Example */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">Usage Example</CardTitle>
                <CardDescription className="text-zinc-400">
                  How to use your API key in code
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(usageExample, "usage-example")}
              >
                {copiedKey === "usage-example" ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-lg bg-black border border-zinc-800 overflow-x-auto">
              <code className="text-sm text-cyan-400 font-mono">{usageExample}</code>
            </pre>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
