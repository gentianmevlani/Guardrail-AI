# guardrail Operations Runbook

## Overview

This runbook provides operational guidance for running, maintaining, and troubleshooting the guardrail platform.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Environment Setup](#environment-setup)
3. [Deployment](#deployment)
4. [Monitoring & Observability](#monitoring--observability)
5. [Common Operations](#common-operations)
6. [Troubleshooting](#troubleshooting)
7. [Security Procedures](#security-procedures)
8. [Incident Response](#incident-response)

---

## System Architecture

### Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| API Server | Fastify 5.x | REST API, WebSocket, Webhooks |
| Web UI | Next.js 14.x | Dashboard, Settings, Reports |
| Database | PostgreSQL | Primary data store |
| Cache | Redis (optional) | Session cache, rate limiting |
| Queue | BullMQ | Background job processing |
| Auth | JWT + NextAuth | Authentication & Authorization |

### Key Services

- **Authentication Service**: JWT-based auth with refresh tokens
- **Billing Service**: Stripe integration for subscriptions
- **Security Event Service**: Audit logging and security monitoring
- **Webhook Integration Service**: Outbound webhook delivery
- **Export Service**: Data export in CSV/JSON formats
- **Cleanup Jobs Service**: Automated data retention

---

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/guardrail"

# Authentication
JWT_SECRET="your-jwt-secret-min-32-chars"
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="https://your-domain.com"

# Stripe Billing
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_ID_PRO_MONTHLY="price_..."
STRIPE_PRICE_ID_STARTER_MONTHLY="price_..."

# MFA
MFA_ENCRYPTION_KEY="32-byte-hex-key"

# Email (optional)
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT="587"
SMTP_USER="apikey"
SMTP_PASSWORD="SG..."
EMAIL_FROM="noreply@guardrailai.dev"

# GitHub Integration (optional)
GITHUB_APP_ID="..."
GITHUB_PRIVATE_KEY="..."
GITHUB_WEBHOOK_SECRET="..."

# Redis (optional)
REDIS_URL="redis://localhost:6379"
```

### Database Migrations

```bash
# Run pending migrations
pnpm prisma migrate deploy

# Generate Prisma client
pnpm prisma generate

# Reset database (CAUTION: deletes all data)
pnpm prisma migrate reset
```

---

## Deployment

### Pre-deployment Checklist

- [ ] All migrations applied
- [ ] Environment variables set
- [ ] Stripe webhooks configured
- [ ] Health check endpoints responding
- [ ] SSL certificates valid

### Docker Deployment

```bash
# Build images
docker build -t guardrail-api -f apps/api/Dockerfile .
docker build -t guardrail-web -f apps/web-ui/Dockerfile .

# Run with docker-compose
docker-compose -f docker-compose.yml up -d
```

### Health Checks

| Endpoint | Expected Response |
|----------|-------------------|
| GET /health | `{ "status": "ok" }` |
| GET /health/ready | `{ "ready": true }` |
| GET /metrics | Prometheus format metrics |

---

## Monitoring & Observability

### Metrics Endpoints

- `/metrics` - Prometheus format for scraping
- `/metrics/json` - JSON format for dashboards

### Key Metrics to Monitor

1. **API Performance**
   - `guardrail_api_request_duration_ms` - Request latency (p50, p95, p99)
   - `guardrail_api_errors_total` - Error count by endpoint

2. **Billing & Subscriptions**
   - `guardrail_billing_webhook_total` - Webhook processing
   - `guardrail_subscription_changes_total` - Tier changes

3. **Security Events**
   - `guardrail_security_events_total` - All security events
   - `guardrail_security_events_by_severity_total` - By severity level

4. **Plan Gating**
   - `guardrail_plan_gate_check_total` - Total gate checks
   - `guardrail_plan_gate_blocked_total` - Blocked requests

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| P95 Latency | > 500ms | > 2s |
| Security Events (Critical) | > 5/hour | > 20/hour |
| Failed Webhooks | > 10% | > 30% |

---

## Common Operations

### Manual Cleanup Jobs

```bash
# Trigger token cleanup
curl -X POST https://api.guardrailai.dev/admin/cleanup/tokens \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Trigger daily cleanup
curl -X POST https://api.guardrailai.dev/admin/cleanup/daily \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Trigger weekly cleanup
curl -X POST https://api.guardrailai.dev/admin/cleanup/weekly \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Export Data

```bash
# Export runs as CSV
curl "https://api.guardrailai.dev/api/exports/runs?format=csv" \
  -H "Authorization: Bearer $TOKEN" \
  -o runs-export.csv

# Export audit logs as JSON
curl "https://api.guardrailai.dev/api/exports/audit-logs?format=json" \
  -H "Authorization: Bearer $TOKEN" \
  -o audit-logs.json
```

### Webhook Management

```bash
# List all webhook subscriptions
curl https://api.guardrailai.dev/api/v1/webhooks/subscriptions \
  -H "Authorization: Bearer $TOKEN"

# Test a webhook endpoint
curl -X POST https://api.guardrailai.dev/api/v1/webhooks/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-endpoint.com/webhook"}'
```

### User Management

```bash
# Search users (admin only)
curl "https://api.guardrailai.dev/api/v1/admin/users?query=email@example.com" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# View user details
curl "https://api.guardrailai.dev/api/v1/admin/users/USER_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## Troubleshooting

### Common Issues

#### 1. Database Connection Errors

**Symptoms**: 500 errors, "connection refused" in logs

**Solutions**:
1. Verify DATABASE_URL is correct
2. Check PostgreSQL is running
3. Verify network connectivity
4. Check connection pool settings

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

#### 2. Authentication Failures

**Symptoms**: 401 errors, "invalid token" messages

**Solutions**:
1. Verify JWT_SECRET matches between API and web
2. Check token expiration (default: 24 hours)
3. Clear cookies and re-authenticate
4. Check for clock skew between servers

#### 3. Stripe Webhook Failures

**Symptoms**: Subscription updates not processing

**Solutions**:
1. Verify STRIPE_WEBHOOK_SECRET is correct
2. Check webhook endpoint is publicly accessible
3. Review Stripe dashboard for failed events
4. Manually replay failed webhooks from Stripe

```bash
# Check recent billing events
curl "https://api.guardrailai.dev/api/billing/events?limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

#### 4. Scan Timeouts

**Symptoms**: Runs stuck in "running" status

**Solutions**:
1. Check worker process is running
2. Review queue depth and processing rate
3. Increase timeout settings if needed
4. Check for deadlocks in scan processing

#### 5. Email Delivery Issues

**Symptoms**: Notifications not received

**Solutions**:
1. Verify SMTP settings
2. Check spam folders
3. Review email service logs (SendGrid, etc.)
4. Test with a simple email send

---

## Security Procedures

### Security Event Investigation

1. Query recent events:
```sql
SELECT * FROM security_events 
WHERE severity IN ('critical', 'high')
AND timestamp > NOW() - INTERVAL '24 hours'
ORDER BY timestamp DESC;
```

2. Identify affected users
3. Review access patterns
4. Take remediation actions
5. Document incident

### Rotating Secrets

1. **JWT_SECRET**: 
   - Generate new secret
   - Deploy to all instances
   - Old tokens will be invalidated

2. **MFA_ENCRYPTION_KEY**:
   - CAUTION: Requires re-enrollment of all MFA users
   - Plan migration carefully

3. **STRIPE_WEBHOOK_SECRET**:
   - Update in Stripe dashboard
   - Update environment variable
   - Deploy immediately

### Access Control

| Role | Capabilities |
|------|-------------|
| user | Basic dashboard, own data |
| admin | User management, audit logs |
| support | Limited admin for customer support |

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Service down, security breach | 15 min |
| P2 | Major feature broken | 1 hour |
| P3 | Minor issue, workaround exists | 4 hours |
| P4 | Enhancement, low priority | Next sprint |

### Incident Response Steps

1. **Identify**: Confirm the issue and severity
2. **Communicate**: Update status page, notify stakeholders
3. **Mitigate**: Apply quick fix or rollback
4. **Investigate**: Root cause analysis
5. **Resolve**: Deploy permanent fix
6. **Document**: Post-incident report

### Emergency Contacts

- On-call Engineer: [PagerDuty/OpsGenie integration]
- Security Team: security@guardrailai.dev
- Platform Lead: platform@guardrailai.dev

---

## Maintenance Windows

- **Weekly**: Sundays 03:00-04:00 UTC - Cleanup jobs, minor updates
- **Monthly**: First Saturday 02:00-06:00 UTC - Database maintenance
- **Quarterly**: Scheduled downtime for major upgrades

---

## Appendix

### Useful Commands

```bash
# View API logs
docker logs guardrail-api -f --tail 100

# Check queue status
redis-cli LLEN bull:guardrail:waiting

# Database backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup-20240115.sql
```

### Support Resources

- Documentation: https://guardrailai.dev/docs
- Status Page: https://status.guardrailai.dev
- GitHub Issues: https://github.com/guardrail/guardrail/issues
