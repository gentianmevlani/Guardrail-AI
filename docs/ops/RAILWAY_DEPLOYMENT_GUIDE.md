# Railway Deployment Guide

## ✅ Current Status
- ✅ Project linked: `accurate-love`
- ✅ Service linked: `@guardrail/api`
- ✅ Railway is indexing and deploying

## 🔧 Required Environment Variables

Make sure these are set in Railway Dashboard → Your Service → Variables:

### Database
- `DATABASE_URL` - Railway will auto-set this when you add PostgreSQL

### Authentication Secrets
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `COOKIE_SECRET`
- `SESSION_SECRET`
- `CSRF_SECRET`
- `JWT_EXPIRES_IN=15m`
- `JWT_REFRESH_EXPIRES_IN=7d`

### CORS & URLs
- `CORS_ORIGIN=https://app.guardrail.network`
- `ALLOWED_ORIGINS=https://app.guardrail.network,https://www.guardrail.network,https://guardrail.network`
- `API_BASE_URL=https://api.guardrail.network`
- `APP_BASE_URL=https://app.guardrail.network`

### OAuth (Google)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL=https://api.guardrail.network/api/auth/google/callback`

### OAuth (GitHub)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL=https://api.guardrail.network/api/auth/github/callback`
- `GITHUB_WEBHOOK_SECRET`
- `GITHUB_APP_ID`

### Stripe
- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_STARTER`
- `STRIPE_PRICE_ID_STARTER_MONTHLY`
- `STRIPE_PRICE_ID_STARTER_ANNUAL`
- `STRIPE_PRICE_ID_PRO`
- `STRIPE_PRICE_ID_PRO_MONTHLY`
- `STRIPE_PRICE_ID_PRO_ANNUAL`
- `STRIPE_PRICE_ID_COMPLIANCE_MONTHLY`
- `STRIPE_PRICE_ID_COMPLIANCE_ANNUAL`
- `STRIPE_PRICE_ID_ENTERPRISE`
- `STRIPE_PRICE_ID_ENTERPRISE_MONTHLY`
- `STRIPE_PRICE_ID_ENTERPRISE_ANNUAL`

### Email (Resend)
- `RESEND_API_KEY`
- `EMAIL_FROM=noreply@guardrail.network`
- `SMTP_HOST=smtp.resend.com`
- `SMTP_PORT=587`
- `SMTP_USER=resend`
- `SMTP_PASS` (same as RESEND_API_KEY)

### AI APIs
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

### Optional
- `REDIS_URL` - If using Redis (Railway Redis addon)
- `NODE_ENV=production`
- `PORT=3001`
- `HOST=0.0.0.0`

## 📋 Next Steps

1. **Add PostgreSQL Database**
   - Railway Dashboard → Your Project → New → Database → Add PostgreSQL
   - Railway will auto-set `DATABASE_URL`

2. **Set Environment Variables**
   - Railway Dashboard → Your Service → Variables tab
   - Add all variables from the list above

3. **Check Deployment**
   - Railway Dashboard → Your Service → Deployments
   - Wait for build to complete
   - Check logs for any errors

4. **Set Custom Domain**
   - Railway Dashboard → Your Service → Settings → Networking
   - Add custom domain: `api.guardrail.network`
   - Update DNS records as shown

## 🚀 Deploy Commands

```bash
# Link project (already done)
railway link -p fae1657d-0db2-4ce2-ac67-df02bb60d287

# Link service (already done)
railway service @guardrail/api

# Deploy
railway up --detach

# View logs
railway logs

# Check status
railway status
```

## 🔍 Troubleshooting

- **Build fails**: Check Railway logs for errors
- **Database connection fails**: Verify `DATABASE_URL` is set
- **Port issues**: Ensure `PORT=3001` matches Railway's expected port
- **Environment variables**: Double-check all required vars are set
