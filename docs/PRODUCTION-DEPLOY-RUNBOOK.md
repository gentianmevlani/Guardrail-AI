# guardrail Production Deployment Runbook

This document provides step-by-step instructions for deploying guardrail to production.

## Architecture Overview

```
┌─────────────────┐         ┌─────────────────┐
│   Netlify       │         │   Railway       │
│   (Frontend)    │────────▶│   (API)         │
│   Next.js       │         │   Fastify       │
└─────────────────┘         └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   PostgreSQL    │
                            │   (Railway)     │
                            └─────────────────┘
```

---

## Pre-Deployment Checklist

### 1. Database Migrations Ready
```bash
# Ensure all schema changes have migrations
cd packages/database
npx prisma migrate status

# If there are pending changes, create a migration locally
npx prisma migrate dev --name your_migration_name
```

### 2. Environment Variables Prepared
- [ ] Production secrets generated (JWT_SECRET, etc.)
- [ ] GitHub OAuth app created for production
- [ ] Stripe account configured with production keys
- [ ] Sentry project created

### 3. External Services Configured
- [ ] GitHub OAuth App (production callback URL)
- [ ] Stripe Webhooks (production endpoint)
- [ ] Sentry DSN obtained

---

## Environment Variable Mapping

### Railway (API Server)

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | Yes | Usually `3000` (Railway sets this) |
| `HOST` | Yes | `0.0.0.0` |
| `DATABASE_URL` | Yes | Auto-set by Railway Postgres |
| `JWT_SECRET` | Yes | Min 64 chars, generate with `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | Yes | Min 64 chars |
| `GITHUB_CLIENT_ID` | Yes | From GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | Yes | From GitHub OAuth App |
| `GITHUB_CALLBACK_URL` | Yes | `https://your-api.up.railway.app/api/auth/github/callback` |
| `STRIPE_SECRET_KEY` | Recommended | `sk_live_...` from Stripe |
| `STRIPE_WEBHOOK_SECRET` | Recommended | `whsec_...` from Stripe |
| `STRIPE_PUBLISHABLE_KEY` | Recommended | `pk_live_...` from Stripe |
| `CORS_ORIGIN` | Yes | `https://your-frontend.netlify.app` |
| `API_BASE_URL` | Yes | `https://your-api.up.railway.app` |
| `SENTRY_DSN` | Recommended | From Sentry project |
| `REDIS_URL` | Optional | For caching (Railway Redis) |
| `OPENAI_API_KEY` | Optional | For AI features |

### Netlify (Frontend)

| Variable | Required | Description |
|----------|----------|-------------|
| `API_URL` | Yes | `https://your-api.up.railway.app` (used in redirects) |
| `NEXT_PUBLIC_API_URL` | Yes | Same as API_URL |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://your-frontend.netlify.app` |
| `SENTRY_DSN` | Recommended | From Sentry project |
| `SENTRY_ORG` | Recommended | Sentry organization slug |
| `SENTRY_PROJECT` | Recommended | Sentry project slug |

---

## First Production Deploy

### Step 1: Set Up Railway

1. **Create Railway Project**
   ```
   railway login
   railway init
   ```

2. **Add PostgreSQL Database**
   - In Railway dashboard: Add → Database → PostgreSQL
   - Railway auto-sets `DATABASE_URL`

3. **Configure Environment Variables**
   - Go to your service → Variables
   - Add all required variables from the table above
   - **Important**: Set `NODE_ENV=production`

4. **Deploy API**
   ```bash
   railway up
   ```

5. **Run Initial Migration**
   ```bash
   # Connect to Railway shell
   railway run npx prisma migrate deploy
   ```

### Step 2: Set Up External Services

#### GitHub OAuth App
1. Go to https://github.com/settings/developers
2. Create new OAuth App:
   - **Application name**: guardrail
   - **Homepage URL**: `https://your-frontend.netlify.app`
   - **Authorization callback URL**: `https://your-api.up.railway.app/api/auth/github/callback`
3. Copy Client ID and Client Secret to Railway variables

#### Stripe Webhooks
1. Go to https://dashboard.stripe.com/webhooks
2. Add endpoint:
   - **Endpoint URL**: `https://your-api.up.railway.app/api/webhooks/stripe`
   - **Events**: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
3. Copy signing secret to Railway variables

### Step 3: Set Up Netlify

1. **Connect Repository**
   - Import project from Git
   - Set build settings:
     - Base directory: `apps/web-ui`
     - Build command: `npm run build`
     - Publish directory: `.next`

2. **Configure Environment Variables**
   - Go to Site settings → Environment variables
   - Add all required variables from the table above

3. **Configure Deploy Contexts**
   - Production: Uses `API_URL` pointing to production Railway
   - Deploy Preview: Uses `API_URL` pointing to staging Railway (optional)

4. **Deploy**
   - Trigger deploy from Netlify dashboard or push to main branch

### Step 4: Verify Deployment

1. **Check API Health**
   ```bash
   curl https://your-api.up.railway.app/api/health
   ```
   Expected response:
   ```json
   {
     "ok": true,
     "environment": "production",
     "checks": {
       "database": "ok",
       "config": "ok"
     }
   }
   ```

2. **Check Readiness**
   ```bash
   curl https://your-api.up.railway.app/api/ready
   ```

3. **Test OAuth Flow**
   - Visit frontend and click "Sign in with GitHub"
   - Verify redirect and callback work

4. **Test Stripe Webhook**
   - Use Stripe CLI or dashboard to send test webhook
   - Check Railway logs for webhook receipt

---

## Subsequent Deployments

### Standard Deploy (No Schema Changes)

```bash
# 1. Push to main branch
git push origin main

# 2. Railway auto-deploys from GitHub
# 3. Netlify auto-deploys from GitHub
# 4. Verify health endpoints
```

### Deploy with Database Migrations

```bash
# 1. Create migration locally
cd packages/database
npx prisma migrate dev --name add_new_feature

# 2. Commit migration files
git add prisma/migrations
git commit -m "feat: add new feature migration"

# 3. Push to main
git push origin main

# 4. Railway deploys and runs `prisma migrate deploy` automatically
# 5. If migration fails, deploy halts (safe)
```

---

## Rollback Procedures

### Rollback API (Railway)

1. **Quick Rollback via Dashboard**
   - Go to Railway → Deployments
   - Click on previous successful deployment
   - Click "Rollback"

2. **Rollback via CLI**
   ```bash
   railway rollback
   ```

### Rollback Frontend (Netlify)

1. **Via Dashboard**
   - Go to Netlify → Deploys
   - Find previous successful deploy
   - Click "Publish deploy"

### Database Rollback

⚠️ **Warning**: Database rollbacks can cause data loss. Proceed with caution.

```bash
# 1. Check migration status
railway run npx prisma migrate status

# 2. If needed, manually revert (requires custom down migration)
# Prisma doesn't support automatic down migrations
# You must write and run manual SQL to revert changes
```

**Best Practice**: Take a database backup before deploying migrations.

---

## Monitoring & Alerts

### Health Endpoints

| Endpoint | Purpose | Expected Status |
|----------|---------|-----------------|
| `/api/live` | Liveness probe | 200 always |
| `/api/health` | Full health check | 200 if healthy |
| `/api/ready` | Readiness probe | 200 if ready |
| `/api/startup` | Startup probe | 200 when started |

### Setting Up Monitoring

1. **Railway Metrics**
   - Built-in CPU/Memory monitoring
   - Set up alerts in Railway dashboard

2. **Uptime Monitoring**
   - Use UptimeRobot, Pingdom, or similar
   - Monitor `/api/health` endpoint
   - Alert on non-200 responses

3. **Sentry Error Tracking**
   - Errors automatically reported
   - Set up Slack/Email alerts in Sentry

---

## Troubleshooting

### API Won't Start

1. **Check Environment Variables**
   ```bash
   railway logs
   ```
   Look for: "❌ FATAL: [VARIABLE] is not set"

2. **Check Database Connection**
   ```bash
   railway run npx prisma migrate status
   ```

3. **Check for Migration Failures**
   Look for: "❌ FATAL: Database migration failed!"

### OAuth Not Working

1. **Verify Callback URL**
   - Must match exactly in GitHub OAuth App settings
   - Check for trailing slashes

2. **Check CORS Settings**
   - `CORS_ORIGIN` must include frontend URL

### Stripe Webhooks Failing

1. **Verify Endpoint URL**
   - Must be HTTPS
   - Must be publicly accessible

2. **Check Webhook Secret**
   - Must match exactly in Railway variables

3. **Test with Stripe CLI**
   ```bash
   stripe listen --forward-to https://your-api.up.railway.app/api/webhooks/stripe
   stripe trigger checkout.session.completed
   ```

---

## Security Checklist

- [ ] All secrets are in environment variables, not code
- [ ] `JWT_SECRET` is at least 64 characters
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enforced on all endpoints
- [ ] CORS is restricted to frontend domain only
- [ ] `db push --accept-data-loss` is blocked
- [ ] Rate limiting is enabled
- [ ] Sentry error tracking is configured
- [ ] Database backups are enabled (Railway automatic)

---

## Emergency Contacts

| Service | Support |
|---------|---------|
| Railway | https://railway.app/help |
| Netlify | https://www.netlify.com/support/ |
| Stripe | https://support.stripe.com/ |
| GitHub | https://support.github.com/ |

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-01 | 1.0.0 | Initial production deploy runbook |
