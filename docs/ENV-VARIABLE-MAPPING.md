# guardrail Environment Variable Mapping

This document maps all environment variables to their deployment locations (Netlify vs Railway).

---

## Quick Reference

| Symbol | Meaning |
|--------|---------|
| ✅ | Required |
| ⚠️ | Recommended |
| ➖ | Optional |
| 🔒 | Secret (never commit) |

---

## Railway (API Server) Variables

### Core Configuration

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `NODE_ENV` | ✅ | No | Must be `production` |
| `PORT` | ✅ | No | Usually `3000` (Railway may override) |
| `HOST` | ✅ | No | Set to `0.0.0.0` |

### Database

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `DATABASE_URL` | ✅ | 🔒 | PostgreSQL connection string. Auto-set by Railway Postgres addon |

### Authentication

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `JWT_SECRET` | ✅ | 🔒 | Min 64 chars. Generate: `openssl rand -base64 64` |
| `JWT_REFRESH_SECRET` | ✅ | 🔒 | Min 64 chars. Generate: `openssl rand -base64 64` |
| `JWT_EXPIRES_IN` | ➖ | No | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | ➖ | No | Default: `7d` |

### GitHub OAuth

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `GITHUB_CLIENT_ID` | ✅ (prod) | No | From GitHub OAuth App |
| `GITHUB_CLIENT_SECRET` | ✅ (prod) | 🔒 | From GitHub OAuth App |
| `GITHUB_CALLBACK_URL` | ✅ (prod) | No | `https://your-api.up.railway.app/api/auth/github/callback` |
| `GITHUB_WEBHOOK_SECRET` | ➖ | 🔒 | For GitHub webhooks |

### Stripe Billing

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `STRIPE_SECRET_KEY` | ⚠️ | 🔒 | `sk_live_...` from Stripe Dashboard |
| `STRIPE_PUBLISHABLE_KEY` | ⚠️ | No | `pk_live_...` from Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | ⚠️ | 🔒 | `whsec_...` from Stripe Webhooks |
| `STRIPE_PRICE_ID_STARTER` | ⚠️ | No | Price ID for Starter plan |
| `STRIPE_PRICE_ID_PRO` | ⚠️ | No | Price ID for Pro plan |
| `STRIPE_PRICE_ID_ENTERPRISE` | ⚠️ | No | Price ID for Enterprise plan |

### URLs & CORS

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `API_BASE_URL` | ✅ | No | `https://your-api.up.railway.app` |
| `CORS_ORIGIN` | ✅ | No | Frontend URLs, comma-separated |

### External Services

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `OPENAI_API_KEY` | ➖ | 🔒 | For AI features |
| `REDIS_URL` | ➖ | 🔒 | For caching. Auto-set by Railway Redis addon |

### Monitoring

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `SENTRY_DSN` | ⚠️ | No | Sentry project DSN |

### Rate Limiting

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `RATE_LIMIT_WINDOW_MS` | ➖ | No | Default: `900000` (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | ➖ | No | Default: `100` |

### Feature Flags

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `ENABLE_METRICS` | ➖ | No | Enable Prometheus metrics |
| `ENABLE_AI_FEATURES` | ➖ | No | Enable AI-powered features |
| `Guardrail_DEMO_MODE` | ➖ | No | Enable demo mode |
| `Guardrail_POLICY_STRICT` | ➖ | No | Strict policy enforcement |

---

## Netlify (Frontend) Variables

### Build-Time Variables

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `API_URL` | ✅ | No | Used in `netlify.toml` redirects |
| `NEXT_PUBLIC_API_URL` | ✅ | No | Bundled into client JS |
| `NEXT_PUBLIC_APP_URL` | ✅ | No | Frontend URL, bundled into client |

### Client-Side Variables

> ⚠️ `NEXT_PUBLIC_*` variables are bundled into the JavaScript and visible to users.
> Never put secrets in these variables!

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | No | API base URL for client requests |
| `NEXT_PUBLIC_APP_URL` | ✅ | No | App URL for OAuth redirects |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ⚠️ | No | Stripe publishable key (safe to expose) |
| `NEXT_PUBLIC_GITHUB_CLIENT_ID` | ➖ | No | For client-side OAuth init (if used) |

### Sentry (Build-Time)

| Variable | Required | Secret | Description |
|----------|----------|--------|-------------|
| `SENTRY_DSN` | ⚠️ | No | Sentry project DSN |
| `SENTRY_ORG` | ⚠️ | No | Sentry organization slug |
| `SENTRY_PROJECT` | ⚠️ | No | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | ⚠️ | 🔒 | For source map uploads |

---

## Environment-Specific Values

### Production

```bash
# Railway
NODE_ENV=production
DATABASE_URL=<auto-set by Railway>
JWT_SECRET=<generate with: openssl rand -base64 64>
GITHUB_CLIENT_ID=<production OAuth app>
GITHUB_CLIENT_SECRET=<production OAuth app>
GITHUB_CALLBACK_URL=https://guardrail-production.up.railway.app/api/auth/github/callback
API_BASE_URL=https://guardrail-production.up.railway.app
CORS_ORIGIN=https://guardrail.app,https://www.guardrail.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Netlify
API_URL=https://guardrail-production.up.railway.app
NEXT_PUBLIC_API_URL=https://guardrail-production.up.railway.app
NEXT_PUBLIC_APP_URL=https://guardrail.app
```

### Staging

```bash
# Railway (staging service)
NODE_ENV=staging
DATABASE_URL=<staging database URL>
JWT_SECRET=<staging secret>
GITHUB_CLIENT_ID=<staging OAuth app>
GITHUB_CLIENT_SECRET=<staging OAuth app>
GITHUB_CALLBACK_URL=https://guardrail-staging.up.railway.app/api/auth/github/callback
API_BASE_URL=https://guardrail-staging.up.railway.app
CORS_ORIGIN=https://staging.guardrail.app,https://*.netlify.app
STRIPE_SECRET_KEY=sk_test_...  # TEST mode!
STRIPE_WEBHOOK_SECRET=whsec_...

# Netlify (deploy preview context)
API_URL=https://guardrail-staging.up.railway.app
NEXT_PUBLIC_API_URL=https://guardrail-staging.up.railway.app
NEXT_PUBLIC_APP_URL=https://staging.guardrail.app
```

### Development

```bash
# Local .env file
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/guardrail
JWT_SECRET=dev-secret-at-least-32-characters-long
GITHUB_CLIENT_ID=<dev OAuth app>
GITHUB_CLIENT_SECRET=<dev OAuth app>
GITHUB_CALLBACK_URL=http://localhost:3000/api/auth/github/callback
API_BASE_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000,http://localhost:5000
STRIPE_SECRET_KEY=sk_test_...
```

---

## Setting Variables in Each Platform

### Railway

**Via Dashboard:**
1. Go to your Railway project
2. Select your service
3. Click "Variables" tab
4. Add each variable

**Via CLI:**
```bash
railway variables set NODE_ENV=production
railway variables set JWT_SECRET="your-secret-here"
```

**Via `railway.toml`** (non-secrets only):
```toml
[env]
NODE_ENV = "production"
PORT = "3000"
```

### Netlify

**Via Dashboard:**
1. Go to Site settings → Environment variables
2. Add variables
3. Optionally set different values per deploy context (Production, Deploy Preview, etc.)

**Via `netlify.toml`** (non-secrets, context-specific):
```toml
[context.production.environment]
  NODE_ENV = "production"

[context.deploy-preview.environment]
  NODE_ENV = "staging"
```

---

## Secrets Management Best Practices

1. **Never commit secrets** to version control
2. **Use different secrets** for production vs staging
3. **Rotate secrets** periodically (at least annually)
4. **Use Railway/Netlify** variable UI for secrets (not config files)
5. **Audit access** to production secrets regularly

### Secret Generation Commands

```bash
# JWT secrets (64+ characters)
openssl rand -base64 64

# Webhook secrets
openssl rand -hex 32

# API keys (if self-generating)
openssl rand -base64 32 | tr -d '=/+'
```

---

## Validation

The API validates required environment variables at startup. If any are missing:

- **Development**: Warning logged, app continues
- **Production**: App exits with error

Check `packages/core/src/env.ts` for the validation schema.

---

## Troubleshooting

### "FATAL: [VARIABLE] is not set"
The startup script (`start.sh`) validates required variables. Add the missing variable to Railway.

### "Invalid database URL format"
Check that `DATABASE_URL` starts with `postgresql://` and includes all parts:
```
postgresql://user:password@host:port/database?sslmode=require
```

### "CORS error in browser"
Ensure `CORS_ORIGIN` includes the exact frontend URL (with protocol, no trailing slash).

### "OAuth callback failed"
1. Check `GITHUB_CALLBACK_URL` matches exactly in GitHub OAuth App settings
2. Ensure no trailing slash mismatch
3. Verify protocol (https in production)

---

## Version History

| Date | Changes |
|------|---------|
| 2026-01-01 | Initial env variable mapping |
