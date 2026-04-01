#!/usr/bin/env node

/**
 * Sync Decisions from Git and Comments
 * 
 * Automatically extracts architectural decisions
 */

const { decisionTracker } = require('../src/lib/decision-tracker');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║            🔄 Syncing Decisions                              ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  console.log(`Project: ${projectPath}\n`);

  try {
    console.log('📝 Extracting decisions from git history...');
    const gitDecisions = await decisionTracker.extractFromGit(projectPath);
    console.log(`   Found ${gitDecisions.length} decisions in git\n`);

    console.log('💬 Extracting decisions from code comments...');
    const commentDecisions = await decisionTracker.extractFromComments(projectPath);
    console.log(`   Found ${commentDecisions.length} decisions in comments\n`);

    console.log('💾 Syncing to knowledge base...');
    await decisionTracker.syncToKnowledgeBase(projectPath);

    console.log('\n✅ Decisions synced!\n');
    console.log('💡 The knowledge base now includes these decisions for context-aware assistance.\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

