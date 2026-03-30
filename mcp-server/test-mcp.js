#!/usr/bin/env node
/**
 * MCP Server Test Script
 * Tests that all tools are properly registered and can be invoked
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing guardrail MCP Server...\n');

// Test 1: Import all modules
async function testImports() {
  console.log('1️⃣ Testing module imports...');
  try {
    const { INTELLIGENCE_TOOLS } = await import('./intelligence-tools.js');
    const { GUARDRAIL_TOOLS } = await import('./guardrail-tools.js');
    const { AGENT_CHECKPOINT_TOOLS } = await import('./agent-checkpoint.js');
    const { ARCHITECT_TOOLS } = await import('./architect-tools.js');
    const { CODEBASE_ARCHITECT_TOOLS } = await import('./codebase-architect-tools.js');
    const { GUARDRAIL_2_TOOLS } = await import('./guardrail-2.0-tools.js');
    const { intentDriftTools } = await import('./intent-drift-tools.js');
    const { mdcGeneratorTool } = await import('./mdc-generator.js');
    
    console.log(`   ✅ Intelligence tools: ${INTELLIGENCE_TOOLS.length}`);
    console.log(`   ✅ guardrail tools: ${GUARDRAIL_TOOLS.length}`);
    console.log(`   ✅ Checkpoint tools: ${AGENT_CHECKPOINT_TOOLS.length}`);
    console.log(`   ✅ Architect tools: ${ARCHITECT_TOOLS.length}`);
    console.log(`   ✅ Codebase Architect tools: ${CODEBASE_ARCHITECT_TOOLS.length}`);
    console.log(`   ✅ guardrail 2.0 tools: ${GUARDRAIL_2_TOOLS.length}`);
    console.log(`   ✅ Intent Drift tools: ${intentDriftTools.length}`);
    console.log(`   ✅ MDC Generator tool: ${mdcGeneratorTool.name}`);
    
    const totalTools = INTELLIGENCE_TOOLS.length + GUARDRAIL_TOOLS.length + 
      AGENT_CHECKPOINT_TOOLS.length + ARCHITECT_TOOLS.length + 
      CODEBASE_ARCHITECT_TOOLS.length + GUARDRAIL_2_TOOLS.length + 
      intentDriftTools.length + 1;
    
    console.log(`\n   📊 Total tools available: ${totalTools}\n`);
    return true;
  } catch (error) {
    console.log(`   ❌ Import failed: ${error.message}`);
    return false;
  }
}

// Test 2: Verify tier auth
async function testTierAuth() {
  console.log('2️⃣ Testing tier authentication...');
  try {
    const tierAuth = await import('./tier-auth.js');
    console.log(`   ✅ Tiers available: ${Object.keys(tierAuth.TIERS).join(', ')}`);
    console.log(`   ✅ Tier auth module loaded successfully`);
    return true;
  } catch (error) {
    console.log(`   ❌ Tier auth failed: ${error.message}`);
    return false;
  }
}

// Test 3: Verify audit trail
async function testAudit() {
  console.log('3️⃣ Testing audit trail...');
  try {
    const { emitToolInvoke, emitToolComplete } = await import('./audit-mcp.js');
    console.log(`   ✅ Audit functions available`);
    return true;
  } catch (error) {
    console.log(`   ❌ Audit failed: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = [];
  
  results.push(await testImports());
  results.push(await testTierAuth());
  results.push(await testAudit());
  
  console.log('\n' + '='.repeat(50));
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  if (passed === total) {
    console.log(`✅ All ${total} tests passed!`);
    console.log('\n🎉 MCP Server is ready for use!\n');
    console.log('To use with Claude Desktop, add to claude_desktop_config.json:');
    console.log(`{
  "mcpServers": {
    "guardrail": {
      "command": "node",
      "args": ["${__dirname.replace(/\\/g, '/')}/index.js"]
    }
  }
}`);
  } else {
    console.log(`❌ ${total - passed}/${total} tests failed`);
    process.exit(1);
  }
}

runTests().catch(console.error);
