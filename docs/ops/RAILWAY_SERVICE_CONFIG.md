# Railway Service Configuration

## ⚠️ Issue: Both API and Web-UI Deploying on Railway

Railway is currently deploying both services, but **web-ui should be on Netlify**, not Railway.

---

## ✅ Solution: Configure Railway to Deploy Only API

### Option 1: Delete Web-UI Service from Railway (Recommended)

1. Go to **Railway Dashboard**
2. Find the **`@guardrail/web-ui`** service
3. Click **Settings** → **Delete Service**
4. Confirm deletion

**Keep only:**
- ✅ `@guardrail/api` service
- ✅ PostgreSQL database
- ✅ Redis (if you added it)

---

### Option 2: Configure Service Settings

If you want to keep both but only deploy API:

**For API Service:**
- **Root Directory:** `apps/api`
- **Build Command:** (leave empty, uses Dockerfile)
- **Start Command:** `cd apps/api && npm start`

**For Web-UI Service:**
- **Settings** → **Pause Service** (or delete it)
- Deploy web-ui on Netlify instead

---

## 🌐 Netlify Setup for Web-UI

**Create new Netlify site:**
1. Netlify Dashboard → **"Add new site"** → **"Import from Git"**
2. Connect GitHub repository
3. **Build settings:**
   - **Base directory:** `apps/web-ui`
   - **Build command:** `npm install && npm run build`
   - **Publish directory:** `apps/web-ui/dist`
4. **Environment variables:** Copy from `NETLIFY_ENV_VARS_FINAL.txt`
5. **Custom domain:** `app.guardrail.network`

---

## 📋 Correct Deployment Setup

| Service | Platform | Domain | Status |
|---------|----------|--------|--------|
| **API** | Railway | `api.guardrail.network` | ✅ Keep |
| **Web-UI** | Netlify | `app.guardrail.network` | ⚠️ Move from Railway |
| **Database** | Railway PostgreSQL | - | ✅ Keep |
| **Redis** | Railway Redis (optional) | - | ✅ Optional |

---

## 🔧 Quick Fix

**In Railway Dashboard:**
1. Delete the `@guardrail/web-ui` service
2. Keep only `@guardrail/api` service
3. Set up web-ui on Netlify separately

This will fix the build failures and properly separate your services.
