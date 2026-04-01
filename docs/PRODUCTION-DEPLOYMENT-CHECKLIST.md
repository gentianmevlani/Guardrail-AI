# Production Deployment Checklist

## Pre-Deployment Verification

### Environment Variables (Netlify Dashboard)

- [ ] `NEXT_PUBLIC_API_URL` - Production API URL (e.g., `https://api.guardrail.app`)
- [ ] `NEXT_PUBLIC_APP_URL` - Production app URL (e.g., `https://guardrail.app`)
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (pk*live*...)
- [ ] `NEXT_PUBLIC_GITHUB_CLIENT_ID` - GitHub OAuth app client ID
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN for error tracking
- [ ] `API_URL` - Backend API URL for proxy redirects

### Backend Environment (Railway/Supabase)

- [ ] `DATABASE_URL` - Production PostgreSQL connection string
- [ ] `JWT_SECRET` - Strong random secret (min 32 chars)
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key (sk*live*...)
- [ ] `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret
- [ ] `GITHUB_CLIENT_SECRET` - GitHub OAuth app secret
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- [ ] `SENTRY_DSN` - Server-side Sentry DSN
- [ ] `SENTRY_AUTH_TOKEN` - For source map uploads
- [ ] `REDIS_URL` - Redis connection string (if using)
- [ ] `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` - Email configuration

### Supabase Configuration

- [ ] Row Level Security (RLS) enabled on all tables
- [ ] Appropriate RLS policies for each table
- [ ] Database backups enabled (daily)
- [ ] Point-in-time recovery enabled
- [ ] Connection pooling configured (PgBouncer)

### Stripe Configuration

- [ ] Production webhook endpoint configured: `https://api.guardrail.app/webhooks/stripe`
- [ ] Webhook events enabled:
  - [ ] `checkout.session.completed`
  - [ ] `customer.subscription.created`
  - [ ] `customer.subscription.updated`
  - [ ] `customer.subscription.deleted`
  - [ ] `invoice.payment_succeeded`
  - [ ] `invoice.payment_failed`
- [ ] Products and prices created in production
- [ ] Customer portal configured

### DNS & SSL

- [ ] DNS A/CNAME records configured for:
  - [ ] `guardrail.app` → Netlify
  - [ ] `api.guardrail.app` → Railway/Backend
- [ ] SSL certificates verified (auto-provisioned by Netlify)
- [ ] HTTPS redirect enabled
- [ ] HSTS headers configured

### Security Headers (netlify.toml)

- [x] `X-Frame-Options: DENY`
- [x] `X-Content-Type-Options: nosniff`
- [x] `X-XSS-Protection: 1; mode=block`
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `Permissions-Policy` configured

### Error Pages

- [ ] Custom 404 page designed and working
- [ ] Custom 500 error page designed
- [ ] Error pages include navigation back to home

### Legal Pages

- [ ] Privacy Policy page (`/privacy`)
- [ ] Terms of Service page (`/terms`)
- [ ] Cookie Policy (if applicable)
- [ ] GDPR compliance notice (if serving EU)

### Analytics & Monitoring

- [ ] Sentry configured with source maps
- [ ] Vercel Analytics or Google Analytics installed
- [ ] Uptime monitoring configured (UptimeRobot/Pingdom)
- [ ] Log aggregation configured

### Backup Verification

- [ ] Database backup tested with restore
- [ ] Backup retention policy documented
- [ ] Backup alerts configured

### Rollback Procedure

- [ ] Rollback procedure documented
- [ ] Previous deploy available in Netlify
- [ ] Database migration rollback scripts ready

---

## Deployment Steps

### 1. Pre-Deploy

```bash
# Run all tests
pnpm test

# Run E2E tests
pnpm test:e2e

# Type check
pnpm type-check

# Lint
pnpm lint

# Security audit
pnpm audit
```

### 2. Database Migration

```bash
# Backup production database first!
# Then run migrations
npx prisma migrate deploy
```

### 3. Deploy

```bash
# Push to main branch triggers auto-deploy
git push origin main

# Or manual deploy via Netlify CLI
netlify deploy --prod
```

### 4. Post-Deploy Verification

```bash
# Run smoke tests
curl -sf https://guardrail.app > /dev/null && echo "✅ Homepage OK"
curl -sf https://api.guardrail.app/health > /dev/null && echo "✅ API Health OK"

# Check critical pages
curl -sf https://guardrail.app/login > /dev/null && echo "✅ Login page OK"
curl -sf https://guardrail.app/pricing > /dev/null && echo "✅ Pricing page OK"
```

---

## First Week Monitoring Dashboard

### Key Metrics to Track

| Metric            | Target     | Alert Threshold |
| ----------------- | ---------- | --------------- |
| Error Rate (5xx)  | < 0.1%     | > 1%            |
| P95 Latency       | < 500ms    | > 2s            |
| Uptime            | 99.9%      | < 99%           |
| Successful Logins | Baseline   | -50%            |
| Stripe Events     | Processing | Failures > 5    |

### Daily Checks (First Week)

- [ ] Check Sentry for new errors
- [ ] Review API response times
- [ ] Check Stripe webhook logs
- [ ] Monitor database connections
- [ ] Review user signup funnel

### Alerts to Configure

1. **Error Rate Alert**: > 1% 5xx errors in 5 minutes
2. **Latency Alert**: P95 > 2 seconds
3. **Downtime Alert**: Site unreachable for > 1 minute
4. **Stripe Alert**: Webhook failures
5. **Database Alert**: Connection pool exhausted

---

## Quick Reference

### Rollback Command

```bash
# Netlify rollback to previous deploy
netlify rollback

# Or via dashboard: Deploys → Previous Deploy → Publish
```

### Database Rollback

```bash
# Find the last migration
npx prisma migrate status

# Rollback (manually create down migration)
npx prisma db execute --file ./prisma/migrations/rollback-XXXX.sql
```

### Emergency Contacts

- **On-Call Engineer**: [Phone/Slack]
- **Infrastructure**: [Netlify Status](https://netlifystatus.com)
- **Database**: [Supabase Status](https://status.supabase.com)
- **Payments**: [Stripe Status](https://status.stripe.com)

---

**Last Updated**: January 2026
