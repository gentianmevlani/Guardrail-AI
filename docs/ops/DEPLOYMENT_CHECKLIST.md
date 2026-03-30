# ✅ Deployment Checklist

Use this checklist to ensure a successful deployment to Netlify and Railway.

## 🌐 Netlify (Frontend) Checklist

### Pre-Deployment
- [ ] Code is pushed to GitHub repository
- [ ] `netlify.toml` exists in root directory
- [ ] `pnpm-lock.yaml` is committed to repository
- [ ] All environment variables documented

### Netlify Setup
- [ ] Created Netlify account
- [ ] Connected GitHub repository to Netlify
- [ ] Verified build settings:
  - [ ] Base directory: (empty)
  - [ ] Build command: `pnpm run build:netlify`
  - [ ] Publish directory: `apps/web-ui/.next`
- [ ] Set environment variables:
  - [ ] `API_URL` (will update after Railway deployment)
  - [ ] `NEXT_PUBLIC_API_URL` (will update after Railway deployment)
  - [ ] `NEXT_PUBLIC_APP_URL`
  - [ ] `NODE_ENV=production`
  - [ ] Other required variables (OAuth, Stripe, etc.)

### Deployment
- [ ] Triggered initial deployment
- [ ] Build completed successfully
- [ ] Site is accessible at Netlify URL
- [ ] No build errors in logs

### Post-Deployment
- [ ] Updated `API_URL` with Railway URL
- [ ] Updated `NEXT_PUBLIC_API_URL` with Railway URL
- [ ] Triggered redeploy after updating API URL
- [ ] Tested frontend functionality
- [ ] Verified API calls work from frontend
- [ ] Set custom domain (if applicable)
- [ ] SSL certificate issued (automatic)

---

## 🚂 Railway (Backend) Checklist

### Pre-Deployment
- [ ] Code is pushed to GitHub repository
- [ ] `railway.toml` exists in root directory
- [ ] `apps/api/Dockerfile` exists and is correct
- [ ] `pnpm-lock.yaml` is committed
- [ ] Prisma schema is up to date

### Railway Setup
- [ ] Created Railway account
- [ ] Created new Railway project
- [ ] Connected GitHub repository
- [ ] Railway auto-detected service (or manually configured)
- [ ] Verified service settings:
  - [ ] Root directory: (empty)
  - [ ] Dockerfile path: `apps/api/Dockerfile`
  - [ ] Port: 3001

### Database Setup
- [ ] Added PostgreSQL database to Railway project
- [ ] Database provisioned successfully
- [ ] `DATABASE_URL` automatically set by Railway
- [ ] Verified database is accessible

### Environment Variables
- [ ] Set required authentication secrets:
  - [ ] `JWT_SECRET` (32+ characters)
  - [ ] `JWT_REFRESH_SECRET` (32+ characters)
  - [ ] `COOKIE_SECRET` (32+ characters)
  - [ ] `SESSION_SECRET` (32+ characters)
  - [ ] `CSRF_SECRET` (32+ characters)
- [ ] Set server configuration:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3001`
  - [ ] `HOST=0.0.0.0`
- [ ] Set CORS and URLs:
  - [ ] `CORS_ORIGIN` (Netlify URL)
  - [ ] `ALLOWED_ORIGINS` (Netlify URL)
  - [ ] `API_BASE_URL` (Railway URL - update after deployment)
  - [ ] `APP_BASE_URL` (Netlify URL)
- [ ] Set optional variables (if using):
  - [ ] OAuth credentials (Google, GitHub)
  - [ ] Stripe keys
  - [ ] Email/SMTP settings
  - [ ] AI API keys (OpenAI, Anthropic)
  - [ ] Redis URL (if using Redis)

### Deployment
- [ ] Triggered initial deployment
- [ ] Build completed successfully (check logs)
- [ ] Prisma migrations ran successfully
- [ ] Server started without errors
- [ ] Health check endpoint responds: `/health`
- [ ] API documentation accessible: `/docs`

### Post-Deployment
- [ ] Copied Railway URL
- [ ] Updated Netlify `API_URL` with Railway URL
- [ ] Updated Netlify `NEXT_PUBLIC_API_URL` with Railway URL
- [ ] Updated Railway `API_BASE_URL` with Railway URL
- [ ] Tested API endpoints:
  - [ ] `/health` - returns `{"status":"ok"}`
  - [ ] `/api/health` - returns health status
  - [ ] `/docs` - API documentation loads
- [ ] Tested integration:
  - [ ] Frontend can call backend API
  - [ ] No CORS errors
  - [ ] Authentication works (if configured)
- [ ] Set custom domain (if applicable)
- [ ] SSL certificate issued (automatic)

---

## 🔗 Integration Checklist

### Cross-Platform Configuration
- [ ] Netlify `API_URL` points to Railway URL
- [ ] Netlify `NEXT_PUBLIC_API_URL` points to Railway URL
- [ ] Railway `CORS_ORIGIN` includes Netlify URL
- [ ] Railway `ALLOWED_ORIGINS` includes Netlify URL
- [ ] Railway `APP_BASE_URL` points to Netlify URL

### Testing
- [ ] Frontend loads without errors
- [ ] API calls from frontend succeed
- [ ] No CORS errors in browser console
- [ ] Authentication flow works (if configured)
- [ ] Database operations work
- [ ] WebSocket connections work (if using)

### Monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor Railway logs for errors
- [ ] Monitor Netlify build logs
- [ ] Set up uptime monitoring
- [ ] Configure alerts for failures

---

## 🚨 Common Issues & Solutions

### Issue: Netlify build fails
- **Check:** `pnpm-lock.yaml` is committed
- **Check:** Build command is correct
- **Check:** Node version matches (22.13.0)

### Issue: Railway build fails
- **Check:** Dockerfile path is correct
- **Check:** All package.json files are present
- **Check:** Prisma schema path is correct

### Issue: Database connection fails
- **Check:** `DATABASE_URL` is set in Railway
- **Check:** Database is provisioned and running
- **Check:** Network access is allowed

### Issue: CORS errors
- **Check:** `CORS_ORIGIN` includes Netlify URL
- **Check:** `ALLOWED_ORIGINS` includes Netlify URL
- **Check:** Frontend uses correct API URL

### Issue: API not responding
- **Check:** Railway service is running
- **Check:** Port is correct (3001)
- **Check:** Health endpoint responds
- **Check:** Railway logs for errors

---

## 📋 Environment Variables Reference

### Netlify Required
```bash
API_URL=https://your-railway-app.up.railway.app
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-netlify-site.netlify.app
NODE_ENV=production
```

### Railway Required
```bash
DATABASE_URL=postgresql://... (auto-set)
JWT_SECRET=... (32+ chars)
JWT_REFRESH_SECRET=... (32+ chars)
COOKIE_SECRET=... (32+ chars)
SESSION_SECRET=... (32+ chars)
CSRF_SECRET=... (32+ chars)
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
CORS_ORIGIN=https://your-netlify-site.netlify.app
ALLOWED_ORIGINS=https://your-netlify-site.netlify.app
API_BASE_URL=https://your-railway-app.up.railway.app
APP_BASE_URL=https://your-netlify-site.netlify.app
```

---

## ✅ Final Verification

- [ ] Frontend is live and accessible
- [ ] Backend API is live and accessible
- [ ] Health checks pass
- [ ] Integration works end-to-end
- [ ] Custom domains configured (if applicable)
- [ ] SSL certificates active
- [ ] Monitoring set up
- [ ] Documentation updated with production URLs

**🎉 Deployment Complete!**
