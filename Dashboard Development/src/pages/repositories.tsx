"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Folder, Star, GitBranch, Code, AlertTriangle, CheckCircle, Plus, Search, TrendingUp, Activity } from "lucide-react";
import { motion } from "motion/react";

export function RepositoriesPage() {
  const [selectedFilter, setSelectedFilter] = useState<"all" | "active" | "archived">("all");

  const repositories = [
    {
      name: "frontend-app",
      description: "React-based frontend application",
      language: "TypeScript",
      stars: 342,
      branches: 12,
      lastScan: "5 minutes ago",
      status: "healthy",
      vulnerabilities: { critical: 0, high: 2, medium: 5, low: 12 },
      healthScore: 92,
      isActive: true,
    },
    {
      name: "backend-api",
      description: "Node.js REST API service",
      language: "JavaScript",
      stars: 215,
      branches: 8,
      lastScan: "1 hour ago",
      status: "warning",
      vulnerabilities: { critical: 1, high: 3, medium: 4, low: 8 },
      healthScore: 78,
      isActive: true,
    },
    {
      name: "mobile-app",
      description: "React Native mobile application",
      language: "TypeScript",
      stars: 189,
      branches: 15,
      lastScan: "3 hours ago",
      status: "critical",
      vulnerabilities: { critical: 3, high: 7, medium: 4, low: 8 },
      healthScore: 45,
      isActive: true,
    },
    {
      name: "data-service",
      description: "Python data processing service",
      language: "Python",
      stars: 128,
      branches: 6,
      lastScan: "2 hours ago",
      status: "healthy",
      vulnerabilities: { critical: 0, high: 0, medium: 2, low: 5 },
      healthScore: 95,
      isActive: true,
    },
    {
      name: "auth-service",
      description: "Authentication and authorization service",
      language: "Go",
      stars: 276,
      branches: 10,
      lastScan: "30 minutes ago",
      status: "healthy",
      vulnerabilities: { critical: 0, high: 1, medium: 3, low: 8 },
      healthScore: 88,
      isActive: true,
    },
    {
      name: "api-gateway",
      description: "API gateway and routing service",
      language: "TypeScript",
      stars: 198,
      branches: 9,
      lastScan: "4 hours ago",
      status: "warning",
      vulnerabilities: { critical: 0, high: 2, medium: 6, low: 15 },
      healthScore: 82,
      isActive: true,
    },
    {
      name: "legacy-app",
      description: "Legacy monolith application",
      language: "Java",
      stars: 45,
      branches: 3,
      lastScan: "2 days ago",
      status: "critical",
      vulnerabilities: { critical: 5, high: 12, medium: 18, low: 25 },
      healthScore: 32,
      isActive: false,
    },
  ];

  const filteredRepos = repositories.filter(repo => {
    if (selectedFilter === "all") return true;
    if (selectedFilter === "active") return repo.isActive;
    if (selectedFilter === "archived") return !repo.isActive;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return { text: "text-emerald-400", bg: "bg-emerald-500/20", border: "border-emerald-500/30" };
      case "warning":
        return { text: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" };
      case "critical":
        return { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" };
      default:
        return { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30" };
    }
  };

  const getLanguageColor = (language: string) => {
    const colors: Record<string, string> = {
      TypeScript: "bg-blue-500",
      JavaScript: "bg-yellow-500",
      Python: "bg-green-500",
      Go: "bg-cyan-500",
      Java: "bg-orange-500",
    };
    return colors[language] || "bg-zinc-500";
  };

  const stats = [
    { 
      label: "Total Repositories", 
      value: repositories.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: Folder
    },
    { 
      label: "Active", 
      value: repositories.filter(r => r.isActive).length.toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: CheckCircle
    },
    { 
      label: "Critical Issues", 
      value: repositories.reduce((sum, r) => sum + r.vulnerabilities.critical, 0).toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-pink-500/20",
      icon: AlertTriangle
    },
    { 
      label: "Avg. Health Score", 
      value: Math.round(repositories.reduce((sum, r) => sum + r.healthScore, 0) / repositories.length).toString(), 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
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
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30">
              <Folder className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Repositories
              </h1>
              <p className="text-zinc-400">Manage and monitor your repositories</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600">
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
              <Plus className="w-4 h-4 mr-2" />
              Add Repository
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
        className="flex items-center gap-2"
      >
        <Activity className="w-4 h-4 text-zinc-500" />
        <div className="flex gap-2">
          {(["all", "active", "archived"] as const).map((filter) => (
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

      {/* Repository Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRepos.map((repo, index) => {
          const statusColor = getStatusColor(repo.status);
          return (
            <motion.div
              key={repo.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + index * 0.05 }}
            >
              <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all cursor-pointer group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Folder className="w-5 h-5 text-purple-400" />
                        <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                          {repo.name}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-zinc-400 text-sm">
                        {repo.description}
                      </CardDescription>
                    </div>
                    <Badge className={`${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
                      {repo.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Language & Stats */}
                  <div className="flex items-center gap-4 text-sm text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3 h-3 rounded-full ${getLanguageColor(repo.language)}`} />
                      <span>{repo.language}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4" />
                      <span>{repo.stars}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GitBranch className="w-4 h-4" />
                      <span>{repo.branches}</span>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-zinc-400">Health Score</span>
                      <span className={`text-sm font-semibold ${
                        repo.healthScore >= 80 ? "text-emerald-400" :
                        repo.healthScore >= 60 ? "text-yellow-400" :
                        "text-red-400"
                      }`}>
                        {repo.healthScore}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          repo.healthScore >= 80 ? "bg-gradient-to-r from-emerald-500 to-green-500" :
                          repo.healthScore >= 60 ? "bg-gradient-to-r from-yellow-500 to-orange-500" :
                          "bg-gradient-to-r from-red-500 to-pink-500"
                        }`}
                        style={{ width: `${repo.healthScore}%` }}
                      />
                    </div>
                  </div>

                  {/* Vulnerabilities */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-zinc-400">Vulnerabilities</span>
                    <div className="flex items-center gap-2 text-sm">
                      {repo.vulnerabilities.critical > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-red-400 font-medium">{repo.vulnerabilities.critical}</span>
                        </div>
                      )}
                      {repo.vulnerabilities.high > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-orange-500" />
                          <span className="text-orange-400 font-medium">{repo.vulnerabilities.high}</span>
                        </div>
                      )}
                      {repo.vulnerabilities.medium > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-500" />
                          <span className="text-yellow-400 font-medium">{repo.vulnerabilities.medium}</span>
                        </div>
                      )}
                      {repo.vulnerabilities.low > 0 && (
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="text-blue-400 font-medium">{repo.vulnerabilities.low}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Last Scan */}
                  <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
                    <span className="text-xs text-zinc-500">Last scan: {repo.lastScan}</span>
                    <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300">
                      View Details
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
