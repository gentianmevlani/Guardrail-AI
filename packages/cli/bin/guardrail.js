#!/usr/bin/env node

/**
 * Guardrail CLI — Enterprise AI Code Safety
 * Powered by VibeCheck engines.
 */

import('../dist/cli.js').then(m => m.runCLI()).catch(err => {
  console.error('Failed to start Guardrail CLI:', err.message);
  process.exit(1);
});
