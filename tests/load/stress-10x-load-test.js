import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

// 10x Traffic Load Test - Stress testing for production readiness
export let options = {
  stages: [
    { duration: '1m', target: 20 },   // Warm up
    { duration: '3m', target: 100 },  // Ramp to 100 users
    { duration: '5m', target: 500 },  // Ramp to 500 users (5x baseline)
    { duration: '10m', target: 1000 }, // Ramp to 1000 users (10x baseline)
    { duration: '5m', target: 2000 },  // Peak stress - 2000 users (20x baseline)
    { duration: '3m', target: 1000 },  // Scale down
    { duration: '2m', target: 500 },   // Scale down further
    { duration: '1m', target: 0 },     // Cool down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1s (relaxed for stress)
    http_req_failed: ['rate<0.2'],     // Allow up to 20% errors under stress
    checks: ['rate>0.8'],              // 80% checks pass under stress
    errors: ['rate<0.2'],              // Custom error rate threshold
  },
  discardResponseBodies: true,        // Save memory during high load
  noConnectionReuse: true,            // Simulate real user behavior
  userAgent: 'GuardrailLoadTest/1.0',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let errorRate = new Rate('errors');

// Test data pool for variety
const testCategories = ['bug', 'feature', 'ui', 'performance', 'other'];
const testSeverities = ['low', 'medium', 'high', 'critical'];

export function setup() {
  console.log(`Starting 10x stress test against ${BASE_URL}`);
  
  // Create multiple test users for load distribution
  const users = [];
  const userCount = 10;
  
  for (let i = 0; i < userCount; i++) {
    const email = `loadtest-stress-${i}-${Date.now()}@example.com`;
    const payload = JSON.stringify({
      email: email,
      password: 'testpassword123',
      name: `Stress Test User ${i}`
    });
    
    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    let response = http.post(`${BASE_URL}/api/v1/auth/register`, payload, params);
    
    if (response.status === 201) {
      const loginResponse = http.post(`${BASE_URL}/api/v1/auth/login`, payload, params);
      if (loginResponse.status === 200) {
        users.push({
          token: loginResponse.json('token'),
          userId: loginResponse.json('user.id'),
          email: email
        });
      }
    }
  }
  
  console.log(`Created ${users.length} test users`);
  return users;
}

export default function(users) {
  if (!users || users.length === 0) {
    console.error('No users available for load test');
    return;
  }
  
  // Randomly select a user for this iteration
  const user = users[Math.floor(Math.random() * users.length)];
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.token}`,
    },
  };
  
  // Mix of read and write operations weighted appropriately
  
  // 70% chance of read operation
  if (Math.random() < 0.7) {
    const readOp = Math.random();
    
    if (readOp < 0.3) {
      // Health check (30% of reads)
      let response = http.get(`${BASE_URL}/health`);
      check(response, {
        'health status is 200': (r) => r.status === 200,
        'health response time < 300ms': (r) => r.timings.duration < 300,
      });
    } else if (readOp < 0.5) {
      // Feature flags (20% of reads)
      let response = http.get(`${BASE_URL}/api/v1/flags`, params);
      check(response, {
        'flags status is 200': (r) => r.status === 200,
        'flags response time < 400ms': (r) => r.timings.duration < 400,
      });
    } else if (readOp < 0.7) {
      // Status page (20% of reads)
      let response = http.get(`${BASE_URL}/api/v1/status`);
      check(response, {
        'status page is 200': (r) => r.status === 200,
        'status response time < 400ms': (r) => r.timings.duration < 400,
      });
    } else if (readOp < 0.85) {
      // User profile (15% of reads)
      let response = http.get(`${BASE_URL}/api/v1/profile`, params);
      check(response, {
        'profile status is 200': (r) => r.status === 200,
        'profile response time < 500ms': (r) => r.timings.duration < 500,
      });
    } else {
      // Projects list (15% of reads)
      let response = http.get(`${BASE_URL}/api/v1/projects`, params);
      check(response, {
        'projects status is 200': (r) => r.status === 200,
        'projects response time < 600ms': (r) => r.timings.duration < 600,
      });
    }
  } else {
    // 30% chance of write operation
    const writeOp = Math.random();
    
    if (writeOp < 0.5) {
      // Submit feedback (50% of writes)
      const feedbackPayload = JSON.stringify({
        category: testCategories[Math.floor(Math.random() * testCategories.length)],
        severity: testSeverities[Math.floor(Math.random() * testSeverities.length)],
        message: `Stress test feedback from ${user.email} at ${Date.now()}`,
        includeDiagnostics: Math.random() < 0.3
      });
      
      let response = http.post(`${BASE_URL}/api/v1/feedback`, feedbackPayload, params);
      check(response, {
        'feedback status is 201': (r) => r.status === 201,
        'feedback response time < 800ms': (r) => r.timings.duration < 800,
      });
    } else {
      // Create project (50% of writes)
      const projectPayload = JSON.stringify({
        name: `Stress Test Project ${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        description: `Project created during stress testing by ${user.email}`,
        path: `/tmp/stress-test-${Math.random().toString(36).substr(2, 9)}`
      });
      
      let response = http.post(`${BASE_URL}/api/v1/projects`, projectPayload, params);
      check(response, {
        'create project status is 201': (r) => r.status === 201,
        'create project response time < 1200ms': (r) => r.timings.duration < 1200,
      });
    }
  }
  
  // Variable sleep to simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5s to 2.5s
}

export function teardown(users) {
  console.log('Stress test completed');
  
  if (users && users.length > 0) {
    console.log(`Cleaning up ${users.length} test users`);
    
    // Cleanup: logout all test users
    users.forEach(user => {
      const params = {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user.token}`,
        },
      };
      http.post(`${BASE_URL}/api/v1/auth/logout`, '', params);
    });
  }
}
