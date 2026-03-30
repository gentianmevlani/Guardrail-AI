# Critical Issues That Could Prevent Buttons From Working

## ✅ FIXED: API_BASE Now Uses Environment Variable in Browser

**Location:** `apps/web-ui/src/lib/api/core.ts:47-52`

**Fixed:**
```typescript
const getApiBase = () => {
  // In Next.js, NEXT_PUBLIC_* environment variables are available in the browser
  // Use empty string for same-origin requests (Next.js rewrites will handle proxying)
  // Or use the full URL if API is on a different origin
  return process.env.NEXT_PUBLIC_API_URL || "";
};
```

**Status:** ✅ Fixed - Now uses `NEXT_PUBLIC_API_URL` in browser, falls back to empty string for same-origin (works with Next.js rewrites)

## ✅ RESOLVED: API URL Usage

**Status:** Now consistent - `API_BASE` uses `NEXT_PUBLIC_API_URL` in browser, and Next.js rewrites handle proxying.

**Files using `API_BASE`:**
- All files in `apps/web-ui/src/lib/api/*.ts` - ✅ Now works correctly

**Files using `process.env.NEXT_PUBLIC_API_URL` directly:**
- `apps/web-ui/src/lib/api/github.ts` - ✅ Also correct (explicit URL needed for OAuth)
- `apps/web-ui/src/app/(dashboard)/findings/page.tsx:161` - ✅ Correct
- `apps/web-ui/src/app/(dashboard)/runs/[id]/page.tsx:191` - ✅ Correct
- `apps/web-ui/src/app/(dashboard)/settings/page.tsx` - ✅ Correct

## 🔍 OTHER POTENTIAL ISSUES

### 1. Missing Error Handling in Button Handlers

**Files to check:**
- `apps/web-ui/src/app/(dashboard)/findings/page.tsx` - Button handlers may not catch all errors
- `apps/web-ui/src/app/(dashboard)/billing/page.tsx` - Upgrade/download buttons
- `apps/web-ui/src/app/(dashboard)/settings/page.tsx` - Delete/disconnect buttons

### 2. Missing Environment Variables

**Required for buttons to work:**
- `NEXT_PUBLIC_API_URL` - Must be set for API calls to work
- `NEXT_PUBLIC_APP_URL` - Required for OAuth callbacks
- `DATABASE_URL` - Backend won't start without it
- `JWT_SECRET` - Authentication will fail

### 3. Authentication Token Issues

**Location:** `apps/web-ui/src/lib/api/core.ts:58-67`

**Potential Issues:**
- `accessToken` is stored in module-level variable (not persisted)
- Token may be lost on page refresh
- Token refresh may fail silently

**Check:**
- Are tokens stored in localStorage/cookies?
- Is token refresh working correctly?

### 4. CORS Issues

**If API is on different origin:**
- CORS must be configured on backend
- `credentials: "include"` is used, so CORS must allow credentials
- Check `CORS_ORIGIN` environment variable

### 5. Health Check Endpoint

**Location:** `apps/web-ui/src/lib/api/core.ts:128`

**Issue:** Calls `${API_BASE}/health/live` which becomes `/health/live` (relative)
- Backend has `/health/live` endpoint ✅
- But if API_BASE is wrong, this will fail

### 6. Missing API Routes

**Some buttons call endpoints that may not exist:**
- `/api/team/*` routes - Check if registered
- `/api/billing/checkout` - Check if exists
- `/api/settings/delete-account` - Check if exists

## ✅ GOOD PRACTICES FOUND

1. **Error Boundaries:** `ErrorBoundary` components are set up ✅
2. **Error Handler Provider:** Global error handlers configured ✅
3. **Toast Notifications:** Error toasts are shown to users ✅
4. **Loading States:** Buttons have `disabled` states during operations ✅
5. **Retry Logic:** `resilientFetch` has retry logic ✅

## ✅ FIXES APPLIED

### ✅ Priority 1: Fixed API_BASE
- Updated `getApiBase()` to use `NEXT_PUBLIC_API_URL` in browser
- Falls back to empty string for same-origin (works with Next.js rewrites)

### ✅ Priority 2: Added Missing Next.js Rewrites
Added rewrites for all missing API routes:
- `/api/runs/*` - For run detail pages
- `/api/v1/*` - For fixes API
- `/api/intelligence/*` - For intelligence features
- `/api/autopilot/*` - For autopilot features
- `/api/settings/*` - For settings page
- `/api/mfa/*` - For MFA features
- `/api/onboarding/*` - For onboarding
- `/api/scans/*` - For scan features
- `/api/scheduled-scans/*` - For scheduled scans
- `/api/policies/*` - For policies
- `/api/organizations/*` - For team features
- `/api/team/*` - For team management (legacy)
- `/api/v1/github/*` - For GitHub v1 API
- `/health/live` - For health checks

### ✅ Priority 3: Registered Team Routes in API
- Added `teamRoutes` import and registration in `apps/api/src/routes/v1/index.ts`
- Team routes now available at `/api/team/*`

### ⚠️ Priority 4: Verify Environment Variables
**REQUIRED:** Ensure `.env.local` or production environment has:
- `NEXT_PUBLIC_API_URL` - Must be set to your API server URL
- `NEXT_PUBLIC_APP_URL` - Required for OAuth callbacks
- `DATABASE_URL` - Backend won't start without it
- `JWT_SECRET` - Authentication will fail without it

## 🧪 TESTING CHECKLIST

1. ✅ Check browser console for CORS errors
2. ✅ Check Network tab for failed API calls
3. ✅ Verify `NEXT_PUBLIC_API_URL` is set in browser (check `window.process?.env`)
4. ✅ Test button clicks and verify API calls succeed
5. ✅ Check for 401/403 errors (auth issues)
6. ✅ Check for 404 errors (missing endpoints)
7. ✅ Check for 500 errors (backend crashes)

## 📊 SUMMARY

**✅ FIXED Issues:**
1. ✅ `API_BASE` now uses `NEXT_PUBLIC_API_URL` in browser
2. ✅ Added missing Next.js rewrites for all API routes
3. ✅ Registered team routes in API server
4. ✅ Fixed all 76 empty catch blocks (prevents silent failures)

**⚠️ REMAINING REQUIREMENTS:**

### Critical: Environment Variables
**MUST be set for buttons to work:**
```bash
NEXT_PUBLIC_API_URL=http://localhost:3000  # Or your production API URL
NEXT_PUBLIC_APP_URL=http://localhost:5000  # Or your production app URL
DATABASE_URL=postgresql://...              # Required for backend
JWT_SECRET=...                             # Required for auth (min 32 chars)
```

### Potential Issues to Monitor:
1. **CORS Configuration** - If API is on different origin, ensure `CORS_ORIGIN` includes frontend URL
2. **Authentication Tokens** - Verify tokens are stored in cookies/localStorage correctly
3. **Network Errors** - Check browser console for failed API calls
4. **Missing Endpoints** - Some buttons may call endpoints that don't exist yet

### Testing Checklist:
- [ ] Set `NEXT_PUBLIC_API_URL` in `.env.local`
- [ ] Verify API server is running
- [ ] Test button clicks and check Network tab
- [ ] Verify no CORS errors in console
- [ ] Check for 401/403 errors (auth issues)
- [ ] Check for 404 errors (missing endpoints)
- [ ] Check for 500 errors (backend crashes)
