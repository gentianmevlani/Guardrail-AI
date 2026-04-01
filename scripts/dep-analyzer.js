#!/usr/bin/env node

/**
 * Dependency Impact Analyzer CLI
 * Predict dependency update impact before updating
 */

const { automatedDependencyImpactAnalyzer } = require('../src/lib/dependency-impact-analyzer');

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
      case 'analyze':
        const dep = args[1];
        const version = args[2];
        if (!dep) {
          console.error('❌ Please provide dependency name');
          process.exit(1);
        }
        await analyzeDependency(projectPath, dep, version);
        break;

      case 'all':
        await analyzeAll(projectPath);
        break;

      case 'plan':
        await generatePlan(projectPath);
        break;

      case 'transitive':
        const transDep = args[1];
        if (!transDep) {
          console.error('❌ Please provide dependency name');
          process.exit(1);
        }
        await analyzeTransitive(projectPath, transDep);
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

async function analyzeDependency(projectPath, dep, version) {
  console.log(`🔍 Analyzing impact of updating ${dep}...\n`);

  const analysis = await automatedDependencyImpactAnalyzer.analyzeDependencyUpdate(
    projectPath,
    dep,
    version
  );

  const riskIcon = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  }[analysis.overallRisk];

  console.log(`${riskIcon} Overall Risk: ${analysis.overallRisk.toUpperCase()}`);
  console.log(`   Risk Score: ${analysis.riskScore}/100`);
  console.log(`   ${analysis.currentVersion} → ${analysis.targetVersion}\n`);

  if (analysis.breakingChanges.length > 0) {
    console.log(`⚠️  Breaking Changes (${analysis.breakingChanges.length}):\n`);
    analysis.breakingChanges.forEach((change, idx) => {
      console.log(`${idx + 1}. ${change.description}`);
      console.log(`   Severity: ${change.severity}`);
      console.log(`   Affected: ${change.affectedCode.length} location(s)\n`);
    });
  }

  if (analysis.compatibilityIssues.length > 0) {
    console.log('🔌 Compatibility Issues:');
    analysis.compatibilityIssues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
    console.log('');
  }

  console.log('⏱️  Estimated Effort:');
  console.log(`   Time: ${analysis.estimatedEffort.hours} hours`);
  console.log(`   Complexity: ${analysis.estimatedEffort.complexity}\n`);

  console.log('💡 Recommendations:');
  analysis.recommendations.forEach(rec => {
    console.log(`   - ${rec}`);
  });

  console.log(`\n${analysis.safeToUpdate ? '✅ SAFE TO UPDATE' : '⚠️  UPDATE WITH CAUTION'}`);
}

async function analyzeAll(projectPath) {
  console.log('📊 Analyzing all dependencies...\n');

  const result = await automatedDependencyImpactAnalyzer.analyzeAllUpdates(projectPath);

  console.log(`📦 Total Dependencies: ${result.totalDependencies}`);
  console.log(`📈 Outdated: ${result.outdated}\n`);

  console.log('📊 Summary:');
  console.log(`   🟢 Safe: ${result.summary.safe}`);
  console.log(`   🟡 Caution: ${result.summary.caution}`);
  console.log(`   🔴 Risky: ${result.summary.risky}\n`);

  if (result.analyses.length > 0) {
    console.log('⚠️  Top 10 Updates to Review:\n');
    
    const sorted = result.analyses
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 10);

    sorted.forEach((analysis, idx) => {
      const riskIcon = {
        low: '🟢',
        medium: '🟡',
        high: '🟠',
        critical: '🔴',
      }[analysis.overallRisk];

      console.log(`${idx + 1}. ${riskIcon} ${analysis.dependency}`);
      console.log(`   ${analysis.currentVersion} → ${analysis.targetVersion}`);
      console.log(`   Risk: ${analysis.overallRisk} (${analysis.riskScore}/100)`);
      console.log(`   Breaking changes: ${analysis.breakingChanges.length}`);
      console.log('');
    });
  }

  if (result.recommendations.length > 0) {
    console.log('💡 Global Recommendations:');
    result.recommendations.forEach(rec => {
      console.log(`   - ${rec}`);
    });
  }
}

async function generatePlan(projectPath) {
  console.log('📋 Generating update plan...\n');

  const plan = await automatedDependencyImpactAnalyzer.generateUpdatePlan(projectPath);

  console.log('📦 Update Plan:\n');

  plan.dependencies.forEach(dep => {
    console.log(`${dep.order}. ${dep.name}`);
    console.log(`   ${dep.from} → ${dep.to}`);
    console.log(`   ${dep.reason}\n`);
  });

  console.log(`⏱️  Total Estimated Time: ${plan.totalEstimatedTime.toFixed(1)} hours\n`);

  if (plan.risks.length > 0) {
    console.log('⚠️  Risks:');
    plan.risks.forEach(risk => console.log(`   - ${risk}`));
    console.log('');
  }

  if (plan.prerequisites.length > 0) {
    console.log('📋 Prerequisites:');
    plan.prerequisites.forEach(prereq => console.log(`   - ${prereq}`));
    console.log('');
  }

  if (plan.testingStrategy.length > 0) {
    console.log('🧪 Testing Strategy:');
    plan.testingStrategy.forEach(test => console.log(`   - ${test}`));
  }
}

async function analyzeTransitive(projectPath, dep) {
  console.log(`🔗 Analyzing transitive dependencies for ${dep}...\n`);

  const result = await automatedDependencyImpactAnalyzer.predictTransitiveIssues(
    projectPath,
    dep
  );

  if (result.affectedDependencies.length > 0) {
    console.log(`📦 Affected Dependencies (${result.affectedDependencies.length}):`);
    result.affectedDependencies.slice(0, 10).forEach(dep => {
      console.log(`   - ${dep}`);
    });
    console.log('');
  }

  if (result.conflicts.length > 0) {
    console.log('⚠️  Conflicts:');
    result.conflicts.forEach(conflict => {
      console.log(`   ${conflict.dependency}: ${conflict.issue}`);
      console.log(`   Resolution: ${conflict.resolution}\n`);
    });
  }

  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(warning => console.log(`   - ${warning}`));
  }
}

function showHelp() {
  console.log(`
🔍 Automated Dependency Impact Analyzer

Predict how dependency updates will affect your code BEFORE you update.

Commands:
  analyze <dep> [version]    Analyze impact of updating a dependency
  all                        Analyze all dependencies
  plan                       Generate optimal update plan
  transitive <dep>           Analyze transitive dependency issues
  help                       Show this help message

Examples:
  npm run dep-analyzer analyze react
  npm run dep-analyzer analyze express 5.0.0
  npm run dep-analyzer all
  npm run dep-analyzer plan
  npm run dep-analyzer transitive webpack

Features:
  ✅ Predicts breaking changes
  ✅ Identifies compatibility issues
  ✅ Estimates update effort
  ✅ Generates optimal update order
  ✅ Analyzes transitive dependencies
  ✅ Provides specific recommendations

This is a UNIQUE feature - PREDICTS impact BEFORE updating!
  `);
}

main().catch(console.error);
