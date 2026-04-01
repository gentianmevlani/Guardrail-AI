#!/usr/bin/env node
/**
 * Test individual MCP tools
 */

import { GUARDRAIL_TOOLS } from './guardrail-tools.js';
import { INTELLIGENCE_TOOLS } from './intelligence-tools.js';

console.log('🔧 Testing MCP Server Tools...\n');

// List all available tools
console.log('Available guardrail Tools:');
GUARDRAIL_TOOLS.forEach(tool => {
  console.log(`  - ${tool.name}: ${tool.description}`);
});

console.log('\nAvailable Intelligence Tools:');
INTELLIGENCE_TOOLS.forEach(tool => {
  console.log(`  - ${tool.name}: ${tool.description}`);
});

// Test a simple tool function
console.log('\n🧪 Testing tool execution...');

// Test guardrail.mdc function
try {
  const { handleGuardrailTool } = await import('./guardrail-tools.js');
  const result = await handleGuardrailTool('guardrail.mdc', {
    path: process.cwd(),
    output: 'test-output.mdc'
  });
  console.log('✅ guardrail.mdc tool executed successfully');
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (error) {
  console.log('❌ Tool execution failed:', error.message);
}
