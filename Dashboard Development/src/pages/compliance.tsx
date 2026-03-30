"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { FileText, CheckCircle, XCircle, Clock, Download, Shield, AlertTriangle, TrendingUp, Award } from "lucide-react";
import { motion } from "motion/react";

export function CompliancePage() {
  const [selectedFramework, setSelectedFramework] = useState<"all" | "soc2" | "gdpr" | "hipaa" | "pci">("all");

  const frameworks = [
    {
      id: "soc2",
      name: "SOC 2 Type II",
      description: "Service Organization Control 2",
      status: "compliant",
      progress: 95,
      controls: 64,
      passed: 61,
      failed: 2,
      pending: 1,
      lastAudit: "30 days ago",
      nextAudit: "In 335 days",
      certificate: "Valid until Dec 2024",
    },
    {
      id: "gdpr",
      name: "GDPR",
      description: "General Data Protection Regulation",
      status: "compliant",
      progress: 100,
      controls: 32,
      passed: 32,
      failed: 0,
      pending: 0,
      lastAudit: "15 days ago",
      nextAudit: "In 350 days",
      certificate: "Certified",
    },
    {
      id: "hipaa",
      name: "HIPAA",
      description: "Health Insurance Portability and Accountability Act",
      status: "in-progress",
      progress: 78,
      controls: 45,
      passed: 35,
      failed: 3,
      pending: 7,
      lastAudit: "60 days ago",
      nextAudit: "In 305 days",
      certificate: "In Progress",
    },
    {
      id: "pci",
      name: "PCI DSS",
      description: "Payment Card Industry Data Security Standard",
      status: "at-risk",
      progress: 65,
      controls: 78,
      passed: 51,
      failed: 8,
      pending: 19,
      lastAudit: "90 days ago",
      nextAudit: "In 275 days",
      certificate: "Expired",
    },
  ];

  const recentActivities = [
    {
      type: "passed",
      title: "Access Control Review Completed",
      framework: "SOC 2",
      timestamp: "2 hours ago",
      details: "All access controls reviewed and documented",
    },
    {
      type: "failed",
      title: "Data Encryption Gap Identified",
      framework: "PCI DSS",
      timestamp: "5 hours ago",
      details: "Database encryption at rest not fully implemented",
    },
    {
      type: "passed",
      title: "Privacy Policy Updated",
      framework: "GDPR",
      timestamp: "1 day ago",
      details: "Privacy policy updated to reflect latest regulations",
    },
    {
      type: "pending",
      title: "Security Training Pending",
      framework: "HIPAA",
      timestamp: "2 days ago",
      details: "Annual security awareness training due for 12 employees",
    },
  ];

  const requirements = [
    {
      id: "REQ-001",
      title: "Data Encryption at Rest",
      frameworks: ["SOC 2", "HIPAA", "PCI DSS"],
      status: "compliant",
      lastChecked: "1 day ago",
      severity: "critical",
    },
    {
      id: "REQ-002",
      title: "Multi-Factor Authentication",
      frameworks: ["SOC 2", "PCI DSS"],
      status: "compliant",
      lastChecked: "2 days ago",
      severity: "high",
    },
    {
      id: "REQ-003",
      title: "Access Logs and Monitoring",
      frameworks: ["SOC 2", "HIPAA"],
      status: "compliant",
      lastChecked: "1 day ago",
      severity: "high",
    },
    {
      id: "REQ-004",
      title: "Data Retention Policy",
      frameworks: ["GDPR", "HIPAA"],
      status: "non-compliant",
      lastChecked: "3 days ago",
      severity: "medium",
    },
    {
      id: "REQ-005",
      title: "Incident Response Plan",
      frameworks: ["SOC 2", "HIPAA", "PCI DSS"],
      status: "compliant",
      lastChecked: "5 days ago",
      severity: "critical",
    },
    {
      id: "REQ-006",
      title: "Vulnerability Scanning",
      frameworks: ["PCI DSS"],
      status: "non-compliant",
      lastChecked: "1 week ago",
      severity: "high",
    },
  ];

  const filteredFrameworks = selectedFramework === "all"
    ? frameworks
    : frameworks.filter(f => f.id === selectedFramework);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "compliant":
        return { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30", icon: CheckCircle };
      case "in-progress":
        return { text: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30", icon: Clock };
      case "at-risk":
        return { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30", icon: AlertTriangle };
      default:
        return { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30", icon: XCircle };
    }
  };

  const stats = [
    { 
      label: "Frameworks", 
      value: frameworks.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: FileText
    },
    { 
      label: "Compliant", 
      value: frameworks.filter(f => f.status === "compliant").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
    },
    { 
      label: "Total Controls", 
      value: frameworks.reduce((sum, f) => sum + f.controls, 0).toString(), 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: Shield
    },
    { 
      label: "Avg. Progress", 
      value: Math.round(frameworks.reduce((sum, f) => sum + f.progress, 0) / frameworks.length).toString() + "%", 
      color: "text-cyan-400",
      bg: "from-cyan-500/20 to-blue-500/20",
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <FileText className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Compliance
              </h1>
              <p className="text-zinc-400">Track regulatory compliance and certifications</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <Download className="w-4 h-4 mr-2" />
            Export Report
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

      {/* Framework Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2"
      >
        <Shield className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          {(["all", "soc2", "gdpr", "hipaa", "pci"] as const).map((framework) => (
            <Button
              key={framework}
              variant={selectedFramework === framework ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFramework(framework)}
              className={selectedFramework === framework 
                ? "bg-blue-600 text-white" 
                : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
              }
            >
              {framework === "all" ? "All" : framework.toUpperCase()}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Compliance Frameworks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredFrameworks.map((framework, index) => {
          const statusConfig = getStatusColor(framework.status);
          const StatusIcon = statusConfig.icon;
          
          return (
            <motion.div
              key={framework.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            >
              <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${statusConfig.bg} border ${statusConfig.border}`}>
                        <Award className={`w-5 h-5 ${statusConfig.text}`} />
                      </div>
                      <div>
                        <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                          {framework.name}
                        </CardTitle>
                        <CardDescription className="text-zinc-400 text-sm">
                          {framework.description}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={`${statusConfig.bg} ${statusConfig.text} ${statusConfig.border} flex items-center gap-1`}>
                      <StatusIcon className="w-3 h-3" />
                      {framework.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-zinc-400">Compliance Progress</span>
                      <span className={`text-sm font-semibold ${
                        framework.progress >= 90 ? "text-emerald-400" :
                        framework.progress >= 70 ? "text-yellow-400" :
                        "text-red-400"
                      }`}>
                        {framework.progress}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          framework.progress >= 90 ? "bg-gradient-to-r from-emerald-500 to-green-500" :
                          framework.progress >= 70 ? "bg-gradient-to-r from-yellow-500 to-orange-500" :
                          "bg-gradient-to-r from-red-500 to-pink-500"
                        }`}
                        style={{ width: `${framework.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Controls Summary */}
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Total</p>
                      <p className="text-sm font-semibold text-white">{framework.controls}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Passed</p>
                      <p className="text-sm font-semibold text-emerald-400">{framework.passed}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Failed</p>
                      <p className="text-sm font-semibold text-red-400">{framework.failed}</p>
                    </div>
                    <div className="text-center p-2 rounded bg-zinc-800/50">
                      <p className="text-xs text-zinc-500">Pending</p>
                      <p className="text-sm font-semibold text-yellow-400">{framework.pending}</p>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 text-xs text-zinc-500">
                    <div className="flex items-center justify-between">
                      <span>Last Audit:</span>
                      <span className="text-zinc-400">{framework.lastAudit}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Next Audit:</span>
                      <span className="text-zinc-400">{framework.nextAudit}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Certificate:</span>
                      <span className="text-zinc-400">{framework.certificate}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 border-t border-zinc-800">
                    <Button variant="outline" size="sm" className="flex-1 border-zinc-700 text-zinc-400 hover:text-white">
                      View Controls
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1 border-zinc-700 text-zinc-400 hover:text-white">
                      <Download className="w-3 h-3 mr-1" />
                      Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Requirements Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Compliance Requirements</CardTitle>
            <CardDescription className="text-zinc-400">
              Cross-framework compliance requirements and status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requirements.map((req, index) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {req.status === "compliant" ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white">{req.title}</p>
                        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {req.id}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.frameworks.map((framework) => (
                          <Badge key={framework} variant="outline" className="text-[10px] border-blue-500/50 text-blue-400">
                            {framework}
                          </Badge>
                        ))}
                        <span className="text-xs text-zinc-500">• Checked {req.lastChecked}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className={req.status === "compliant" 
                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                    : "bg-red-500/20 text-red-400 border-red-500/30"
                  }>
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Activity</CardTitle>
            <CardDescription className="text-zinc-400">
              Latest compliance checks and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  {activity.type === "passed" && <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5" />}
                  {activity.type === "failed" && <XCircle className="w-5 h-5 text-red-400 mt-0.5" />}
                  {activity.type === "pending" && <Clock className="w-5 h-5 text-yellow-400 mt-0.5" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-white">{activity.title}</p>
                      <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                        {activity.framework}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mb-1">{activity.details}</p>
                    <p className="text-xs text-zinc-500">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
