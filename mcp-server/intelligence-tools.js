/**
 * guardrail Intelligence MCP Tools
 *
 * Power suite tools for MCP:
 * - guardrail.intelligence.ai       - AI code analysis
 * - guardrail.intelligence.security - Security scanning
 * - guardrail.intelligence.arch     - Architecture health
 * - guardrail.intelligence.supply   - Supply chain analysis
 * - guardrail.intelligence.team     - Team intelligence
 * - guardrail.intelligence.predict  - Predictive analytics
 * - guardrail.intelligence.full     - Run all suites
 */

import path from "path";
import { execSync } from "child_process";
import fs from "fs/promises";

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export const INTELLIGENCE_TOOLS = [
  {
    name: "guardrail.intelligence.ai",
    description:
      "🧠 AI Code Intelligence — Code review, bug prediction, pattern learning, and explanations",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        file: {
          type: "string",
          description: "Optional: specific file to analyze",
        },
        focus: {
          type: "string",
          enum: ["all", "security", "performance", "quality"],
          description: "Focus area for analysis",
          default: "all",
        },
      },
    },
  },
  {
    name: "guardrail.intelligence.security",
    description:
      "🔒 Security Suite — Secrets, vulnerabilities, PII, threats, and compliance checking",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        checks: {
          type: "array",
          items: { type: "string" },
          description:
            "Specific checks: secrets, vulnerabilities, pii, threats, access",
        },
      },
    },
  },
  {
    name: "guardrail.intelligence.arch",
    description:
      "🏗️ Architecture Health — Code smells, dependencies, coupling, drift prediction",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        visualize: {
          type: "boolean",
          description: "Generate dependency graph visualization",
          default: false,
        },
      },
    },
  },
  {
    name: "guardrail.intelligence.supply",
    description:
      "📦 Supply Chain — SBOM, vulnerabilities, licenses, typosquatting detection",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        sbomFormat: {
          type: "string",
          enum: ["cyclonedx", "spdx"],
          description: "SBOM output format",
          default: "cyclonedx",
        },
      },
    },
  },
  {
    name: "guardrail.intelligence.team",
    description:
      "👥 Team Intelligence — Expertise mapping, bus factor, knowledge silos, decisions",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
      },
    },
  },
  {
    name: "guardrail.intelligence.predict",
    description:
      "🔮 Predictive Analytics — Quality trends, risk assessment, anomaly detection",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
        timeframe: {
          type: "string",
          enum: ["7d", "30d", "90d"],
          description: "Prediction timeframe",
          default: "30d",
        },
      },
    },
  },
  {
    name: "guardrail.intelligence.full",
    description:
      "🚀 Full Intelligence — Run all power suites for comprehensive analysis",
    inputSchema: {
      type: "object",
      properties: {
        projectPath: {
          type: "string",
          description: "Path to project root",
          default: ".",
        },
      },
    },
  },
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

export async function handleIntelligenceTool(name, args, __dirname) {
  const projectPath = path.resolve(args?.projectPath || ".");

  try {
    switch (name) {
      case "guardrail.intelligence.ai":
        return await handleAI(projectPath, args, __dirname);
      case "guardrail.intelligence.security":
        return await handleSecurity(projectPath, args, __dirname);
      case "guardrail.intelligence.arch":
        return await handleArchitecture(projectPath, args, __dirname);
      case "guardrail.intelligence.supply":
        return await handleSupplyChain(projectPath, args, __dirname);
      case "guardrail.intelligence.team":
        return await handleTeam(projectPath, args, __dirname);
      case "guardrail.intelligence.predict":
        return await handlePredictive(projectPath, args, __dirname);
      case "guardrail.intelligence.full":
        return await handleFull(projectPath, args, __dirname);
      default:
        return null;
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `❌ ${name} failed: ${err.message}` }],
      isError: true,
    };
  }
}

// ============================================================================
// HANDLER IMPLEMENTATIONS
// ============================================================================

async function handleAI(projectPath, args, __dirname) {
  let output = "# 🧠 AI Code Intelligence\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" ai --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);

    output += "## Scores\n\n";
    output += `| Metric | Score |\n|--------|-------|\n`;
    if (data.scores) {
      output += `| Overall | ${data.scores.overall}/100 ${getScoreIcon(data.scores.overall)} |\n`;
      output += `| Security | ${data.scores.security}/100 ${getScoreIcon(data.scores.security)} |\n`;
      output += `| Quality | ${data.scores.quality}/100 ${getScoreIcon(data.scores.quality)} |\n`;
      output += `| Performance | ${data.scores.performance}/100 ${getScoreIcon(data.scores.performance)} |\n`;
    }

    if (data.bugPredictions) {
      output += "\n## Bug Predictions\n\n";
      output += `- **Total:** ${data.bugPredictions.total}\n`;
      output += `- **Critical:** ${data.bugPredictions.critical} 🔴\n`;
      output += `- **High:** ${data.bugPredictions.high} 🟠\n`;
      output += `- **Medium:** ${data.bugPredictions.medium} 🟡\n`;
    }

    if (data.issues && data.issues.length > 0) {
      output += "\n## Top Issues\n\n";
      for (const issue of data.issues.slice(0, 5)) {
        output += `- **${issue.severity.toUpperCase()}** ${issue.title}\n`;
        output += `  - File: \`${issue.file}\`${issue.line ? `:${issue.line}` : ""}\n`;
      }
    }

    if (data.recommendations && data.recommendations.length > 0) {
      output += "\n## Recommendations\n\n";
      for (const rec of data.recommendations.slice(0, 3)) {
        output += `- ${rec}\n`;
      }
    }
  } catch (err) {
    output += `⚠️ Analysis incomplete: ${err.message}\n`;
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

async function handleSecurity(projectPath, args, __dirname) {
  let output = "# 🔒 Security Suite\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" security --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);

    output += "## Security Scores\n\n";
    output += `| Category | Score |\n|----------|-------|\n`;
    if (data.scores) {
      output += `| Overall | ${data.scores.overall}/100 ${getScoreIcon(data.scores.overall)} |\n`;
      output += `| Secrets | ${data.scores.secrets}/100 ${getScoreIcon(data.scores.secrets)} |\n`;
      output += `| Vulnerabilities | ${data.scores.vulnerabilities}/100 ${getScoreIcon(data.scores.vulnerabilities)} |\n`;
      output += `| Compliance | ${data.scores.compliance}/100 ${getScoreIcon(data.scores.compliance)} |\n`;
    }

    output += "\n## Summary\n\n";
    if (data.summary) {
      output += `- **Total Findings:** ${data.summary.totalFindings}\n`;
      output += `- **Critical:** ${data.summary.critical} 🔴\n`;
      output += `- **High:** ${data.summary.high} 🟠\n`;
      output += `- **Medium:** ${data.summary.medium} 🟡\n`;
      output += `- **Low:** ${data.summary.low} 🔵\n`;
    }

    if (data.secrets && data.secrets.length > 0) {
      output += "\n## 🔑 Secrets Found\n\n";
      for (const secret of data.secrets.slice(0, 5)) {
        output += `- **${secret.severity.toUpperCase()}** ${secret.type} in \`${secret.file}:${secret.line}\`\n`;
      }
    }

    if (
      data.vulnerabilities?.findings &&
      data.vulnerabilities.findings.length > 0
    ) {
      output += "\n## 🛡️ Vulnerabilities\n\n";
      for (const vuln of data.vulnerabilities.findings.slice(0, 5)) {
        output += `- **${vuln.severity.toUpperCase()}** ${vuln.package}@${vuln.version}\n`;
        output += `  - ${vuln.title}\n`;
      }
    }

    if (data.compliance) {
      output += "\n## 📋 Compliance Status\n\n";
      output += `| Standard | Status |\n|----------|--------|\n`;
      output += `| SOC2 | ${data.compliance.soc2?.compliant ? "✅ Compliant" : "❌ Non-compliant"} |\n`;
      output += `| HIPAA | ${data.compliance.hipaa?.compliant ? "✅ Compliant" : "❌ Non-compliant"} |\n`;
      output += `| GDPR | ${data.compliance.gdpr?.compliant ? "✅ Compliant" : "❌ Non-compliant"} |\n`;
      output += `| PCI | ${data.compliance.pci?.compliant ? "✅ Compliant" : "❌ Non-compliant"} |\n`;
    }
  } catch (err) {
    output += `⚠️ Security scan incomplete: ${err.message}\n`;
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

async function handleArchitecture(projectPath, args, __dirname) {
  let output = "# 🏗️ Architecture Health\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" arch --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);

    output += "## Architecture Scores\n\n";
    output += `| Metric | Score |\n|--------|-------|\n`;
    if (data.scores) {
      output += `| Overall | ${data.scores.overall}/100 ${getScoreIcon(data.scores.overall)} |\n`;
      output += `| Modularity | ${data.scores.modularity}/100 ${getScoreIcon(data.scores.modularity)} |\n`;
      output += `| Coupling | ${data.scores.coupling}/100 ${getScoreIcon(data.scores.coupling)} |\n`;
      output += `| Cohesion | ${data.scores.cohesion}/100 ${getScoreIcon(data.scores.cohesion)} |\n`;
      output += `| Complexity | ${data.scores.complexity}/100 ${getScoreIcon(data.scores.complexity)} |\n`;
      output += `| Maintainability | ${data.scores.maintainability}/100 ${getScoreIcon(data.scores.maintainability)} |\n`;
    }

    if (data.architecture?.layers && data.architecture.layers.length > 0) {
      output += "\n## Architecture Layers\n\n";
      for (const layer of data.architecture.layers) {
        output += `- **${layer.name}:** ${layer.files} files, ${layer.loc} LOC\n`;
      }
    }

    if (
      data.architecture?.circularDeps &&
      data.architecture.circularDeps.length > 0
    ) {
      output += "\n## 🔄 Circular Dependencies\n\n";
      for (const dep of data.architecture.circularDeps.slice(0, 3)) {
        output += `- **${dep.severity.toUpperCase()}** ${dep.cycle.join(" → ")}\n`;
      }
    }

    if (data.smells && data.smells.length > 0) {
      output += "\n## 👃 Code Smells\n\n";
      for (const smell of data.smells.slice(0, 5)) {
        output += `- **${smell.severity.toUpperCase()}** ${smell.name}\n`;
        output += `  - \`${smell.file}\`${smell.line ? `:${smell.line}` : ""}\n`;
      }
    }

    if (data.visualizations?.dependencyGraph && args?.visualize) {
      output += "\n## Dependency Graph\n\n";
      output +=
        "```mermaid\n" + data.visualizations.dependencyGraph + "\n```\n";
    }
  } catch (err) {
    output += `⚠️ Architecture analysis incomplete: ${err.message}\n`;
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

async function handleSupplyChain(projectPath, args, __dirname) {
  let output = "# 📦 Supply Chain Analysis\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" supply --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);

    output += "## Supply Chain Scores\n\n";
    output += `| Category | Score |\n|----------|-------|\n`;
    if (data.scores) {
      output += `| Overall | ${data.scores.overall}/100 ${getScoreIcon(data.scores.overall)} |\n`;
      output += `| Vulnerability | ${data.scores.vulnerability}/100 ${getScoreIcon(data.scores.vulnerability)} |\n`;
      output += `| License | ${data.scores.license}/100 ${getScoreIcon(data.scores.license)} |\n`;
      output += `| Maintenance | ${data.scores.maintenance}/100 ${getScoreIcon(data.scores.maintenance)} |\n`;
    }

    if (data.dependencies) {
      output += "\n## Dependencies\n\n";
      output += `- **Total:** ${data.dependencies.total}\n`;
      output += `- **Direct:** ${data.dependencies.direct}\n`;
      output += `- **Transitive:** ${data.dependencies.transitive}\n`;
      output += `- **Outdated:** ${data.dependencies.outdated?.length || 0}\n`;
    }

    if (data.vulnerabilities) {
      output += "\n## Vulnerabilities\n\n";
      output += `- **Total:** ${data.vulnerabilities.total}\n`;
      output += `- **Critical:** ${data.vulnerabilities.critical} 🔴\n`;
      output += `- **High:** ${data.vulnerabilities.high} 🟠\n`;
      output += `- **Medium:** ${data.vulnerabilities.medium} 🟡\n`;
    }

    if (
      data.licenses?.riskyLicenses &&
      data.licenses.riskyLicenses.length > 0
    ) {
      output += "\n## ⚠️ Risky Licenses\n\n";
      for (const lic of data.licenses.riskyLicenses.slice(0, 5)) {
        output += `- **${lic.risk.toUpperCase()}** ${lic.package} (${lic.license})\n`;
      }
    }

    if (data.security?.malicious && data.security.malicious.length > 0) {
      output += "\n## 🚨 MALICIOUS PACKAGES\n\n";
      for (const mal of data.security.malicious) {
        output += `- ❌ **${mal.name}** - ${mal.reason}\n`;
      }
    }

    if (
      data.security?.typosquatting &&
      data.security.typosquatting.length > 0
    ) {
      output += "\n## ⚠️ Typosquatting Risks\n\n";
      for (const typo of data.security.typosquatting.slice(0, 3)) {
        output += `- **${typo.riskLevel.toUpperCase()}** \`${typo.package}\` → similar to \`${typo.similarTo}\`\n`;
      }
    }
  } catch (err) {
    output += `⚠️ Supply chain analysis incomplete: ${err.message}\n`;
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

async function handleTeam(projectPath, args, __dirname) {
  let output = "# 👥 Team Intelligence\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" team --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);

    if (data.collaboration?.metrics) {
      output += "## Team Metrics\n\n";
      const m = data.collaboration.metrics;
      output += `- **Total Contributors:** ${m.totalContributors}\n`;
      output += `- **Active Contributors:** ${m.activeContributors}\n`;
      output += `- **Commits/Week:** ${m.averageCommitsPerWeek}\n`;
      output += `- **Knowledge Sharing:** ${(m.knowledgeSharingScore * 100).toFixed(0)}%\n`;
    }

    if (data.collaboration?.busFactor) {
      output += "\n## 🚌 Bus Factor\n\n";
      output += `**Overall Bus Factor:** ${data.collaboration.busFactor.overall}\n\n`;

      if (data.collaboration.busFactor.criticalAreas?.length > 0) {
        output += "**⚠️ Critical Areas (Bus Factor = 1):**\n";
        for (const area of data.collaboration.busFactor.criticalAreas) {
          output += `- ${area}\n`;
        }
      }
    }

    if (data.knowledge?.experts && data.knowledge.experts.length > 0) {
      output += "\n## 🎯 Top Experts\n\n";
      for (const expert of data.knowledge.experts.slice(0, 5)) {
        const topAreas =
          expert.areas
            ?.slice(0, 2)
            .map((a) => a.area)
            .join(", ") || "Various";
        output += `- **${expert.developer}:** ${expert.totalCommits} commits (${topAreas})\n`;
      }
    }

    if (
      data.knowledge?.orphanedKnowledge &&
      data.knowledge.orphanedKnowledge.length > 0
    ) {
      output += "\n## ⚠️ Knowledge Silos\n\n";
      for (const orphan of data.knowledge.orphanedKnowledge.slice(0, 3)) {
        output += `- **${orphan.risk.toUpperCase()}** ${orphan.area}\n`;
        output += `  - ${orphan.reason}\n`;
      }
    }

    if (data.decisions?.tracked && data.decisions.tracked.length > 0) {
      output += "\n## 📜 Architectural Decisions\n\n";
      for (const decision of data.decisions.tracked.slice(0, 3)) {
        const icon = decision.status === "accepted" ? "✅" : "📝";
        output += `- ${icon} ${decision.title}\n`;
      }
    }
  } catch (err) {
    output += `⚠️ Team analysis incomplete: ${err.message}\n`;
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

async function handlePredictive(projectPath, args, __dirname) {
  let output = "# 🔮 Predictive Analytics\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" predict --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    const data = JSON.parse(result);

    if (data.quality) {
      output += "## Quality Prediction\n\n";
      output += `- **Current Score:** ${data.quality.currentScore}/100 ${getScoreIcon(data.quality.currentScore)}\n`;
      output += `- **Predicted Score:** ${data.quality.predictedScore}/100 (30 days)\n`;
      const trendIcon =
        data.quality.trend === "improving"
          ? "📈"
          : data.quality.trend === "degrading"
            ? "📉"
            : "➡️";
      output += `- **Trend:** ${trendIcon} ${data.quality.trend}\n`;
    }

    if (data.risk) {
      output += "\n## Risk Assessment\n\n";
      output += `**Overall Risk:** ${data.risk.overallRisk}%\n\n`;

      if (data.risk.categories) {
        output += "| Category | Risk | Trend |\n|----------|------|-------|\n";
        for (const cat of data.risk.categories.slice(0, 4)) {
          const trendIcon =
            cat.trend === "increasing"
              ? "📈"
              : cat.trend === "decreasing"
                ? "📉"
                : "➡️";
          output += `| ${cat.name} | ${cat.score}% | ${trendIcon} |\n`;
        }
      }
    }

    if (data.quality?.riskAreas && data.quality.riskAreas.length > 0) {
      output += "\n## 🎯 High-Risk Areas\n\n";
      for (const area of data.quality.riskAreas.slice(0, 5)) {
        output += `- **${area.riskScore}%** \`${area.path}\`\n`;
        output += `  - ${area.factors.join(", ")}\n`;
      }
    }

    if (data.anomalies?.detected && data.anomalies.detected.length > 0) {
      output += "\n## 🚨 Anomalies Detected\n\n";
      for (const anomaly of data.anomalies.detected.slice(0, 3)) {
        output += `- **${anomaly.severity.toUpperCase()}** ${anomaly.type} in ${anomaly.metric}\n`;
        output += `  - ${anomaly.context}\n`;
      }
    }

    if (
      data.growth?.capacityWarnings &&
      data.growth.capacityWarnings.length > 0
    ) {
      output += "\n## 📈 Growth Warnings\n\n";
      for (const warning of data.growth.capacityWarnings) {
        output += `- ⚠️ **${warning.metric}:** ${warning.timeToThreshold}\n`;
        output += `  - ${warning.recommendation}\n`;
      }
    }

    if (data.evolution?.trajectory) {
      output += "\n## 🔮 Trajectory\n\n";
      const trajIcon =
        data.evolution.trajectory.direction === "positive"
          ? "🚀"
          : data.evolution.trajectory.direction === "negative"
            ? "📉"
            : "➡️";
      output += `${trajIcon} **${data.evolution.trajectory.predictedState}**\n`;
    }
  } catch (err) {
    output += `⚠️ Predictive analysis incomplete: ${err.message}\n`;
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

async function handleFull(projectPath, args, __dirname) {
  let output = "# 🚀 Comprehensive Intelligence Analysis\n\n";
  output += `**Path:** ${projectPath}\n\n`;

  try {
    const cmd = `node "${path.join(__dirname, "..", "bin", "runners", "runIntelligence.js")}" full --json --path "${projectPath}"`;
    const result = execSync(cmd, {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      timeout: 300000,
    });
    const data = JSON.parse(result);

    if (data.summary) {
      const s = data.summary;
      output += "## Overall Results\n\n";
      output += `**Score:** ${s.overallScore}/100 ${getScoreIcon(s.overallScore)}  **Grade:** ${s.grade}\n\n`;

      const verdictIcon =
        s.verdict === "SHIP" ? "🚀" : s.verdict === "NO-SHIP" ? "🛑" : "⚠️";
      output += `**Verdict:** ${verdictIcon} ${s.verdict}\n\n`;

      output += "### Suite Scores\n\n";
      output += "| Suite | Score |\n|-------|-------|\n";
      output += `| AI Intelligence | ${s.scores?.ai || "N/A"}/100 ${getScoreIcon(s.scores?.ai)} |\n`;
      output += `| Security | ${s.scores?.security || "N/A"}/100 ${getScoreIcon(s.scores?.security)} |\n`;
      output += `| Architecture | ${s.scores?.architecture || "N/A"}/100 ${getScoreIcon(s.scores?.architecture)} |\n`;
      output += `| Supply Chain | ${s.scores?.supplyChain || "N/A"}/100 ${getScoreIcon(s.scores?.supplyChain)} |\n`;
      output += `| Team Health | ${s.scores?.team || "N/A"}/100 ${getScoreIcon(s.scores?.team)} |\n`;
      output += `| Risk Score | ${s.scores?.predictive || "N/A"}/100 ${getScoreIcon(s.scores?.predictive)} |\n`;

      if (s.criticalIssues > 0) {
        output += `\n⚠️ **${s.criticalIssues} Critical Issues Found** - Address before shipping\n`;
      }

      output += `\n_Analysis completed in ${((s.duration || 0) / 1000).toFixed(1)}s_\n`;
    }
  } catch (err) {
    output += `⚠️ Full analysis incomplete: ${err.message}\n`;
    output += "\nTry running individual suites for partial results.\n";
  }

  output += "\n---\n_Context Enhanced by guardrail AI_\n";
  return { content: [{ type: "text", text: output }] };
}

// ============================================================================
// HELPERS
// ============================================================================

function getScoreIcon(score) {
  if (score === undefined || score === null) return "";
  if (score >= 80) return "✅";
  if (score >= 60) return "⚠️";
  return "❌";
}

export default { INTELLIGENCE_TOOLS, handleIntelligenceTool };
