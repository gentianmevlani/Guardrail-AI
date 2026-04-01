"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ScrollText, Plus, Search, Settings, CheckCircle, XCircle, Clock, Code, FileText, Shield, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { motion } from "motion/react";

export function PoliciesPage() {
  const [selectedCategory, setSelectedCategory] = useState<"all" | "security" | "quality" | "compliance" | "custom">("all");

  const policies = [
    {
      id: "POL-001",
      name: "Secure Dependency Management",
      description: "Enforce secure dependency versions and prevent vulnerable packages",
      category: "security",
      status: "active",
      severity: "critical",
      rules: 8,
      violations: 3,
      lastUpdated: "2 days ago",
      appliedTo: ["frontend-app", "backend-api", "mobile-app"],
      conditions: [
        "No dependencies with critical CVEs",
        "All dependencies must be from approved registries",
        "Dependency versions must be pinned",
      ],
    },
    {
      id: "POL-002",
      name: "Code Review Requirements",
      description: "Mandate code review process for all pull requests",
      category: "quality",
      status: "active",
      severity: "high",
      rules: 5,
      violations: 0,
      lastUpdated: "1 week ago",
      appliedTo: ["All repositories"],
      conditions: [
        "Minimum 2 approvals required",
        "No self-approvals allowed",
        "All comments must be resolved",
      ],
    },
    {
      id: "POL-003",
      name: "License Compliance Check",
      description: "Ensure all dependencies comply with approved licenses",
      category: "compliance",
      status: "active",
      severity: "critical",
      rules: 4,
      violations: 1,
      lastUpdated: "3 days ago",
      appliedTo: ["All repositories"],
      conditions: [
        "Only MIT, Apache-2.0, BSD licenses allowed",
        "GPL licenses prohibited in commercial projects",
        "License must be declared in package.json",
      ],
    },
    {
      id: "POL-004",
      name: "Test Coverage Requirements",
      description: "Maintain minimum test coverage standards",
      category: "quality",
      status: "active",
      severity: "medium",
      rules: 6,
      violations: 5,
      lastUpdated: "1 day ago",
      appliedTo: ["frontend-app", "backend-api"],
      conditions: [
        "Minimum 80% code coverage",
        "All new code must have tests",
        "E2E tests for critical flows",
      ],
    },
    {
      id: "POL-005",
      name: "API Security Standards",
      description: "Security requirements for API endpoints",
      category: "security",
      status: "active",
      severity: "critical",
      rules: 10,
      violations: 2,
      lastUpdated: "4 days ago",
      appliedTo: ["backend-api", "api-gateway"],
      conditions: [
        "All endpoints require authentication",
        "Rate limiting enabled",
        "HTTPS only",
        "Input validation on all endpoints",
      ],
    },
    {
      id: "POL-006",
      name: "Data Retention Policy",
      description: "Guidelines for data storage and retention",
      category: "compliance",
      status: "active",
      severity: "high",
      rules: 7,
      violations: 0,
      lastUpdated: "1 week ago",
      appliedTo: ["data-service"],
      conditions: [
        "PII data encrypted at rest",
        "Logs retained for 90 days",
        "User data deletion on request",
      ],
    },
    {
      id: "POL-007",
      name: "Custom Build Standards",
      description: "Organization-specific build and deployment requirements",
      category: "custom",
      status: "draft",
      severity: "low",
      rules: 3,
      violations: 0,
      lastUpdated: "5 days ago",
      appliedTo: [],
      conditions: [
        "Dockerfile must exist",
        "Docker image size < 500MB",
        "Multi-stage builds required",
      ],
    },
    {
      id: "POL-008",
      name: "Secrets Management",
      description: "Prevent hardcoded secrets and credentials",
      category: "security",
      status: "active",
      severity: "critical",
      rules: 12,
      violations: 0,
      lastUpdated: "2 days ago",
      appliedTo: ["All repositories"],
      conditions: [
        "No hardcoded API keys",
        "Use environment variables",
        "Secrets must be in vault",
        "No secrets in git history",
      ],
    },
  ];

  const filteredPolicies = selectedCategory === "all"
    ? policies
    : policies.filter(p => p.category === selectedCategory);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      security: { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
      quality: { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
      compliance: { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
      custom: { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
    };
    return colors[category] || { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30" };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return { text: "text-red-400", dot: "bg-red-500" };
      case "high":
        return { text: "text-orange-400", dot: "bg-orange-500" };
      case "medium":
        return { text: "text-yellow-400", dot: "bg-yellow-500" };
      case "low":
        return { text: "text-blue-400", dot: "bg-blue-500" };
      default:
        return { text: "text-zinc-400", dot: "bg-zinc-500" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case "draft":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Draft</Badge>;
      case "disabled":
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Disabled</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const stats = [
    { 
      label: "Total Policies", 
      value: policies.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: ScrollText
    },
    { 
      label: "Active", 
      value: policies.filter(p => p.status === "active").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
    },
    { 
      label: "Total Violations", 
      value: policies.reduce((sum, p) => sum + p.violations, 0).toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-pink-500/20",
      icon: AlertTriangle
    },
    { 
      label: "Total Rules", 
      value: policies.reduce((sum, p) => sum + p.rules, 0).toString(), 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: FileText
    },
  ];

  const policyTemplates = [
    {
      name: "OWASP Top 10",
      description: "Security policies based on OWASP standards",
      icon: Shield,
      rules: 24,
      color: "from-red-500 to-orange-500",
    },
    {
      name: "SOC 2 Compliance",
      description: "Policies for SOC 2 certification",
      icon: CheckCircle,
      rules: 18,
      color: "from-green-500 to-emerald-500",
    },
    {
      name: "Best Practices",
      description: "Industry standard development practices",
      icon: Code,
      rules: 15,
      color: "from-blue-500 to-cyan-500",
    },
    {
      name: "Custom Template",
      description: "Create your own policy template",
      icon: Settings,
      rules: 0,
      color: "from-purple-500 to-pink-500",
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
              <ScrollText className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Policies
              </h1>
              <p className="text-zinc-400">Define and manage security and compliance policies</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Plus className="w-4 h-4 mr-2" />
              New Policy
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

      {/* Policy Templates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Policy Templates</CardTitle>
            <CardDescription className="text-zinc-400">
              Quick start with pre-configured policy templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {policyTemplates.map((template, index) => (
                <motion.button
                  key={template.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-blue-500/30 hover:bg-zinc-800 transition-all text-left group"
                >
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${template.color} bg-opacity-20 flex items-center justify-center mb-3`}>
                    <template.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors mb-1">
                    {template.name}
                  </h3>
                  <p className="text-xs text-zinc-400 mb-2">{template.description}</p>
                  <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                    {template.rules} rules
                  </Badge>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Category Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-2"
      >
        <Settings className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          {(["all", "security", "quality", "compliance", "custom"] as const).map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={selectedCategory === category 
                ? "bg-blue-600 text-white" 
                : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
              }
            >
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Policies List */}
      <div className="space-y-3">
        {filteredPolicies.map((policy, index) => {
          const categoryColor = getCategoryColor(policy.category);
          const severityColor = getSeverityColor(policy.severity);
          
          return (
            <motion.div
              key={policy.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.05 }}
            >
              <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                          {policy.name}
                        </h3>
                        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {policy.id}
                        </Badge>
                        <Badge className={`text-xs ${categoryColor.bg} ${categoryColor.text} ${categoryColor.border}`}>
                          {policy.category}
                        </Badge>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${severityColor.dot}`} />
                          <span className={`text-xs ${severityColor.text}`}>{policy.severity}</span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 mb-3">{policy.description}</p>
                      
                      {/* Conditions */}
                      <div className="mb-3">
                        <p className="text-xs text-zinc-500 mb-1.5">Conditions:</p>
                        <div className="space-y-1">
                          {policy.conditions.map((condition, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs text-zinc-400">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              {condition}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Applied To */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <span className="text-xs text-zinc-500">Applied to:</span>
                        {policy.appliedTo.map((repo) => (
                          <Badge key={repo} variant="outline" className="text-[10px] border-blue-500/50 text-blue-400">
                            {repo}
                          </Badge>
                        ))}
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-4 text-xs text-zinc-500">
                        <span>{policy.rules} rules</span>
                        <span>•</span>
                        <span className={policy.violations > 0 ? "text-red-400 font-medium" : ""}>
                          {policy.violations} violations
                        </span>
                        <span>•</span>
                        <span>Updated {policy.lastUpdated}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {getStatusBadge(policy.status)}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
                    <Button variant="ghost" size="sm" className="h-8 text-blue-400 hover:text-blue-300">
                      <Edit className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-zinc-400 hover:text-zinc-300">
                      <Code className="w-3 h-3 mr-1" />
                      View Rules
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300 ml-auto">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
