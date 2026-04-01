# Incident Response Runbook

## Severity Levels

| Level    | Description          | Response Time | Examples                      |
| -------- | -------------------- | ------------- | ----------------------------- |
| **SEV1** | Complete outage      | < 15 min      | Site down, all users affected |
| **SEV2** | Major feature broken | < 1 hour      | Auth broken, payments failing |
| **SEV3** | Minor feature broken | < 4 hours     | Single feature degraded       |
| **SEV4** | Cosmetic/low impact  | < 24 hours    | UI bug, typo                  |

---

## Incident Commander Checklist

### 1. Acknowledge & Assess (0-5 min)

- [ ] Acknowledge alert in monitoring system
- [ ] Open incident channel: `#incident-YYYY-MM-DD`
- [ ] Post initial assessment:
  ```
  🚨 INCIDENT: [Brief description]
  Severity: SEV[X]
  Impact: [Who/what is affected]
  Status: Investigating
  IC: @[your-name]
  ```

### 2. Investigate (5-15 min)

- [ ] Check Sentry for errors: https://sentry.io/organizations/guardrail
- [ ] Check Netlify deploy status: https://app.netlify.com
- [ ] Check API logs: Railway dashboard
- [ ] Check database status: Supabase dashboard
- [ ] Check Stripe status: https://status.stripe.com

### 3. Communicate (Every 15 min)

- [ ] Post status update to incident channel
- [ ] Update status page if public-facing
- [ ] Notify affected customers if SEV1/SEV2

### 4. Mitigate

- [ ] Identify root cause
- [ ] Apply fix or rollback
- [ ] Verify fix in production
- [ ] Confirm with users if possible

### 5. Resolve

- [ ] Post resolution to incident channel
- [ ] Close incident in monitoring system
- [ ] Schedule postmortem (within 48 hours for SEV1/SEV2)

---

## Common Issues & Fixes

### Site Returns 500 Error

**Symptoms**: All pages return 500, Sentry shows errors

**Diagnosis**:

```bash
# Check Netlify deploy
netlify status

# Check API health
curl -v https://api.guardrail.app/health
```

**Fix**:

1. Check Netlify Functions logs
2. If deploy issue: Rollback to previous deploy
3. If API issue: Check Railway logs

### Database Connection Errors

**Symptoms**: "Connection refused" or "Too many connections"

**Diagnosis**:

```bash
# Check Supabase connection pool
# In Supabase dashboard → Database → Connection pooling
```

**Fix**:

1. Check if connection pool is exhausted
2. Restart API service if needed
3. Scale connection pool if persistent

### Authentication Failing

**Symptoms**: Users can't log in, OAuth callback errors

**Diagnosis**:

```bash
# Check OAuth provider status
# GitHub: https://www.githubstatus.com
# Google: https://www.google.com/appsstatus

# Check callback URLs match environment
```

**Fix**:

1. Verify OAuth app credentials
2. Check callback URLs in provider dashboard
3. Verify JWT_SECRET is set correctly

### Stripe Webhooks Failing

**Symptoms**: Subscriptions not updating, payments not recorded

**Diagnosis**:

```bash
# Check Stripe webhook logs
# Dashboard → Developers → Webhooks → [endpoint] → Logs
```

**Fix**:

1. Verify webhook secret matches
2. Check if endpoint is reachable
3. Manually replay failed events from Stripe dashboard

### High Latency / Slow Responses

**Symptoms**: P95 latency > 2s, users report slowness

**Diagnosis**:

1. Check APM for slow endpoints
2. Check database query performance
3. Check external service latency

**Fix**:

1. Identify slow queries and optimize
2. Add caching where appropriate
3. Scale resources if needed

---

## Rollback Procedures

### Netlify (Frontend) Rollback

```bash
# Option 1: CLI
netlify rollback

# Option 2: Dashboard
# 1. Go to Netlify Dashboard
# 2. Click "Deploys"
# 3. Find previous working deploy
# 4. Click "Publish deploy"
```

### Railway (Backend) Rollback

```bash
# Option 1: Redeploy previous commit
git revert HEAD
git push origin main

# Option 2: Railway Dashboard
# 1. Go to Deployments
# 2. Find previous deploy
# 3. Click "Redeploy"
```

### Database Migration Rollback

```sql
-- Example rollback for migration 20260105_add_feature
-- Save as prisma/migrations/rollback-20260105.sql

BEGIN;

-- Reverse the migration changes
DROP TABLE IF EXISTS "new_feature_table";
ALTER TABLE "users" DROP COLUMN IF EXISTS "new_column";

-- Update migration history
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20260105_add_feature';

COMMIT;
```

---

## Escalation Path

```
Level 1: On-call Engineer
   ↓ (15 min no progress)
Level 2: Team Lead
   ↓ (30 min SEV1/SEV2)
Level 3: Engineering Manager
   ↓ (1 hour SEV1)
Level 4: CTO/Executive
```

---

## Post-Incident

### Postmortem Template

```markdown
# Incident Postmortem: [Title]

**Date**: YYYY-MM-DD
**Duration**: X hours Y minutes
**Severity**: SEV[X]
**Author**: [Name]

## Summary

Brief description of what happened.

## Impact

- Users affected: X
- Revenue impact: $X
- Duration: X hours

## Timeline

- HH:MM - First alert
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Incident resolved

## Root Cause

Technical explanation of what caused the incident.

## Resolution

What was done to fix the issue.

## Action Items

- [ ] Action 1 - Owner - Due date
- [ ] Action 2 - Owner - Due date

## Lessons Learned

What we learned and how we'll prevent this in the future.
```

---

## Useful Commands

```bash
# Check site status
curl -I https://guardrail.app

# Check API health
curl https://api.guardrail.app/health | jq

# Check SSL certificate
echo | openssl s_client -servername guardrail.app -connect guardrail.app:443 2>/dev/null | openssl x509 -noout -dates

# DNS lookup
dig guardrail.app +short
dig api.guardrail.app +short

# Test Stripe webhook
stripe trigger checkout.session.completed
```

---

**Keep calm and debug on! 🔧**
