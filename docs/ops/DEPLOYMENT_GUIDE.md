# 🚀 Deployment Guide: Netlify + Railway

This guide will help you deploy the guardrail application to production using:
- **Netlify** for the frontend (web-ui)
- **Railway** for the backend API

---

## 📋 Prerequisites

1. **GitHub Repository** - Your code should be in a GitHub repository
2. **Netlify Account** - Sign up at [netlify.com](https://netlify.com)
3. **Railway Account** - Sign up at [railway.app](https://railway.app)
4. **Domain Names** (optional but recommended):
   - `guardrailai.dev` (or your domain) for frontend
   - `api.guardrailai.dev` (or your domain) for backend

---

## 🌐 Part 1: Deploy Frontend to Netlify

### Step 1: Connect Repository to Netlify

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Connect your GitHub account and select your repository
4. Click **"Import"**

### Step 2: Configure Build Settings

Netlify should auto-detect Next.js, but verify these settings:

- **Base directory:** (leave empty - builds from root)
- **Build command:** `pnpm run build:netlify`
- **Publish directory:** `apps/web-ui/.next`

**Or manually set in Netlify Dashboard:**
- Site Settings → Build & deploy → Build settings
- Base directory: (empty)
- Build command: `pnpm run build:netlify`
- Publish directory: `apps/web-ui/.next`

**Note:** The root page (`/`) redirects to `/dashboard/auth` (login page). The landing page is excluded from deployment - only the dashboard and login modal are deployed.

### Step 3: Set Environment Variables

Go to **Site Settings → Environment variables** and add:

```bash
# API URL - Update this after Railway deployment
API_URL=https://your-railway-app.up.railway.app

# Next.js Public Variables
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-netlify-site.netlify.app

# OAuth (if using)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Stripe (if using billing)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key

# Build Settings
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
```

**⚠️ Important:** Update `API_URL` and `NEXT_PUBLIC_API_URL` after you deploy to Railway and get your Railway URL.

### Step 4: Deploy

1. Click **"Deploy site"** or push to your main branch
2. Wait for build to complete (usually 3-5 minutes)
3. Your site will be live at `https://your-site-name.netlify.app`

### Step 5: Set Custom Domain (Optional)

1. Go to **Domain settings** → **Add custom domain**
2. Enter your domain: `guardrailai.dev`
3. Follow DNS instructions to add CNAME record
4. Wait for SSL certificate (usually 1-2 minutes)

---

## 🚂 Part 2: Deploy Backend API to Railway

### Step 1: Install Railway CLI (Optional but Recommended)

```bash
npm install -g @railway/cli
```

### Step 2: Create Railway Project

**Option A: Using Railway Dashboard**
1. Go to [Railway Dashboard](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Connect your GitHub account and select your repository
5. Railway will auto-detect services

**Option B: Using Railway CLI**
```bash
railway login
railway init
railway link
```

### Step 3: Configure Railway Service

Railway should auto-detect the `railway.toml` file. Verify these settings:

**In Railway Dashboard → Your Service → Settings:**

- **Root Directory:** (leave empty - builds from root)
- **Dockerfile Path:** `apps/api/Dockerfile` (should auto-detect)
- **Start Command:** (leave empty - uses Dockerfile CMD, or Railway will use railway.toml startCommand)

The `railway.toml` file is already configured with:
- Dockerfile builder
- Prisma migrations on startup
- Port 3001
- Restart policy

### Step 4: Add PostgreSQL Database

1. In Railway Dashboard → Your Project
2. Click **"New"** → **"Database"** → **"Add PostgreSQL"**
3. Railway will automatically set `DATABASE_URL` environment variable
4. Wait for database to provision (usually 1-2 minutes)

### Step 5: Set Environment Variables

Go to **Railway Dashboard → Your Service → Variables** and add:

#### Required Variables

```bash
# Database (auto-set by Railway when you add PostgreSQL)
DATABASE_URL=postgresql://... (auto-set)

# Authentication Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your_32_char_secret_minimum
JWT_REFRESH_SECRET=your_32_char_secret_minimum
COOKIE_SECRET=your_32_char_secret_minimum
SESSION_SECRET=your_32_char_secret_minimum
CSRF_SECRET=your_32_char_secret_minimum
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# CORS & URLs (update with your Netlify URL)
CORS_ORIGIN=https://your-netlify-site.netlify.app
ALLOWED_ORIGINS=https://your-netlify-site.netlify.app,https://guardrailai.dev
API_BASE_URL=https://your-railway-app.up.railway.app
APP_BASE_URL=https://your-netlify-site.netlify.app
```

#### Optional Variables (Add if using these features)

```bash
# OAuth - Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-railway-app.up.railway.app/api/auth/google/callback

# OAuth - GitHub
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-railway-app.up.railway.app/api/auth/github/callback
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_APP_ID=your_app_id

# Stripe (Billing)
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_PRICE_ID_STARTER=price_xxx
STRIPE_PRICE_ID_PRO=price_xxx
STRIPE_PRICE_ID_ENTERPRISE=price_xxx

# Email (Resend)
RESEND_API_KEY=re_your_key
EMAIL_FROM=noreply@guardrailai.dev
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_your_key

# AI APIs
OPENAI_API_KEY=sk-your_key
ANTHROPIC_API_KEY=sk-ant-your_key

# Redis (if using Redis addon)
REDIS_URL=redis://... (auto-set if you add Redis)
```

### Step 6: Deploy

1. Railway will automatically deploy when you:
   - Push to your connected branch, OR
   - Click **"Deploy"** in Railway Dashboard
2. Wait for build to complete (usually 5-10 minutes for first build)
3. Check deployment logs for any errors

### Step 7: Get Railway URL

1. Go to **Railway Dashboard → Your Service → Settings → Networking**
2. Copy your Railway URL (e.g., `https://your-app.up.railway.app`)
3. **Update Netlify environment variables** with this URL:
   - `API_URL=https://your-app.up.railway.app`
   - `NEXT_PUBLIC_API_URL=https://your-app.up.railway.app`

### Step 8: Set Custom Domain (Optional)

1. Go to **Railway Dashboard → Your Service → Settings → Networking**
2. Click **"Custom Domain"**
3. Enter your domain: `api.guardrailai.dev`
4. Add the CNAME record shown to your DNS provider
5. Wait for SSL certificate (usually 1-2 minutes)

---

## ✅ Part 3: Verify Deployment

### Test Frontend (Netlify)

1. Visit your Netlify URL: `https://your-site.netlify.app`
2. Check browser console for errors
3. Try logging in (if auth is configured)
4. Verify API calls are working

### Test Backend (Railway)

1. Visit health endpoint: `https://your-railway-app.up.railway.app/health`
2. Should return: `{"status":"ok"}`
3. Visit API docs: `https://your-railway-app.up.railway.app/docs`

### Test Integration

1. Make sure Netlify `API_URL` points to Railway URL
2. Test API calls from frontend
3. Check CORS is working (no CORS errors in browser console)

---

## 🔧 Troubleshooting

### Netlify Build Fails

**Issue:** Build command fails
- **Fix:** Check `pnpm-lock.yaml` is committed. Netlify needs it for `--frozen-lockfile`

**Issue:** Missing dependencies
- **Fix:** Ensure `package.json` has all dependencies listed

**Issue:** Build timeout
- **Fix:** Netlify free tier has 15min limit. Consider upgrading or optimizing build

### Railway Build Fails

**Issue:** Docker build fails
- **Fix:** Check Dockerfile path is correct: `apps/api/Dockerfile`

**Issue:** Prisma generate fails
- **Fix:** Ensure `packages/database/prisma/schema.prisma` exists

**Issue:** Database connection fails
- **Fix:** Verify `DATABASE_URL` is set correctly in Railway variables

**Issue:** Port binding fails
- **Fix:** Ensure `PORT=3001` matches Railway's expected port

### API Not Responding

**Issue:** 502 Bad Gateway
- **Fix:** Check Railway logs for errors. Verify start command is correct.

**Issue:** CORS errors
- **Fix:** Update `CORS_ORIGIN` and `ALLOWED_ORIGINS` in Railway to match Netlify URL

**Issue:** Database migration fails
- **Fix:** Check Railway logs. Ensure `DATABASE_URL` is correct and database is accessible.

---

## 📝 Quick Reference

### Netlify URLs
- Dashboard: https://app.netlify.com
- Site Settings: Site → Settings → Build & deploy
- Environment Variables: Site → Settings → Environment variables
- Deploy Logs: Site → Deploys → [Latest deploy]

### Railway URLs
- Dashboard: https://railway.app
- Service Settings: Project → Service → Settings
- Environment Variables: Project → Service → Variables
- Deploy Logs: Project → Service → Deployments → [Latest]

### Important Files
- `netlify.toml` - Netlify configuration
- `railway.toml` - Railway configuration
- `apps/api/Dockerfile` - Railway Docker build
- `apps/web-ui/package.json` - Frontend build config

---

## 🎉 Next Steps

1. ✅ Set up monitoring (Sentry, etc.)
2. ✅ Configure backups for database
3. ✅ Set up CI/CD for automatic deployments
4. ✅ Add staging environment
5. ✅ Configure custom domains
6. ✅ Set up SSL certificates (auto-handled by both platforms)

---

## 📞 Support

- Netlify Docs: https://docs.netlify.com
- Railway Docs: https://docs.railway.app
- Project Issues: Check GitHub issues
