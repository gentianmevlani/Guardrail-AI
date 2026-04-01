# guardrail Testing Framework - Remediation Plan

## 🎯 Objective
Fix all critical and major issues to achieve true production readiness.

---

## 📋 Phase 1: Critical Fixes (Day 1-2)

### 1.1 Install Missing Dependencies
```bash
# Install performance testing tools
npm install --save-dev artillery
npm install --save-dev @lhci/cli@0.12.x

# Install missing API dependencies
npm install --save-dev cors

# Install additional test utilities
npm install --save-dev nock supertest @types/supertest
```

### 1.2 Fix Failing Unit Tests
```bash
# Identify specific failing tests
npm run test:unit -- --verbose

# Fix semantic search service tests
# Issue: entry.isFile is not a function
# Solution: Update to use proper fs.Dirent API
```

### 1.3 Create Missing Scripts

#### Create `scripts/check-bundle-size.js`
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const bundlesize = require('bundlesize');

const config = [
  {
    path: './dist/main.js',
    maxSize: '500kb'
  }
];

bundlesize(config);
```

#### Fix `scripts/setup-test-db.bat`
```batch
@echo off
echo Setting up test database...

docker-compose -f docker-compose.test.yml up -d postgres

timeout /t 5 /nobreak

cd packages/database
npx prisma migrate dev
npx prisma db seed

echo Test database setup complete!
```

### 1.4 Fix Jest Configuration
```javascript
// Update jest.config.js
module.exports = {
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/**/*.unit.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/tests/setup/unit.setup.js']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/**/*.integration.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.integration.setup.js']
    }
  ],
  // ... rest of config
};
```

---

## 📋 Phase 2: Complete Implementation (Day 3-5)

### 2.1 Real Performance Testing

#### Create `tests/performance/stress-test.yml`
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 300
      arrivalRate: 200
      name: "Stress Test"

scenarios:
  - name: "API Stress Test"
    weight: 100
    flow:
      - get:
          url: "/health"
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "TestPassword123!"
```

#### Create `tests/performance/spike-test.yml`
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
    - duration: 120
      arrivalRate: 500
    - duration: 60
      arrivalRate: 10

scenarios:
  - name: "Spike Test"
    flow:
      - get:
          url: "/health"
```

### 2.2 Working E2E Tests

#### Create `playwright.config.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npm run api:dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2.3 Real Security Testing

#### Create `tests/security/security.test.ts`
```typescript
import request from 'supertest';
import { app } from '../../apps/api/src/index';

describe('Security Tests', () => {
  it('should prevent SQL injection', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: maliciousInput,
        password: 'password'
      });
    
    expect(response.status).toBe(400);
  });

  it('should have security headers', async () => {
    const response = await request(app).get('/health');
    
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBeDefined();
  });
});
```

### 2.4 Fix Integration Tests

#### Fix semantic search service
```typescript
// Fix in src/lib/semantic-search-service.ts
private async scan(dir: string): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      await scan(fullPath);
    } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
}
```

---

## 📋 Phase 3: Documentation & Monitoring (Day 6-7)

### 3.1 Update Documentation

#### Fix `TESTING-GUIDE.md`
- Remove false claims about test counts
- Add actual troubleshooting steps
- Include real installation instructions
- Document actual test structure

#### Update `TESTING-RUNBOOK.md`
- Add real debugging procedures
- Include actual error scenarios
- Document working commands
- Add real contact information

### 3.2 Add Monitoring

#### Create `scripts/test-monitor.js`
```javascript
#!/usr/bin/env node
const { execSync } = require('child_process');

function runTests() {
  try {
    const output = execSync('npm test', { encoding: 'utf8' });
    console.log('✅ All tests passed');
    return true;
  } catch (error) {
    console.error('❌ Tests failed');
    console.error(error.stdout);
    return false;
  }
}

if (require.main === module) {
  process.exit(runTests() ? 0 : 1);
}
```

---

## 📋 Phase 4: Validation (Day 8-10)

### 4.1 Test Validation Checklist
- [ ] All unit tests pass (0 failures)
- [ ] All integration tests pass (0 failures)
- [ ] E2E tests run on 3 browsers
- [ ] Performance tests execute
- [ ] Security tests validate real vulnerabilities
- [ ] Coverage report generates correctly
- [ ] CI/CD pipeline runs successfully

### 4.2 Performance Validation
```bash
# Run performance tests
npm run test:performance

# Check results
npm run test:load

# Validate thresholds
node scripts/check-performance-thresholds.js
```

### 4.3 Security Validation
```bash
# Run security audit
npm audit

# Run security tests
npm run test:security

# Check for vulnerabilities
npx audit-ci --moderate
```

---

## 🛠️ Implementation Commands

### Day 1 Commands
```bash
# Install dependencies
npm install --save-dev artillery @lhci/cli cors nock supertest @types/supertest

# Fix immediate test failures
npm run test:unit -- --verbose
npm run test:integration -- --verbose

# Create missing scripts
# (Implement scripts/check-bundle-size.js)
# (Fix scripts/setup-test-db.bat)
```

### Day 2-3 Commands
```bash
# Fix Jest config
# (Update jest.config.js)

# Run tests to verify fixes
npm run test:unit
npm run test:integration

# Coverage check
npm run test:coverage
```

### Day 4-5 Commands
```bash
# Set up Playwright
npx playwright install

# Run E2E tests
npm run test:e2e

# Performance tests
npm run test:performance
```

---

## 📊 Success Metrics

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| Unit Tests Pass Rate | 100% | 74% | ❌ |
| Integration Tests Pass Rate | 100% | 70% | ❌ |
| E2E Tests | Working | Not Verified | ❌ |
| Performance Tests | Working | 0 | ❌ |
| Security Tests | Real | Mocks | ❌ |
| Coverage | >75% | Unknown | ❌ |

---

## 🚨 Risk Mitigation

1. **Daily Checkpoints** - Review progress at end of each day
2. **Test After Each Fix** - Run full test suite after changes
3. **Backup Working Code** - Git branch for each phase
4. **Peer Review** - Have another developer review fixes
5. **Incremental Deployment** - Fix one area at a time

---

## 📞 Support Resources

- Documentation: `docs/TESTING-GUIDE.md`
- Troubleshooting: `docs/TESTING-RUNBOOK.md`
- Test Status: Run `npm run test:status` (to be created)
- Emergency: Create issue in GitHub with "CRITICAL" label

---

## ✅ Completion Criteria

The testing framework will be truly production-ready when:

1. All tests pass without failures
2. Performance tests run and validate thresholds
3. E2E tests execute on multiple browsers
4. Security tests validate real issues
5. CI/CD pipeline runs successfully
6. Documentation is accurate and complete
7. Team can run tests locally without issues

---

*Created: December 30, 2024*
*Estimated Completion: 10 days*
*Priority: CRITICAL*

*Context Enhanced by guardrail AI*
