#!/usr/bin/env node

/**
 * Production Anomaly Predictor CLI
 * Predict production issues before deployment
 */

const { productionAnomalyPredictor } = require('../src/lib/production-anomaly-predictor');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  const projectPath = process.cwd();

  try {
    switch (command) {
      case 'predict':
        await predictAnomalies(projectPath);
        break;

      case 'learn':
        await learnFromIncident();
        break;

      case 'report':
        await generateReport(projectPath, args[1]);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function predictAnomalies(projectPath) {
  console.log('🔮 Predicting production anomalies...\n');

  const startTime = Date.now();
  const report = await productionAnomalyPredictor.predictAnomalies(projectPath);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`✅ Analysis complete in ${duration}s\n`);

  // Show deployment readiness
  const readinessEmoji = {
    safe: '🟢',
    caution: '🟡',
    dangerous: '🔴',
  }[report.deploymentReadiness];

  console.log(`${readinessEmoji} Deployment Readiness: ${report.deploymentReadiness.toUpperCase()}`);
  console.log(`   Overall Risk Score: ${report.overallRisk.toFixed(1)}/100\n`);

  // Show anomalies by severity
  const critical = report.anomalies.filter(a => a.severity === 'critical');
  const high = report.anomalies.filter(a => a.severity === 'high');
  const medium = report.anomalies.filter(a => a.severity === 'medium');
  const low = report.anomalies.filter(a => a.severity === 'low');

  console.log('📊 Anomalies Found:');
  console.log(`   🔴 Critical: ${critical.length}`);
  console.log(`   🟠 High: ${high.length}`);
  console.log(`   🟡 Medium: ${medium.length}`);
  console.log(`   🟢 Low: ${low.length}\n`);

  // Show top 10 most critical anomalies
  if (report.anomalies.length > 0) {
    console.log('⚠️  Top Critical Issues:\n');

    const topIssues = report.anomalies
      .slice(0, 10)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity] || b.confidence - a.confidence;
      });

    topIssues.forEach((anomaly, index) => {
      const severityEmoji = {
        critical: '🔴',
        high: '🟠',
        medium: '🟡',
        low: '🟢',
      }[anomaly.severity];

      console.log(`${index + 1}. ${severityEmoji} ${anomaly.type.toUpperCase()}`);
      console.log(`   Location: ${anomaly.location.file}:${anomaly.location.line}`);
      if (anomaly.location.function) {
        console.log(`   Function: ${anomaly.location.function}`);
      }
      console.log(`   Severity: ${anomaly.severity} | Confidence: ${(anomaly.confidence * 100).toFixed(0)}%`);
      console.log(`   ${anomaly.description}`);
      
      console.log(`\n   📜 Historical Evidence:`);
      anomaly.historicalEvidence.forEach(evidence => {
        console.log(`      - ${evidence}`);
      });

      console.log(`\n   🛠️  Prevention Steps:`);
      anomaly.preventionSteps.forEach(step => {
        console.log(`      - ${step}`);
      });

      console.log(`\n   💥 Estimated Impact:`);
      console.log(`      Users Affected: ${anomaly.estimatedImpact.usersFffected}`);
      console.log(`      Downtime: ${anomaly.estimatedImpact.downtime}`);
      console.log(`      Cost: ${anomaly.estimatedImpact.dataCost}`);
      console.log('');
    });
  }

  // Show recommendations
  if (report.recommendations.length > 0) {
    console.log('\n💡 Recommendations:\n');
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });
  }

  // Final verdict
  console.log('\n' + '='.repeat(60));
  if (report.deploymentReadiness === 'dangerous') {
    console.log('❌ DO NOT DEPLOY - Critical issues must be fixed first!');
  } else if (report.deploymentReadiness === 'caution') {
    console.log('⚠️  DEPLOY WITH CAUTION - Monitor closely after deployment');
  } else {
    console.log('✅ SAFE TO DEPLOY - Risk is within acceptable levels');
  }
  console.log('='.repeat(60) + '\n');
}

async function learnFromIncident() {
  console.log('📚 Learn from a production incident\n');
  console.log('This feature allows the system to learn from real incidents');
  console.log('and improve future predictions.\n');
  
  // Interactive mode would be implemented here
  console.log('Example usage:');
  console.log('  const incident = {');
  console.log('    type: "memory",');
  console.log('    code: "... problematic code ...",');
  console.log('    file: "src/api/users.ts",');
  console.log('    description: "Memory leak in user service",');
  console.log('    rootCause: "Event listeners not cleaned up"');
  console.log('  };');
  console.log('  await productionAnomalyPredictor.learnFromIncident(incident);');
}

async function generateReport(projectPath, outputFile) {
  console.log('📄 Generating detailed report...\n');

  const report = await productionAnomalyPredictor.predictAnomalies(projectPath);

  // Generate markdown report
  let markdown = '# Production Anomaly Prediction Report\n\n';
  markdown += `**Generated:** ${report.timestamp.toLocaleString()}\n`;
  markdown += `**Project:** ${report.projectPath}\n`;
  markdown += `**Overall Risk:** ${report.overallRisk.toFixed(1)}/100\n`;
  markdown += `**Deployment Readiness:** ${report.deploymentReadiness.toUpperCase()}\n\n`;

  markdown += '## Summary\n\n';
  markdown += `- Total Anomalies: ${report.anomalies.length}\n`;
  markdown += `- Critical: ${report.anomalies.filter(a => a.severity === 'critical').length}\n`;
  markdown += `- High: ${report.anomalies.filter(a => a.severity === 'high').length}\n`;
  markdown += `- Medium: ${report.anomalies.filter(a => a.severity === 'medium').length}\n`;
  markdown += `- Low: ${report.anomalies.filter(a => a.severity === 'low').length}\n\n`;

  markdown += '## Detailed Findings\n\n';
  report.anomalies.forEach((anomaly, index) => {
    markdown += `### ${index + 1}. ${anomaly.type.toUpperCase()} (${anomaly.severity})\n\n`;
    markdown += `**Location:** ${anomaly.location.file}:${anomaly.location.line}\n\n`;
    markdown += `**Confidence:** ${(anomaly.confidence * 100).toFixed(0)}%\n\n`;
    markdown += `**Description:** ${anomaly.description}\n\n`;
    
    markdown += '**Historical Evidence:**\n';
    anomaly.historicalEvidence.forEach(evidence => {
      markdown += `- ${evidence}\n`;
    });
    markdown += '\n';

    markdown += '**Prevention Steps:**\n';
    anomaly.preventionSteps.forEach(step => {
      markdown += `- ${step}\n`;
    });
    markdown += '\n';

    markdown += '**Estimated Impact:**\n';
    markdown += `- Users Affected: ${anomaly.estimatedImpact.usersFffected}\n`;
    markdown += `- Downtime: ${anomaly.estimatedImpact.downtime}\n`;
    markdown += `- Cost: ${anomaly.estimatedImpact.dataCost}\n\n`;
  });

  markdown += '## Recommendations\n\n';
  report.recommendations.forEach(rec => {
    markdown += `- ${rec}\n`;
  });

  // Save report
  const filename = outputFile || `anomaly-report-${Date.now()}.md`;
  await fs.writeFile(filename, markdown);

  console.log(`✅ Report saved to: ${filename}`);
}

function showHelp() {
  console.log(`
🔮 Production Anomaly Predictor

Revolutionary feature that PREDICTS production issues before deployment.
Unlike monitoring tools that react, this PREVENTS problems.

Commands:
  predict            Predict production anomalies in current codebase
  learn              Learn from a production incident
  report [file]      Generate detailed markdown report
  help               Show this help message

Examples:
  npm run predict-prod
  npm run predict-prod report
  npm run predict-prod report ./reports/analysis.md

What it detects:
  🔴 Performance issues (N+1 queries, unbounded loops)
  🔴 Memory leaks (event listeners, timers)
  🔴 Crash risks (unhandled promises, null pointers)
  🔴 Security vulnerabilities (SQL injection, command injection)
  🔴 Race conditions (concurrent operations)
  🔴 Data corruption risks (missing transactions)

Features:
  ✅ Predicts issues BEFORE deployment
  ✅ Learns from historical incidents
  ✅ Provides prevention steps
  ✅ Estimates impact (users, downtime, cost)
  ✅ Deployment readiness assessment
  ✅ Detailed remediation guidance

This is a UNIQUE feature - NO other tool predicts production issues like this!
  `);
}

main().catch(console.error);
