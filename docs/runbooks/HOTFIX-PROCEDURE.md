# Hotfix Deployment Procedure

## When to Use Hotfix

Use this procedure for:

- Critical bugs affecting production
- Security vulnerabilities
- Data integrity issues

**Do NOT use for**: Feature additions, non-critical bugs, refactoring

---

## Hotfix Workflow

### 1. Create Hotfix Branch

```bash
# Start from main
git checkout main
git pull origin main

# Create hotfix branch
git checkout -b hotfix/describe-the-fix
```

### 2. Make Minimal Fix

- Fix ONLY the critical issue
- No refactoring
- No unrelated changes
- Add regression test if possible

### 3. Test Locally

```bash
# Run relevant tests
pnpm test -- --grep "related-test"

# Test the specific fix manually
pnpm dev
```

### 4. Create PR with Hotfix Label

```bash
git add .
git commit -m "hotfix: brief description of fix

- What was broken
- What this fixes
- Any side effects

Fixes #ISSUE_NUMBER"

git push origin hotfix/describe-the-fix
```

Create PR with:

- `hotfix` label
- Link to incident (if applicable)
- Screenshot/proof of fix working

### 5. Fast-Track Review

- Requires 1 approval (normally 2)
- CI must pass (tests, lint, build)
- Security review for auth/data fixes

### 6. Deploy

```bash
# Merge to main (triggers auto-deploy)
git checkout main
git merge hotfix/describe-the-fix
git push origin main

# Monitor deploy
# Watch Netlify dashboard for build completion
```

### 7. Verify in Production

```bash
# Run smoke tests
curl -sf https://guardrail.app/health

# Verify specific fix
# [Add verification steps specific to the fix]

# Monitor Sentry for new errors
```

### 8. Cleanup

```bash
# Delete hotfix branch
git branch -d hotfix/describe-the-fix
git push origin --delete hotfix/describe-the-fix
```

---

## Emergency Bypass (SEV1 Only)

For SEV1 incidents where CI/review would cause unacceptable delay:

### Option A: Direct Deploy

```bash
# Build locally
pnpm build

# Deploy directly to Netlify
netlify deploy --prod --dir=apps/web-ui/.next
```

### Option B: Netlify Deploy Lock

1. Go to Netlify Dashboard
2. Site Settings → Build & Deploy
3. Stop auto publishing
4. Make fix
5. Manually trigger deploy
6. Re-enable auto publishing

**⚠️ Always backfill PR and review after emergency deploy**

---

## Post-Hotfix Checklist

- [ ] Verify fix in production
- [ ] Update incident channel
- [ ] Create follow-up issue for proper fix (if this was a band-aid)
- [ ] Add regression test
- [ ] Update runbook if new failure mode discovered
- [ ] Schedule postmortem if significant

---

## Hotfix vs Rollback Decision Tree

```
Is the broken code from recent deploy?
├── Yes → Is the deploy < 30 min ago?
│   ├── Yes → ROLLBACK (faster)
│   └── No → Can you fix in < 15 min?
│       ├── Yes → HOTFIX
│       └── No → ROLLBACK
└── No → HOTFIX (can't rollback to fix old bug)
```

---

## Communication Template

### Slack Update

```
🔧 HOTFIX DEPLOYING

Issue: [Brief description]
Fix: [What the hotfix does]
ETA: [Time to production]
Risk: Low/Medium/High
Rollback ready: Yes

Will update when deployed.
```

### Post-Deploy Update

```
✅ HOTFIX DEPLOYED

Fix verified in production at [time]
Monitoring for [duration]

[Link to fix PR]
```
