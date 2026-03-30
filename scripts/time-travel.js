#!/usr/bin/env node

/**
 * Temporal Code Intelligence CLI
 * Time-travel through your code history with AI insights
 */

const { temporalCodeIntelligence } = require('../src/lib/temporal-code-intelligence');
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
      case 'history':
        const file = args[1];
        if (!file) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await showFileHistory(file, projectPath);
        break;

      case 'evolution':
        await showQualityEvolution(projectPath);
        break;

      case 'bug-origin':
        const bugDesc = args.slice(1).join(' ');
        if (!bugDesc) {
          console.error('❌ Please describe the bug');
          process.exit(1);
        }
        await findBugOrigin(bugDesc, projectPath);
        break;

      case 'rollback':
        await suggestRollbacks(projectPath);
        break;

      case 'compare':
        await comparePeriods(projectPath);
        break;

      case 'timeline':
        await generateTimeline(projectPath);
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

async function showFileHistory(file, projectPath) {
  const fullPath = path.resolve(file);
  console.log(`⏰ Analyzing history of ${file}...\n`);

  const history = await temporalCodeIntelligence.analyzeFileHistory(fullPath, {
    maxCommits: 20,
  });

  if (history.length === 0) {
    console.log('❌ No history found. Make sure the file is in a git repository.');
    return;
  }

  console.log(`✅ Found ${history.length} changes:\n`);

  history.forEach((change, index) => {
    console.log(`${index + 1}. ${change.date.toLocaleDateString()} by ${change.author}`);
    console.log(`   ${change.message}`);
    if (change.intent) {
      console.log(`   Intent: ${change.intent}`);
    }
    if (change.impact) {
      console.log(`   Impact: ${change.impact.type} (${change.impact.severity})`);
      if (change.impact.potentialIssues.length > 0) {
        console.log(`   Issues: ${change.impact.potentialIssues.join(', ')}`);
      }
    }
    console.log(`   Changes: +${change.additions} -${change.deletions}`);
    console.log('');
  });
}

async function showQualityEvolution(projectPath) {
  console.log('📊 Analyzing code quality evolution...\n');

  const analysis = await temporalCodeIntelligence.analyzeQualityEvolution(projectPath, {
    granularity: 'weekly',
  });

  console.log(`Period: ${analysis.period.start.toLocaleDateString()} - ${analysis.period.end.toLocaleDateString()}`);
  console.log(`Total commits: ${analysis.totalCommits}\n`);

  if (analysis.patterns.length > 0) {
    console.log('📈 Patterns detected:');
    analysis.patterns.forEach(pattern => {
      console.log(`   - ${pattern.type}: ${pattern.count} occurrences (${pattern.trend})`);
    });
    console.log('');
  }

  if (analysis.riskPeriods.length > 0) {
    console.log('⚠️  Risk periods:');
    analysis.riskPeriods.forEach(period => {
      console.log(`   - ${period.start.toLocaleDateString()} - ${period.end.toLocaleDateString()}`);
      console.log(`     Reason: ${period.reason} (${period.severity} severity)`);
    });
    console.log('');
  }

  if (analysis.recommendations.length > 0) {
    console.log('💡 Recommendations:');
    analysis.recommendations.forEach(rec => {
      console.log(`   - ${rec}`);
    });
  }
}

async function findBugOrigin(bugDescription, projectPath) {
  console.log(`🐛 Finding bug origin for: "${bugDescription}"\n`);

  // For demo, use current directory files
  const fs = require('fs').promises;
  const files = await fs.readdir(projectPath);
  const affectedFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.js')).slice(0, 3);

  if (affectedFiles.length === 0) {
    console.log('❌ No code files found in current directory');
    return;
  }

  const result = await temporalCodeIntelligence.findBugOrigin(
    projectPath,
    bugDescription,
    affectedFiles
  );

  console.log(`✅ Most likely origin: ${result.likelyCommit}`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(1)}%\n`);
  console.log(`Analysis:\n${result.analysis}\n`);

  if (result.relatedCommits.length > 0) {
    console.log('Related commits to investigate:');
    result.relatedCommits.forEach(commit => {
      console.log(`   - ${commit}`);
    });
  }
}

async function suggestRollbacks(projectPath) {
  console.log('🔄 Analyzing safe rollback points...\n');

  const suggestions = await temporalCodeIntelligence.suggestRollbackPoints(projectPath);

  if (suggestions.length === 0) {
    console.log('❌ No rollback suggestions available');
    return;
  }

  console.log(`✅ Found ${suggestions.length} potential rollback points:\n`);

  suggestions.forEach((suggestion, index) => {
    const riskEmoji = {
      low: '🟢',
      medium: '🟡',
      high: '🔴',
    }[suggestion.risk];

    console.log(`${index + 1}. ${riskEmoji} Commit: ${suggestion.commit.substring(0, 8)}`);
    console.log(`   Risk: ${suggestion.risk}`);
    console.log(`   Test Coverage: ${(suggestion.testCoverage * 100).toFixed(0)}%`);
    console.log(`   Reason: ${suggestion.reason}`);
    console.log(`   Recommendation: ${suggestion.recommendation}`);
    console.log(`   Affected files: ${suggestion.affectedFiles.length}`);
    console.log('');
  });
}

async function comparePeriods(projectPath) {
  console.log('📈 Comparing time periods...\n');

  const now = new Date();
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const comparison = await temporalCodeIntelligence.compareTimePeriods(
    projectPath,
    { start: twoWeeksAgo, end: lastWeek },
    { start: lastWeek, end: now }
  );

  console.log('Period 1 (two weeks ago):');
  Object.entries(comparison.metrics.period1).forEach(([key, value]) => {
    console.log(`   ${key}: ${value.toFixed(2)}`);
  });

  console.log('\nPeriod 2 (last week):');
  Object.entries(comparison.metrics.period2).forEach(([key, value]) => {
    console.log(`   ${key}: ${value.toFixed(2)}`);
  });

  console.log('\nChange:');
  Object.entries(comparison.metrics.change).forEach(([key, value]) => {
    const arrow = value > 0 ? '↑' : '↓';
    console.log(`   ${key}: ${arrow} ${Math.abs(value).toFixed(1)}%`);
  });

  if (comparison.regression) {
    console.log('\n⚠️  Regression detected!');
  }

  if (comparison.insights.length > 0) {
    console.log('\n💡 Insights:');
    comparison.insights.forEach(insight => {
      console.log(`   - ${insight}`);
    });
  }
}

async function generateTimeline(projectPath) {
  console.log('📅 Generating code evolution timeline...\n');

  const timeline = await temporalCodeIntelligence.generateTimeline(projectPath, {
    format: 'markdown',
    includeMetrics: true,
  });

  console.log(timeline);
}

function showHelp() {
  console.log(`
⏰ Temporal Code Intelligence

Revolutionary time-travel debugging with AI-powered insights about code history.

Commands:
  history <file>     Analyze the history of a specific file
  evolution          Analyze code quality evolution over time
  bug-origin <desc>  Find when a bug was likely introduced
  rollback           Suggest safe rollback points
  compare            Compare code between time periods
  timeline           Generate visual timeline of code evolution
  help               Show this help message

Examples:
  npm run time-travel history src/lib/api.ts
  npm run time-travel evolution
  npm run time-travel bug-origin "memory leak in user service"
  npm run time-travel rollback
  npm run time-travel compare
  npm run time-travel timeline

Features:
  ✅ Understand WHY changes were made
  ✅ Predict impact of changes
  ✅ Find bug origins automatically
  ✅ Suggest safe rollback points
  ✅ Track quality evolution
  ✅ Compare time periods

This is a UNIQUE feature - unlike git history, this understands INTENT and IMPACT!
  `);
}

main().catch(console.error);
