#!/usr/bin/env node

/**
 * Vibecoder Check
 * 
 * Detects what AI app builders forget - the gap between
 * "looks good" and "actually works in production"
 */

const { vibecoderDetector } = require('../src/lib/vibecoder-detector');
const path = require('path');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🎯 Vibecoder Readiness Check                        ║
║                                                              ║
║  Finds what AI app builders forget - the gap between        ║
║  "looks good" and "actually works in production"             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Analyzing: ${projectPath}\n`);

  try {
    console.log('🔍 Checking for missing features...\n');
    const report = await vibecoderDetector.analyze(projectPath);

    // Score
    const scoreIcon = report.score >= 80 ? '🟢' : report.score >= 60 ? '🟡' : '🔴';
    console.log(`📊 SHIPPING READINESS SCORE\n`);
    console.log(`   ${scoreIcon} ${report.score}/100\n`);

    if (report.canShip) {
      console.log('✅ Ready to ship!\n');
    } else {
      console.log('❌ Not ready to ship - critical features missing\n');
    }

    // Critical features
    if (report.missingCritical.length > 0) {
      console.log('🚨 CRITICAL - Blocks Shipping\n');
      report.missingCritical.forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature.feature}`);
        console.log(`      ${feature.description}`);
        console.log(`      Why it matters: ${feature.whyItMatters}`);
        console.log(`      Impact: ${feature.impact}`);
        console.log('');
      });
    }

    // Essential features
    if (report.missingEssential.length > 0) {
      console.log('⚠️  ESSENTIAL - Poor UX Without These\n');
      report.missingEssential.forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature.feature}`);
        console.log(`      ${feature.description}`);
        console.log(`      Why it matters: ${feature.whyItMatters}`);
        console.log('');
      });
    }

    // Important features
    if (report.missingImportant.length > 0) {
      console.log('💡 IMPORTANT - Scalability/Security\n');
      report.missingImportant.forEach((feature, i) => {
        console.log(`   ${i + 1}. ${feature.feature}`);
        console.log(`      ${feature.description}`);
        console.log('');
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS\n');
      report.recommendations.forEach((rec, i) => {
        console.log(`   ${i + 1}. ${rec}`);
      });
      console.log('');
    }

    // Time to ship
    console.log(`⏱️  Estimated time to ship: ${report.estimatedTimeToShip}\n`);

    console.log('💡 Next steps:');
    console.log('   1. Fix critical features first');
    console.log('   2. Add essential features for better UX');
    console.log('   3. Add important features for scale/security');
    console.log('   4. Run architect agent to apply templates\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

