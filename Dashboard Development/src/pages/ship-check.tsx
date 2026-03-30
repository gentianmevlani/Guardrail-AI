"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Rocket, CheckCircle, AlertTriangle, Clock, Play, Loader2, GitBranch, Shield, TrendingUp, Code, Package, Users } from "lucide-react";
import { motion } from "motion/react";

export function ShipCheckPage() {
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"pass" | "fail" | null>(null);

  const runShipCheck = () => {
    setIsChecking(true);
    setCheckResult(null);
    
    setTimeout(() => {
      setIsChecking(false);
      setCheckResult(Math.random() > 0.3 ? "pass" : "fail");
    }, 3000);
  };

  const checks = [
    { name: "Security Vulnerabilities", status: checkResult === "pass" ? "pass" : checkResult === "fail" ? "fail" : "pending", critical: true, description: "No critical security issues found" },
    { name: "Code Quality Gates", status: checkResult === "pass" ? "pass" : checkResult === "fail" ? "warning" : "pending", critical: false, description: "Meets quality standards" },
    { name: "Test Coverage", status: checkResult === "pass" ? "pass" : checkResult === "fail" ? "pass" : "pending", critical: false, description: "85% coverage achieved" },
    { name: "Dependencies Check", status: checkResult === "pass" ? "pass" : checkResult === "fail" ? "pass" : "pending", critical: true, description: "All dependencies up to date" },
    { name: "License Compliance", status: checkResult === "pass" ? "pass" : checkResult === "fail" ? "pass" : "pending", critical: true, description: "MIT license compliant" },
    { name: "Build Process", status: checkResult === "pass" ? "pass" : checkResult === "fail" ? "pass" : "pending", critical: false, description: "Build successful" },
  ];

  const stats = [
    { label: "Total Checks", value: "6", icon: Shield, color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/20" },
    { label: "Critical Checks", value: "3", icon: AlertTriangle, color: "text-red-400", bg: "from-red-500/20 to-orange-500/20" },
    { label: "Pass Rate", value: "100%", icon: TrendingUp, color: "text-emerald-400", bg: "from-emerald-500/20 to-green-500/20" },
    { label: "Last Run", value: "2h ago", icon: Clock, color: "text-purple-400", bg: "from-purple-500/20 to-pink-500/20" },
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
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30">
            <Rocket className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Ship Check
            </h1>
            <p className="text-zinc-400">Pre-deployment validation and quality gates</p>
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

      {/* Ship Check Action Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  {checkResult === "pass" && <CheckCircle className="w-5 h-5 text-emerald-400" />}
                  {checkResult === "fail" && <AlertTriangle className="w-5 h-5 text-red-400" />}
                  {!checkResult && <GitBranch className="w-5 h-5 text-blue-400" />}
                  Ready to Ship?
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Run comprehensive checks before deployment
                </CardDescription>
              </div>
              <Button
                onClick={runShipCheck}
                disabled={isChecking}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20"
              >
                {isChecking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Ship Check
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {(isChecking || checkResult) && (
            <CardContent>
              <div className="space-y-3">
                {checks.map((check, index) => (
                  <motion.div
                    key={check.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {check.status === "pass" && (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      )}
                      {check.status === "fail" && (
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      )}
                      {check.status === "warning" && (
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      )}
                      {check.status === "pending" && (
                        <Clock className="w-5 h-5 text-zinc-500" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white">{check.name}</p>
                          {check.critical && (
                            <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-400">
                              Critical
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{check.description}</p>
                      </div>
                    </div>
                    <Badge
                      variant={
                        check.status === "pass"
                          ? "default"
                          : check.status === "fail"
                          ? "destructive"
                          : "secondary"
                      }
                      className={
                        check.status === "pass"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : check.status === "warning"
                          ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          : ""
                      }
                    >
                      {check.status === "pending" ? "Pending" : check.status.toUpperCase()}
                    </Badge>
                  </motion.div>
                ))}
              </div>

              {checkResult && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 }}
                  className={`mt-6 p-4 rounded-lg border ${
                    checkResult === "pass"
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : "bg-red-500/10 border-red-500/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {checkResult === "pass" ? (
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-400" />
                    )}
                    <div>
                      <p className={`font-semibold ${checkResult === "pass" ? "text-emerald-400" : "text-red-400"}`}>
                        {checkResult === "pass" ? "Ready to Ship! 🚀" : "Not Ready to Ship"}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {checkResult === "pass"
                          ? "All critical checks passed. Safe to deploy."
                          : "Critical issues found. Please fix before deploying."}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
            </CardContent>
          )}
        </Card>
      </motion.div>

      {/* Recent Deployments */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Recent Deployments
            </CardTitle>
            <CardDescription className="text-zinc-400">
              History of your ship checks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { repo: "frontend-app", result: "pass", time: "2 hours ago", checks: "6/6" },
                { repo: "backend-api", result: "pass", time: "5 hours ago", checks: "6/6" },
                { repo: "mobile-app", result: "fail", time: "1 day ago", checks: "4/6" },
              ].map((deployment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50"
                >
                  <div className="flex items-center gap-3">
                    {deployment.result === "pass" ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-white">{deployment.repo}</p>
                      <p className="text-xs text-zinc-500">{deployment.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">
                      {deployment.checks}
                    </Badge>
                    <Badge
                      className={
                        deployment.result === "pass"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/20 text-red-400 border-red-500/30"
                      }
                    >
                      {deployment.result.toUpperCase()}
                    </Badge>
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