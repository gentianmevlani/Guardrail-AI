# 🌐 Netlify Environment Variables - Complete Setup

## Your Domains
- **Main Site:** `guardrail.network`
- **API:** `api.guardrail.network`
- **App (Frontend):** `app.guardrail.network` (or `guardrail.network`)

---

## 📋 Complete Environment Variables for Netlify

Go to **Netlify Dashboard → Site Settings → Environment Variables** and add these:

### 🔗 Core URLs (Required)

```bash
# API URL - Points to Railway API
API_URL=https://api.guardrail.network

# Public API URL (used in frontend code)
NEXT_PUBLIC_API_URL=https://api.guardrail.network

# App URL (your Netlify site)
NEXT_PUBLIC_APP_URL=https://app.guardrail.network

# Base URL for the app
APP_BASE_URL=https://app.guardrail.network
```

### ⚙️ Build Configuration

```bash
# Node environment
NODE_ENV=production

# Disable Next.js telemetry
NEXT_TELEMETRY_DISABLED=1

# Mock Google Fonts responses (faster builds)
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=1
```

### 🔐 OAuth Configuration (If Using)

```bash
# GitHub OAuth (if using GitHub login)
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id_here
# Note: GITHUB_CLIENT_SECRET goes in Railway, not Netlify

# Google OAuth (if using Google login)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id_here
# Note: GOOGLE_CLIENT_SECRET goes in Railway, not Netlify
```

### 💳 Stripe Configuration (If Using Billing)

```bash
# Stripe Publishable Key (public key - safe in frontend)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key

# Note: STRIPE_SECRET_KEY goes in Railway, not Netlify
```

### 🌐 WebSocket URL (If Using Real-time Features)

```bash
# WebSocket URL for real-time updates
NEXT_PUBLIC_WS_URL=wss://api.guardrail.network/ws
```

### 🔒 Security Headers (Optional)

```bash
# Allowed origin for CORS (set in Railway too)
ALLOWED_ORIGIN=https://app.guardrail.network
```

---

## 📝 Step-by-Step Setup

### 1. Set Core URLs First

**Minimum required variables:**

```bash
API_URL=https://api.guardrail.network
NEXT_PUBLIC_API_URL=https://api.guardrail.network
NEXT_PUBLIC_APP_URL=https://app.guardrail.network
NODE_ENV=production
```

### 2. Add OAuth (If Using)

If you have GitHub/Google OAuth set up:

```bash
NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
```

**Important:** Make sure your OAuth app callback URLs are set to:
- GitHub: `https://app.guardrail.network/api/auth/github/callback`
- Google: `https://app.guardrail.network/api/auth/google/callback`

### 3. Add Stripe (If Using Billing)

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_your_key
```

---

## 🔄 Context-Specific Variables

Netlify supports different variables for different contexts. You can set:

### Production Context
- **Trigger:** Deploys from `main` branch
- **Variables:** Use production values

### Deploy Preview Context
- **Trigger:** Pull requests
- **Variables:** Can use staging API URL if needed

### Branch Deploy Context
- **Trigger:** Other branches
- **Variables:** Can use development values

**For now, set all variables in the main "Environment Variables" section.**

---

## ✅ Verification Checklist

After setting variables:

- [ ] `API_URL` = `https://api.guardrail.network`
- [ ] `NEXT_PUBLIC_API_URL` = `https://api.guardrail.network`
- [ ] `NEXT_PUBLIC_APP_URL` = `https://app.guardrail.network`
- [ ] `NODE_ENV` = `production`
- [ ] OAuth IDs set (if using OAuth)
- [ ] Stripe key set (if using billing)

---

## 🚀 After Setting Variables

1. **Trigger Redeploy:**
   - Netlify Dashboard → **Deploys** → **Trigger deploy** → **Deploy site**

2. **Wait for Build** (3-5 minutes)

3. **Test:**
   - Visit `https://app.guardrail.network`
   - Should redirect to `/dashboard/auth`
   - Check browser console for errors
   - Verify API calls work

---

## 🔗 Related Railway Variables

Make sure Railway has matching variables:

```bash
# In Railway → Variables
CORS_ORIGIN=https://app.guardrail.network
ALLOWED_ORIGINS=https://app.guardrail.network,https://guardrail.network
API_BASE_URL=https://api.guardrail.network
APP_BASE_URL=https://app.guardrail.network
```

---

## 🆘 Troubleshooting

**Issue: API calls fail**
- Check `API_URL` matches Railway domain
- Check `NEXT_PUBLIC_API_URL` matches Railway domain
- Verify Railway CORS allows `app.guardrail.network`

**Issue: OAuth redirects fail**
- Check callback URLs match your OAuth app settings
- Verify `NEXT_PUBLIC_APP_URL` is correct

**Issue: Build fails**
- Check all required variables are set
- Check variable names are correct (case-sensitive)

---

## 📋 Quick Copy-Paste Template

```bash
API_URL=https://api.guardrail.network
NEXT_PUBLIC_API_URL=https://api.guardrail.network
NEXT_PUBLIC_APP_URL=https://app.guardrail.network
APP_BASE_URL=https://app.guardrail.network
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1
NEXT_FONT_GOOGLE_MOCKED_RESPONSES=1
```

Copy this and paste into Netlify Environment Variables, then add your OAuth/Stripe keys if needed.
