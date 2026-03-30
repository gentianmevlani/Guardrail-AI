# 🚨 Security Incident Response: Production Credentials Exposed

**Incident Date:** January 5, 2026  
**Severity:** CRITICAL  
**Status:** IN PROGRESS

---

## 📋 Executive Summary

Production `.env` file was committed to git with live credentials. All secrets must be considered compromised and require immediate rotation.

---

## 1️⃣ Credential Rotation Checklist

### Railway PostgreSQL Database

```bash
# 1. Log into Railway dashboard: https://railway.app/dashboard
# 2. Navigate to your project → PostgreSQL service
# 3. Click "Settings" → "Danger Zone" → "Reset Credentials"
# 4. Copy the new DATABASE_URL

# Verify new connection works:
psql "your-new-database-url" -c "SELECT 1;"
```

**Update in Railway Variables:**

```
DATABASE_URL=postgresql://user:NEW_PASSWORD@host:port/database?sslmode=require
```

---

### GitHub OAuth Application

```bash
# 1. Go to: https://github.com/settings/developers
# 2. Select your OAuth App
# 3. Click "Generate a new client secret"
# 4. Copy the NEW secret immediately (shown only once)
# 5. Update in Railway:
```

**Update in Railway Variables:**

```
GITHUB_CLIENT_ID=<keep-existing-or-create-new-app>
GITHUB_CLIENT_SECRET=<new-generated-secret>
```

---

### GitHub App (if separate from OAuth)

```bash
# 1. Go to: https://github.com/settings/apps
# 2. Select your GitHub App
# 3. Under "Client secrets", click "Generate a new client secret"
# 4. Scroll to "Private keys" → Generate new private key
# 5. Revoke old keys after confirming new ones work
```

**Update in Railway Variables:**

```
GITHUB_APP_ID=<your-app-id>
GITHUB_APP_CLIENT_ID=<your-client-id>
GITHUB_APP_CLIENT_SECRET=<new-secret>
GITHUB_APP_PRIVATE_KEY=<base64-encoded-new-private-key>
```

---

### Google OAuth

```bash
# 1. Go to: https://console.cloud.google.com/apis/credentials
# 2. Select your OAuth 2.0 Client ID
# 3. Click "Reset Secret" or create new credentials
# 4. Download the new JSON or copy credentials
```

**Update in Railway Variables:**

```
GOOGLE_CLIENT_ID=<your-client-id>
GOOGLE_CLIENT_SECRET=<new-secret>
```

---

### Stripe Keys

```bash
# 1. Go to: https://dashboard.stripe.com/apikeys
# 2. Click "Roll key" on BOTH publishable and secret keys
# 3. For webhook secret: Webhooks → Select endpoint → "Roll secret"

# IMPORTANT: Stripe keys can be rolled with grace period
# Old keys remain valid for 24h by default
```

**Update in Railway Variables:**

```
STRIPE_PUBLISHABLE_KEY=pk_live_NEW_KEY
STRIPE_SECRET_KEY=sk_live_NEW_KEY
STRIPE_WEBHOOK_SECRET=whsec_NEW_SECRET
```

---

### JWT, Cookie, and Session Secrets

Generate new 256-bit (32-byte) secrets:

**Mac/Linux:**

```bash
# Generate JWT_SECRET
openssl rand -base64 32
# Output example: K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=

# Generate COOKIE_SECRET
openssl rand -base64 32

# Generate SESSION_SECRET
openssl rand -base64 32

# Generate JWT_REFRESH_SECRET
openssl rand -base64 32
```

**Windows PowerShell:**

```powershell
# Generate JWT_SECRET
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Generate COOKIE_SECRET
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Generate SESSION_SECRET
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# Generate JWT_REFRESH_SECRET
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

**Update in Railway Variables:**

```
JWT_SECRET=<new-256-bit-secret>
JWT_REFRESH_SECRET=<new-256-bit-secret>
COOKIE_SECRET=<new-256-bit-secret>
SESSION_SECRET=<new-256-bit-secret>
```

⚠️ **WARNING:** Rotating JWT secrets will invalidate ALL existing user sessions. Users will need to re-login.

---

### OpenAI API Key

```bash
# 1. Go to: https://platform.openai.com/api-keys
# 2. Click "Create new secret key"
# 3. Name it (e.g., "guardrail-production-v2")
# 4. Copy immediately (shown only once)
# 5. Delete the old compromised key
```

**Update in Railway Variables:**

```
OPENAI_API_KEY=sk-proj-NEW_KEY
```

---

### Anthropic API Key

```bash
# 1. Go to: https://console.anthropic.com/settings/keys
# 2. Click "Create Key"
# 3. Name it (e.g., "guardrail-production-v2")
# 4. Copy immediately
# 5. Delete the old compromised key
```

**Update in Railway Variables:**

```
ANTHROPIC_API_KEY=sk-ant-NEW_KEY
```

---

## 2️⃣ Git History Cleanup

### Prerequisites

```bash
# Install BFG Repo-Cleaner
# Mac:
brew install bfg

# Windows (download JAR):
# https://rtyley.github.io/bfg-repo-cleaner/
# Place bfg.jar in a known location

# Linux:
sudo apt install default-jre
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar -O bfg.jar
```

### Step-by-Step Cleanup

```bash
# 1. BACKUP YOUR REPO FIRST
cd ..
cp -r codeguard codeguard-backup-$(date +%Y%m%d)

# 2. Create a fresh clone (BFG requires bare clone for safety)
git clone --mirror https://github.com/YOUR_ORG/codeguard.git codeguard-mirror.git

# 3. Create a file listing secrets to remove
cat > secrets-to-remove.txt << 'EOF'
.env
.env.local
.env.production
.env.staging
.env.development
EOF

# 4. Run BFG to remove .env files from history
# Mac/Linux:
bfg --delete-files '.env*' codeguard-mirror.git

# Windows:
java -jar bfg.jar --delete-files '.env*' codeguard-mirror.git

# 5. Clean up the refs and garbage collect
cd codeguard-mirror.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. COORDINATE WITH TEAM - Send this message:
# "⚠️ SECURITY: Force push incoming. Everyone must:
#  1. Commit/stash local changes
#  2. Delete local repo
#  3. Fresh clone after force push
#  Do NOT push until you've re-cloned!"

# 7. Force push (DESTRUCTIVE - no going back)
git push --force

# 8. All team members must fresh clone:
cd ..
rm -rf codeguard
git clone https://github.com/YOUR_ORG/codeguard.git
```

### Windows PowerShell Commands

```powershell
# 1. Backup
cd ..
Copy-Item -Recurse codeguard "codeguard-backup-$(Get-Date -Format 'yyyyMMdd')"

# 2. Mirror clone
git clone --mirror https://github.com/YOUR_ORG/codeguard.git codeguard-mirror.git

# 3. Run BFG
java -jar bfg.jar --delete-files '.env*' codeguard-mirror.git

# 4. Cleanup
cd codeguard-mirror.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push
git push --force
```

---

## 3️⃣ Railway Environment Variable Setup

### CLI Setup (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Set variables (one by one for security)
railway variables set JWT_SECRET="<your-new-secret>"
railway variables set JWT_REFRESH_SECRET="<your-new-secret>"
railway variables set DATABASE_URL="<your-new-url>"
railway variables set GITHUB_CLIENT_ID="<your-id>"
railway variables set GITHUB_CLIENT_SECRET="<your-new-secret>"
railway variables set GOOGLE_CLIENT_ID="<your-id>"
railway variables set GOOGLE_CLIENT_SECRET="<your-new-secret>"
railway variables set STRIPE_SECRET_KEY="<your-new-key>"
railway variables set STRIPE_PUBLISHABLE_KEY="<your-new-key>"
railway variables set STRIPE_WEBHOOK_SECRET="<your-new-secret>"
railway variables set OPENAI_API_KEY="<your-new-key>"
railway variables set ANTHROPIC_API_KEY="<your-new-key>"
railway variables set COOKIE_SECRET="<your-new-secret>"
railway variables set SESSION_SECRET="<your-new-secret>"

# Verify
railway variables

# Trigger redeploy
railway up
```

---

## 4️⃣ Verification Checklist

After completing all steps, verify:

- [ ] New DATABASE_URL connects successfully
- [ ] GitHub OAuth login works
- [ ] Google OAuth login works
- [ ] Stripe payments process
- [ ] AI features work (OpenAI/Anthropic)
- [ ] All user sessions invalidated (expected with JWT rotation)
- [ ] Git history no longer contains .env files
- [ ] `scripts/verify-secrets.js` passes

```bash
# Run verification script
node scripts/verify-secrets.js

# Test OAuth flows manually
# Test Stripe webhook with CLI
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## 5️⃣ Post-Incident Actions

1. **Audit logs** - Check for unauthorized access during exposure window
2. **User notification** - Consider notifying users if data may be compromised
3. **Incident report** - Document timeline and lessons learned
4. **Enable secret scanning** - GitHub Advanced Security or GitGuardian

```bash
# Enable GitHub secret scanning (if available)
# Repository Settings → Security → Secret scanning → Enable
```

---

## 📞 Emergency Contacts

- **Railway Support:** https://railway.app/help
- **GitHub Security:** https://github.com/contact/security
- **Stripe Support:** https://support.stripe.com
- **OpenAI:** https://help.openai.com
- **Anthropic:** https://support.anthropic.com
