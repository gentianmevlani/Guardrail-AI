# Production Deployment Checklist

## 🔄 URL Updates Required

### GitHub OAuth App Settings

1. Go to GitHub → Settings → Developer settings → OAuth Apps → Your App
2. Update **Authorization callback URL**:
   - From: `http://localhost:3000/api/auth/github/callback`
   - To: `https://your-backend-url.railway.app/api/auth/github/callback`
3. Update **Homepage URL**:
   - From: `http://localhost:3000`
   - To: `https://myGuardrail.com`

### Stripe Webhook Settings

1. Go to Stripe Dashboard → Developers → Webhooks
2. Update endpoint URL:
   - From: `http://localhost:3000/api/stripe/webhook`
   - To: `https://your-backend-url.railway.app/api/stripe/webhook`
3. Retest webhook endpoints after update

### Environment Variables

After deployment, update these with actual URLs:

#### Railway (Backend)

```bash
# Update with your actual Railway URL
API_URL=https://your-backend-url.railway.app/api
CORS_ORIGIN=https://myGuardrail.netlify.app,https://myGuardrail.com
GITHUB_REDIRECT_URI=https://myGuardrail.com/api/auth/github/callback
FRONTEND_URL=https://myGuardrail.com
```

#### Netlify (Frontend)

```bash
# Update with your actual Railway URL
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
NEXT_PUBLIC_APP_URL=https://myGuardrail.netlify.app
```

## 📋 Pre-Deployment Steps

1. [ ] Backup current database
2. [ ] Run `npm run db:migrate:prod` on production database
3. [ ] Update GitHub OAuth callback URL
4. [ ] Update Stripe webhook endpoint
5. [ ] Set all environment variables in Railway
6. [ ] Set all environment variables in Netlify
7. [ ] Test health endpoint: `https://your-backend-url.railway.app/api/health`

## 🚀 Deployment Steps

### Backend (Railway)

1. Connect GitHub repo to Railway
2. Configure build settings (use `railway.json`)
3. Set environment variables from `.env.railway`
4. Deploy!
5. Run migrations if needed

### Frontend (Netlify)

1. Connect GitHub repo to Netlify
2. Configure build settings (use `netlify.toml`)
3. Set environment variables from `.env.netlify`
4. Deploy!

## ✅ Post-Deployment Tests

1. [ ] Health check: `/api/health`
2. [ ] GitHub OAuth flow
3. [ ] Stripe checkout flow
4. [ ] API calls from frontend
5. [ ] CORS is working
6. [ ] Sessions/cookies work across domains

## 🔧 Troubleshooting

### CORS Errors

- Check `CORS_ORIGIN` includes your Netlify domain
- Ensure credentials are enabled in CORS config

### OAuth Errors

- Verify callback URL matches exactly
- Check state parameter is being handled

### Webhook Issues

- Verify webhook endpoint is accessible
- Check webhook secret matches

### Session Issues

- Ensure `COOKIE_SECRET` is set
- Check secure cookie settings for HTTPS
