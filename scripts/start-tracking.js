#!/usr/bin/env node

/**
 * Start Tracking
 * 
 * Start real-time tracking of API endpoints, components, etc.
 */

const { fileWatcher } = require('../src/lib/file-watcher.js');
const { apiEndpointTracker } = require('../src/lib/api-endpoint-tracker.js');
const { componentRegistry } = require('../src/lib/component-registry.js');

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         📡 guardrail AI - Real-Time Tracking                ║
║                                                              ║
║  Tracking API endpoints, components, and more...           ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

// Register change handlers
fileWatcher.onChange((change) => {
  console.log(`📝 ${change.type}: ${change.filePath}`);
});

// Start watching
fileWatcher.startWatching();

console.log('\n✅ Tracking started!\n');
console.log('Watching for changes in:');
console.log('  • API endpoints');
console.log('  • React components');
console.log('  • File changes\n');
console.log('Press Ctrl+C to stop tracking.\n');

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n\n🛑 Stopping tracking...\n');
  fileWatcher.stopWatching();
  process.exit(0);
});

