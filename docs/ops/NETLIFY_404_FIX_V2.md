# 🔧 Netlify 404 Fix - Complete Solution

## The Problem

Getting 404 errors on Netlify even though the build succeeds. This is a common issue with Next.js App Router on Netlify.

## Root Causes

1. **Publish Directory** - Must match where Next.js builds
2. **Next.js Plugin** - Needs to be installed and configured
3. **Routing** - Next.js App Router needs special handling on Netlify

## ✅ Complete Fix Applied

### 1. Updated `netlify.toml`

```toml
[build]
  base = ""
  command = "pnpm run build:netlify"
  publish = "apps/web-ui/.next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 2. Updated `apps/web-ui/public/_redirects`

```
# Redirect root to dashboard auth
/ /dashboard/auth 200

# Fallback for all routes - let Next.js handle them
/* /.netlify/functions/next 200
```

### 3. Root Page Uses Server-Side Redirect

```tsx
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/dashboard/auth");
}
```

## 🔍 Verify in Netlify Dashboard

### Check Build Settings

1. Go to **Site Settings** → **Build & deploy**
2. Verify:
   - **Base directory:** (empty)
   - **Build command:** `pnpm run build:netlify`
   - **Publish directory:** `apps/web-ui/.next`

### Check Plugins

1. Go to **Site Settings** → **Plugins**
2. Verify `@netlify/plugin-nextjs` is installed
3. If not, Netlify will install it automatically on next deploy

### Check Build Logs

1. Go to **Deploys** → **Latest deployment** → **Deploy log**
2. Look for:
   - ✅ "Installing @netlify/plugin-nextjs"
   - ✅ "Next.js build completed"
   - ✅ "Generating static pages"

## 🚀 Deploy Steps

1. **Commit changes:**
   ```bash
   git add netlify.toml apps/web-ui/public/_redirects apps/web-ui/src/app/page.tsx
   git commit -m "Fix Netlify 404 - configure Next.js plugin and routing"
   git push
   ```

2. **Netlify will auto-deploy**

3. **Wait for build** (5-10 minutes)

4. **Test:**
   - Visit `https://guardrailai.dev`
   - Should redirect to `/dashboard/auth`
   - Should NOT show 404

## 🆘 If Still Getting 404

### Option 1: Manual Plugin Installation

1. Go to **Netlify Dashboard** → **Site Settings** → **Plugins**
2. Click **"Add plugin"**
3. Search for `@netlify/plugin-nextjs`
4. Click **"Install"**

### Option 2: Check Build Output

1. Check build logs for errors
2. Verify `.next` folder is created
3. Check publish directory matches build output

### Option 3: Clear Cache and Redeploy

1. **Netlify Dashboard** → **Deploys**
2. Click **"Trigger deploy"** → **"Clear cache and deploy site"**

## 📋 Checklist

- [ ] `netlify.toml` has correct publish directory
- [ ] `netlify.toml` includes Next.js plugin
- [ ] `_redirects` file exists in `apps/web-ui/public/`
- [ ] Root page uses server-side redirect
- [ ] Build succeeds in Netlify
- [ ] Plugin is installed
- [ ] Tested on production URL

## ✅ Expected Result

After deploying:
- ✅ Root URL redirects to `/dashboard/auth`
- ✅ Login page loads correctly
- ✅ No 404 errors
- ✅ All routes work
