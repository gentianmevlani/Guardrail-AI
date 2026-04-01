"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Brain, Shield, Building2, Package, Users, LineChart, TrendingUp, Activity, Zap } from "lucide-react";
import { motion } from "motion/react";

export function IntelligencePage() {
  const suites = [
    {
      title: "AI Analysis",
      description: "Intelligent code analysis and recommendations",
      icon: Brain,
      color: "from-purple-500 to-pink-500",
      stats: { insights: 127, accuracy: "94%" },
      badge: "NEW",
    },
    {
      title: "Security Intelligence",
      description: "Advanced threat detection and vulnerability analysis",
      icon: Shield,
      color: "from-blue-500 to-cyan-500",
      stats: { threats: 3, score: "A" },
    },
    {
      title: "Architecture",
      description: "System design patterns and structure analysis",
      icon: Building2,
      color: "from-green-500 to-emerald-500",
      stats: { components: 42, complexity: "Medium" },
    },
    {
      title: "Supply Chain",
      description: "Dependency risk and supply chain security",
      icon: Package,
      color: "from-orange-500 to-amber-500",
      stats: { dependencies: 156, risks: 5 },
    },
    {
      title: "Team Analytics",
      description: "Collaboration patterns and team productivity",
      icon: Users,
      color: "from-indigo-500 to-blue-500",
      stats: { contributors: 12, velocity: "+15%" },
    },
    {
      title: "Predictive Analysis",
      description: "Forecast trends and potential issues",
      icon: LineChart,
      color: "from-cyan-500 to-teal-500",
      stats: { predictions: 8, confidence: "87%" },
    },
  ];

  const recentInsights = [
    { text: "Security vulnerability pattern detected in authentication flow", severity: "high", suite: "Security" },
    { text: "Code duplication identified across 3 modules", severity: "medium", suite: "AI Analysis" },
    { text: "Deprecated dependency detected: lodash@3.x", severity: "high", suite: "Supply Chain" },
    { text: "Team velocity increased by 15% this sprint", severity: "info", suite: "Team" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Intelligence Hub
            </h1>
            <p className="text-zinc-400">AI-powered insights and analytics</p>
          </div>
        </div>
      </motion.div>

      {/* Intelligence Suites Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suites.map((suite, index) => (
          <motion.div
            key={suite.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl hover:border-zinc-700 transition-all cursor-pointer group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${suite.color} bg-opacity-20 border border-opacity-30`}>
                    <suite.icon className="w-5 h-5 text-white" />
                  </div>
                  {suite.badge && (
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                      {suite.badge}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-white group-hover:text-blue-400 transition-colors">
                  {suite.title}
                </CardTitle>
                <CardDescription className="text-zinc-400 text-sm">
                  {suite.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  {Object.entries(suite.stats).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-zinc-500 text-xs uppercase">{key}</p>
                      <p className="text-white font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Insights */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <CardTitle className="text-white">Recent Insights</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Latest findings from intelligence suites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInsights.map((insight, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8 + index * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <Activity className={`w-5 h-5 mt-0.5 ${
                    insight.severity === "high" ? "text-red-400" :
                    insight.severity === "medium" ? "text-yellow-400" :
                    "text-blue-400"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-white">{insight.text}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                        {insight.suite}
                      </Badge>
                      <Badge
                        variant={insight.severity === "high" ? "destructive" : "secondary"}
                        className={
                          insight.severity === "medium"
                            ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                            : insight.severity === "info"
                            ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                            : ""
                        }
                      >
                        {insight.severity}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
