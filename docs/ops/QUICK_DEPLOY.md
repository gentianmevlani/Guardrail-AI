# ⚡ Quick Deploy Guide

**TL;DR:** Deploy frontend to Netlify, backend to Railway, connect them together.

---

## 🚀 5-Minute Deploy

### 1. Deploy to Railway (Backend) - 3 minutes

```bash
# Option A: Using Railway Dashboard (Easiest)
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects and deploys API
5. Add PostgreSQL database: "New" → "Database" → "PostgreSQL"
6. Go to Variables tab, add required env vars (see DEPLOYMENT_GUIDE.md)
7. Copy Railway URL (e.g., https://your-app.up.railway.app)

# Option B: Using Railway CLI
railway login
railway init
railway link
railway up
```

**Required Environment Variables (minimum):**
```bash
JWT_SECRET=<generate with: openssl rand -base64 32>
JWT_REFRESH_SECRET=<generate>
COOKIE_SECRET=<generate>
SESSION_SECRET=<generate>
CSRF_SECRET=<generate>
CORS_ORIGIN=https://your-netlify-site.netlify.app
ALLOWED_ORIGINS=https://your-netlify-site.netlify.app
```

### 2. Deploy to Netlify (Frontend) - 2 minutes

```bash
# Using Netlify Dashboard
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import from Git"
3. Connect GitHub and select repository
4. Build settings (auto-detected):
   - Build command: pnpm run build:netlify
   - Publish directory: apps/web-ui/.next
5. Add environment variables:
   - API_URL=<your-railway-url>
   - NEXT_PUBLIC_API_URL=<your-railway-url>
   - NEXT_PUBLIC_APP_URL=<your-netlify-url>
6. Deploy!
```

### 3. Connect Them Together

1. **Update Netlify** with Railway URL:
   - Netlify Dashboard → Site Settings → Environment Variables
   - Set `API_URL` = your Railway URL
   - Set `NEXT_PUBLIC_API_URL` = your Railway URL
   - Redeploy

2. **Update Railway** with Netlify URL:
   - Railway Dashboard → Service → Variables
   - Set `CORS_ORIGIN` = your Netlify URL
   - Set `ALLOWED_ORIGINS` = your Netlify URL
   - Set `APP_BASE_URL` = your Netlify URL
   - Redeploy

---

## ✅ Verify Deployment

```bash
# Test Railway API
curl https://your-railway-app.up.railway.app/health
# Should return: {"status":"ok"}

# Test Netlify Frontend
# Visit: https://your-site.netlify.app
# Check browser console for errors
```

---

## 📚 Full Documentation

- **Detailed Guide:** See `DEPLOYMENT_GUIDE.md`
- **Checklist:** See `DEPLOYMENT_CHECKLIST.md`
- **Troubleshooting:** See `DEPLOYMENT_GUIDE.md` → Troubleshooting section

---

## 🔑 Generate Secrets

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## 🆘 Quick Troubleshooting

**Railway build fails?**
- Check `apps/api/Dockerfile` exists
- Check Railway logs for specific error

**Netlify build fails?**
- Check `pnpm-lock.yaml` is committed
- Check build command: `pnpm run build:netlify`

**CORS errors?**
- Update Railway `CORS_ORIGIN` with Netlify URL
- Update Railway `ALLOWED_ORIGINS` with Netlify URL

**API not responding?**
- Check Railway service is running
- Check `/health` endpoint
- Check Railway logs

---

**Need help?** Check `DEPLOYMENT_GUIDE.md` for detailed instructions.
