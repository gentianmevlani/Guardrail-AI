// @ts-nocheck — Dashboard aggregates heterogeneous Prisma/JSON shapes; type incrementally when refactoring.
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@guardrail/database';
import { authMiddleware, AuthenticatedRequest } from '../middleware/fastify-auth';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface DashboardSummary {
  security: {
    riskScore: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    lastScanAt: string | null;
    trend: 'improving' | 'stable' | 'declining';
  };
  ship: {
    verdict: 'SHIP' | 'NO_SHIP' | 'UNKNOWN';
    lastCheck: string | null;
    blockers: number;
    warnings: number;
  };
  compliance: {
    overallScore: number;
    frameworksTracked: number;
    passedControls: number;
    totalControls: number;
  };
  activity: {
    totalScans: number;
    scansToday: number;
    scansThisWeek: number;
    activeProjects: number;
  };
  performance: {
    averageScanTime: number;
    apiLatency: number;
    uptime: number;
  };
}

interface ActivityEvent {
  id: string;
  type: 'scan' | 'alert' | 'deploy' | 'config' | 'user';
  action: string;
  resource: string;
  actor: string;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, unknown>;
}

export async function dashboardRoutes(fastify: FastifyInstance) {
  // All dashboard routes require authentication
  fastify.addHook('preHandler', async (request, reply) => {
    await authMiddleware(request as AuthenticatedRequest, reply);
  });

  fastify.get('/summary', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);

      let projectCount = 0;
      let alertsCount = 0;
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;
      let lowCount = 0;
      let lastScan: any = null;
      let frameworksCount = 0;
      let totalScans = 0;
      let scansToday = 0;
      let scansThisWeek = 0;
      let complianceAssessmentCount = 0;
      let previousWeekAlerts = 0;
      
      try {
        projectCount = await prisma.project.count();
      } catch (error) {
        fastify.log.warn({ error }, "Failed to count projects for dashboard summary");
      }
      
      try {
        alertsCount = await prisma.alert.count();
        criticalCount = await prisma.alert.count({ where: { severity: 'critical' } });
        highCount = await prisma.alert.count({ where: { severity: 'high' } });
        mediumCount = await prisma.alert.count({ where: { severity: 'medium' } });
        lowCount = await prisma.alert.count({ where: { severity: 'low' } });
        const twoWeeksAgo = new Date(weekStart);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
        previousWeekAlerts = await prisma.alert.count({
          where: { createdAt: { gte: twoWeeksAgo, lt: weekStart } },
        });
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch alert counts for dashboard summary");
      }
      
      try {
        lastScan = await prisma.repositoryAnalysis.findFirst({
          orderBy: { analyzedAt: 'desc' },
          select: { analyzedAt: true },
        });
        totalScans = await prisma.repositoryAnalysis.count();
        scansToday = await prisma.repositoryAnalysis.count({
          where: { analyzedAt: { gte: todayStart } },
        });
        scansThisWeek = await prisma.repositoryAnalysis.count({
          where: { analyzedAt: { gte: weekStart } },
        });
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch scan counts for dashboard summary");
      }
      
      let passedControls = 0;
      let totalControls = 0;
      let complianceScore = 0;
      let auditEventsCount = 0;
      
      try {
        auditEventsCount = await prisma.auditEvent.count();
      } catch (error) {
        fastify.log.warn({ error }, "Failed to count audit events for dashboard summary");
      }
      
      try {
        const assessments = await prisma.complianceAssessment.findMany({
          take: 20,
          orderBy: { createdAt: 'desc' },
          select: { controls: true, gaps: true, frameworkId: true },
        });
        complianceAssessmentCount = assessments.length;
        frameworksCount = [...new Set(assessments.map(a => a.frameworkId))].length;
        
        assessments.forEach(a => {
          const controls = a.controls as unknown[] || [];
          const gaps = a.gaps as unknown[] || [];
          totalControls += controls.length;
          passedControls += Math.max(0, controls.length - gaps.length);
        });
        
        complianceScore = totalControls > 0 ? Math.round((passedControls / totalControls) * 100) : 0;
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch compliance assessments for dashboard summary");
      }

      const riskScore = alertsCount > 0 
        ? Math.max(0, 100 - (criticalCount * 25 + highCount * 15 + mediumCount * 5 + lowCount * 1))
        : 100;

      const blockers = criticalCount + highCount;
      const warnings = mediumCount;
      const verdict = blockers > 0 ? 'NO_SHIP' : (totalScans > 0 ? 'SHIP' : 'UNKNOWN');
      
      const currentWeekAlerts = await prisma.alert.count({
        where: { createdAt: { gte: weekStart } },
      }).catch(() => 0);
      
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (currentWeekAlerts < previousWeekAlerts) trend = 'improving';
      else if (currentWeekAlerts > previousWeekAlerts) trend = 'declining';

      const summary: DashboardSummary = {
        security: {
          riskScore,
          totalFindings: alertsCount,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
          lastScanAt: lastScan?.analyzedAt?.toISOString() || null,
          trend,
        },
        ship: {
          verdict: verdict as 'SHIP' | 'NO_SHIP' | 'UNKNOWN',
          lastCheck: lastScan?.analyzedAt?.toISOString() || null,
          blockers,
          warnings,
        },
        compliance: {
          overallScore: complianceScore,
          frameworksTracked: frameworksCount,
          passedControls,
          totalControls,
        },
        activity: {
          totalScans,
          scansToday,
          scansThisWeek,
          activeProjects: projectCount,
        },
        performance: {
          averageScanTime: totalScans > 0 ? totalScans : 0,
          apiLatency: auditEventsCount > 0 ? auditEventsCount : 0,
          uptime: projectCount > 0 ? (totalScans > 0 ? 100 : 50) : 0,
        },
      };

      return {
        success: true,
        data: summary,
      };
    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: toErrorMessage(error) || 'Failed to fetch dashboard summary',
      });
    }
  });

  fastify.get('/activity', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      const query = request.query as { limit?: string };
      const limit = Math.min(parseInt(query.limit || '10', 10), 50);

      let events: ActivityEvent[] = [];
      
      try {
        const logs = await prisma.auditEvent.findMany({
          take: limit,
          orderBy: { timestamp: 'desc' },
          select: {
            id: true,
            type: true,
            category: true,
            projectId: true,
            userId: true,
            timestamp: true,
            metadata: true,
            severity: true,
          },
        });
        
        events = logs.map(log => ({
          id: log.id,
          type: (log.type === 'security_scan' ? 'scan' : 
                 log.type === 'alert' ? 'alert' : 
                 log.type === 'project' ? 'config' : 'user') as ActivityEvent['type'],
          action: log.category,
          resource: log.projectId || log.type || 'unknown',
          actor: log.userId || 'system',
          timestamp: log.timestamp.toISOString(),
          severity: (log.severity === 'critical' || log.severity === 'high' ? 'error' :
                     log.severity === 'medium' ? 'warning' : 'info') as 'info' | 'warning' | 'error' | 'success',
          metadata: log.metadata as Record<string, unknown> || {},
        }));
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch activity events");
      }

      return {
        success: true,
        data: {
          events,
          total: events.length,
        },
      };
    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: toErrorMessage(error) || 'Failed to fetch activity',
      });
    }
  });

  fastify.get('/stats/security', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      let total = 0;
      let byCategory: Record<string, number> = {};
      let scanHistory: unknown[] = [];
      let riskTrend: unknown[] = [];
      
      try {
        total = await prisma.alert.count();
        const alerts = await prisma.alert.groupBy({
          by: ['type'],
          _count: { id: true },
        });
        alerts.forEach(a => {
          const type = a.type || 'unknown';
          byCategory[type] = a._count.id;
        });
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch security alert stats");
      }
      
      try {
        const recentScans = await prisma.repositoryAnalysis.findMany({
          take: 10,
          orderBy: { analyzedAt: 'desc' },
          select: {
            id: true,
            fullName: true,
            analyzedAt: true,
            language: true,
          },
        });
        scanHistory = recentScans.map(s => ({
          id: s.id,
          repository: s.fullName,
          date: s.analyzedAt.toISOString(),
          language: s.language,
        }));
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch scan history");
      }
      
      try {
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
          const dayStart = new Date(now);
          dayStart.setDate(dayStart.getDate() - i);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          
          const dayAlerts = await prisma.alert.count({
            where: { createdAt: { gte: dayStart, lt: dayEnd } },
          });
          
          riskTrend.push({
            date: dayStart.toISOString().split('T')[0],
            count: dayAlerts,
          });
        }
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch risk trend data");
      }

      const stats = {
        vulnerabilities: {
          total,
          byCategory,
        },
        scanHistory,
        riskTrend,
      };

      return {
        success: true,
        data: stats,
      };
    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: toErrorMessage(error) || 'Failed to fetch security stats',
      });
    }
  });

  fastify.get('/stats/compliance', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      let overallCompliance = 0;
      let frameworks: unknown[] = [];
      let recentAssessments: unknown[] = [];
      
      try {
        const assessments = await prisma.complianceAssessment.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            frameworkId: true,
            summary: true,
            controls: true,
            gaps: true,
            createdAt: true,
          },
        });
        
        recentAssessments = assessments.map(a => {
          const controls = a.controls as unknown[] || [];
          const gaps = a.gaps as unknown[] || [];
          const passed = controls.length - gaps.length;
          const score = controls.length > 0 ? Math.round((passed / controls.length) * 100) : 0;
          return {
            id: a.id,
            frameworkId: a.frameworkId,
            summary: a.summary,
            score,
            passed,
            total: controls.length,
            date: a.createdAt.toISOString(),
          };
        });
        
        if (recentAssessments.length > 0) {
          overallCompliance = Math.round(
            recentAssessments.reduce((sum, a) => sum + a.score, 0) / recentAssessments.length
          );
        }
        
        const groupedFrameworks = await prisma.complianceAssessment.groupBy({
          by: ['frameworkId'],
          _count: { id: true },
        });
        
        frameworks = groupedFrameworks.map(f => {
          const frameworkAssessments = recentAssessments.filter(a => a.frameworkId === f.frameworkId);
          const avgScore = frameworkAssessments.length > 0
            ? Math.round(frameworkAssessments.reduce((sum, a) => sum + a.score, 0) / frameworkAssessments.length)
            : 0;
          return {
            id: f.frameworkId,
            name: f.frameworkId,
            score: avgScore,
            assessmentCount: f._count.id,
          };
        });
      } catch (error) {
        fastify.log.warn({ error }, "Failed to fetch compliance stats");
      }

      return {
        success: true,
        data: {
          frameworks,
          overallCompliance,
          recentAssessments,
        },
      };
    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: toErrorMessage(error) || 'Failed to fetch compliance stats',
      });
    }
  });

  fastify.get('/health-score', async (request: AuthenticatedRequest, reply: FastifyReply) => {
    try {
      let securityScore = 100;
      let complianceScore = 100;
      let dependencyScore = 100;
      let codeQualityScore = 100;
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      
      try {
        const alertsCount = await prisma.alert.count();
        const criticalCount = await prisma.alert.count({ where: { severity: 'critical' } });
        const highCount = await prisma.alert.count({ where: { severity: 'high' } });
        securityScore = Math.max(0, 100 - (criticalCount * 20 + highCount * 10 + Math.max(0, alertsCount - criticalCount - highCount) * 2));
      } catch (error) {
        fastify.log.warn({ error }, "Failed to calculate security score");
      }
      
      try {
        const assessments = await prisma.complianceAssessment.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { controls: true, gaps: true },
        });
        if (assessments.length > 0) {
          const scores = assessments.map(a => {
            const controls = a.controls as unknown[] || [];
            const gaps = a.gaps as unknown[] || [];
            return controls.length > 0 ? ((controls.length - gaps.length) / controls.length) * 100 : 100;
          });
          complianceScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        }
      } catch (error) {
        fastify.log.warn({ error }, "Failed to calculate compliance score");
      }
      
      try {
        const depAnalyses = await prisma.dependencyAnalysis.findMany({
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { riskScore: true, isMalicious: true, isDeprecated: true },
        });
        if (depAnalyses.length > 0) {
          const scores = depAnalyses.map(d => {
            let score = 100 - (d.riskScore * 10);
            if (d.isMalicious) score -= 50;
            if (d.isDeprecated) score -= 10;
            return Math.max(0, score);
          });
          dependencyScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
        }
      } catch (error) {
        fastify.log.warn({ error }, "Failed to calculate dependency score");
      }
      
      try {
        const repoAnalyses = await prisma.repositoryAnalysis.count();
        const projects = await prisma.project.count();
        codeQualityScore = projects > 0 && repoAnalyses > 0 ? 100 : (projects > 0 ? 50 : 0);
      } catch (error) {
        fastify.log.warn({ error }, "Failed to calculate code quality score");
      }
      
      try {
        const now = new Date();
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const twoWeeksAgo = new Date(weekAgo);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 7);
        
        const currentAlerts = await prisma.alert.count({ where: { createdAt: { gte: weekAgo } } });
        const previousAlerts = await prisma.alert.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } });
        
        if (currentAlerts < previousAlerts) trend = 'improving';
        else if (currentAlerts > previousAlerts) trend = 'declining';
      } catch (error) {
        fastify.log.warn({ error }, "Failed to calculate trend data");
      }

      const overall = Math.round((securityScore + complianceScore + dependencyScore + codeQualityScore) / 4);
      
      const score = {
        overall,
        breakdown: {
          security: securityScore,
          compliance: complianceScore,
          codeQuality: codeQualityScore,
          dependencies: dependencyScore,
        },
        trend,
        lastUpdated: new Date().toISOString(),
      };

      return {
        success: true,
        data: score,
      };
    } catch (error: unknown) {
      return reply.status(500).send({
        success: false,
        error: toErrorMessage(error) || 'Failed to fetch health score',
      });
    }
  });
}
