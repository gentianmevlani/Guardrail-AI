# ✅ Netlify Setup Testing Checklist

Use this checklist to verify your Netlify deployment is working correctly.

---

## 🔍 Pre-Test: Verify Configuration

### 1. Check Environment Variables

**In Netlify Dashboard:**
1. Go to **Site Settings** → **Environment Variables**
2. Verify these are set:

```bash
✅ API_URL=https://api.guardrailai.dev
✅ NEXT_PUBLIC_API_URL=https://api.guardrailai.dev
✅ NEXT_PUBLIC_APP_URL=https://guardrailai.dev
✅ APP_BASE_URL=https://guardrailai.dev
✅ NODE_ENV=production
```

### 2. Check Build Status

**In Netlify Dashboard:**
1. Go to **Deploys** tab
2. Check latest deployment:
   - ✅ Status: **Published** (green)
   - ✅ Build log shows: "Build succeeded"
   - ✅ No build errors

### 3. Check Domain Configuration

**In Netlify Dashboard:**
1. Go to **Domain Settings**
2. Verify custom domain:
   - ✅ `guardrailai.dev` is configured
   - ✅ SSL certificate is active (green lock icon)
   - ✅ DNS records are correct

---

## 🧪 Test 1: Root URL Redirect

**Test:** Visit `https://guardrailai.dev`

**Expected Result:**
- ✅ Page loads (not 404)
- ✅ Automatically redirects to `/dashboard/auth`
- ✅ Shows "Redirecting to login..." message briefly
- ✅ Login page appears

**If it fails:**
- Check `apps/web-ui/public/_redirects` file exists
- Check `apps/web-ui/src/app/page.tsx` has redirect code
- Check Netlify build logs for errors

---

## 🧪 Test 2: Login Page

**Test:** Visit `https://guardrailai.dev/dashboard/auth`

**Expected Result:**
- ✅ Login page loads
- ✅ Shows "Sign In" form
- ✅ Has email and password fields
- ✅ Has "Sign up" toggle
- ✅ Has GitHub/Google OAuth buttons (if configured)
- ✅ No console errors

**Check Browser Console (F12):**
- ✅ No 404 errors
- ✅ No CORS errors
- ✅ No API connection errors (if Railway not deployed yet, this is OK)

---

## 🧪 Test 3: Static Assets

**Test:** Check if images/assets load

**Expected Result:**
- ✅ Logo loads: `https://guardrailai.dev/logo.png`
- ✅ Favicon loads
- ✅ No broken images

**If images don't load:**
- Check `apps/web-ui/public/` folder has files
- Check build output includes public assets

---

## 🧪 Test 4: API Routes (If Railway is Deployed)

**Test:** Check API connectivity

**In Browser Console (F12 → Network tab):**
1. Try to login (or trigger any API call)
2. Check network requests

**Expected Result:**
- ✅ API calls go to `https://api.guardrailai.dev`
- ✅ No CORS errors
- ✅ Responses received (or proper error messages)

**If Railway not deployed yet:**
- ✅ API calls should fail gracefully
- ✅ Should show error message, not crash

---

## 🧪 Test 5: Next.js Routing

**Test:** Navigate to different routes

**Test these URLs:**
- `https://guardrailai.dev/` → Should redirect to `/dashboard/auth`
- `https://guardrailai.dev/dashboard/auth` → Login page
- `https://guardrailai.dev/dashboard` → Dashboard (after login)

**Expected Result:**
- ✅ All routes load (not 404)
- ✅ Client-side navigation works
- ✅ No page reloads on navigation

---

## 🧪 Test 6: Build Output Verification

**In Netlify Dashboard:**
1. Go to **Deploys** → **Latest deployment** → **Deploy log**
2. Scroll through the build log

**Look for:**
- ✅ `pnpm install` completed successfully
- ✅ `pnpm run build:netlify` completed
- ✅ `Generating static pages...`
- ✅ `Build completed`
- ✅ No TypeScript errors
- ✅ No build warnings

---

## 🧪 Test 7: Environment Variables Check

**Test:** Verify env vars are accessible

**In Browser Console (F12):**
```javascript
// Check if API URL is set (this won't work for server-side vars)
console.log('API URL:', process.env.NEXT_PUBLIC_API_URL);
```

**Or check Network tab:**
- Look at API requests
- Verify they're going to correct URL

**Expected Result:**
- ✅ API calls use `https://api.guardrailai.dev`
- ✅ No localhost URLs in production

---

## 🧪 Test 8: Performance Check

**Test:** Page load speed

**Using Browser DevTools:**
1. Open DevTools (F12)
2. Go to **Network** tab
3. Reload page
4. Check load time

**Expected Result:**
- ✅ First Contentful Paint < 2s
- ✅ Page fully loaded < 5s
- ✅ No slow requests (> 3s)

---

## 🧪 Test 9: Mobile Responsiveness

**Test:** Check mobile view

**Using Browser DevTools:**
1. Open DevTools (F12)
2. Click device toggle (or Ctrl+Shift+M)
3. Select mobile device
4. Reload page

**Expected Result:**
- ✅ Login page is responsive
- ✅ Forms are usable on mobile
- ✅ No horizontal scrolling
- ✅ Text is readable

---

## 🧪 Test 10: SSL/HTTPS Check

**Test:** Verify SSL certificate

**Visit:** `https://guardrailai.dev`

**Expected Result:**
- ✅ Green lock icon in browser
- ✅ "Secure" badge in address bar
- ✅ No SSL warnings
- ✅ Certificate is valid

**If SSL issues:**
- Check Netlify Domain Settings
- Wait for certificate provisioning (can take 24 hours)
- Check DNS records are correct

---

## 🆘 Common Issues & Fixes

### Issue: 404 on All Routes

**Symptoms:**
- Every route shows 404
- Root page doesn't load

**Fix:**
1. Check `apps/web-ui/public/_redirects` exists
2. Verify publish directory: `apps/web-ui/.next`
3. Check build succeeded
4. Clear Netlify cache and redeploy

### Issue: API Calls Fail

**Symptoms:**
- Login doesn't work
- API errors in console

**Fix:**
1. Check `API_URL` env var is set
2. Check `NEXT_PUBLIC_API_URL` env var is set
3. Verify Railway is deployed (if not, deploy Railway first)
4. Check CORS settings in Railway

### Issue: Images Don't Load

**Symptoms:**
- Broken image icons
- 404 for image files

**Fix:**
1. Check `apps/web-ui/public/` folder has files
2. Verify build includes public folder
3. Check image paths are correct

### Issue: Redirect Loop

**Symptoms:**
- Page keeps redirecting
- Can't access login page

**Fix:**
1. Check `apps/web-ui/src/app/page.tsx` redirect logic
2. Check `_redirects` file doesn't conflict
3. Clear browser cache
4. Try incognito mode

---

## ✅ Success Criteria

Your Netlify setup is working if:

- ✅ Root URL redirects to login
- ✅ Login page loads correctly
- ✅ No console errors
- ✅ Build succeeded
- ✅ SSL certificate active
- ✅ Environment variables set
- ✅ Static assets load

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

✅ Root URL Redirect: [ ] Pass [ ] Fail
✅ Login Page: [ ] Pass [ ] Fail
✅ Static Assets: [ ] Pass [ ] Fail
✅ API Routes: [ ] Pass [ ] Fail (Railway not deployed)
✅ Next.js Routing: [ ] Pass [ ] Fail
✅ Build Output: [ ] Pass [ ] Fail
✅ Environment Variables: [ ] Pass [ ] Fail
✅ Performance: [ ] Pass [ ] Fail
✅ Mobile Responsive: [ ] Pass [ ] Fail
✅ SSL/HTTPS: [ ] Pass [ ] Fail

Issues Found:
_______________________________________
_______________________________________
_______________________________________

Next Steps:
_______________________________________
_______________________________________
```

---

## 🚀 After Testing

Once all tests pass:

1. **Deploy Railway** (if not done yet)
2. **Update Netlify `API_URL`** with Railway URL
3. **Test full integration**
4. **Set up monitoring**

---

**Ready to test?** Start with Test 1 and work through the checklist!
