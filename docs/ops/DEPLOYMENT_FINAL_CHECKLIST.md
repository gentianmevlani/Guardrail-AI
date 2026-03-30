# ✅ Final Deployment Checklist

## Configuration Review Complete

### Netlify Configuration (`netlify.toml`) ✅

- ✅ Build command: `pnpm run build:netlify`
- ✅ Publish directory: `apps/web-ui/.next`
- ✅ Next.js plugin: `@netlify/plugin-nextjs` configured
- ✅ Node version: 22.13.0
- ✅ pnpm version: 9.15.1
- ✅ API redirects to Railway: Configured for `api.guardrail.network`
- ✅ Security headers: Configured
- ✅ Context configurations: Production, deploy-preview, branch-deploy

### Root Page (`apps/web-ui/src/app/page.tsx`) ✅

- ✅ Server-side redirect to `/dashboard/auth`
- ✅ Using Next.js `redirect()` function

### Auth Page (`apps/web-ui/src/app/(dashboard)/auth/page.tsx`) ✅

- ✅ Login/Signup form exists
- ✅ OAuth buttons for GitHub and Google
- ✅ Proper routing to dashboard after login

### Next.js Config (`apps/web-ui/next.config.mjs`) ✅

- ✅ `trailingSlash` removed for Netlify compatibility
- ✅ API rewrites configured
- ✅ Image domains configured
- ✅ Security headers configured

### Redirects (`apps/web-ui/public/_redirects`) ✅

- ✅ Simplified - lets Next.js plugin handle routing
- ✅ No conflicting redirects

### Railway Configuration (`railway.toml`) ✅

- ✅ Dockerfile builder configured
- ✅ Prisma migrations on startup
- ✅ Port 3001
- ✅ Production environment

### API Dockerfile (`apps/api/Dockerfile`) ✅

- ✅ Node 20 LTS
- ✅ pnpm 9.15.1
- ✅ Prisma client generation
- ✅ Health check configured
- ✅ Port 3001 exposed

---

## Netlify Environment Variables

Set these in Netlify Dashboard → Site Settings → Environment Variables:

```bash
# Required
API_URL=https://api.guardrail.network
NEXT_PUBLIC_API_URL=https://api.guardrail.network
NEXT_PUBLIC_APP_URL=https://app.guardrail.network
NODE_ENV=production

# Optional (if using OAuth)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# Optional (if using Stripe)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
```

---

## Railway Environment Variables

Set these in Railway Dashboard → Service → Variables:

```bash
# Database (auto-set when you add PostgreSQL)
DATABASE_URL=postgresql://...

# Required Auth Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=<32+ char secret>
JWT_REFRESH_SECRET=<32+ char secret>
COOKIE_SECRET=<32+ char secret>
SESSION_SECRET=<32+ char secret>
CSRF_SECRET=<32+ char secret>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Server
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# CORS
CORS_ORIGIN=https://app.guardrail.network
ALLOWED_ORIGINS=https://app.guardrail.network,https://guardrail.network
API_BASE_URL=https://api.guardrail.network
APP_BASE_URL=https://app.guardrail.network

# OAuth (if using)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://api.guardrail.network/api/auth/github/callback

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://api.guardrail.network/api/auth/google/callback
```

---

## Deploy Steps

### 1. Commit and Push

```bash
git add .
git commit -m "Fix Netlify deployment - configure Next.js plugin properly"
git push origin main
```

### 2. Netlify

1. Go to Netlify Dashboard
2. Wait for auto-deploy (or trigger manually)
3. Check build logs for errors
4. Verify `@netlify/plugin-nextjs` is installed

### 3. Railway

1. Go to Railway Dashboard
2. Create project from GitHub
3. Add PostgreSQL database
4. Set environment variables
5. Deploy

### 4. Test

- Visit `https://app.guardrail.network`
- Should redirect to `/dashboard/auth`
- Login page should load
- No 404 errors

---

## 🚀 Ready to Deploy!

All configurations have been reviewed and are correct.

```bash
git add .
git commit -m "Fix Netlify deployment - configure Next.js plugin properly"
git push origin main
```
