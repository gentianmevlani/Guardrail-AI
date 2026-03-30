"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Shield, AlertTriangle, XCircle, CheckCircle, Search, Filter, Download, ExternalLink, Clock, TrendingUp } from "lucide-react";
import { motion } from "motion/react";

export function VulnerabilitiesPage() {
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "critical" | "high" | "medium" | "low">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "open" | "fixed" | "ignored">("all");

  const vulnerabilities = [
    {
      id: "CVE-2024-1234",
      title: "SQL Injection vulnerability in authentication module",
      severity: "critical",
      status: "open",
      package: "auth-service@2.1.0",
      repository: "backend-api",
      discovered: "2 hours ago",
      cvss: 9.8,
      description: "Allows remote attackers to execute arbitrary SQL commands",
    },
    {
      id: "CVE-2024-5678",
      title: "Cross-Site Scripting (XSS) in user profile",
      severity: "high",
      status: "open",
      package: "react-dom@17.0.2",
      repository: "frontend-app",
      discovered: "5 hours ago",
      cvss: 7.5,
      description: "Stored XSS vulnerability in profile description field",
    },
    {
      id: "CVE-2024-9012",
      title: "Prototype Pollution in lodash",
      severity: "high",
      status: "fixed",
      package: "lodash@4.17.15",
      repository: "api-gateway",
      discovered: "1 day ago",
      cvss: 7.2,
      description: "Prototype pollution vulnerability affecting object manipulation",
    },
    {
      id: "CVE-2024-3456",
      title: "Insecure Deserialization in data processor",
      severity: "critical",
      status: "open",
      package: "data-processor@1.5.3",
      repository: "data-service",
      discovered: "3 hours ago",
      cvss: 9.1,
      description: "Remote code execution through malicious serialized objects",
    },
    {
      id: "CVE-2024-7890",
      title: "Information Disclosure in API responses",
      severity: "medium",
      status: "open",
      package: "express@4.17.1",
      repository: "backend-api",
      discovered: "1 day ago",
      cvss: 5.3,
      description: "Sensitive data exposed in error messages",
    },
    {
      id: "CVE-2024-2468",
      title: "Denial of Service in rate limiter",
      severity: "medium",
      status: "fixed",
      package: "rate-limiter@2.0.1",
      repository: "api-gateway",
      discovered: "2 days ago",
      cvss: 6.5,
      description: "Resource exhaustion through crafted requests",
    },
    {
      id: "CVE-2024-1357",
      title: "Weak cryptographic algorithm in token generation",
      severity: "high",
      status: "open",
      package: "crypto-utils@1.2.0",
      repository: "auth-service",
      discovered: "6 hours ago",
      cvss: 7.8,
      description: "Uses deprecated SHA-1 for token generation",
    },
    {
      id: "CVE-2024-8642",
      title: "Path Traversal in file upload",
      severity: "critical",
      status: "ignored",
      package: "file-handler@3.0.0",
      repository: "frontend-app",
      discovered: "3 days ago",
      cvss: 9.3,
      description: "Allows reading arbitrary files from the server",
    },
    {
      id: "CVE-2024-9753",
      title: "Missing authentication in admin endpoint",
      severity: "low",
      status: "open",
      package: "admin-api@1.0.5",
      repository: "backend-api",
      discovered: "4 hours ago",
      cvss: 3.7,
      description: "Non-critical admin endpoint lacks authentication",
    },
  ];

  const filteredVulnerabilities = vulnerabilities.filter(vuln => {
    const severityMatch = selectedSeverity === "all" || vuln.severity === selectedSeverity;
    const statusMatch = selectedStatus === "all" || vuln.status === selectedStatus;
    return severityMatch && statusMatch;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" };
      case "high":
        return { text: "text-orange-400", bg: "bg-orange-500/20", border: "border-orange-500/30" };
      case "medium":
        return { text: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" };
      case "low":
        return { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" };
      default:
        return { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30" };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Open</Badge>;
      case "fixed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Fixed</Badge>;
      case "ignored":
        return <Badge className="bg-zinc-500/20 text-zinc-400 border-zinc-500/30">Ignored</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const stats = [
    { 
      label: "Total Vulnerabilities", 
      value: vulnerabilities.length.toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-pink-500/20",
      icon: Shield
    },
    { 
      label: "Critical", 
      value: vulnerabilities.filter(v => v.severity === "critical").length.toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-orange-500/20",
      icon: XCircle
    },
    { 
      label: "Fixed This Week", 
      value: vulnerabilities.filter(v => v.status === "fixed").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
    },
    { 
      label: "Avg. CVSS Score", 
      value: "7.2", 
      color: "text-orange-400",
      bg: "from-orange-500/20 to-yellow-500/20",
      icon: TrendingUp
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
              <Shield className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Vulnerabilities
              </h1>
              <p className="text-zinc-400">Manage and track security vulnerabilities</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Search className="w-4 h-4 mr-2" />
              Scan Now
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

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row gap-4"
      >
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-400">Severity:</span>
          <div className="flex gap-2">
            {(["all", "critical", "high", "medium", "low"] as const).map((severity) => (
              <Button
                key={severity}
                variant={selectedSeverity === severity ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedSeverity(severity)}
                className={selectedSeverity === severity 
                  ? "bg-blue-600 text-white" 
                  : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                }
              >
                {severity.charAt(0).toUpperCase() + severity.slice(1)}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-400">Status:</span>
          <div className="flex gap-2">
            {(["all", "open", "fixed", "ignored"] as const).map((status) => (
              <Button
                key={status}
                variant={selectedStatus === status ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedStatus(status)}
                className={selectedStatus === status 
                  ? "bg-blue-600 text-white" 
                  : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
                }
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Vulnerabilities List */}
      <div className="space-y-3">
        {filteredVulnerabilities.map((vuln, index) => {
          const severityColor = getSeverityColor(vuln.severity);
          return (
            <motion.div
              key={vuln.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            >
              <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div className={`p-2.5 rounded-lg bg-gradient-to-br ${severityColor.bg} border ${severityColor.border} mt-1`}>
                        <AlertTriangle className={`w-5 h-5 ${severityColor.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                            {vuln.title}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                            {vuln.id}
                          </Badge>
                          <Badge className={`text-xs ${severityColor.bg} ${severityColor.text} ${severityColor.border}`}>
                            {vuln.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                            {vuln.repository}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <Clock className="w-3 h-3" />
                            {vuln.discovered}
                          </div>
                        </div>
                        <p className="text-sm text-zinc-400 mb-2">{vuln.description}</p>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>Package: <span className="text-zinc-400">{vuln.package}</span></span>
                          <span>•</span>
                          <span>CVSS Score: <span className={`font-semibold ${severityColor.text}`}>{vuln.cvss}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      {getStatusBadge(vuln.status)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredVulnerabilities.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <Shield className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-zinc-400 font-medium">No vulnerabilities found</p>
              <p className="text-sm text-zinc-500 mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
