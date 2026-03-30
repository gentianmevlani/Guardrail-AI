# Railway Deployment Guide for guardrail

Complete guide for deploying guardrail API to Railway with database migrations.

## Overview

This guide covers deploying the guardrail API to Railway with:
- **API Domain**: `api.guardrail.network`
- **App Domain**: `app.guardrail.network` (deployed separately)
- **Landing**: `guardrail.network` (already deployed)

## Prerequisites

1. Railway account: https://railway.app
2. PostgreSQL database (Railway provides this)
3. Environment variables configured (see below)

## Step 1: Set Up Railway Project

1. Go to https://railway.app and create a new project
2. Click "New" → "GitHub Repo" and connect your repository
3. Railway will auto-detect the `railway.toml` configuration

## Step 2: Add PostgreSQL Database

1. In your Railway project, click "New" → "Database" → "PostgreSQL"
2. Railway will automatically create a `DATABASE_URL` environment variable
3. The database will be provisioned automatically

## Step 3: Configure Environment Variables

In Railway project settings → Variables, add the following environment variables:

### Required Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=3000  # Railway will set this automatically, but include as fallback
HOST=0.0.0.0

# Database (Auto-set by Railway PostgreSQL service)
DATABASE_URL=<auto-set-by-railway>

# Authentication Secrets (Pre-generated - use the values from env.example)
JWT_SECRET=mHk6m9eW5GP9dJpOh8Qt35xfh/9Qa3h15i307k+Q77o=
JWT_REFRESH_SECRET=3RV0DlIZ+1fa4dw/Gyx3c5HPQ6LMRSkGcmfeEaF2pbU=
COOKIE_SECRET=qU339XPJ0O535L5APh4JDe1++iHHjb9zEBV4yfoXV9o=
SESSION_SECRET=gCJ+WRmBq/fbKnXA762UA+kxLR57SvkDhqaFYG0AYrU=
CSRF_SECRET=XYNzfonMqIwwbEqg7oU+1FkxwHL9Mz7mdO7Q1d9nqSo=
MFA_ENCRYPTION_KEY=1a68a13c61b7a5bf524eceec91b08a5d13ea0c8d56f855341b0b3c6da50a8a48

# URLs
NEXT_PUBLIC_API_URL=https://api.guardrail.network
API_BASE_URL=https://api.guardrail.network
NEXT_PUBLIC_APP_URL=https://app.guardrail.network
APP_BASE_URL=https://app.guardrail.network
NEXT_PUBLIC_WS_URL=wss://api.guardrail.network/ws

# CORS
CORS_ORIGIN=https://guardrail.network,https://app.guardrail.network,https://api.guardrail.network
ALLOWED_ORIGIN=https://app.guardrail.network
```

### Optional Variables (Add API Keys)

```bash
# GitHub OAuth (Get from https://github.com/settings/developers)
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
GITHUB_CALLBACK_URL=https://app.guardrail.network/api/auth/github/callback

# Google OAuth (Get from https://console.cloud.google.com/apis/credentials)
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_CALLBACK_URL=https://app.guardrail.network/api/auth/google/callback

# Stripe (Get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=<your-stripe-secret-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_WEBHOOK_SECRET=<your-stripe-webhook-secret>

# OpenAI (Optional - Get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=<your-openai-key>

# Anthropic (Optional - Get from https://console.anthropic.com/settings/keys)
ANTHROPIC_API_KEY=<your-anthropic-key>

# SendGrid (Optional - Get from https://app.sendgrid.com/settings/api_keys)
SENDGRID_API_KEY=<your-sendgrid-key>
SENDGRID_FROM_EMAIL=noreply@guardrail.network
```

## Step 4: Configure GitHub OAuth App

1. Go to https://github.com/settings/developers
2. Click "New OAuth App"
3. Fill in:
   - **Application name**: guardrail
   - **Homepage URL**: `https://app.guardrail.network`
   - **Authorization callback URL**: `https://app.guardrail.network/api/auth/github/callback`
4. Copy the Client ID and Client Secret to Railway environment variables

## Step 5: Configure Google OAuth

1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized origins:
   - `https://app.guardrail.network`
4. Add authorized redirect URIs:
   - `https://app.guardrail.network/api/auth/google/callback`
5. Copy the Client ID and Client Secret to Railway environment variables

## Step 6: Configure Custom Domain

1. In Railway project → Settings → Networking
2. Click "Generate Domain" to get a Railway domain (e.g., `xxx.up.railway.app`)
3. Click "Custom Domain" and add: `api.guardrail.network`
4. Railway will provide DNS records to add to your domain registrar
5. Add the CNAME record in your DNS provider pointing to the Railway domain

## Step 7: Deploy

1. Railway will automatically deploy when you push to your main branch
2. Or manually trigger deployment from Railway dashboard
3. Watch the deployment logs to ensure migrations run successfully

## Database Migrations

**Migrations run automatically on deployment!**

The deployment process:
1. Dockerfile builds the application
2. `scripts/start-api.sh` runs on container start
3. Script runs `npx prisma migrate deploy` before starting the server
4. All database tables are created automatically

**Migration logs will show:**
```
📦 Running database migrations...
✅ Migrations applied successfully
🚀 Starting API server...
```

## Step 8: Verify Deployment

1. Check Railway deployment logs for success
2. Visit `https://api.guardrail.network/health` - should return `{"status":"ok"}`
3. Check Railway metrics for CPU, memory, and request logs

## Troubleshooting

### Migration Errors

If migrations fail:
1. Check Railway logs for error messages
2. Verify `DATABASE_URL` is set correctly
3. Ensure database service is running
4. Check that migrations exist in `packages/database/prisma/migrations/`

### Port Issues

- Railway automatically sets `PORT` environment variable
- The app listens on `0.0.0.0:$PORT`
- If issues, check Railway logs for port binding errors

### Connection Errors

- Verify `DATABASE_URL` includes correct credentials
- Check database service is running in Railway
- Ensure network connectivity between services

### Environment Variables

- All required variables must be set before deployment
- Missing variables will cause the app to fail on startup
- Check Railway logs for validation errors

## Production Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Database migrations run successfully
- [ ] Custom domain configured (`api.guardrail.network`)
- [ ] SSL certificate active (automatic with Railway)
- [ ] GitHub OAuth app configured
- [ ] Google OAuth app configured
- [ ] Stripe keys configured (if using billing)
- [ ] Health endpoint responding
- [ ] CORS configured correctly
- [ ] WebSocket URL configured (`wss://api.guardrail.network/ws`)

## Monitoring

1. **Railway Dashboard**: View logs, metrics, and deployment status
2. **Health Endpoint**: `https://api.guardrail.network/health`
3. **Database**: Railway provides database connection monitoring

## Next Steps

1. Configure `app.guardrail.network` to point to your frontend (Netlify/Vercel)
2. Update frontend environment variables to use `https://api.guardrail.network`
3. Test OAuth flows end-to-end
4. Set up monitoring and alerting

## Support

For issues:
- Check Railway deployment logs
- Review application logs in Railway dashboard
- Verify environment variables are set correctly
- Ensure database is accessible
