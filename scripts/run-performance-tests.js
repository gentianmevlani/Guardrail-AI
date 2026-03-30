#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Performance test configuration
const config = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  reportDir: path.join(__dirname, '../reports/performance'),
  timestamp: new Date().toISOString().replace(/[:.]/g, '-')
};

// Create report directory
if (!fs.existsSync(config.reportDir)) {
  fs.mkdirSync(config.reportDir, { recursive: true });
}

console.log('🚀 Starting Performance Tests');
console.log(`📍 Target: ${config.baseUrl}`);
console.log(`📊 Report will be saved to: ${config.reportDir}`);

// Test scenarios to run
const scenarios = [
  {
    name: 'Basic Load Test',
    file: 'tests/performance/load-test.yml',
    description: 'Tests basic API endpoints under load'
  },
  {
    name: 'Stress Test',
    file: 'tests/performance/stress-test.yml',
    description: 'Tests system limits under extreme load'
  },
  {
    name: 'Spike Test',
    file: 'tests/performance/spike-test.yml',
    description: 'Tests sudden traffic spikes'
  }
];

// Run each test scenario
async function runTests() {
  const results = [];
  
  for (const scenario of scenarios) {
    console.log(`\n📋 Running: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    try {
      // Check if test file exists
      const testFile = path.join(__dirname, '..', scenario.file);
      if (!fs.existsSync(testFile)) {
        console.log(`⚠️  Test file not found: ${testFile}`);
        console.log('   Skipping this scenario...');
        continue;
      }
      
      // Run Artillery test
      const reportFile = path.join(config.reportDir, `${scenario.name.toLowerCase().replace(/\s+/g, '-')}-${config.timestamp}.json`);
      
      const command = `npx artillery run ${testFile} --target ${config.baseUrl} --output ${reportFile}`;
      console.log(`   Executing: ${command}`);
      
      const output = execSync(command, { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      // Parse results
      const result = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
      
      results.push({
        name: scenario.name,
        status: 'passed',
        metrics: {
          totalRequests: result.aggregate.counters['http.requests'],
          completedRequests: result.aggregate.counters['http.responses.200'],
          failedRequests: result.aggregate.counters['http.codes.4xx'] + result.aggregate.counters['http.codes.5xx'],
          responseTime: {
            min: result.aggregate.latency.min,
            max: result.aggregate.latency.max,
            median: result.aggregate.latency.median,
            p95: result.aggregate.latency.p95,
            p99: result.aggregate.latency.p99
          },
          rps: result.aggregate.rps.mean
        }
      });
      
      console.log(`   ✅ Completed - RPS: ${result.aggregate.rps.mean}, P95: ${result.aggregate.latency.p95}ms`);
      
    } catch (error) {
      console.error(`   ❌ Failed: ${error.message}`);
      results.push({
        name: scenario.name,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  // Generate summary report
  generateSummaryReport(results);
  
  // Check performance thresholds
  checkThresholds(results);
}

function generateSummaryReport(results) {
  const reportFile = path.join(config.reportDir, `summary-${config.timestamp}.html`);
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Performance Test Report - ${new Date().toLocaleString()}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .test-result { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
    .passed { border-left: 5px solid #4CAF50; }
    .failed { border-left: 5px solid #f44336; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-top: 10px; }
    .metric { background: #f9f9f9; padding: 10px; border-radius: 3px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚀 guardrail Performance Test Report</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>Target: ${config.baseUrl}</p>
  </div>
  
  <h2>📊 Test Results Summary</h2>
  <table>
    <tr>
      <th>Test Scenario</th>
      <th>Status</th>
      <th>Requests/s</th>
      <th>P95 Response Time</th>
      <th>Success Rate</th>
    </tr>
  `;
  
  results.forEach(result => {
    if (result.status === 'passed') {
      const successRate = ((result.metrics.completedRequests / result.metrics.totalRequests) * 100).toFixed(2);
      html += `
    <tr>
      <td>${result.name}</td>
      <td style="color: #4CAF50">✅ Passed</td>
      <td>${result.metrics.rps.toFixed(2)}</td>
      <td>${result.metrics.responseTime.p95}ms</td>
      <td>${successRate}%</td>
    </tr>
      `;
    } else {
      html += `
    <tr>
      <td>${result.name}</td>
      <td style="color: #f44336">❌ Failed</td>
      <td>-</td>
      <td>-</td>
      <td>-</td>
    </tr>
      `;
    }
  });
  
  html += `
  </table>
  
  <h2>📈 Detailed Results</h2>
  `;
  
  results.forEach(result => {
    const statusClass = result.status === 'passed' ? 'passed' : 'failed';
    html += `
  <div class="test-result ${statusClass}">
    <h3>${result.name}</h3>
    <p>Status: ${result.status === 'passed' ? '✅ Passed' : '❌ Failed'}</p>
    `;
    
    if (result.status === 'passed') {
      html += `
    <div class="metrics">
      <div class="metric">
        <strong>Total Requests</strong><br>
        ${result.metrics.totalRequests}
      </div>
      <div class="metric">
        <strong>Completed</strong><br>
        ${result.metrics.completedRequests}
      </div>
      <div class="metric">
        <strong>Failed</strong><br>
        ${result.metrics.failedRequests}
      </div>
      <div class="metric">
        <strong>RPS</strong><br>
        ${result.metrics.rps.toFixed(2)}
      </div>
      <div class="metric">
        <strong>Min Response</strong><br>
        ${result.metrics.responseTime.min}ms
      </div>
      <div class="metric">
        <strong>Max Response</strong><br>
        ${result.metrics.responseTime.max}ms
      </div>
      <div class="metric">
        <strong>Median</strong><br>
        ${result.metrics.responseTime.median}ms
      </div>
      <div class="metric">
        <strong>P95</strong><br>
        ${result.metrics.responseTime.p95}ms
      </div>
      <div class="metric">
        <strong>P99</strong><br>
        ${result.metrics.responseTime.p99}ms
      </div>
    </div>
      `;
    } else {
      html += `<p><strong>Error:</strong> ${result.error}</p>`;
    }
    
    html += `</div>`;
  });
  
  html += `
</body>
</html>
  `;
  
  fs.writeFileSync(reportFile, html);
  console.log(`\n📄 HTML report generated: ${reportFile}`);
}

function checkThresholds(results) {
  console.log('\n🎯 Checking Performance Thresholds');
  
  const thresholds = {
    p95ResponseTime: 500, // ms
    successRate: 99, // %
    minRPS: 100
  };
  
  let allPassed = true;
  
  results.forEach(result => {
    if (result.status === 'passed') {
      const successRate = ((result.metrics.completedRequests / result.metrics.totalRequests) * 100);
      
      if (result.metrics.responseTime.p95 > thresholds.p95ResponseTime) {
        console.log(`❌ ${result.name}: P95 response time (${result.metrics.responseTime.p95}ms) exceeds threshold (${thresholds.p95ResponseTime}ms)`);
        allPassed = false;
      }
      
      if (successRate < thresholds.successRate) {
        console.log(`❌ ${result.name}: Success rate (${successRate.toFixed(2)}%) below threshold (${thresholds.successRate}%)`);
        allPassed = false;
      }
      
      if (result.metrics.rps < thresholds.minRPS) {
        console.log(`❌ ${result.name}: RPS (${result.metrics.rps.toFixed(2)}) below threshold (${thresholds.minRPS})`);
        allPassed = false;
      }
    }
  });
  
  if (allPassed) {
    console.log('✅ All performance thresholds passed!');
  } else {
    console.log('\n⚠️  Some performance thresholds were not met. Please review the results.');
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Performance test execution failed:', error);
  process.exit(1);
});
