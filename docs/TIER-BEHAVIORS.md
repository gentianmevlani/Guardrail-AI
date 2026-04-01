# guardrail Tier Behaviors

## Quick Reference

| Feature | FREE | STARTER | PRO | COMPLIANCE |
|---------|------|---------|-----|------------|
| `guardrail scan` | ✅ 10/mo | ✅ 100/mo | ✅ 500/mo | ✅ 1000/mo |
| `guardrail scan --truth` | ❌ | ✅ | ✅ | ✅ |
| `guardrail scan --reality` | ❌ | ✅ 20/mo | ✅ 100/mo | ✅ 200/mo |
| `guardrail ship` | Layer 1 only | Full check | Full check | Full check |
| `guardrail ship --block` | ❌ | ✅ | ✅ | ✅ |
| `guardrail fix` | Plan only | Plan only | ✅ 50/mo | ✅ 100/mo |
| `guardrail autopilot` | ❌ | ❌ | ✅ | ✅ |
| `guardrail mcp` | ❌ | ❌ | ✅ | ✅ |
| Compliance reports | ❌ | ❌ | ❌ | ✅ PDF |
| Team seats | 1 | 1 | 5 (+$25/seat) | 10 (+$35/seat) |

---

## FREE Tier ($0/month)

### What's Included
- Static code analysis (`guardrail scan`)
- AI code validation
- Ship badge generator
- 10 scans/month
- 1 team member

### Command Behaviors

```bash
# ✅ ALLOWED - Basic scan (Layer 1 only)
guardrail scan
# Output: Route integrity analysis, placeholders, basic issues
# Consumes: 1 scan

# ❌ BLOCKED - Truth layer requires Starter+
guardrail scan --truth
# Output: "Upgrade to Starter for build manifest verification"

# ❌ BLOCKED - Reality layer requires Starter+
guardrail scan --reality
# Output: "Upgrade to Starter for Reality Mode browser testing"

# ⚠️ LIMITED - Ship check runs Layer 1 only
guardrail ship
# Output: Basic health check, "Not eligible for ship guarantee"
# Note: Cannot use --block flag for CI gating

# ⚠️ LIMITED - Fix shows suggestions only
guardrail fix
# Output: List of available fix packs with upgrade prompts
# Note: Cannot apply fixes, only view suggestions

# ✅ ALLOWED - Badge generation
guardrail badge
```

---

## STARTER Tier ($29/month)

### What's Included
- Everything in Free
- Reality Mode browser testing
- CI/CD deploy blocking
- Mock detection
- 100 scans/month
- 20 Reality runs/month
- 1 team member

### Command Behaviors

```bash
# ✅ ALLOWED - Full scan with truth layer
guardrail scan --truth
# Output: Route integrity + build manifest verification
# Consumes: 1 scan

# ✅ ALLOWED - Reality mode
guardrail scan --reality --url http://localhost:3000
# Output: Full Playwright crawl proof
# Consumes: 1 reality run

# ✅ ALLOWED - Full ship check with CI blocking
guardrail ship
# Output: SHIP PASS/FAIL with full analysis

guardrail ship --block
# Output: Exits non-zero if checks fail (for CI)

# ⚠️ LIMITED - Fix shows suggestions only
guardrail fix route-integrity
# Output: "Upgrade to Pro for verified autofix"
# Note: Can see what would be fixed, cannot apply

# ❌ BLOCKED - Autopilot requires Pro+
guardrail autopilot
# Output: "Upgrade to Pro for Autopilot continuous protection"

# ❌ BLOCKED - MCP requires Pro+
guardrail mcp
# Output: "Upgrade to Pro for MCP IDE integration"
```

---

## PRO Tier ($99/month)

### What's Included
- Everything in Starter
- AI Agent autonomous testing
- Verified autofix with generated prompts
- Autopilot continuous protection
- MCP plugin for IDE
- 500 scans/month
- 100 Reality runs/month
- 50 AI Agent runs/month
- 5 seats included (+$25/seat/mo)

### Command Behaviors

```bash
# ✅ ALLOWED - All scan modes
guardrail scan
guardrail scan --truth
guardrail scan --reality --url http://localhost:3000

# ✅ ALLOWED - Full ship check
guardrail ship
guardrail ship --block

# ✅ ALLOWED - Verified autofix
guardrail fix route-integrity
# Process:
# 1. Generates strict Build Mode prompt
# 2. Validates JSON diff output
# 3. Applies in temp workspace
# 4. Runs verification pipeline
# 5. Applies only if all checks pass
# Consumes: 1 AI Agent run

guardrail fix type-errors --dry-run
# Shows diff without applying

# ✅ ALLOWED - Autopilot
guardrail autopilot
# Continuous protection mode

# ✅ ALLOWED - MCP integration
guardrail mcp
# IDE integration with prompt firewall
```

---

## COMPLIANCE Tier ($199/month)

### What's Included
- Everything in Pro
- Compliance frameworks: SOC2, HIPAA, GDPR, PCI-DSS, NIST, ISO 27001
- Audit-ready PDF reports
- 1000 scans/month
- 200 Reality runs/month
- 100 AI Agent runs/month
- 10 seats included (+$35/seat/mo)

### Command Behaviors

```bash
# ✅ ALLOWED - All features from Pro

# ✅ ALLOWED - Compliance scanning
guardrail scan --compliance soc2
guardrail scan --compliance hipaa
guardrail scan --compliance gdpr

# ✅ ALLOWED - PDF reports
guardrail ship --report pdf
# Output: Audit-ready PDF in .guardrail/reports/

# ✅ ALLOWED - Full compliance certify
guardrail certify --framework soc2
# Generates compliance certification report
```

---

## Quota Enforcement

### How Quotas Work

1. **Server-Authoritative**: CLI checks with server before consuming quota
2. **Idempotent**: Request IDs prevent double-counting on retries
3. **Offline Mode**: Works offline, syncs when online
4. **Monthly Reset**: Quotas reset on billing cycle

### Quota Exceeded Behavior

```
╭─────────────────────────────────────────────────────────────────╮
│  ⚠️  MONTHLY LIMIT REACHED                                      │
├─────────────────────────────────────────────────────────────────┤
│  Reality Runs: 20/20 used this month                            │
│  Your tier: Starter ($29/month)                                 │
├─────────────────────────────────────────────────────────────────┤
│  Pro ($99/mo): 100 Reality runs/month                           │
├─────────────────────────────────────────────────────────────────┤
│  → guardrail upgrade                                            │
│  → https://guardrailai.dev/pricing                              │
╰─────────────────────────────────────────────────────────────────╯
```

---

## Verification Commands

```bash
# Check current tier and usage
guardrail whoami

# View usage summary
guardrail usage

# Upgrade tier
guardrail upgrade
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: guardrail Ship Check
on: [push, pull_request]

jobs:
  ship-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build
      
      # Ship check with CI blocking (Starter+ required)
      - name: Ship Check
        run: npx guardrail ship --block
        env:
          GUARDRAIL_API_KEY: ${{ secrets.GUARDRAIL_API_KEY }}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success / Ship Ready |
| 1 | Blockers found / Not ship ready |
| 2 | Access denied (tier/quota) |
| 3 | Configuration error |
