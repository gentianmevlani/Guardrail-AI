#!/usr/bin/env node
/**
 * Security Headers Test Script
 * 
 * Tests that all security headers are properly configured on a deployed site.
 * 
 * Usage:
 *   node scripts/test-security-headers.js https://your-domain.com
 *   node scripts/test-security-headers.js https://your-domain.com --verbose
 *   node scripts/test-security-headers.js https://your-domain.com --json
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// =============================================================================
// Expected Headers Configuration
// =============================================================================

const REQUIRED_HEADERS = [
  {
    name: 'X-Frame-Options',
    expected: 'DENY',
    description: 'Prevents clickjacking attacks',
    severity: 'critical',
  },
  {
    name: 'X-Content-Type-Options',
    expected: 'nosniff',
    description: 'Prevents MIME type sniffing',
    severity: 'high',
  },
  {
    name: 'X-XSS-Protection',
    expected: '1; mode=block',
    description: 'Legacy XSS protection for older browsers',
    severity: 'medium',
  },
  {
    name: 'Strict-Transport-Security',
    pattern: /max-age=\d+/,
    description: 'Enforces HTTPS connections (HSTS)',
    severity: 'critical',
    httpsOnly: true,
  },
  {
    name: 'Content-Security-Policy',
    pattern: /default-src/,
    description: 'Restricts resource loading to prevent XSS',
    severity: 'critical',
  },
  {
    name: 'Referrer-Policy',
    expected: ['strict-origin-when-cross-origin', 'no-referrer', 'same-origin'],
    description: 'Controls referrer information',
    severity: 'medium',
  },
  {
    name: 'Permissions-Policy',
    pattern: /(camera|microphone|geolocation)/,
    description: 'Restricts browser features',
    severity: 'medium',
  },
];

const RECOMMENDED_HEADERS = [
  {
    name: 'X-RateLimit-Limit',
    pattern: /^\d+$/,
    description: 'Rate limit information',
    severity: 'low',
  },
  {
    name: 'Cache-Control',
    pattern: /no-store|private|no-cache/,
    description: 'Cache control for sensitive pages',
    severity: 'low',
    pathSpecific: ['/dashboard', '/settings', '/api/'],
  },
];

const HEADERS_TO_AVOID = [
  {
    name: 'Server',
    description: 'Reveals server technology',
    severity: 'low',
  },
  {
    name: 'X-Powered-By',
    description: 'Reveals technology stack',
    severity: 'low',
  },
];

// =============================================================================
// Test Functions
// =============================================================================

function fetchHeaders(url) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(url, { method: 'HEAD' }, (res) => {
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

function checkHeader(headers, config, isHttps) {
  const value = headers[config.name.toLowerCase()];
  
  // Skip HTTPS-only headers on HTTP
  if (config.httpsOnly && !isHttps) {
    return { status: 'skipped', reason: 'HTTPS only' };
  }
  
  if (!value) {
    return { status: 'missing', value: null };
  }
  
  if (config.expected) {
    const expectedValues = Array.isArray(config.expected) ? config.expected : [config.expected];
    if (expectedValues.some(exp => value.toLowerCase().includes(exp.toLowerCase()))) {
      return { status: 'pass', value };
    }
    return { status: 'mismatch', value, expected: config.expected };
  }
  
  if (config.pattern) {
    if (config.pattern.test(value)) {
      return { status: 'pass', value };
    }
    return { status: 'mismatch', value, expected: config.pattern.toString() };
  }
  
  return { status: 'pass', value };
}

function formatResult(result, verbose) {
  const icons = {
    pass: '✅',
    missing: '❌',
    mismatch: '⚠️',
    skipped: '⏭️',
    warning: '🔶',
  };
  
  const icon = icons[result.status] || '❓';
  let line = `${icon} ${result.name}`;
  
  if (verbose || result.status !== 'pass') {
    if (result.value) {
      line += `: ${result.value}`;
    }
    if (result.expected && result.status === 'mismatch') {
      line += ` (expected: ${result.expected})`;
    }
    if (result.reason) {
      line += ` (${result.reason})`;
    }
  }
  
  return line;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const url = args.find(a => a.startsWith('http'));
  const verbose = args.includes('--verbose') || args.includes('-v');
  const jsonOutput = args.includes('--json');
  
  if (!url) {
    console.error('Usage: node test-security-headers.js <url> [--verbose] [--json]');
    console.error('Example: node test-security-headers.js https://guardrail.dev');
    process.exit(1);
  }
  
  const isHttps = url.startsWith('https://');
  
  console.log(`\n🔒 Security Headers Test: ${url}\n`);
  console.log('─'.repeat(60));
  
  let response;
  try {
    response = await fetchHeaders(url);
  } catch (error) {
    console.error(`❌ Failed to fetch: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`📡 Status: ${response.statusCode}\n`);
  
  const results = {
    url,
    timestamp: new Date().toISOString(),
    statusCode: response.statusCode,
    required: [],
    recommended: [],
    avoid: [],
    score: 0,
    maxScore: 0,
  };
  
  // Test required headers
  console.log('📋 Required Headers:');
  for (const config of REQUIRED_HEADERS) {
    const check = checkHeader(response.headers, config, isHttps);
    const result = { ...config, ...check };
    results.required.push(result);
    
    const points = { critical: 20, high: 15, medium: 10, low: 5 };
    results.maxScore += points[config.severity] || 10;
    if (check.status === 'pass') {
      results.score += points[config.severity] || 10;
    }
    
    console.log(`   ${formatResult(result, verbose)}`);
  }
  
  console.log('\n📋 Recommended Headers:');
  for (const config of RECOMMENDED_HEADERS) {
    const check = checkHeader(response.headers, config, isHttps);
    const result = { ...config, ...check };
    results.recommended.push(result);
    
    results.maxScore += 5;
    if (check.status === 'pass') {
      results.score += 5;
    }
    
    console.log(`   ${formatResult(result, verbose)}`);
  }
  
  console.log('\n📋 Headers to Avoid (should be absent):');
  for (const config of HEADERS_TO_AVOID) {
    const value = response.headers[config.name.toLowerCase()];
    const status = value ? 'warning' : 'pass';
    const result = { ...config, status, value };
    results.avoid.push(result);
    
    results.maxScore += 5;
    if (!value) {
      results.score += 5;
    }
    
    const icon = value ? '🔶' : '✅';
    console.log(`   ${icon} ${config.name}${value ? `: ${value} (should be removed)` : ': Not present (good)'}`);
  }
  
  // Calculate score
  const percentage = Math.round((results.score / results.maxScore) * 100);
  const grade = percentage >= 90 ? 'A' : percentage >= 80 ? 'B' : percentage >= 70 ? 'C' : percentage >= 60 ? 'D' : 'F';
  
  console.log('\n' + '─'.repeat(60));
  console.log(`\n📊 Security Score: ${results.score}/${results.maxScore} (${percentage}%) - Grade: ${grade}`);
  
  if (percentage < 70) {
    console.log('\n⚠️  Your security headers need improvement!');
    console.log('   Review the missing/misconfigured headers above.');
  } else if (percentage < 90) {
    console.log('\n👍 Good security posture, but there\'s room for improvement.');
  } else {
    console.log('\n🏆 Excellent security headers configuration!');
  }
  
  // Recommendations
  const criticalMissing = results.required.filter(r => r.status === 'missing' && r.severity === 'critical');
  if (criticalMissing.length > 0) {
    console.log('\n🚨 Critical Issues:');
    criticalMissing.forEach(r => {
      console.log(`   - ${r.name}: ${r.description}`);
    });
  }
  
  if (jsonOutput) {
    console.log('\n📄 JSON Output:');
    console.log(JSON.stringify(results, null, 2));
  }
  
  console.log('\n🔗 Additional Resources:');
  console.log('   - https://securityheaders.com');
  console.log('   - https://observatory.mozilla.org');
  console.log('   - https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers');
  console.log();
  
  // Exit with error if critical headers missing
  if (criticalMissing.length > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
