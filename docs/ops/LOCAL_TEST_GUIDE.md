# 🧪 Local Testing Guide

## Start Development Server

```bash
# From project root
pnpm run dev

# Or from web-ui directory
cd apps/web-ui
npm run dev
```

The dev server will start on `http://localhost:5000` (or port shown in terminal)

## Test Routes

1. **Root URL:** `http://localhost:5000/`
   - Should redirect to `/dashboard/auth`

2. **Login Page:** `http://localhost:5000/dashboard/auth`
   - Should show login form

3. **Dashboard:** `http://localhost:5000/dashboard`
   - Should show dashboard (after login)

## Check for Errors

1. Open browser console (F12)
2. Check for:
   - ✅ No 404 errors
   - ✅ No routing errors
   - ✅ Components load correctly

## Fixes Applied

1. ✅ Changed root page to use server-side redirect (`redirect()`)
2. ✅ Updated `_redirects` file for Netlify
3. ✅ Added Next.js plugin to `netlify.toml`

## Next Steps

After testing locally:
1. Commit changes
2. Push to GitHub
3. Netlify will auto-deploy
4. Test on `https://app.guardrail.network`
