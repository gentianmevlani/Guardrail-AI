import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MOCK_FRAMEWORKS = [
  {
    frameworkId: "soc2",
    frameworkName: "SOC 2 Type II",
    version: "2017",
    score: 87,
    status: "partial" as const,
    lastAssessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    nextAssessment: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000),
    controlsTotal: 64,
    controlsPassed: 56,
    trend: "up" as const,
    controls: [
      {
        controlId: "CC1.1",
        title: "COSO Principle 1: Demonstrates Commitment to Integrity",
        category: "control-environment",
        status: "compliant" as const,
        score: 100,
        findings: ["✓ Code of conduct documented"],
        gaps: [],
      },
      {
        controlId: "CC2.1",
        title: "COSO Principle 6: Specifies Suitable Objectives",
        category: "risk-assessment",
        status: "compliant" as const,
        score: 95,
        findings: ["✓ Security objectives defined"],
        gaps: [],
      },
      {
        controlId: "CC3.1",
        title: "COSO Principle 10: Selects and Develops Control Activities",
        category: "control-activities",
        status: "partial" as const,
        score: 75,
        findings: ["✓ Access controls implemented"],
        gaps: ["MFA not enforced for all users"],
      },
      {
        controlId: "CC4.1",
        title: "COSO Principle 13: Uses Relevant Information",
        category: "information-communication",
        status: "compliant" as const,
        score: 90,
        findings: ["✓ Logging enabled"],
        gaps: [],
      },
      {
        controlId: "CC5.1",
        title: "COSO Principle 16: Conducts Ongoing Evaluations",
        category: "monitoring",
        status: "partial" as const,
        score: 70,
        findings: ["✓ Basic monitoring in place"],
        gaps: ["Automated compliance checks not implemented"],
      },
    ],
  },
  {
    frameworkId: "hipaa",
    frameworkName: "HIPAA Security Rule",
    version: "2013",
    score: 72,
    status: "partial" as const,
    lastAssessment: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    nextAssessment: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
    controlsTotal: 42,
    controlsPassed: 30,
    trend: "stable" as const,
    controls: [
      {
        controlId: "164.308(a)(1)",
        title: "Security Management Process",
        category: "administrative",
        status: "partial" as const,
        score: 80,
        findings: ["✓ Risk analysis documented"],
        gaps: ["Risk management plan needs update"],
      },
      {
        controlId: "164.308(a)(3)",
        title: "Workforce Security",
        category: "administrative",
        status: "compliant" as const,
        score: 95,
        findings: ["✓ Authorization procedures in place"],
        gaps: [],
      },
      {
        controlId: "164.310(a)(1)",
        title: "Facility Access Controls",
        category: "physical",
        status: "non-compliant" as const,
        score: 45,
        findings: ["✗ Physical access logs incomplete"],
        gaps: ["Facility security plan missing", "Visitor logs not maintained"],
      },
      {
        controlId: "164.312(a)(1)",
        title: "Access Control",
        category: "technical",
        status: "partial" as const,
        score: 70,
        findings: ["✓ Unique user identification"],
        gaps: ["Emergency access procedure not tested"],
      },
    ],
  },
  {
    frameworkId: "gdpr",
    frameworkName: "GDPR",
    version: "2018",
    score: 91,
    status: "compliant" as const,
    lastAssessment: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    nextAssessment: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000),
    controlsTotal: 28,
    controlsPassed: 26,
    trend: "up" as const,
    controls: [
      {
        controlId: "Art.5",
        title: "Principles of Processing",
        category: "data-protection",
        status: "compliant" as const,
        score: 100,
        findings: ["✓ Lawful basis documented"],
        gaps: [],
      },
      {
        controlId: "Art.6",
        title: "Lawfulness of Processing",
        category: "data-protection",
        status: "compliant" as const,
        score: 95,
        findings: ["✓ Consent mechanisms implemented"],
        gaps: [],
      },
      {
        controlId: "Art.17",
        title: "Right to Erasure",
        category: "data-subject-rights",
        status: "partial" as const,
        score: 85,
        findings: ["✓ Deletion process exists"],
        gaps: ["Automated deletion for backups pending"],
      },
    ],
  },
  {
    frameworkId: "pci",
    frameworkName: "PCI DSS",
    version: "4.0",
    score: 65,
    status: "non-compliant" as const,
    lastAssessment: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
    nextAssessment: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    controlsTotal: 78,
    controlsPassed: 51,
    trend: "down" as const,
    controls: [
      {
        controlId: "Req.1",
        title: "Install and Maintain Network Security Controls",
        category: "network-security",
        status: "partial" as const,
        score: 70,
        findings: ["✓ Firewall configured"],
        gaps: ["Network segmentation incomplete"],
      },
      {
        controlId: "Req.3",
        title: "Protect Stored Account Data",
        category: "data-protection",
        status: "non-compliant" as const,
        score: 40,
        findings: ["✗ Encryption at rest not fully implemented"],
        gaps: ["PAN data encryption missing", "Key management process incomplete"],
      },
      {
        controlId: "Req.8",
        title: "Identify Users and Authenticate Access",
        category: "access-control",
        status: "partial" as const,
        score: 75,
        findings: ["✓ Unique IDs assigned"],
        gaps: ["MFA not enforced for admin access"],
      },
    ],
  },
  {
    frameworkId: "nist",
    frameworkName: "NIST CSF",
    version: "2.0",
    score: 78,
    status: "partial" as const,
    lastAssessment: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    nextAssessment: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    controlsTotal: 108,
    controlsPassed: 84,
    trend: "stable" as const,
    controls: [
      {
        controlId: "ID.AM",
        title: "Asset Management",
        category: "identify",
        status: "compliant" as const,
        score: 90,
        findings: ["✓ Asset inventory maintained"],
        gaps: [],
      },
      {
        controlId: "PR.AC",
        title: "Identity Management and Access Control",
        category: "protect",
        status: "partial" as const,
        score: 75,
        findings: ["✓ Access policies defined"],
        gaps: ["Privileged access review overdue"],
      },
      {
        controlId: "DE.CM",
        title: "Security Continuous Monitoring",
        category: "detect",
        status: "partial" as const,
        score: 70,
        findings: ["✓ SIEM deployed"],
        gaps: ["Alert tuning needed"],
      },
    ],
  },
  {
    frameworkId: "iso27001",
    frameworkName: "ISO 27001",
    version: "2022",
    score: 82,
    status: "partial" as const,
    lastAssessment: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    nextAssessment: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    controlsTotal: 93,
    controlsPassed: 76,
    trend: "up" as const,
    controls: [
      {
        controlId: "A.5.1",
        title: "Policies for Information Security",
        category: "organizational",
        status: "compliant" as const,
        score: 95,
        findings: ["✓ Security policy approved"],
        gaps: [],
      },
      {
        controlId: "A.6.1",
        title: "Screening",
        category: "people",
        status: "compliant" as const,
        score: 100,
        findings: ["✓ Background checks performed"],
        gaps: [],
      },
      {
        controlId: "A.8.1",
        title: "User Endpoint Devices",
        category: "technological",
        status: "partial" as const,
        score: 75,
        findings: ["✓ MDM deployed"],
        gaps: ["BYOD policy enforcement incomplete"],
      },
    ],
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const frameworkId = searchParams.get("frameworkId");

    if (frameworkId) {
      const framework = MOCK_FRAMEWORKS.find(
        (f) => f.frameworkId === frameworkId
      );
      if (!framework) {
        return NextResponse.json(
          { error: "Framework not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(framework);
    }

    const summary = MOCK_FRAMEWORKS.map((f) => ({
      frameworkId: f.frameworkId,
      frameworkName: f.frameworkName,
      version: f.version,
      score: f.score,
      status: f.status,
      lastAssessment: f.lastAssessment,
      nextAssessment: f.nextAssessment,
      controlsTotal: f.controlsTotal,
      controlsPassed: f.controlsPassed,
      trend: f.trend,
    }));

    return NextResponse.json({
      frameworks: summary,
      overall: {
        score: Math.round(
          MOCK_FRAMEWORKS.reduce((acc, f) => acc + f.score, 0) /
            MOCK_FRAMEWORKS.length
        ),
        compliant: MOCK_FRAMEWORKS.filter((f) => f.status === "compliant")
          .length,
        partial: MOCK_FRAMEWORKS.filter((f) => f.status === "partial").length,
        nonCompliant: MOCK_FRAMEWORKS.filter(
          (f) => f.status === "non-compliant"
        ).length,
      },
    });
  } catch (error) {
    logger.logUnknownError("Error fetching frameworks", error);
    return NextResponse.json(
      { error: "Failed to fetch compliance frameworks" },
      { status: 500 }
    );
  }
}
