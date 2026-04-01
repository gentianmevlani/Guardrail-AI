# guardrail Operations & Monitoring Runbook

This document covers post-deploy verification, monitoring setup, incident response, and troubleshooting.

---

## Table of Contents

1. [Post-Deploy Verification](#post-deploy-verification)
2. [Monitoring Architecture](#monitoring-architecture)
3. [Uptime Monitoring Setup](#uptime-monitoring-setup)
4. [Alert Configuration](#alert-configuration)
5. [Incident Response](#incident-response)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Runbook: Health Check Failure](#runbook-health-check-failure)
8. [Runbook: Database Issues](#runbook-database-issues)
9. [Runbook: High Error Rate](#runbook-high-error-rate)

---

## Post-Deploy Verification

### Automated Smoke Tests

After every deploy, automated smoke tests run via GitHub Actions:

```bash
# Manual trigger
gh workflow run smoke-tests.yml -f environment=production

# Or run locally
PROD_URL=https://your-site.netlify.app \
RAILWAY_API_URL=https://your-api.up.railway.app \
npx playwright test e2e/smoke.spec.ts
```

### Manual Verification Checklist

```bash
# 1. Frontend loads
curl -I https://your-site.netlify.app/

# 2. API health check
curl https://your-api.up.railway.app/api/health | jq .

# 3. API readiness
curl https://your-api.up.railway.app/api/ready | jq .

# 4. Database connectivity (via health check)
curl https://your-api.up.railway.app/api/health | jq '.services.database'

# 5. Test OAuth redirect (should return 302 to GitHub)
curl -I https://your-api.up.railway.app/api/auth/github
```

### Expected Health Response

```json
{
  "ok": true,
  "status": "healthy",
  "db": "ok",
  "ms": 45,
  "ts": "2026-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "git_sha": "abc1234",
  "deploy_id": "abc123",
  "environment": "production",
  "services": {
    "database": "connected",
    "github": "configured",
    "stripe": "configured",
    "openai": "configured",
    "sentry": "configured"
  }
}
```

---

## Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Monitoring Stack                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ UptimeRobot  │    │   Sentry     │    │  Railway     │      │
│  │ /Better Stack│    │   Errors     │    │  Metrics     │      │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘      │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                    Alerting                          │      │
│  │  Slack / Discord / Email / PagerDuty                 │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Endpoints Monitored:
  • GET /api/health     → Full health (DB + config)
  • GET /api/ready      → Readiness probe
  • GET /api/live       → Liveness probe
  • GET /               → Frontend availability
```

---

## Uptime Monitoring Setup

### Option A: UptimeRobot (Free Tier Available)

1. **Create Account**: https://uptimerobot.com/
2. **Add Monitors**:

| Monitor Name | URL | Type | Interval |
|--------------|-----|------|----------|
| guardrail Frontend | `https://your-site.netlify.app/` | HTTP(s) | 5 min |
| guardrail API Health | `https://your-api.up.railway.app/api/health` | HTTP(s) - Keyword | 5 min |
| guardrail API Ready | `https://your-api.up.railway.app/api/ready` | HTTP(s) - Keyword | 5 min |

3. **Keyword Monitoring** for `/api/health`:
   - Keyword: `"ok":true`
   - Alert if keyword NOT found

4. **Configure Alerts**:
   - Email notification
   - Slack webhook (optional)
   - SMS (paid tier)

### Option B: Better Stack (Better Uptime)

1. **Create Account**: https://betterstack.com/
2. **Add Heartbeat** for cron monitoring
3. **Add HTTP Monitors** for endpoints
4. **Configure on-call schedule**

### Option C: Checkly (For Synthetic Monitoring)

```javascript
// checkly.config.js
import { defineConfig } from 'checkly';

export default defineConfig({
  projectName: 'guardrail',
  checks: [
    {
      name: 'API Health Check',
      type: 'api',
      request: {
        url: 'https://your-api.up.railway.app/api/health',
        method: 'GET',
      },
      assertions: [
        { source: 'STATUS_CODE', comparison: 'EQUALS', target: 200 },
        { source: 'JSON_BODY', property: '$.ok', comparison: 'EQUALS', target: true },
      ],
      frequency: 5,
      locations: ['us-east-1', 'eu-west-1'],
    },
  ],
});
```

---

## Alert Configuration

### What Should Trigger Alerts

| Alert | Severity | Channel | Condition |
|-------|----------|---------|-----------|
| Frontend Down | Critical | Slack + Email | HTTP != 2xx for 2 checks |
| API Health Failed | Critical | Slack + Email | `/api/health` returns `ok: false` |
| Database Disconnected | Critical | Slack + Email + PagerDuty | `services.database != "connected"` |
| High Error Rate | High | Slack | Sentry: >10 errors/min |
| Slow Response | Medium | Slack | p95 latency > 2s |
| SSL Certificate Expiry | Medium | Email | <14 days to expiry |

### Sentry Alert Setup

1. **Navigate to**: Sentry → Alerts → Create Alert
2. **Create Issue Alert**:
   ```
   When: An issue is first seen
   Filter: level:error
   Action: Send Slack notification
   ```
3. **Create Metric Alert**:
   ```
   When: Error count > 50 in 1 hour
   Action: Send email + Slack
   ```

### GitHub Actions Notifications

Already configured in `.github/workflows/smoke-tests.yml`:
- Set `SLACK_WEBHOOK_URL` secret for Slack notifications
- Set `DISCORD_WEBHOOK_URL` secret for Discord notifications

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 - Critical | Service completely down | < 15 min | API unreachable, DB down |
| P2 - High | Major feature broken | < 1 hour | Auth failing, payments broken |
| P3 - Medium | Minor feature broken | < 4 hours | Single endpoint errors |
| P4 - Low | Cosmetic/minor issue | Next business day | UI glitches |

### Incident Response Steps

#### 1. Acknowledge
```bash
# Check current status
curl https://your-api.up.railway.app/api/health | jq .

# Check Railway logs
railway logs --tail 100
```

#### 2. Assess
- Is the issue affecting all users or some?
- Is it frontend, API, or database?
- When did it start? (Check deploy times)

#### 3. Mitigate
```bash
# Quick rollback if recent deploy caused issue
railway rollback

# Or rollback Netlify
# Dashboard → Deploys → Previous deploy → Publish
```

#### 4. Communicate
- Update status page (if you have one)
- Notify affected users if necessary

#### 5. Resolve & Document
- Create post-mortem for P1/P2 incidents
- Update runbooks with new learnings

---

## Troubleshooting Guide

### Quick Diagnostic Commands

```bash
# Full health check
curl -s https://your-api.up.railway.app/api/health | jq .

# Check specific service status
curl -s https://your-api.up.railway.app/api/health | jq '.services'

# Get response time
curl -w "Time: %{time_total}s\n" -o /dev/null -s https://your-api.up.railway.app/api/health

# Check Railway logs
railway logs --tail 50

# Check recent deploys
railway status
```

### Common Issues Quick Reference

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| `database: disconnected` | DB connection failed | Check `DATABASE_URL`, restart service |
| `ok: false` with env errors | Missing env vars | Add missing vars in Railway |
| 502 Bad Gateway | App crashed | Check logs, restart, or rollback |
| OAuth redirect fails | Callback URL mismatch | Verify GitHub OAuth app settings |
| Stripe webhooks fail | Wrong webhook secret | Update `STRIPE_WEBHOOK_SECRET` |

---

## Runbook: Health Check Failure

### Symptoms
- `/api/health` returns `ok: false` or 503
- Uptime monitor alerts firing
- Users reporting errors

### Diagnosis Steps

```bash
# Step 1: Get detailed health status
curl -s https://your-api.up.railway.app/api/health | jq .

# Step 2: Check what's failing
# Look at the response:
# - services.database: "disconnected" → Database issue
# - services.github: "not_configured" → Missing env var
# - status: "unhealthy" → General failure

# Step 3: Check logs for errors
railway logs --tail 100 | grep -i error

# Step 4: Check Sentry for recent errors
# Go to Sentry dashboard → Issues → Sort by last seen
```

### Resolution Steps

#### If Database Disconnected:
```bash
# 1. Check DATABASE_URL is set
railway variables

# 2. Check if Postgres is running
# Railway Dashboard → Your Project → Database → Status

# 3. Restart the service
railway service restart

# 4. If still failing, check for connection limit
railway run npx prisma db execute --stdin <<< "SELECT count(*) FROM pg_stat_activity;"
```

#### If Missing Config:
```bash
# 1. Check which vars are missing (look at health response)
# 2. Add missing variables
railway variables set VARIABLE_NAME=value

# 3. Service will auto-restart
```

#### If General Failure:
```bash
# 1. Check logs for specific error
railway logs --tail 100

# 2. If recent deploy caused it, rollback
railway rollback

# 3. If not, restart service
railway service restart
```

---

## Runbook: Database Issues

### Symptoms
- Health check shows `database: disconnected`
- Queries timing out
- "Connection refused" errors in logs

### Diagnosis

```bash
# 1. Check DATABASE_URL
railway variables | grep DATABASE

# 2. Test connection directly
railway run npx prisma db execute --stdin <<< "SELECT 1;"

# 3. Check connection pool
railway run npx prisma db execute --stdin <<< "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();"

# 4. Check for locks
railway run npx prisma db execute --stdin <<< "SELECT * FROM pg_locks WHERE NOT granted;"
```

### Resolution

#### Connection Refused:
1. Check Railway Postgres service is running
2. Check if IP restrictions are in place
3. Restart Postgres service in Railway dashboard

#### Too Many Connections:
```bash
# Kill idle connections (use with caution)
railway run npx prisma db execute --stdin <<< "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = current_database() 
AND state = 'idle' 
AND pid <> pg_backend_pid();
"
```

#### Slow Queries:
```bash
# Check for long-running queries
railway run npx prisma db execute --stdin <<< "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '1 minute';
"
```

---

## Runbook: High Error Rate

### Symptoms
- Sentry alerts firing
- Users reporting errors
- Error count spike in logs

### Diagnosis

```bash
# 1. Check Sentry for error patterns
# Sentry Dashboard → Issues → Group by error type

# 2. Check logs for error patterns
railway logs --tail 500 | grep -i "error\|exception\|failed" | head -50

# 3. Check if correlated with deploy
railway status  # Check recent deploy times

# 4. Check error rate by endpoint (if you have metrics)
# Railway Dashboard → Metrics → Look for spikes
```

### Resolution

#### If Caused by Recent Deploy:
```bash
# Rollback immediately
railway rollback
```

#### If External Service Issue (GitHub, Stripe, etc.):
1. Check service status pages
2. Implement circuit breaker if not already
3. Add fallback behavior
4. Monitor for recovery

#### If Database Query Issues:
1. Check for slow queries (see Database Runbook)
2. Add indexes if needed
3. Optimize queries

#### If Memory/CPU Issues:
1. Check Railway metrics
2. Scale up service if needed
3. Look for memory leaks in logs

---

## Smoke Test Commands

### Run Locally Against Production

```bash
# Full smoke test suite
PROD_URL=https://your-site.netlify.app \
RAILWAY_API_URL=https://your-api.up.railway.app \
npx playwright test e2e/smoke.spec.ts

# Auth flow tests only
PROD_URL=https://your-site.netlify.app \
RAILWAY_API_URL=https://your-api.up.railway.app \
npx playwright test e2e/auth-flow.spec.ts

# Quick curl tests
./scripts/smoke-test.sh production
```

### Create Quick Smoke Script

```bash
#!/bin/bash
# scripts/smoke-test.sh

ENV=${1:-production}

if [ "$ENV" = "production" ]; then
  FRONTEND_URL="https://your-site.netlify.app"
  API_URL="https://your-api.up.railway.app"
else
  FRONTEND_URL="https://staging.your-site.netlify.app"
  API_URL="https://your-api-staging.up.railway.app"
fi

echo "🔍 Running smoke tests against $ENV"
echo "Frontend: $FRONTEND_URL"
echo "API: $API_URL"
echo ""

# Frontend
echo -n "Frontend... "
HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" "$FRONTEND_URL/")
[ "$HTTP_CODE" -lt 400 ] && echo "✅ OK" || echo "❌ FAILED ($HTTP_CODE)"

# API Health
echo -n "API Health... "
HEALTH=$(curl -sS "$API_URL/api/health")
echo "$HEALTH" | jq -e '.ok == true' > /dev/null && echo "✅ OK" || echo "❌ FAILED"

# Database
echo -n "Database... "
DB=$(echo "$HEALTH" | jq -r '.services.database // .db')
[ "$DB" = "connected" ] || [ "$DB" = "ok" ] && echo "✅ OK" || echo "❌ FAILED ($DB)"

echo ""
echo "Full health response:"
echo "$HEALTH" | jq .
```

---

## Cron Schedule Recommendations

| Check | Frequency | Purpose |
|-------|-----------|---------|
| Health endpoint | Every 5 min | Detect outages quickly |
| Full smoke tests | Every 4 hours | Catch functional regressions |
| SSL certificate | Daily | Prevent certificate expiry |
| Database backup verify | Weekly | Ensure backups work |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-01 | 1.0.0 | Initial ops runbook |
