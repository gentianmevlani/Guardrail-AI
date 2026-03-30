"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { History, CheckCircle, XCircle, Clock, Play, AlertTriangle, Filter, TrendingUp, Activity, Download } from "lucide-react";
import { motion } from "motion/react";

export function RunsPage() {
  const [selectedFilter, setSelectedFilter] = useState<"all" | "success" | "failed" | "running">("all");

  const runs = [
    {
      id: "RUN-1234",
      type: "Full Scan",
      status: "success",
      duration: "2m 34s",
      timestamp: "5 minutes ago",
      findings: { critical: 0, high: 2, medium: 5, low: 12 },
      repo: "frontend-app",
    },
    {
      id: "RUN-1233",
      type: "Security Scan",
      status: "running",
      duration: "1m 12s",
      timestamp: "Running",
      findings: { critical: 0, high: 0, medium: 0, low: 0 },
      repo: "backend-api",
    },
    {
      id: "RUN-1232",
      type: "Ship Check",
      status: "failed",
      duration: "1m 45s",
      timestamp: "1 hour ago",
      findings: { critical: 3, high: 7, medium: 4, low: 8 },
      repo: "mobile-app",
    },
    {
      id: "RUN-1231",
      type: "Full Scan",
      status: "success",
      duration: "3m 21s",
      timestamp: "3 hours ago",
      findings: { critical: 0, high: 1, medium: 6, low: 15 },
      repo: "api-gateway",
    },
    {
      id: "RUN-1230",
      type: "Security Scan",
      status: "success",
      duration: "1m 54s",
      timestamp: "5 hours ago",
      findings: { critical: 0, high: 0, medium: 2, low: 5 },
      repo: "data-service",
    },
    {
      id: "RUN-1229",
      type: "Ship Check",
      status: "success",
      duration: "2m 10s",
      timestamp: "8 hours ago",
      findings: { critical: 0, high: 1, medium: 3, low: 8 },
      repo: "auth-service",
    },
  ];

  const filteredRuns = selectedFilter === "all" 
    ? runs 
    : runs.filter(run => run.status === selectedFilter);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "running":
        return <Clock className="w-5 h-5 text-yellow-400 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Success</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Failed</Badge>;
      case "running":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Running</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const stats = [
    { label: "Total Runs", value: runs.length.toString(), color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/20" },
    { label: "Success Rate", value: "67%", color: "text-emerald-400", bg: "from-emerald-500/20 to-green-500/20" },
    { label: "Active Now", value: runs.filter(r => r.status === "running").length.toString(), color: "text-yellow-400", bg: "from-yellow-500/20 to-orange-500/20" },
    { label: "Failed Today", value: runs.filter(r => r.status === "failed").length.toString(), color: "text-red-400", bg: "from-red-500/20 to-pink-500/20" },
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
              <History className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                Scan Runs
              </h1>
              <p className="text-zinc-400">View and manage your scan history</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <Play className="w-4 h-4 mr-2" />
            New Scan
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
                    <Activity className={`w-5 h-5 ${stat.color}`} />
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
        className="flex items-center gap-2"
      >
        <Filter className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          {(["all", "success", "failed", "running"] as const).map((filter) => (
            <Button
              key={filter}
              variant={selectedFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter(filter)}
              className={selectedFilter === filter 
                ? "bg-blue-600 text-white" 
                : "border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600"
              }
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          ))}
        </div>
      </motion.div>

      {/* Runs List */}
      <div className="space-y-3">
        {filteredRuns.map((run, index) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + index * 0.05 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all cursor-pointer group">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(run.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white group-hover:text-blue-400 transition-colors">{run.id}</p>
                        <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                          {run.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-400">
                          {run.repo}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-500 mt-0.5">
                        {run.timestamp} • {run.duration}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    {run.status !== "running" && (
                      <div className="flex items-center gap-3 text-sm">
                        {run.findings.critical > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-red-400 font-medium">{run.findings.critical}</span>
                          </div>
                        )}
                        {run.findings.high > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-orange-400 font-medium">{run.findings.high}</span>
                          </div>
                        )}
                        {run.findings.medium > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-yellow-500" />
                            <span className="text-yellow-400 font-medium">{run.findings.medium}</span>
                          </div>
                        )}
                        {run.findings.low > 0 && (
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-blue-400 font-medium">{run.findings.low}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      {run.status !== "running" && (
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <Download className="w-4 h-4" />
                        </Button>
                      )}
                      {getStatusBadge(run.status)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Empty State */}
      {filteredRuns.length === 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <History className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
              <p className="text-zinc-400 font-medium">No runs found</p>
              <p className="text-sm text-zinc-500 mt-1">Try adjusting your filters</p>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}