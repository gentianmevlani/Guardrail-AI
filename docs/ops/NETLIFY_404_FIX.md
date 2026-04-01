# 🔧 Fixing Netlify 404 Error

If you're getting a 404 on Netlify, follow these steps:

## Quick Fixes

### 1. Check Build Output

**In Netlify Dashboard:**
1. Go to **Deploys** tab
2. Click on your latest deployment
3. Check **Build log** for errors
4. Verify build completed successfully

**Look for:**
- ✅ "Build succeeded"
- ✅ "Next.js build output: apps/web-ui/.next"
- ❌ Any build errors

### 2. Verify Publish Directory

**In Netlify Dashboard:**
1. Go to **Site Settings** → **Build & deploy**
2. Check **Publish directory:** Should be `apps/web-ui/.next`
3. If wrong, update and redeploy

### 3. Check Environment Variables

**In Netlify Dashboard:**
1. Go to **Site Settings** → **Environment variables**
2. Verify these are set:
   - `NODE_ENV=production`
   - `API_URL` (can be placeholder until Railway is deployed)
   - `NEXT_PUBLIC_API_URL` (can be placeholder)

### 4. Verify _redirects File

The `apps/web-ui/public/_redirects` file should exist with:
```
/* /index.html 200
```

This ensures Next.js App Router routing works on Netlify.

### 5. Common Issues

**Issue: "Page not found" on all routes**
- **Fix:** Check `_redirects` file exists in `public/` folder
- **Fix:** Verify `publish` directory is `apps/web-ui/.next`

**Issue: Build fails**
- **Fix:** Check `pnpm-lock.yaml` is committed
- **Fix:** Check Node version matches (22.13.0)

**Issue: Root page shows 404**
- **Fix:** The root page redirects to `/dashboard/auth` - this is correct
- **Fix:** Try visiting `/dashboard/auth` directly

### 6. Test After Fixes

1. **Redeploy on Netlify:**
   - Go to **Deploys** → **Trigger deploy** → **Deploy site**

2. **Wait for build** (usually 3-5 minutes)

3. **Test these URLs:**
   - `https://your-site.netlify.app/` → Should redirect to `/dashboard/auth`
   - `https://your-site.netlify.app/dashboard/auth` → Should show login page
   - `https://your-site.netlify.app/dashboard` → Should show dashboard (after login)

---

## Still Getting 404?

1. **Check Netlify Functions:**
   - Next.js API routes need Netlify Functions
   - Check **Functions** tab in Netlify Dashboard
   - Should see functions for `/api/*` routes

2. **Check Build Logs:**
   - Look for "Generating static pages"
   - Look for "Build completed"

3. **Try Manual Deploy:**
   - Netlify Dashboard → **Deploys** → **Trigger deploy** → **Clear cache and deploy site**

---

## Next Steps

Once Netlify is working:
1. Deploy Railway (see `RAILWAY_DEPLOY_STEPS.md`)
2. Update Netlify `API_URL` with Railway URL
3. Test full integration
