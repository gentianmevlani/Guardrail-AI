import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { format, projectId } = body;

    if (!format || !["json", "csv"].includes(format)) {
      return NextResponse.json(
        { error: "Invalid export format. Supported: json, csv" },
        { status: 400 }
      );
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      projectId: projectId || "default-project",
      format,
      compliance: {
        overallScore: 79,
        frameworks: [
          {
            id: "soc2",
            name: "SOC 2 Type II",
            score: 87,
            status: "partial",
            controlsTotal: 64,
            controlsPassed: 56,
          },
          {
            id: "hipaa",
            name: "HIPAA Security Rule",
            score: 72,
            status: "partial",
            controlsTotal: 42,
            controlsPassed: 30,
          },
          {
            id: "gdpr",
            name: "GDPR",
            score: 91,
            status: "compliant",
            controlsTotal: 28,
            controlsPassed: 26,
          },
          {
            id: "pci",
            name: "PCI DSS",
            score: 65,
            status: "non-compliant",
            controlsTotal: 78,
            controlsPassed: 51,
          },
          {
            id: "nist",
            name: "NIST CSF",
            score: 78,
            status: "partial",
            controlsTotal: 108,
            controlsPassed: 84,
          },
          {
            id: "iso27001",
            name: "ISO 27001",
            score: 82,
            status: "partial",
            controlsTotal: 93,
            controlsPassed: 76,
          },
        ],
        gaps: [
          {
            framework: "pci",
            controlId: "Req.3",
            severity: "high",
            description: "PAN data encryption missing",
          },
          {
            framework: "hipaa",
            controlId: "164.310(a)(1)",
            severity: "high",
            description: "Facility security plan missing",
          },
          {
            framework: "soc2",
            controlId: "CC3.1",
            severity: "medium",
            description: "MFA not enforced for all users",
          },
        ],
      },
      auditTrail: {
        totalEvents: 247,
        lastEvent: new Date(Date.now() - 3600000).toISOString(),
        integrityStatus: "valid",
      },
    };

    if (format === "json") {
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="compliance-export-${Date.now()}.json"`,
        },
      });
    }

    if (format === "csv") {
      const csvRows = [
        ["Framework", "Score", "Status", "Controls Total", "Controls Passed"],
        ...exportData.compliance.frameworks.map((f) => [
          f.name,
          f.score.toString(),
          f.status,
          f.controlsTotal.toString(),
          f.controlsPassed.toString(),
        ]),
      ];

      const csvContent = csvRows.map((row) => row.join(",")).join("\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="compliance-export-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: "Unsupported format" }, { status: 400 });
  } catch (error) {
    logger.logUnknownError("Error exporting compliance data", error);
    return NextResponse.json(
      { error: "Failed to export compliance data" },
      { status: 500 }
    );
  }
}
