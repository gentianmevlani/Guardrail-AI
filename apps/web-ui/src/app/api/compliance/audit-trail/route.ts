import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function generateMockAuditEvents(count: number) {
  const eventTypes = [
    "compliance_check_started",
    "compliance_check_completed",
    "evidence_collected",
    "compliance_violation",
    "remediation_performed",
    "compliance_access",
    "policy_updated",
    "control_assessment",
    "framework_enabled",
    "report_generated",
  ];

  const categories = ["compliance", "security", "access", "data", "system"] as const;
  const severities = ["low", "medium", "high", "critical"] as const;
  const actors = ["system", "admin@company.com", "auditor@company.com", "devops@company.com", "security@company.com"];
  const frameworks = ["soc2", "hipaa", "gdpr", "pci", "nist", "iso27001"];

  const events = [];

  for (let i = 0; i < count; i++) {
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const category = categories[Math.floor(Math.random() * categories.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];
    const actor = actors[Math.floor(Math.random() * actors.length)];
    const framework = frameworks[Math.floor(Math.random() * frameworks.length)];

    const timestamp = new Date(
      Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)
    );

    let action = "";
    switch (eventType) {
      case "compliance_check_started":
        action = `Compliance assessment initiated for ${framework.toUpperCase()}`;
        break;
      case "compliance_check_completed":
        action = `Compliance assessment completed for ${framework.toUpperCase()} with score ${Math.floor(Math.random() * 30) + 70}%`;
        break;
      case "evidence_collected":
        action = `${Math.floor(Math.random() * 50) + 10} evidence artifacts collected for ${framework.toUpperCase()}`;
        break;
      case "compliance_violation":
        action = `Control violation detected in ${framework.toUpperCase()} framework`;
        break;
      case "remediation_performed":
        action = `Remediation action completed for ${framework.toUpperCase()} control`;
        break;
      case "compliance_access":
        action = `Compliance dashboard accessed`;
        break;
      case "policy_updated":
        action = `Security policy updated for ${framework.toUpperCase()} compliance`;
        break;
      case "control_assessment":
        action = `Control assessment performed for ${framework.toUpperCase()}`;
        break;
      case "framework_enabled":
        action = `${framework.toUpperCase()} framework enabled for project`;
        break;
      case "report_generated":
        action = `Compliance report generated for ${framework.toUpperCase()}`;
        break;
      default:
        action = `${eventType.replace(/_/g, " ")}`;
    }

    events.push({
      id: `audit_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType,
      category,
      timestamp,
      actor,
      action,
      resource: `project/default/${framework}`,
      details: {
        framework,
        executionId: `exec_${Math.random().toString(36).substr(2, 9)}`,
      },
      severity,
      projectId: "default-project",
      frameworkId: framework,
    });
  }

  return events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

const MOCK_EVENTS = generateMockAuditEvents(100);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const severity = searchParams.get("severity");
    const actor = searchParams.get("actor");
    const frameworkId = searchParams.get("frameworkId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let filtered = [...MOCK_EVENTS];

    if (category) {
      filtered = filtered.filter((e) => e.category === category);
    }
    if (severity) {
      filtered = filtered.filter((e) => e.severity === severity);
    }
    if (actor) {
      filtered = filtered.filter((e) => e.actor === actor);
    }
    if (frameworkId) {
      filtered = filtered.filter((e) => e.frameworkId === frameworkId);
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    const summary = {
      totalEvents: total,
      byType: filtered.reduce(
        (acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      byCategory: filtered.reduce(
        (acc, e) => {
          acc[e.category] = (acc[e.category] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
      bySeverity: filtered.reduce(
        (acc, e) => {
          acc[e.severity] = (acc[e.severity] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      ),
    };

    return NextResponse.json({
      events: paginated,
      summary,
      metadata: {
        total,
        limit,
        offset,
        hasMore: offset + paginated.length < total,
      },
    });
  } catch (error) {
    logger.logUnknownError("Error fetching audit trail", error);
    return NextResponse.json(
      { error: "Failed to fetch audit trail" },
      { status: 500 }
    );
  }
}
