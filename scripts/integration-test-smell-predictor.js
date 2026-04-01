#!/usr/bin/env node

/**
 * Simple integration test for Code Smell Predictor
 * Demonstrates the predictor working on sample files
 */

const { codeSmellPredictor } = require('../src/lib/code-smell-predictor');
const path = require('path');

async function runIntegrationTest() {
  console.log('🧪 Running Code Smell Predictor Integration Test\n');
  
  const demoPath = path.join(__dirname, '../examples/demo-for-video');
  
  try {
    console.log(`📁 Analyzing demo files in: ${demoPath}\n`);
    
    const report = await codeSmellPredictor.predict(demoPath);
    
    console.log('📊 Results:');
    console.log(`   Total Smells: ${report.totalSmells}`);
    console.log(`   Critical: ${report.critical}`);
    console.log(`   Estimated Debt: ${report.estimatedDebt} hours\n`);
    
    if (report.smells.length > 0) {
      console.log('🔍 Detected Smells:');
      report.smells.forEach((smell, index) => {
        console.log(`   ${index + 1}. ${smell.type.toUpperCase()} - ${smell.severity.toUpperCase()}`);
        console.log(`      File: ${smell.file}${smell.line ? `:${smell.line}` : ''}`);
        console.log(`      Description: ${smell.description}`);
        console.log(`      Current: ${smell.metrics.current} (threshold: ${smell.metrics.threshold})`);
        console.log(`      Prediction: ${smell.prediction.when} - ${smell.prediction.impact}\n`);
      });
    } else {
      console.log('✅ No code smells detected!\n');
    }
    
    console.log('📈 Trends:');
    report.trends.forEach(trend => {
      console.log(`   ${trend.type}: ${trend.trend} (${trend.change > 0 ? '+' : ''}${trend.change})`);
    });
    
    console.log('\n✅ Integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    process.exit(1);
  }
}

runIntegrationTest();
