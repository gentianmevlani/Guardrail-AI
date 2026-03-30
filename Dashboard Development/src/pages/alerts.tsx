"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Bell, AlertTriangle, Info, CheckCircle, XCircle, Clock, Filter, Archive, Trash2 } from "lucide-react";
import { motion } from "motion/react";

export function AlertsPage() {
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "critical" | "warning" | "info">("all");
  const [selectedStatus, setSelectedStatus] = useState<"all" | "active" | "acknowledged" | "resolved">("all");

  const alerts = [
    {
      id: "ALT-1234",
      title: "Critical vulnerability detected in auth-service",
      description: "CVE-2024-1234: SQL Injection in authentication module requires immediate attention",
      severity: "critical",
      status: "active",
      timestamp: "5 minutes ago",
      repository: "auth-service",
      type: "Security",
      assignedTo: "Security Team",
    },
    {
      id: "ALT-1233",
      title: "High memory usage detected",
      description: "Backend API service memory usage exceeded 90% threshold",
      severity: "warning",
      status: "acknowledged",
      timestamp: "15 minutes ago",
      repository: "backend-api",
      type: "Performance",
      assignedTo: "DevOps Team",
    },
    {
      id: "ALT-1232",
      title: "Scan completed successfully",
      description: "Full security scan completed for frontend-app with 19 findings",
      severity: "info",
      status: "resolved",
      timestamp: "1 hour ago",
      repository: "frontend-app",
      type: "System",
      assignedTo: "N/A",
    },
    {
      id: "ALT-1231",
      title: "Multiple high-severity vulnerabilities found",
      description: "7 high-severity vulnerabilities detected in mobile-app dependencies",
      severity: "critical",
      status: "active",
      timestamp: "2 hours ago",
      repository: "mobile-app",
      type: "Security",
      assignedTo: "Mobile Team",
    },
    {
      id: "ALT-1230",
      title: "Code quality threshold not met",
      description: "Code coverage dropped below 80% in api-gateway",
      severity: "warning",
      status: "acknowledged",
      timestamp: "3 hours ago",
      repository: "api-gateway",
      type: "Quality",
      assignedTo: "Backend Team",
    },
    {
      id: "ALT-1229",
      title: "Dependency update available",
      description: "Security patch available for lodash@4.17.15",
      severity: "info",
      status: "active",
      timestamp: "4 hours ago",
      repository: "data-service",
      type: "Maintenance",
      assignedTo: "N/A",
    },
    {
      id: "ALT-1228",
      title: "License compliance issue detected",
      description: "GPL-licensed dependency found in commercial project",
      severity: "critical",
      status: "active",
      timestamp: "5 hours ago",
      repository: "frontend-app",
      type: "Compliance",
      assignedTo: "Legal Team",
    },
    {
      id: "ALT-1227",
      title: "Build failed for main branch",
      description: "CI/CD pipeline failed due to test failures",
      severity: "warning",
      status: "resolved",
      timestamp: "6 hours ago",
      repository: "backend-api",
      type: "System",
      assignedTo: "Backend Team",
    },
    {
      id: "ALT-1226",
      title: "Rate limit threshold exceeded",
      description: "API rate limit reached 95% of quota",
      severity: "warning",
      status: "acknowledged",
      timestamp: "8 hours ago",
      repository: "api-gateway",
      type: "Performance",
      assignedTo: "Platform Team",
    },
    {
      id: "ALT-1225",
      title: "Security scan scheduled",
      description: "Weekly security scan will run in 1 hour",
      severity: "info",
      status: "active",
      timestamp: "12 hours ago",
      repository: "All Repositories",
      type: "System",
      assignedTo: "N/A",
    },
  ];

  const filteredAlerts = alerts.filter(alert => {
    const severityMatch = selectedSeverity === "all" || alert.severity === selectedSeverity;
    const statusMatch = selectedStatus === "all" || alert.status === selectedStatus;
    return severityMatch && statusMatch;
  });

  const getSeverityConfig = (severity: string) => {
    switch (severity) {
      case "critical":
        return { 
          icon: XCircle, 
          text: "text-red-400", 
          bg: "bg-red-500/20", 
          border: "border-red-500/30",
          gradient: "from-red-500/20 to-pink-500/20"
        };
      case "warning":
        return { 
          icon: AlertTriangle, 
          text: "text-yellow-400", 
          bg: "bg-yellow-500/20", 
          border: "border-yellow-500/30",
          gradient: "from-yellow-500/20 to-orange-500/20"
        };
      case "info":
        return { 
          icon: Info, 
          text: "text-blue-400", 
          bg: "bg-blue-500/20", 
          border: "border-blue-500/30",
          gradient: "from-blue-500/20 to-cyan-500/20"
        };
      default:
        return { 
          icon: Bell, 
          text: "text-zinc-400", 
          bg: "bg-zinc-500/20", 
          border: "border-zinc-500/30",
          gradient: "from-zinc-500/20 to-zinc-600/20"
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Active</Badge>;
      case "acknowledged":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Acknowledged</Badge>;
      case "resolved":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Resolved</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const stats = [
    { 
      label: "Total Alerts", 
      value: alerts.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Bell
    },
    { 
      label: "Critical", 
      value: alerts.filter(a => a.severity === "critical").length.toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-pink-500/20",
      icon: XCircle
    },
    { 
      label: "Active", 
      value: alerts.filter(a => a.status === "active").length.toString(), 
      color: "text-yellow-400",
      bg: "from-yellow-500/20 to-orange-500/20",
      icon: AlertTriangle
    },
    { 
      label: "Resolved Today", 
      value: alerts.filter(a => a.status === "resolved").length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30">
              <Bell className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                Alerts
              </h1>
              <p className="text-zinc-400">Monitor and manage security alerts</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <Archive className="w-4 h-4 mr-2" />
              Archive All
            </Button>
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
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
            {(["all", "critical", "warning", "info"] as const).map((severity) => (
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
            {(["all", "active", "acknowledged", "resolved"] as const).map((status) => (
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

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.map((alert, index) => {
          const severityConfig = getSeverityConfig(alert.severity);
          const SeverityIcon = severityConfig.icon;
          
          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            >
              <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all cursor-pointer group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-lg bg-gradient-to-br ${severityConfig.gradient} border ${severityConfig.border} mt-1`}>
                      <SeverityIcon className={`w-5 h-5 ${severityConfig.text}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                              {alert.title}
                            </h3>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                              {alert.id}
                            </Badge>
                            <Badge className={`text-xs ${severityConfig.bg} ${severityConfig.text} ${severityConfig.border}`}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                              {alert.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-400">
                              {alert.repository}
                            </Badge>
                          </div>
                          <p className="text-sm text-zinc-400 mb-3">{alert.description}</p>
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {alert.timestamp}
                            </div>
                            <span>•</span>
                            <span>Assigned to: <span className="text-zinc-400">{alert.assignedTo}</span></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          {getStatusBadge(alert.status)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pt-3 border-t border-zinc-800">
                        <Button variant="ghost" size="sm" className="h-8 text-emerald-400 hover:text-emerald-300">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Resolve
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-blue-400 hover:text-blue-300">
                          Acknowledge
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-zinc-400 hover:text-zinc-300">
                          <Archive className="w-3 h-3 mr-1" />
                          Archive
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-400 hover:text-red-300 ml-auto">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredAlerts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-zinc-400 font-medium">No alerts found</p>
              <p className="text-sm text-zinc-500 mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
