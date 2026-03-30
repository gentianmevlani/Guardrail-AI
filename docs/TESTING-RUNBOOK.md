# guardrail Testing Runbook

## 🚨 Quick Response Guide

### Test Failures in Production

1. **Immediate Actions**
   ```bash
   # Check recent test runs
   gh run list --branch main
   
   # View failed test details
   gh run view <run-id>
   
   # Download test artifacts
   gh run download <run-id>
   ```

2. **Common Failure Scenarios**

   #### Database Connection Issues
   ```bash
   # Check test database status
   docker ps | grep postgres
   
   # Restart if needed
   npm run test:db:stop
   npm run test:db:start
   
   # Verify connection
   npm run test:integration -- --testNamePattern="health"
   ```

   #### Authentication Failures
   ```bash
   # Check JWT secret
   echo $JWT_SECRET
   
   # Reset test tokens
   npm run test:unit -- --testPathPattern="auth"
   ```

   #### Performance Degradation
   ```bash
   # Run quick performance check
   npm run test:load
   
   # Check system resources
   docker stats
   ```

## 📋 Test Execution Procedures

### Daily Test Suite

```bash
# Full test suite (automated in CI)
npm test

# With coverage
npm run test:coverage

# Performance tests
npm run test:performance
```

### Pre-Release Checklist

- [ ] All unit tests passing
- [ ] Integration tests with database passing
- [ ] E2E tests on all browsers passing
- [ ] Security audit clean
- [ ] Performance thresholds met
- [ ] Coverage above thresholds
- [ ] Documentation updated

### Hotfix Testing

```bash
# Run only affected tests
npm test -- --onlyChanged

# Run related integration tests
npm run test:integration -- --testPathPattern="affected-module"

# Quick smoke test
npm run test:unit && npm run test:integration
```

## 🔧 Debugging Procedures

### 1. Test Isolation

```bash
# Run single test file
npx jest tests/specific.test.ts --no-coverage

# Run with verbose output
npx jest --verbose --no-coverage

# Run in debug mode
node --inspect-brk node_modules/.bin/jest --runInBand
```

### 2. Database Debugging

```bash
# Connect to test database
docker exec -it guardrail-test-db psql -U postgres -d Guardrail_test

# Check tables
\dt

# View recent records
SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
```

### 3. API Debugging

```bash
# Start API with debug logs
DEBUG=* npm run api:dev

# Test endpoints manually
curl -X GET http://localhost:3000/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"TestPassword123!"}'
```

### 4. E2E Debugging

```bash
# Run with headed mode
npx playwright test --headed

# Run with trace viewer
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

## 📊 Performance Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| P95 Response Time | < 500ms | > 750ms |
| Success Rate | > 99% | < 98% |
| RPS | > 100 | < 80 |
| Memory Usage | < 512MB | > 1GB |
| CPU Usage | < 70% | > 85% |

### Performance Test Commands

```bash
# Quick load test
npm run test:load

# Stress test
npm run test:stress

# Custom scenario
npx artillery run tests/performance/custom-test.yml \
  --target http://localhost:3000 \
  --output results.json

# View HTML report
npx artillery report results.json
```

## 🛡️ Security Testing

### Security Test Checklist

- [ ] No hardcoded secrets
- [ ] SQL injection protection
- [ ] XSS prevention
- [ ] Authentication enforced
- [ ] Rate limiting active
- [ ] Headers security set

### Security Commands

```bash
# Audit dependencies
npm audit --audit-level moderate

# Scan for secrets
npx trufflehog --regex --entropy .

# Run SAST
npx eslint . --ext .ts,.js --format=json

# Check headers
npx nmap --script http-headers localhost:3000
```

## 🔄 Rollback Procedures

### Test Rollback

```bash
# Reset to last passing commit
git log --oneline -10
git revert <bad-commit-hash>

# Clear test cache
npm run clean
rm -rf node_modules/.cache

# Re-run tests
npm test
```

### Database Rollback

```bash
# Reset test database
npm run test:db:stop
docker volume rm Guardrail_postgres_test_data
npm run test:db:start
npm run test:db:setup
```

## 📈 Test Optimization

### Speed Up Tests

```bash
# Run tests in parallel
jest --maxWorkers=4

# Skip coverage for speed
npm test -- --no-coverage

# Use test cache
jest --cache

# Run only changed files
npm test -- --onlyChanged
```

### Reduce Flakiness

```bash
# Increase timeout
jest --testTimeout=10000

# Run tests sequentially
jest --runInBand

# Add retry logic
jest --retryTimes=3
```

## 🚨 Emergency Procedures

### All Tests Failing

1. **Check Infrastructure**
   ```bash
   # Verify services running
   docker ps
   
   # Check disk space
   df -h
   
   # Check memory
   free -h
   ```

2. **Quick Diagnosis**
   ```bash
   # Run minimal test
   npx jest packages/core/src/__tests__/utils/hash.test.ts
   
   # Check TypeScript compilation
   npm run type-check
   
   # Verify dependencies
   npm ls
   ```

3. **Restore from Backup**
   ```bash
   # Reset to known good state
   git clean -fd
   git reset --hard HEAD~1
   
   # Reinstall dependencies
   rm -rf node_modules package-lock.json
   npm install
   ```

### Performance Regression

1. **Identify Bottleneck**
   ```bash
   # Profile test execution
   node --prof node_modules/.bin/jest
   
   # Analyze profile
   node --prof-process isolate-*.log > performance.txt
   ```

2. **Compare with Baseline**
   ```bash
   # Checkout last known good
   git checkout <good-commit>
   
   # Run performance test
   npm run test:performance > baseline.json
   
   # Return to current
   git checkout -
   
   # Run and compare
   npm run test:performance > current.json
   ```

## 📞 Contact Information

### Escalation Path

1. **Level 1**: Developer on duty
   - Check Slack #testing channel
   - Review recent changes

2. **Level 2**: Test Infrastructure Team
   - Email: test-infra@guardrail.com
   - Pager: +1-555-TEST-HELP

3. **Level 3**: DevOps Engineering
   - Email: devops@guardrail.com
   - Emergency: +1-555-DEV-OPS

### Useful Links

- [Test Dashboard](https://tests.guardrail.com)
- [Coverage Reports](https://codecov.io/gh/guardrail/guardrail)
- [Performance Dashboard](https://performance.guardrail.com)
- [CI/CD Pipeline](https://github.com/guardrail/guardrail/actions)

## 📝 Runbook Maintenance

### Monthly Tasks

- [ ] Review and update contact info
- [ ] Check emergency procedures
- [ ] Update performance thresholds
- [ ] Verify all commands still work
- [ ] Add new failure scenarios

### Quarterly Tasks

- [ ] Full runbook review
- [ ] Update screenshots/examples
- [ ] Conduct fire drill
- [ ] Update documentation links

---

*Last Updated: December 30, 2024*
*Version: 1.0*
*Maintainer: DevOps Team*

*Context Enhanced by guardrail AI*
