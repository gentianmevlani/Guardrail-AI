#!/usr/bin/env node

/**
 * Test script for guardrail.smells MCP tool
 */

const { codeSmellPredictor } = require('../src/lib/code-smell-predictor');
const path = require('path');

async function testMCPTool() {
  console.log('🧪 Testing guardrail.smells MCP tool\n');
  
  const projectPath = path.join(__dirname, '../examples/demo-for-video');
  
  try {
    console.log('📁 Testing basic functionality...');
    const basicReport = await codeSmellPredictor.predict(projectPath);
    
    console.log(`✅ Basic test - Total smells: ${basicReport.totalSmells}`);
    console.log(`   Estimated debt: ${basicReport.estimatedDebt} hours\n`);
    
    console.log('🚀 Testing PRO features...');
    const proReport = await codeSmellPredictor.predict(projectPath);
    
    console.log(`✅ PRO test - Total smells: ${proReport.totalSmells}`);
    console.log(`   AI-adjusted debt: ${proReport.estimatedDebt} hours`);
    console.log(`   Trends: ${proReport.trends.length} trends detected\n`);
    
    // Test MCP response format
    const mcpResponse = {
      success: proReport.smells.filter(s => s.severity === 'critical').length === 0,
      total: proReport.totalSmells,
      critical: proReport.critical,
      estimatedDebt: proReport.estimatedDebt,
      estimatedDebtAI: proReport.estimatedDebt,
      bySeverity: {
        critical: proReport.smells.filter(s => s.severity === 'critical').length,
        high: proReport.smells.filter(s => s.severity === 'high').length,
        medium: proReport.smells.filter(s => s.severity === 'medium').length,
        low: proReport.smells.filter(s => s.severity === 'low').length,
      },
      smells: proReport.smells.slice(0, 5),
      trends: proReport.trends,
      recommendations: proReport.smells.flatMap(s => s.recommendation).slice(0, 10),
      summary: proReport.totalSmells === 0
        ? "✅ No significant code smells detected (PRO Analysis)"
        : `⚠️ Found ${proReport.totalSmells} code smell(s) - ${proReport.estimatedDebt}h AI-assisted debt (PRO Analysis)`,
      proFeatures: {
        advancedPredictor: true,
        technicalDebtCalculation: true,
        trendAnalysis: true,
        recommendations: true,
        aiAdjustedTimelines: true
      }
    };
    
    console.log('📊 MCP Response Format:');
    console.log(JSON.stringify(mcpResponse, null, 2));
    
    console.log('\n✅ MCP tool test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testMCPTool();
