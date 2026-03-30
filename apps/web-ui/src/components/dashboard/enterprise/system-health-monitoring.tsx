"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cloud,
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  Monitor,
  RefreshCw,
  Server,
  Shield,
  Signal,
  Thermometer,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: "healthy" | "warning" | "critical";
  icon: React.ElementType;
  threshold?: {
    warning: number;
    critical: number;
  };
}

interface Service {
  name: string;
  status: "running" | "degraded" | "down";
  uptime: number;
  lastCheck: string;
  dependencies: string[];
  metrics: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
}

// Mock data
const systemMetrics: SystemMetric[] = [
  {
    name: "CPU Usage",
    value: 45,
    unit: "%",
    status: "healthy",
    icon: Cpu,
    threshold: { warning: 70, critical: 90 },
  },
  {
    name: "Memory Usage",
    value: 68,
    unit: "%",
    status: "warning",
    icon: MemoryStick,
    threshold: { warning: 75, critical: 90 },
  },
  {
    name: "Disk Usage",
    value: 34,
    unit: "%",
    status: "healthy",
    icon: HardDrive,
    threshold: { warning: 80, critical: 95 },
  },
  {
    name: "Network I/O",
    value: 125,
    unit: "Mbps",
    status: "healthy",
    icon: Wifi,
    threshold: { warning: 500, critical: 800 },
  },
  {
    name: "Temperature",
    value: 42,
    unit: "°C",
    status: "healthy",
    icon: Thermometer,
    threshold: { warning: 60, critical: 75 },
  },
  {
    name: "Database Connections",
    value: 78,
    unit: "/100",
    status: "healthy",
    icon: Database,
    threshold: { warning: 80, critical: 95 },
  },
];

const services: Service[] = [
  {
    name: "API Gateway",
    status: "running",
    uptime: 99.9,
    lastCheck: "30 seconds ago",
    dependencies: ["Auth Service", "Database"],
    metrics: {
      responseTime: 45,
      errorRate: 0.1,
      throughput: 1250,
    },
  },
  {
    name: "Auth Service",
    status: "running",
    uptime: 99.8,
    lastCheck: "15 seconds ago",
    dependencies: ["Database"],
    metrics: {
      responseTime: 32,
      errorRate: 0.05,
      throughput: 890,
    },
  },
  {
    name: "Scan Service",
    status: "degraded",
    uptime: 98.5,
    lastCheck: "1 minute ago",
    dependencies: ["API Gateway", "Database", "Storage"],
    metrics: {
      responseTime: 125,
      errorRate: 2.3,
      throughput: 450,
    },
  },
  {
    name: "Database",
    status: "running",
    uptime: 99.95,
    lastCheck: "10 seconds ago",
    dependencies: [],
    metrics: {
      responseTime: 8,
      errorRate: 0.01,
      throughput: 2100,
    },
  },
];

function MetricCard({ metric }: { metric: SystemMetric }) {
  const Icon = metric.icon;
  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "warning":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "critical":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  return (
    <Card className="bg-card border-border hover:border-teal-500/30 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-2 rounded-lg border", getStatusColor(metric.status))}>
            <Icon className="w-5 h-5" />
          </div>
          <Badge
            className={cn(
              "border-0",
              metric.status === "healthy"
                ? "bg-emerald-500/20 text-emerald-400"
                : metric.status === "warning"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {metric.status}
          </Badge>
        </div>
        <div>
          <p className="text-2xl font-bold text-white">
            {metric.value}
            <span className="text-sm text-muted-foreground ml-1">{metric.unit}</span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">{metric.name}</p>
        </div>
        {metric.threshold && (
          <div className="mt-3">
            <div className="w-full bg-charcoal-700 rounded-full h-1">
              <div
                className={cn(
                  "h-1 rounded-full transition-all",
                  metric.status === "healthy"
                    ? "bg-emerald-500"
                    : metric.status === "warning"
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{
                  width: `${Math.min(
                    (metric.value / metric.threshold.critical) * 100,
                  100
                )}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceCard({ service }: { service: Service }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "degraded":
        return "text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "down":
        return "text-red-400 bg-red-500/10 border-red-500/30";
      default:
        return "text-gray-400 bg-gray-500/10 border-gray-500/30";
    }
  };

  return (
    <Card className="bg-card border-border hover:border-teal-500/30 transition-all">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg border", getStatusColor(service.status))}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white">{service.name}</h3>
              <p className="text-xs text-muted-foreground">
                Last check: {service.lastCheck}
              </p>
            </div>
          </div>
          <Badge
            className={cn(
              "border-0",
              service.status === "running"
                ? "bg-emerald-500/20 text-emerald-400"
                : service.status === "degraded"
                ? "bg-amber-500/20 text-amber-400"
                : "bg-red-500/20 text-red-400"
            )}
          >
            {service.status}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Uptime</span>
            <span className="text-emerald-400 font-medium">{service.uptime}%</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Response Time</span>
            <span className={cn(
              "font-medium",
              service.metrics.responseTime < 50 ? "text-emerald-400" :
              service.metrics.responseTime < 100 ? "text-amber-400" : "text-red-400"
            )}>
              {service.metrics.responseTime}ms
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Error Rate</span>
            <span className={cn(
              "font-medium",
              service.metrics.errorRate < 0.5 ? "text-emerald-400" :
              service.metrics.errorRate < 2 ? "text-amber-400" : "text-red-400"
            )}>
              {service.metrics.errorRate}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Throughput</span>
            <span className="text-white font-medium">{service.metrics.throughput}/s</span>
          </div>
        </div>

        {service.dependencies.length > 0 && (
          <div className="mt-4 pt-4 border-t border-charcoal-700">
            <p className="text-xs text-muted-foreground mb-2">Dependencies:</p>
            <div className="flex flex-wrap gap-1">
              {service.dependencies.map((dep) => (
                <Badge key={dep} variant="outline" className="text-xs">
                  {dep}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function SystemHealthMonitoring() {
  const [mounted, setMounted] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const criticalMetrics = systemMetrics.filter(m => m.status === "critical");
  const warningMetrics = systemMetrics.filter(m => m.status === "warning");
  const healthyMetrics = systemMetrics.filter(m => m.status === "healthy");
  const downServices = services.filter(s => s.status === "down");
  const degradedServices = services.filter(s => s.status === "degraded");

  if (!mounted) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-36 skeleton bg-charcoal-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Monitor className="w-6 h-6 text-teal-400" />
            System Health Monitoring
          </h2>
          <p className="text-muted-foreground">
            Real-time system performance and service status
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alert Banner */}
      {(criticalMetrics.length > 0 || downServices.length > 0) && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-red-400">
                <span className="font-medium">
                  {criticalMetrics.length + downServices.length} critical issue
                  {criticalMetrics.length + downServices.length > 1 ? "s" : ""}
                </span>
                {" "}require immediate attention
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Healthy Services</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">
                  {services.filter(s => s.status === "running").length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Degraded Services</p>
                <p className="text-3xl font-bold text-amber-400 mt-1">
                  {degradedServices.length}
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-500/10">
                <AlertTriangle className="w-6 h-6 text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">System Load</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {Math.round(systemMetrics.reduce((acc, m) => acc + m.value, 0) / systemMetrics.length)}%
                </p>
              </div>
              <div className="p-3 rounded-full bg-teal-500/10">
                <Activity className="w-6 h-6 text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Uptime</p>
                <p className="text-3xl font-bold text-emerald-400 mt-1">99.9%</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-500/10">
                <Signal className="w-6 h-6 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">System Metrics</h3>
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {systemMetrics.map((metric) => (
            <MetricCard key={metric.name} metric={metric} />
          ))}
        </div>
      </div>

      {/* Services Status */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Service Status</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {services.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SystemHealthMonitoring;
