# Production Verification Guide

This guide explains how to verify that your guardrail dashboard is 100% connected to the backend and not using any mock data.

## 📍 Accessing the Verification System

1. Navigate to **Verify Connection** in the sidebar
2. Or go directly to: `https://your-domain.com/verify`

## 🔍 Connection Verification Tests

The system runs 6 critical tests to ensure everything is properly connected:

### 1. API Health Check

- **What it tests**: Backend server health and database connectivity
- **Success**: Backend responds with `status: healthy`
- **Failure**: Backend is unreachable or unhealthy

### 2. Authentication System

- **What it tests**: User authentication flow
- **Success**: Auth endpoints respond correctly
- **Failure**: Auth system not working

### 3. GitHub OAuth Integration

- **What it tests**: GitHub OAuth configuration
- **Success**: OAuth is properly configured (may show "not connected" for new users)
- **Failure**: OAuth misconfiguration

### 4. Database Connection

- **What it tests**: Database connectivity via API
- **Success**: Database operations work
- **Failure**: Database connection issues

### 5. Stripe Integration

- **What it tests**: Payment system configuration
- **Success**: Stripe is configured
- **Failure**: Stripe not properly set up

### 6. Repository Synchronization

- **What it tests**: GitHub repo sync functionality
- **Success**: Repositories are synced from GitHub
- **Failure**: Repo sync issues

## 📊 Repository Verification

The second tab verifies your connected repositories:

### What it checks:

- Repository exists in database
- Repository is accessible for scanning
- Last scan status
- Issue count from scans

### Actions available:

- **Scan All**: Trigger security scan on all repositories
- **View Details**: Navigate to individual repository scans

## 🚫 Mock Data Detection

The system automatically detects and prevents mock data in production:

### Automatic Checks:

1. **API URL**: Ensures not using localhost or mock endpoints
2. **localStorage**: Checks for mock GitHub data
3. **API Calls**: Detects mock API endpoints
4. **Context Flags**: Prevents mock context usage

### Production Safeguards:

- Mock data causes application to fail in production
- Console warnings in development mode
- Automatic 30-second interval checks in development

## ✅ Success Criteria

Your system is production-ready when:

### Backend Connection:

- ✅ All 6 connection tests pass
- ✅ Green "All Critical Systems Connected!" message appears

### Repository Status:

- ✅ GitHub is connected
- ✅ Repositories appear with "Repository ready for scanning" status
- ✅ Green "All Repositories Ready!" message appears

### Mock Data:

- ✅ No mock data detected
- ✅ All API calls go to real backend
- ✅ No localStorage mock data

## 🔧 Troubleshooting

### Backend Connection Issues:

1. **Check environment variables**:
   ```bash
   npm run env:check railway
   ```
2. **Verify backend is running**:
   - Visit: `https://your-backend.railway.app/api/health`
3. **Check CORS configuration**:
   - Ensure `CORS_ORIGIN` includes your frontend domain

### GitHub OAuth Issues:

1. **Update callback URL** in GitHub OAuth app:
   - Must match: `https://your-backend.railway.app/api/auth/github/callback`
2. **Verify environment variables**:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET`

### Repository Sync Issues:

1. **Re-connect GitHub**:
   - Click "Disconnect" then "Connect" again
2. **Manual sync**:
   - Use the "Sync" button in Integrations

### Mock Data Detected:

1. **Clear localStorage**:
   ```javascript
   localStorage.clear();
   ```
2. **Check API URL**:
   - Ensure `NEXT_PUBLIC_API_URL` is set correctly
3. **Refresh page** after clearing data

## 📋 Pre-Deployment Checklist

Before deploying to production:

1. [ ] Run all verification tests: `/verify`
2. [ ] Ensure no mock data is detected
3. [ ] Test GitHub OAuth flow end-to-end
4. [ ] Verify repository scanning works
5. [ ] Check all environment variables:
   ```bash
   npm run env:check netlify
   npm run env:check railway
   ```
6. [ ] Confirm HTTPS is enabled
7. [ ] Test cross-domain cookies (if using custom domain)

## 🚀 Production Deployment

After deployment:

1. Visit `/verify` to confirm everything is working
2. Connect your GitHub account
3. Sync your repositories
4. Run your first security scan

Your guardrail dashboard is now fully connected and ready for production use!
