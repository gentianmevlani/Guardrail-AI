#!/usr/bin/env node

/**
 * Cross-Repository Intelligence CLI
 * Learn patterns from multiple projects
 */

const { crossRepositoryIntelligence } = require('../src/lib/cross-repo-intelligence');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case 'register':
        const paths = args.slice(1);
        if (paths.length === 0) {
          console.error('❌ Please provide repository paths');
          process.exit(1);
        }
        await registerRepos(paths);
        break;

      case 'learn':
        await learnPatterns();
        break;

      case 'best':
        const pattern = args.slice(1).join(' ');
        if (!pattern) {
          console.error('❌ Please provide a pattern to search');
          process.exit(1);
        }
        await findBestImplementation(pattern);
        break;

      case 'insights':
        const focus = args[1];
        await getInsights(focus);
        break;

      case 'compare':
        const feature = args.slice(1).join(' ');
        if (!feature) {
          console.error('❌ Please provide a feature to compare');
          process.exit(1);
        }
        await compareFeature(feature);
        break;

      case 'knowledge':
        await buildKnowledge();
        break;

      case 'recommend':
        await getRecommendations();
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

async function registerRepos(paths) {
  await crossRepositoryIntelligence.registerRepositories(paths);
  console.log('✅ Repositories registered successfully');
}

async function learnPatterns() {
  const patterns = await crossRepositoryIntelligence.learnPatterns();
  
  console.log(`\n📊 Learned ${patterns.length} patterns:\n`);
  
  patterns.slice(0, 10).forEach((pattern, idx) => {
    console.log(`${idx + 1}. ${pattern.pattern}`);
    console.log(`   Found in: ${pattern.repositories.join(', ')}`);
    console.log(`   Occurrences: ${pattern.occurrences}\n`);
  });
}

async function findBestImplementation(pattern) {
  const best = await crossRepositoryIntelligence.findBestImplementation(pattern);
  
  if (!best.repo) {
    console.log('❌ No implementation found');
    return;
  }

  console.log(`\n🏆 Best Implementation:\n`);
  console.log(`Repository: ${best.repo}`);
  console.log(`File: ${best.file}`);
  console.log(`Score: ${(best.score * 100).toFixed(0)}%\n`);
  
  console.log('✨ Reasons:');
  best.reasons.forEach(reason => console.log(`   - ${reason}`));
}

async function getInsights(focus) {
  const insights = await crossRepositoryIntelligence.getInsights(focus);
  
  console.log(`\n💡 Insights (${insights.length}):\n`);
  
  insights.forEach((insight, idx) => {
    const icon = {
      'best-practice': '✅',
      'anti-pattern': '❌',
      'common-solution': '📌',
      'unique-approach': '🌟',
    }[insight.type];

    console.log(`${idx + 1}. ${icon} ${insight.title}`);
    console.log(`   ${insight.description}`);
    console.log(`   Confidence: ${(insight.confidence * 100).toFixed(0)}%`);
    console.log(`   Recommendation: ${insight.recommendation}\n`);
  });
}

async function compareFeature(feature) {
  const comparison = await crossRepositoryIntelligence.compareAcrossRepos(feature);
  
  console.log(`\n📊 Comparing "${comparison.feature}" across repositories:\n`);
  
  comparison.implementations.forEach((impl, idx) => {
    console.log(`${idx + 1}. ${impl.repo}`);
    console.log(`   Approach: ${impl.approach}`);
    console.log(`   Complexity: ${impl.complexity}`);
    console.log(`   Test Coverage: ${impl.testCoverage}%`);
    console.log(`   Pros: ${impl.pros.join(', ')}`);
    console.log(`   Cons: ${impl.cons.join(', ')}\n`);
  });
  
  console.log(`💡 Recommendation: ${comparison.recommendation}`);
}

async function buildKnowledge() {
  const knowledge = await crossRepositoryIntelligence.buildTeamKnowledge();
  
  console.log(`\n🏗️ Team Knowledge Base:\n`);
  console.log(`Total Repositories: ${knowledge.totalRepos}`);
  console.log(`Total Files: ${knowledge.totalFiles}\n`);
  
  console.log('📚 Common Patterns:');
  knowledge.commonPatterns.slice(0, 5).forEach(p => {
    console.log(`   - ${p.pattern} (${p.occurrences} occurrences)`);
  });
  
  console.log('\n🔧 Team Preferences:');
  console.log('   Libraries:');
  knowledge.teamPreferences.libraries.slice(0, 5).forEach(l => {
    console.log(`      - ${l.name} (used in ${l.usage} repos)`);
  });
  
  console.log('\n✅ Knowledge base built successfully');
}

async function getRecommendations() {
  const recommendations = await crossRepositoryIntelligence.getRecommendations({
    currentRepo: process.cwd(),
    task: 'development',
  });
  
  console.log(`\n💬 Recommendations:\n`);
  
  recommendations.recommendations.forEach(rec => {
    console.log(`   ✅ ${rec}`);
  });
  
  console.log(`\n📁 Similar Projects:`);
  recommendations.similarProjects.forEach(proj => {
    console.log(`   - ${proj}`);
  });
  
  console.log(`\n📦 Suggested Libraries:`);
  recommendations.suggestedLibraries.forEach(lib => {
    console.log(`   - ${lib}`);
  });
  
  if (recommendations.expertContacts.length > 0) {
    console.log(`\n👥 Expert Contacts:`);
    recommendations.expertContacts.forEach(expert => {
      console.log(`   - ${expert}`);
    });
  }
}

function showHelp() {
  console.log(`
📚 Cross-Repository Intelligence

Learn patterns from multiple projects to provide intelligent suggestions.

Commands:
  register <paths...>        Register repositories for analysis
  learn                      Learn patterns across all repos
  best <pattern>             Find best implementation of a pattern
  insights [focus]           Get insights (focus: architecture/testing/security)
  compare <feature>          Compare feature implementations across repos
  knowledge                  Build team knowledge base
  recommend                  Get recommendations based on team knowledge
  help                       Show this help message

Examples:
  npm run cross-repo register ../project1 ../project2 ../project3
  npm run cross-repo learn
  npm run cross-repo best "error handling"
  npm run cross-repo insights security
  npm run cross-repo compare "authentication"
  npm run cross-repo knowledge
  npm run cross-repo recommend

Features:
  ✅ Learn from multiple projects simultaneously
  ✅ Find best implementations across repos
  ✅ Identify team-wide patterns and preferences
  ✅ Get recommendations based on collective knowledge
  ✅ Compare different approaches to same problem

This is a UNIQUE feature - NO other tool learns from multiple repos like this!
  `);
}

main().catch(console.error);
