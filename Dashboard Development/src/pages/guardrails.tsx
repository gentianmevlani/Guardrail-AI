"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Wand2, Shield, AlertTriangle, CheckCircle, Plus, TrendingDown, TrendingUp, Settings } from "lucide-react";
import { motion } from "motion/react";

export function GuardrailsPage() {
  const [selectedType, setSelectedType] = useState<"all" | "security" | "quality" | "compliance" | "maintenance">("all");

  const guardrails = [
    {
      name: "No Critical Vulnerabilities",
      description: "Block deployments with critical security issues",
      status: "active",
      violations: 0,
      type: "security",
      trend: "stable",
      lastTriggered: "Never",
    },
    {
      name: "Minimum Test Coverage",
      description: "Require at least 80% code coverage",
      status: "active",
      violations: 2,
      type: "quality",
      trend: "improving",
      lastTriggered: "3 days ago",
    },
    {
      name: "License Compliance",
      description: "Ensure all dependencies have approved licenses",
      status: "active",
      violations: 0,
      type: "compliance",
      trend: "stable",
      lastTriggered: "Never",
    },
    {
      name: "No High Severity Issues",
      description: "Prevent deployments with high severity findings",
      status: "warning",
      violations: 5,
      type: "security",
      trend: "degrading",
      lastTriggered: "2 hours ago",
    },
    {
      name: "Code Review Required",
      description: "All changes must be reviewed before merge",
      status: "active",
      violations: 0,
      type: "quality",
      trend: "stable",
      lastTriggered: "Never",
    },
    {
      name: "Dependency Updates",
      description: "No dependencies older than 6 months",
      status: "inactive",
      violations: 12,
      type: "maintenance",
      trend: "degrading",
      lastTriggered: "1 day ago",
    },
    {
      name: "API Security Headers",
      description: "Require security headers on all API endpoints",
      status: "active",
      violations: 1,
      type: "security",
      trend: "improving",
      lastTriggered: "5 hours ago",
    },
    {
      name: "Performance Budgets",
      description: "Enforce bundle size and performance limits",
      status: "active",
      violations: 0,
      type: "quality",
      trend: "stable",
      lastTriggered: "Never",
    },
  ];

  const filteredGuardrails = selectedType === "all"
    ? guardrails
    : guardrails.filter(g => g.type === selectedType);

  const stats = [
    { 
      label: "Active", 
      value: guardrails.filter(g => g.status === "active").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20"
    },
    { 
      label: "Warning", 
      value: guardrails.filter(g => g.status === "warning").length.toString(), 
      color: "text-yellow-400",
      bg: "from-yellow-500/20 to-orange-500/20"
    },
    { 
      label: "Inactive", 
      value: guardrails.filter(g => g.status === "inactive").length.toString(), 
      color: "text-zinc-500",
      bg: "from-zinc-500/20 to-zinc-600/20"
    },
    { 
      label: "Violations", 
      value: guardrails.reduce((sum, g) => sum + g.violations, 0).toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-pink-500/20"
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
              <Wand2 className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                Guardrails
              </h1>
              <p className="text-zinc-400">Automated quality gates and policies</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <Plus className="w-4 h-4 mr-2" />
            New guardrail
          </Button>
        </div>
      </motion.div>

      {/* Stats Overview */}
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
                    <Shield className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Type Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2"
      >
        <Settings className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          {(["all", "security", "quality", "compliance", "maintenance"] as const).map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type)}
              className={selectedType === type 
                ? "bg-blue-600 text-white" 
                : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
              }
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Guardrails List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredGuardrails.map((guardrail, index) => (
          <motion.div
            key={guardrail.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.05 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all group cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {guardrail.status === "active" && guardrail.violations === 0 ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : guardrail.status === "warning" || guardrail.violations > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                    ) : (
                      <Shield className="w-5 h-5 text-zinc-500" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">{guardrail.name}</h3>
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize ${
                            guardrail.type === "security"
                              ? "border-blue-500/50 text-blue-400"
                              : guardrail.type === "quality"
                              ? "border-purple-500/50 text-purple-400"
                              : guardrail.type === "compliance"
                              ? "border-green-500/50 text-green-400"
                              : "border-orange-500/50 text-orange-400"
                          }`}
                        >
                          {guardrail.type}
                        </Badge>
                        {guardrail.trend === "improving" && (
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                        )}
                        {guardrail.trend === "degrading" && (
                          <TrendingDown className="w-3 h-3 text-red-400" />
                        )}
                      </div>
                      <p className="text-sm text-zinc-400 mt-0.5">{guardrail.description}</p>
                      <p className="text-xs text-zinc-600 mt-1">Last triggered: {guardrail.lastTriggered}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {guardrail.violations > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-zinc-500">Violations</p>
                        <p className="text-lg font-semibold text-red-400">{guardrail.violations}</p>
                      </div>
                    )}
                    <Badge
                      className={
                        guardrail.status === "active"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : guardrail.status === "warning"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : "bg-zinc-700/50 text-zinc-500 border-zinc-600/30"
                      }
                    >
                      {guardrail.status}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Policy Templates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-cyan-400" />
              Policy Templates
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Quick start with pre-configured guardrail templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { name: "Enterprise Security", policies: 12, icon: Shield },
                { name: "Startup MVP", policies: 5, icon: CheckCircle },
                { name: "Compliance Focus", policies: 8, icon: AlertTriangle },
              ].map((template, index) => (
                <button
                  key={index}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-blue-500/30 hover:bg-zinc-800 transition-all text-left group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30 transition-colors">
                      <template.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-medium text-white">{template.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{template.policies} policies</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}