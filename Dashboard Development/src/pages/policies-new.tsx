"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ScrollText,
  Plus,
  Shield,
  CheckCircle,
  Code,
  Lock,
  Settings,
  FileCode,
  Ban,
  Edit,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "../components/ui/utils";
import { Switch } from "../components/ui/switch";

// Mock data
const strictnessPresets = [
  {
    id: "dev",
    name: "Dev (Light)",
    description: "Minimal guardrails for rapid development",
    active: false,
    rules: {
      hallucinationCheck: true,
      dependencyValidation: false,
      boundaryEnforcement: false,
      securityScanning: false,
    },
  },
  {
    id: "pre-merge",
    name: "Pre-merge (Medium)",
    description: "Balanced protection for pull requests",
    active: true,
    rules: {
      hallucinationCheck: true,
      dependencyValidation: true,
      boundaryEnforcement: true,
      securityScanning: false,
    },
  },
  {
    id: "pre-deploy",
    name: "Pre-deploy (Strict)",
    description: "Maximum protection before production",
    active: false,
    rules: {
      hallucinationCheck: true,
      dependencyValidation: true,
      boundaryEnforcement: true,
      securityScanning: true,
    },
  },
];

const architectureBoundaries = [
  {
    id: 1,
    name: "client cannot import server",
    enabled: true,
    violations: 2,
    description: "Prevent client-side code from importing server-only modules",
  },
  {
    id: 2,
    name: "db isolated",
    enabled: true,
    violations: 0,
    description: "Database layer must be accessed through repository pattern",
  },
  {
    id: 3,
    name: "components cannot import pages",
    enabled: true,
    violations: 1,
    description: "Maintain unidirectional data flow",
  },
  {
    id: 4,
    name: "utils must be pure functions",
    enabled: false,
    violations: 0,
    description: "Utility functions cannot have side effects",
  },
];

const scopeTemplates = [
  {
    id: 1,
    name: "Auth Changes",
    description: "Security-critical authentication modifications",
    scope: ["src/auth/**", "src/middleware/auth.ts"],
    guardrails: ["Require 2FA check", "No external dependencies", "Security scan"],
    color: "from-red-500 to-orange-500",
  },
  {
    id: 2,
    name: "Billing Changes",
    description: "Payment and subscription handling",
    scope: ["src/billing/**", "src/payments/**"],
    guardrails: ["Transaction safety", "Rate limiting", "Audit logging"],
    color: "from-purple-500 to-pink-500",
  },
  {
    id: 3,
    name: "UI-only Changes",
    description: "Visual changes with no business logic",
    scope: ["components/**", "styles/**"],
    guardrails: ["No API calls", "No state mutations", "Accessibility check"],
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: 4,
    name: "Database Migrations",
    description: "Schema changes and migrations",
    scope: ["prisma/**", "migrations/**"],
    guardrails: ["Rollback plan required", "Backup verification", "Load test"],
    color: "from-green-500 to-emerald-500",
  },
];

const allowedDependencies = [
  { name: "react", version: "^18.0.0", status: "allowed" },
  { name: "next", version: "14.0.0", status: "pinned" },
  { name: "axios", version: "*", status: "blocked" },
  { name: "lodash", version: "^4.17.21", status: "allowed" },
  { name: "moment", version: "*", status: "deprecated" },
];

export function PoliciesNewPage() {
  const [activePreset, setActivePreset] = useState("pre-merge");

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Policies
          </h1>
          <p className="text-zinc-500 mt-2">
            Control surface for guardrails, boundaries, and scope templates
          </p>
        </div>
      </motion.div>

      {/* Strictness Presets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Settings className="w-5 h-5 text-blue-400" />
              Strictness Presets
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Pre-configured protection levels for different environments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {strictnessPresets.map((preset) => (
                <motion.div
                  key={preset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "p-5 rounded-lg border-2 transition-all cursor-pointer",
                    activePreset === preset.id
                      ? "bg-blue-500/10 border-blue-500/50"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                  )}
                  onClick={() => setActivePreset(preset.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white">{preset.name}</h3>
                    {activePreset === preset.id && (
                      <CheckCircle className="w-5 h-5 text-blue-400" />
                    )}
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">{preset.description}</p>
                  <div className="space-y-2">
                    {Object.entries(preset.rules).map(([key, enabled]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-zinc-500 capitalize">
                          {key.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                        {enabled ? (
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border-2 border-zinc-700" />
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Architecture Boundaries */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Lock className="w-5 h-5 text-cyan-400" />
                  Architecture Boundaries
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Define and enforce architectural constraints
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {architectureBoundaries.map((boundary) => (
                <motion.div
                  key={boundary.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <code className="font-mono text-sm text-blue-400">
                          {boundary.name}
                        </code>
                        {boundary.violations > 0 && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                            {boundary.violations} violation{boundary.violations > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{boundary.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch checked={boundary.enabled} />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Scope Templates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileCode className="w-5 h-5 text-purple-400" />
                  Scope Templates
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Reusable scope contracts for common change types
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Template
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scopeTemplates.map((template) => (
                <motion.div
                  key={template.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className={cn(
                        "p-2.5 rounded-lg bg-gradient-to-br",
                        template.color,
                        "bg-opacity-20"
                      )}
                    >
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-blue-400 transition-colors" />
                  </div>

                  <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                    {template.name}
                  </h3>
                  <p className="text-sm text-zinc-400 mb-4">{template.description}</p>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1.5">Scope:</p>
                      <div className="space-y-1">
                        {template.scope.map((path) => (
                          <code
                            key={path}
                            className="block text-xs font-mono text-blue-400 bg-zinc-950/50 px-2 py-1 rounded"
                          >
                            {path}
                          </code>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-zinc-500 mb-1.5">Guardrails:</p>
                      <div className="space-y-1">
                        {template.guardrails.map((guardrail) => (
                          <div
                            key={guardrail}
                            className="flex items-center gap-2 text-xs text-zinc-400"
                          >
                            <CheckCircle className="w-3 h-3 text-emerald-400" />
                            {guardrail}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Allowed Dependencies Policy */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Code className="w-5 h-5 text-green-400" />
                  Allowed Dependencies
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Manage package allowlist, denylist, and version pinning
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Package
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allowedDependencies.map((dep) => (
                <div
                  key={dep.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <code className="font-mono text-sm text-white">{dep.name}</code>
                    <code className="font-mono text-xs text-zinc-500">
                      {dep.version}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    {dep.status === "allowed" && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                        ✓ Allowed
                      </Badge>
                    )}
                    {dep.status === "pinned" && (
                      <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                        📌 Pinned
                      </Badge>
                    )}
                    {dep.status === "blocked" && (
                      <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                        ✕ Blocked
                      </Badge>
                    )}
                    {dep.status === "deprecated" && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">
                        ⚠ Deprecated
                      </Badge>
                    )}
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Save Changes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="flex items-center justify-end gap-3"
      >
        <p className="text-sm text-zinc-500">
          Changes will be saved to <code className="font-mono text-blue-400">guardrail.config.json</code>
        </p>
        <Button
          variant="outline"
          className="border-zinc-700 hover:border-zinc-600"
        >
          Reset
        </Button>
        <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500">
          Save Policies
        </Button>
      </motion.div>
    </div>
  );
}
