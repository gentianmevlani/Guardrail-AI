# Production Testing Setup

Complete guide for monitoring and testing guardrail in production.

## Architecture

```
┌─────────────────────┐     ┌─────────────────────┐
│   Netlify (Next.js) │────▶│  Railway (Fastify)  │
│   /api/health       │     │  /api/health        │
└─────────────────────┘     │  /api/ready         │
         │                  │  PostgreSQL DB      │
         │                  └─────────────────────┘
         │
         ▼
┌─────────────────────┐
│  UptimeRobot /      │
│  Better Stack       │
│  (Monitors)         │
└─────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Environment Variables

#### Netlify (Frontend)

```env
# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # For source map upload
SENTRY_ORG=your-org
SENTRY_PROJECT=guardrail-web

# API
RAILWAY_API_URL=https://guardrail-production.up.railway.app
```

#### Railway (API)

```env
# Sentry
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Database (auto-set by Railway)
DATABASE_URL=postgresql://...
```

---

## Health Endpoints

### Frontend Health (`/api/health`)

**URL:** `https://your-site.netlify.app/api/health`

**Response:**
```json
{
  "ok": true,
  "frontend": "ok",
  "api": "ok",
  "db": "ok",
  "ms": 245,
  "ts": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

**Status Codes:**
- `200` - All services healthy
- `503` - One or more services unhealthy

### Railway API Health (`/api/health`)

**URL:** `https://guardrail-production.up.railway.app/api/health`

**Response:**
```json
{
  "ok": true,
  "db": "ok",
  "ms": 12,
  "ts": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0",
  "services": {
    "github": "ok",
    "stripe": "ok",
    "openai": "ok"
  }
}
```

### Railway Readiness (`/api/ready`)

**URL:** `https://guardrail-production.up.railway.app/api/ready`

**Response:**
```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "github": true,
    "stripe": true
  }
}
```

---

## Sentry Setup

### 1. Create Sentry Project

1. Go to [sentry.io](https://sentry.io)
2. Create a new project for Next.js
3. Create another project for Node.js (for Railway API)
4. Copy the DSN values

### 2. Configure Sentry

Files created:
- `apps/web-ui/sentry.client.config.ts` - Browser error tracking
- `apps/web-ui/sentry.server.config.ts` - Server-side error tracking
- `apps/web-ui/sentry.edge.config.ts` - Edge runtime tracking
- `apps/api/src/sentry.ts` - API error tracking

### 3. What You Get

- **Stack traces** with source maps
- **Session replay** on errors (browser)
- **Performance traces** (slow API calls, DB queries)
- **Release tracking** (see which deploy broke)
- **User context** (which user hit the error)

---

## Uptime Monitoring

### UptimeRobot (Free)

1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Create monitors:

| Monitor Name | URL | Type | Interval |
|--------------|-----|------|----------|
| guardrail Homepage | `https://your-site.netlify.app/` | HTTP(s) | 5 min |
| guardrail Health | `https://your-site.netlify.app/api/health` | HTTP(s) | 5 min |
| Railway API Health | `https://guardrail-production.up.railway.app/api/health` | HTTP(s) | 5 min |

3. Set up alerts (email, SMS, Slack)

### Better Stack (Alternative)

Better logging + monitoring in one:
1. Sign up at [betterstack.com](https://betterstack.com)
2. Similar monitor setup
3. Can also receive logs from Railway

---

## Smoke Tests

### Run Locally

```bash
# Set production URLs
export PROD_URL=https://your-site.netlify.app
export RAILWAY_API_URL=https://guardrail-production.up.railway.app

# Run Playwright tests
npx playwright test e2e/smoke.spec.ts

# Or run bash script
./scripts/smoke-test.sh
```

### GitHub Actions (Automatic)

Smoke tests run automatically:
- Every 6 hours (cron)
- After push to `main`
- Manual trigger via workflow_dispatch

See: `.github/workflows/smoke-tests.yml`

### Checkly (Recommended for Production)

1. Sign up at [checklyhq.com](https://checklyhq.com)
2. Import `e2e/smoke.spec.ts`
3. Configure:
   - Run interval: 10 minutes
   - Locations: US East, EU West
   - Alert channels: Email, Slack

---

## Smoke Test Coverage

| Test | What it checks |
|------|----------------|
| Landing page loads | Homepage returns 2xx, key elements visible |
| Frontend health | `/api/health` returns ok for all services |
| Railway API health | Direct API health check |
| Login page renders | Auth modal/page appears |
| Navigation works | No crashes on scroll/navigation |
| No console errors | No critical JS errors |
| API readiness | All backend services ready |
| Performance | Page < 5s, API < 2s |

---

## Post-Deploy Verification

After every deploy, verify:

```bash
# Quick check
curl -fsS https://your-site.netlify.app/api/health | jq .

# Expected output
{
  "ok": true,
  "frontend": "ok",
  "api": "ok",
  "db": "ok",
  "ms": 245,
  "ts": "2024-01-01T12:00:00.000Z"
}
```

---

## Cloudflare (Optional Security Layer)

For custom domains, add Cloudflare:

1. Add domain to Cloudflare
2. Point DNS to Netlify
3. Enable:
   - **WAF Rules** (basic protection)
   - **Rate Limiting** on `/api/auth/*`
   - **Bot Protection**
   - **DDoS protection** (automatic)

---

## Minimum Setup Checklist

If you do only 3 things:

- [x] `/api/health` endpoint (frontend + API)
- [ ] UptimeRobot monitors (homepage + health endpoints)
- [ ] Sentry on Next.js + Railway

Then add:
- [ ] Checkly or GH Actions cron for Playwright smoke tests

---

## Environment Variables Summary

### Netlify

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SENTRY_DSN` | Yes | Sentry DSN for browser |
| `SENTRY_DSN` | Yes | Sentry DSN for server |
| `SENTRY_AUTH_TOKEN` | No | For source map upload |
| `SENTRY_ORG` | No | Sentry organization |
| `SENTRY_PROJECT` | No | Sentry project name |
| `RAILWAY_API_URL` | Yes | Railway API base URL |

### Railway

| Variable | Required | Description |
|----------|----------|-------------|
| `SENTRY_DSN` | Yes | Sentry DSN for API |
| `DATABASE_URL` | Yes | PostgreSQL connection (auto) |
| `NODE_ENV` | Yes | `production` |

---

## Troubleshooting

### Health check returns 503

1. Check Railway logs for DB connection errors
2. Verify `DATABASE_URL` is set
3. Check if Railway service is running

### Sentry not receiving errors

1. Verify `SENTRY_DSN` is set correctly
2. Check that `NODE_ENV=production`
3. Test with: `Sentry.captureMessage("Test")`

### Smoke tests failing

1. Check if URLs are correct
2. Verify Netlify deploy completed
3. Check Railway service status
4. Look at Playwright trace/screenshot artifacts
