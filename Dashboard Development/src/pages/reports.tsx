"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { FileText, Download, Calendar, TrendingUp, BarChart3, PieChart, Share2, Mail } from "lucide-react";
import { motion } from "motion/react";

export function ReportsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<"week" | "month" | "quarter">("month");

  const reports = [
    {
      id: "RPT-2024-001",
      title: "Monthly Security Assessment",
      type: "Security",
      period: "January 2024",
      generatedDate: "2024-01-31",
      status: "completed",
      findings: { critical: 4, high: 12, medium: 23, low: 45 },
      pages: 48,
      format: "PDF",
    },
    {
      id: "RPT-2024-002",
      title: "Compliance Audit Report",
      type: "Compliance",
      period: "Q1 2024",
      generatedDate: "2024-01-30",
      status: "completed",
      findings: { critical: 2, high: 5, medium: 8, low: 12 },
      pages: 32,
      format: "PDF",
    },
    {
      id: "RPT-2024-003",
      title: "Vulnerability Trend Analysis",
      type: "Analytics",
      period: "January 2024",
      generatedDate: "2024-01-29",
      status: "completed",
      findings: { critical: 1, high: 3, medium: 15, low: 28 },
      pages: 24,
      format: "PDF",
    },
    {
      id: "RPT-2024-004",
      title: "Code Quality Metrics",
      type: "Quality",
      period: "Week 4, January 2024",
      generatedDate: "2024-01-28",
      status: "completed",
      findings: { critical: 0, high: 4, medium: 12, low: 19 },
      pages: 16,
      format: "PDF",
    },
    {
      id: "RPT-2024-005",
      title: "Executive Summary Report",
      type: "Executive",
      period: "January 2024",
      generatedDate: "2024-01-27",
      status: "completed",
      findings: { critical: 3, high: 8, medium: 18, low: 32 },
      pages: 8,
      format: "PDF",
    },
    {
      id: "RPT-2024-006",
      title: "Weekly Security Scan",
      type: "Security",
      period: "Week 3, January 2024",
      generatedDate: "In Progress",
      status: "generating",
      findings: { critical: 0, high: 0, medium: 0, low: 0 },
      pages: 0,
      format: "PDF",
    },
  ];

  const reportTemplates = [
    {
      name: "Security Assessment",
      description: "Comprehensive security vulnerability analysis",
      icon: FileText,
      color: "from-red-500 to-orange-500",
      metrics: ["Vulnerabilities", "CVSS Scores", "Remediation"],
    },
    {
      name: "Compliance Report",
      description: "Regulatory compliance and audit documentation",
      icon: BarChart3,
      color: "from-blue-500 to-cyan-500",
      metrics: ["Standards", "Controls", "Evidence"],
    },
    {
      name: "Executive Summary",
      description: "High-level overview for stakeholders",
      icon: TrendingUp,
      color: "from-purple-500 to-pink-500",
      metrics: ["KPIs", "Trends", "Recommendations"],
    },
    {
      name: "Custom Report",
      description: "Build your own custom report",
      icon: PieChart,
      color: "from-green-500 to-emerald-500",
      metrics: ["Flexible", "Templates", "Widgets"],
    },
  ];

  const getTypeColor = (type: string) => {
    const colors: Record<string, { text: string; bg: string; border: string }> = {
      Security: { text: "text-red-400", bg: "bg-red-500/20", border: "border-red-500/30" },
      Compliance: { text: "text-blue-400", bg: "bg-blue-500/20", border: "border-blue-500/30" },
      Analytics: { text: "text-purple-400", bg: "bg-purple-500/20", border: "border-purple-500/30" },
      Quality: { text: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
      Executive: { text: "text-cyan-400", bg: "bg-cyan-500/20", border: "border-cyan-500/30" },
    };
    return colors[type] || { text: "text-zinc-400", bg: "bg-zinc-500/20", border: "border-zinc-500/30" };
  };

  const stats = [
    { 
      label: "Total Reports", 
      value: reports.length.toString(), 
      color: "text-blue-400",
      bg: "from-blue-500/20 to-cyan-500/20",
      icon: FileText
    },
    { 
      label: "This Month", 
      value: reports.filter(r => r.period.includes("January")).length.toString(), 
      color: "text-purple-400",
      bg: "from-purple-500/20 to-pink-500/20",
      icon: Calendar
    },
    { 
      label: "Critical Findings", 
      value: reports.reduce((sum, r) => sum + r.findings.critical, 0).toString(), 
      color: "text-red-400",
      bg: "from-red-500/20 to-orange-500/20",
      icon: TrendingUp
    },
    { 
      label: "Avg. Pages", 
      value: Math.round(reports.reduce((sum, r) => sum + r.pages, 0) / reports.filter(r => r.status === "completed").length).toString(), 
      color: "text-emerald-400",
      bg: "from-emerald-500/20 to-green-500/20",
      icon: BarChart3
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
                Reports
              </h1>
              <p className="text-zinc-400">Generate and manage security reports</p>
            </div>
          </div>
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-500/20">
            <FileText className="w-4 h-4 mr-2" />
            Generate Report
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

      {/* Report Templates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Report Templates</CardTitle>
            <CardDescription className="text-zinc-400">
              Choose a template to generate a new report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {reportTemplates.map((template, index) => (
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
                  <p className="text-xs text-zinc-400 mb-3">{template.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.metrics.map((metric) => (
                      <Badge key={metric} variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                        {metric}
                      </Badge>
                    ))}
                  </div>
                </motion.button>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Reports */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="border-zinc-800 bg-zinc-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Recent Reports</CardTitle>
            <CardDescription className="text-zinc-400">
              Your recently generated reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report, index) => {
                const typeColor = getTypeColor(report.type);
                return (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-700/50 hover:border-zinc-600/50 transition-all group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2.5 rounded-lg ${typeColor.bg} border ${typeColor.border}`}>
                        <FileText className={`w-5 h-5 ${typeColor.text}`} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors">
                            {report.title}
                          </h3>
                          <Badge className={`text-xs ${typeColor.bg} ${typeColor.text} ${typeColor.border}`}>
                            {report.type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-zinc-500">
                          <span>{report.period}</span>
                          <span>•</span>
                          <span>{report.pages} pages</span>
                          <span>•</span>
                          <span>Generated: {report.generatedDate}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {report.status === "completed" && (
                        <>
                          <div className="flex items-center gap-2 text-sm mr-4">
                            {report.findings.critical > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-red-400 font-medium">{report.findings.critical}</span>
                              </div>
                            )}
                            {report.findings.high > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-full bg-orange-500" />
                                <span className="text-orange-400 font-medium">{report.findings.high}</span>
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Share2 className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Mail className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm" className="border-zinc-600 text-zinc-400 hover:text-white">
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </>
                      )}
                      {report.status === "generating" && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                          Generating...
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
