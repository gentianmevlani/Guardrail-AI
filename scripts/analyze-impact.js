#!/usr/bin/env node

/**
 * Change Impact Analysis
 * 
 * Analyzes what breaks when you change a file
 */

const { changeImpactAnalyzer } = require('../src/lib/change-impact');
const path = require('path');

async function main() {
  const filePath = process.argv[2];
  const projectPath = process.argv[3] || process.cwd();

  if (!filePath) {
    console.log('Usage: npm run analyze-impact <file-path> [project-path]\n');
    console.log('Example: npm run analyze-impact src/components/Button.tsx\n');
    process.exit(1);
  }

  const fullPath = path.resolve(projectPath, filePath);

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🔍 Change Impact Analysis                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`Analyzing: ${filePath}\n`);

  try {
    const impact = await changeImpactAnalyzer.analyzeImpact(fullPath, projectPath);

    const riskIcon = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    }[impact.risk] || '⚪';

    console.log(`📊 IMPACT ANALYSIS\n`);
    console.log(`   Risk Level: ${riskIcon} ${impact.risk.toUpperCase()}\n`);

    console.log(`   Direct Impact: ${impact.directImpact.length} file(s)`);
    if (impact.directImpact.length > 0) {
      impact.directImpact.slice(0, 5).forEach(file => {
        console.log(`      • ${file}`);
      });
      if (impact.directImpact.length > 5) {
        console.log(`      ... and ${impact.directImpact.length - 5} more`);
      }
    }

    console.log(`\n   Indirect Impact: ${impact.indirectImpact.length} file(s)`);
    if (impact.indirectImpact.length > 0) {
      impact.indirectImpact.slice(0, 5).forEach(file => {
        console.log(`      • ${file}`);
      });
      if (impact.indirectImpact.length > 5) {
        console.log(`      ... and ${impact.indirectImpact.length - 5} more`);
      }
    }

    if (impact.breakingChanges.length > 0) {
      console.log(`\n   ⚠️  Breaking Changes: ${impact.breakingChanges.length}`);
      impact.breakingChanges.forEach(change => {
        console.log(`      • ${change.type}: ${change.name}`);
        console.log(`        Affects: ${change.affectedFiles.length} file(s)`);
      });
    }

    if (impact.suggestions.length > 0) {
      console.log(`\n   💡 Suggestions:\n`);
      impact.suggestions.forEach(suggestion => {
        console.log(`      ${suggestion}`);
      });
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('Knowledge base')) {
      console.log('\n💡 Run "npm run build-knowledge" first\n');
    }
    process.exit(1);
  }
}

main();

