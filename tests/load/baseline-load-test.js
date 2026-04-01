import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate } from 'k6/metrics';

// Custom metrics
export let options = {
  stages: [
    { duration: '2m', target: 10 }, // Ramp up to 10 users
    { duration: '5m', target: 10 }, // Stay at 10 users
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users (10x baseline)
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'], // Less than 10% errors
    checks: ['rate>0.9'], // 90% of checks pass
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

// Custom metrics for tracking
let errorRate = new Rate('errors');

export function setup() {
  console.log(`Starting load test against ${BASE_URL}`);
  
  // Create test user if needed
  const payload = JSON.stringify({
    email: `loadtest-${Date.now()}@example.com`,
    password: 'testpassword123',
    name: 'Load Test User'
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
      return {
        token: loginResponse.json('token'),
        userId: loginResponse.json('user.id')
      };
    }
  }
  
  // Fallback to login with existing test user
  const loginPayload = JSON.stringify({
    email: 'test@example.com',
    password: 'testpassword123'
  });
  
  response = http.post(`${BASE_URL}/api/v1/auth/login`, loginPayload, params);
  if (response.status === 200) {
    return {
      token: response.json('token'),
      userId: response.json('user.id')
    };
  }
  
  return null;
}

export default function(data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
  };
  
  // Test 1: Health Check (critical endpoint)
  let response = http.get(`${BASE_URL}/health`, params);
  let success = check(response, {
    'health status is 200': (r) => r.status === 200,
    'health response time < 200ms': (r) => r.timings.duration < 200,
  });
  errorRate.add(!success);
  
  // Test 2: Feature Flags (new Ops & UX feature)
  response = http.get(`${BASE_URL}/api/v1/flags`, params);
  success = check(response, {
    'flags status is 200': (r) => r.status === 200,
    'flags has data': (r) => r.json('flags') !== undefined,
    'flags response time < 300ms': (r) => r.timings.duration < 300,
  });
  errorRate.add(!success);
  
  // Test 3: Status Page (public endpoint)
  response = http.get(`${BASE_URL}/api/v1/status`);
  success = check(response, {
    'status page is 200': (r) => r.status === 200,
    'status has API health': (r) => r.json('status.api') !== undefined,
    'status response time < 300ms': (r) => r.timings.duration < 300,
  });
  errorRate.add(!success);
  
  // Test 4: User Profile (authenticated endpoint)
  response = http.get(`${BASE_URL}/api/v1/profile`, params);
  success = check(response, {
    'profile status is 200': (r) => r.status === 200,
    'profile has user data': (r) => r.json('user') !== undefined,
    'profile response time < 400ms': (r) => r.timings.duration < 400,
  });
  errorRate.add(!success);
  
  // Test 5: Projects List (authenticated endpoint)
  response = http.get(`${BASE_URL}/api/v1/projects`, params);
  success = check(response, {
    'projects status is 200': (r) => r.status === 200,
    'projects is array': (r) => Array.isArray(r.json('projects')),
    'projects response time < 500ms': (r) => r.timings.duration < 500,
  });
  errorRate.add(!success);
  
  // Test 6: Submit Feedback (new Ops & UX feature)
  const feedbackPayload = JSON.stringify({
    category: 'ui',
    severity: 'low',
    message: 'Load test feedback message',
    includeDiagnostics: false
  });
  
  response = http.post(`${BASE_URL}/api/v1/feedback`, feedbackPayload, params);
  success = check(response, {
    'feedback status is 201': (r) => r.status === 201,
    'feedback has ID': (r) => r.json('feedback.id') !== undefined,
    'feedback response time < 600ms': (r) => r.timings.duration < 600,
  });
  errorRate.add(!success);
  
  // Test 7: Create Project (write operation)
  const projectPayload = JSON.stringify({
    name: `Load Test Project ${Date.now()}`,
    description: 'Project created during load testing',
    path: '/tmp/load-test'
  });
  
  response = http.post(`${BASE_URL}/api/v1/projects`, projectPayload, params);
  success = check(response, {
    'create project status is 201': (r) => r.status === 201,
    'project has ID': (r) => r.json('project.id') !== undefined,
    'create project response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  errorRate.add(!success);
  
  // Small delay between iterations
  sleep(0.1);
}

export function teardown(data) {
  console.log('Load test completed');
  if (data && data.token) {
    // Cleanup: logout the test user
    const params = {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
    };
    http.post(`${BASE_URL}/api/v1/auth/logout`, '', params);
  }
}
