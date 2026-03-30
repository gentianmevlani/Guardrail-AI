# Testing Guide for guardrail

This guide covers the testing setup and best practices for the guardrail project.

## Table of Contents

1. [Testing Stack](#testing-stack)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Writing Tests](#writing-tests)
5. [Coverage](#coverage)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)

## Testing Stack

### Unit & Integration Tests
- **Jest**: Test runner and assertion library
- **ts-jest**: TypeScript support for Jest
- **Supertest**: HTTP assertion testing for Node.js

### E2E Tests
- **Playwright**: End-to-end testing framework
- **@playwright/test**: Playwright's test runner

### Test Utilities
- **Jest Matchers**: Custom matchers for assertions
- **Test Fixtures**: Mock data and test utilities
- **Page Object Model**: E2E test organization

## Test Structure

```
guardrail/
├── src/
│   └── lib/
│       └── __tests__/           # Unit tests
│           ├── accessibility-checker.test.ts
│           ├── codebase-knowledge.test.ts
│           └── ...
├── src/
│   └── server/
│       └── __tests__/
│           └── integration/     # Integration tests
│               ├── api.test.ts
│               └── ...
├── e2e/                         # E2E tests
│   ├── auth.spec.ts
│   ├── code-analysis.spec.ts
│   ├── fixtures/               # Test data
│   └── pages/                  # Page objects
├── coverage/                   # Coverage reports
├── playwright-report/          # E2E test reports
└── test-results/              # Test artifacts
```

## Running Tests

### Using npm Scripts

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Using the Test Runner

```bash
# Run all tests
node scripts/test-runner.js

# Run specific test type
node scripts/test-runner.js --type unit
node scripts/test-runner.js --type integration
node scripts/test-runner.js --type e2e

# Run with options
node scripts/test-runner.js --type unit --watch --verbose
node scripts/test-runner.js --type coverage --ci
```

## Writing Tests

### Unit Tests

Unit tests should be fast, isolated, and test a single piece of functionality.

```typescript
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { MyService } from '../my-service';

describe('MyService', () => {
  let service: MyService;
  let mockDependency: jest.Mocked<Dependency>;

  beforeEach(() => {
    // Setup mocks and service instance
    mockDependency = {
      method: jest.fn()
    };
    service = new MyService(mockDependency);
  });

  it('should do something', () => {
    // Arrange
    mockDependency.method.mockReturnValue('mocked value');
    
    // Act
    const result = service.doSomething();
    
    // Assert
    expect(result).toBe('expected value');
    expect(mockDependency.method).toHaveBeenCalled();
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

```typescript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';

describe('API Integration', () => {
  beforeAll(async () => {
    // Setup test database, start server
  });

  afterAll(async () => {
    // Cleanup
  });

  it('should handle API endpoints', async () => {
    const response = await request(app)
      .post('/api/analyze')
      .send({ code: 'test code' })
      .expect(200);

    expect(response.body).toHaveProperty('results');
  });
});
```

### E2E Tests

E2E tests simulate real user interactions with the application.

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Authentication', () => {
  test('should allow user to log in', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('[data-testid=email-input]', 'user@example.com');
    await page.fill('[data-testid=password-input]', 'password');
    await page.click('[data-testid=login-button]');
    
    await expect(page).toHaveURL('/dashboard');
  });
});
```

## Coverage

### Coverage Configuration

Coverage is configured in `jest.config.js` with the following thresholds:

- **Lines**: 80%
- **Functions**: 80%
- **Branches**: 80%
- **Statements**: 80%

### Viewing Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Badges

The test runner automatically generates coverage badges:

```markdown
![Coverage](https://img.shields.io/badge/coverage-85%25-green)
```

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

### Test Matrix

Unit tests run against multiple Node.js versions:
- Node.js 18.x
- Node.js 20.x

### Test Reports

- Unit tests: Uploaded to Codecov
- E2E tests: Artifacts stored in GitHub
- Integration tests: JUnit XML reports

## Best Practices

### General Guidelines

1. **Test Naming**: Use descriptive test names that explain what is being tested
2. **AAA Pattern**: Structure tests with Arrange, Act, Assert
3. **One Assertion**: Prefer one assertion per test when possible
4. **Test Isolation**: Tests should not depend on each other
5. **Mock External Dependencies**: Use mocks for external services

### Unit Test Best Practices

```typescript
// ✅ Good
it('should calculate total with tax', () => {
  const calculator = new TaxCalculator(0.1);
  const total = calculator.calculateTotal(100);
  expect(total).toBe(110);
});

// ❌ Bad
it('should work', () => {
  // Test implementation
});
```

### Integration Test Best Practices

```typescript
// ✅ Good
it('should return 400 for invalid input', async () => {
  const response = await request(app)
    .post('/api/analyze')
    .send({}) // Missing required field
    .expect(400);
    
  expect(response.body.error).toContain('validation');
});

// ❌ Bad
it('should handle errors', async () => {
  // Vague test
});
```

### E2E Test Best Practices

1. **Use Data Selectors**: Prefer data-testid over CSS selectors
2. **Wait for Elements**: Use Playwright's auto-waiting features
3. **Page Object Model**: Organize tests with page objects
4. **Test User Flows**: Test complete user journeys

```typescript
// ✅ Good
await page.fill('[data-testid=email-input]', email);
await page.click('[data-testid=submit-button]');
await expect(page.locator('[data-testid=success-message]')).toBeVisible();

// ❌ Bad
await page.click('.btn-primary');
await page.waitFor(1000); // Avoid arbitrary waits
```

### Mocking Strategies

1. **Unit Tests**: Mock all external dependencies
2. **Integration Tests**: Mock only external services (database, APIs)
3. **E2E Tests**: Avoid mocking, use real services

### Test Data Management

1. **Use Factories**: Create test data with factory functions
2. **Clean Up**: Reset database state after each test
3. **Isolate Data**: Use unique data for each test run

```typescript
// Test factory example
function createUser(overrides: Partial<User> = {}) {
  return {
    id: faker.datatype.uuid(),
    email: faker.internet.email(),
    name: faker.name.fullName(),
    ...overrides
  };
}
```

## Debugging Tests

### Unit Tests

```bash
# Run tests in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Run specific test
npm test -- --testNamePattern="specific test"
```

### E2E Tests

```bash
# Run with UI mode
npx playwright test --ui

# Run in headed mode
npx playwright test --headed

# Debug specific test
npx playwright test --debug
```

## Performance Considerations

1. **Parallel Execution**: Tests run in parallel by default
2. **Test Isolation**: Each test gets a clean state
3. **Resource Cleanup**: Properly clean up resources after tests
4. **Avoid Sleep**: Use Playwright's waiting utilities instead

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Tests use different ports to avoid conflicts
2. **Database Connections**: Ensure test database is configured
3. **Time Zones**: Use UTC for consistent test results
4. **Async Tests**: Properly handle async/await in tests

### Getting Help

- Check Jest documentation: https://jestjs.io/docs/getting-started
- Check Playwright documentation: https://playwright.dev/docs/intro
- Review existing tests for examples
- Ask questions in team channels

## Contributing

When adding new features:

1. Write tests before implementation (TDD)
2. Ensure coverage meets thresholds
3. Add integration tests for new endpoints
4. Add E2E tests for user-facing features
5. Update documentation as needed

Remember: Tests are code too. Keep them clean, maintainable, and well-documented!
