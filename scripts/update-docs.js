#!/usr/bin/env node

/**
 * Update Documentation
 * 
 * Update all documentation files
 */

const { documentationUpdater } = require('../src/lib/documentation-updater.js');

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         📚 guardrail AI - Documentation Updater              ║
║                                                              ║
║  Updating README, Quick Start, Scripts, and API docs        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  try {
    const updates = await documentationUpdater.updateAll();

    console.log('\n✅ Documentation updated!\n');
    console.log(`Updated ${updates.length} file(s):\n`);

    updates.forEach(update => {
      console.log(`   📄 ${update.file}`);
      update.changes.forEach(change => {
        console.log(`      ${change.type === 'added' ? '➕' : change.type === 'updated' ? '🔄' : '➖'} ${change.section}`);
      });
    });

    console.log('');
  } catch (error) {
    console.error(`\n❌ Error updating documentation: ${error.message}\n`);
    process.exit(1);
  }
}

main();

