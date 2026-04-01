# 🚀 guardrail Ship Mode

> "Stop shipping pretend features. guardrail runs your app and catches the lies."

Ship Mode is guardrail's vibecoder-friendly bundle that gives you instant proof your app is real, not fake.

## The Problem

Vibecoders ship fast, but they also ship:
- Mock APIs that return `inv_demo_1234`
- Localhost URLs that break in production
- Placeholder content like "Lorem ipsum"
- Demo billing that never charges anyone
- Feature flags stuck in mock mode

**Static scanners miss this.** They can't see what actually happens at runtime.

## The Solution: Ship Mode

Ship Mode is 3 tools in 1:

### 1. 🛡️ MockProof Build Gate

Blocks banned imports from reaching production entrypoints.

```bash
npm run ship:mockproof
```

**What it does:**
- Scans your import graph from production entrypoints
- Detects `MockProvider`, `useMock`, `mock-context`
- Finds hardcoded `localhost`, `ngrok`, `jsonplaceholder`
- Catches test API keys (`sk_test_`, `pk_test_`)
- Shows the exact import chain: `layout.tsx → MockProvider → mock-context`

**Why it wins:** Semgrep and Snyk don't do "reachable-from-prod-entrypoint" checks in a friendly way.

### 2. 🔍 Reality Mode

A "flight recorder" for fake apps. Runs your app and watches it lie.

```bash
npm run ship:reality --url https://staging.myapp.com
```

**What it does:**
- Generates a Playwright test that intercepts all network calls
- Clicks through your UI like a real user
- Flags calls to mock APIs, staging domains, ngrok
- Detects responses with demo data, placeholder IDs
- Creates a replay showing exactly what happened

**Why it wins:** It's not abstract scanning—it's proof.

### 3. 🏆 Ship Badge

Shareable proof that your app is real.

```bash
npm run ship:badge
```

**What it does:**
- Runs 6 ship-worthiness checks
- Generates SVG badges for your README
- Creates a hosted permalink for social proof
- Gives you embed code for Product Hunt, landing pages

**The checks:**
- ✅ No Mock Data Detected
- ✅ No Localhost/Ngrok URLs
- ✅ All required env vars present
- ✅ Billing not simulated
- ✅ Database is real
- ✅ OAuth callbacks not localhost

## Quick Start

### Run All Checks

```bash
# Full ship check with verdicts
npm run ship

# Or with the CLI
npm run ship:check
```

### Individual Commands

```bash
# MockProof only
npm run ship:mockproof

# Reality Mode only (generates Playwright test)
npm run ship:reality

# Ship Badge only
npm run ship:badge
```

### CI Integration

```bash
# Fail build if checks don't pass
npm run ship -- --ci

# JSON output for parsing
npm run ship -- --json
```

### Options

```
--path, -p     Project path (default: current directory)
--output, -o   Output directory (default: .guardrail/ship)
--url          Base URL for Reality Mode (default: http://localhost:3000)
--json         Output results as JSON
--ci           CI mode (exit with error code on failure)
```

## Output

After running `npm run ship`, you get:

```
.guardrail/ship/
├── badges/
│   ├── ship-status.svg      # Main SHIP/NO-SHIP badge
│   ├── mock-data.svg        # No mock data badge
│   ├── real-api.svg         # No localhost badge
│   ├── env-vars.svg         # Env vars badge
│   ├── billing.svg          # Real billing badge
│   ├── database.svg         # Real database badge
│   ├── oauth.svg            # OAuth badge
│   └── ship-score.svg       # Combined score badge
├── reality-mode/
│   └── reality-mode.spec.ts # Playwright test
├── ship-badge-result.json   # Detailed results
└── ship-report.json         # Combined report
```

## Add Badge to README

After running `npm run ship:badge`, add this to your README:

```markdown
<!-- guardrail Ship Badge -->
[![guardrail Ship Status](https://guardrailai.dev/api/badge/YOUR_ID/main.svg)](https://guardrailai.dev/badge/YOUR_ID)
[![Mock Data](https://guardrailai.dev/api/badge/YOUR_ID/mock-data.svg)](https://guardrailai.dev/badge/YOUR_ID)
[![Real APIs](https://guardrailai.dev/api/badge/YOUR_ID/real-api.svg)](https://guardrailai.dev/badge/YOUR_ID)
<!-- End guardrail Ship Badge -->
```

Or use local badges:

```markdown
![Ship Status](./.guardrail/ship/badges/ship-status.svg)
![Ship Score](./.guardrail/ship/badges/ship-score.svg)
```

## Running Reality Mode

After generating the Reality Mode test:

```bash
# Run the generated Playwright test
npx playwright test .guardrail/ship/reality-mode/reality-mode.spec.ts

# With headed browser (see what's happening)
npx playwright test .guardrail/ship/reality-mode/reality-mode.spec.ts --headed
```

The test will:
1. Navigate to your app
2. Click through common UI paths
3. Intercept all network requests
4. Flag any fake data detected
5. Generate a report with replay steps

## Configuring Banned Patterns

Create `.guardrail/ship.config.json`:

```json
{
  "bannedImports": [
    {
      "pattern": "MockProvider",
      "message": "MockProvider should not be in production",
      "allowedIn": ["**/__tests__/**", "**/stories/**"]
    },
    {
      "pattern": "your-custom-mock",
      "message": "Custom mock detected",
      "allowedIn": ["**/test/**"]
    }
  ],
  "entrypoints": [
    "src/app/layout.tsx",
    "src/app/page.tsx"
  ],
  "requiredEnvVars": [
    "DATABASE_URL",
    "STRIPE_SECRET_KEY",
    "NEXTAUTH_SECRET"
  ]
}
```

## Why Vibecoders Love This

1. **Instant dopamine** - Get a red/green verdict in seconds
2. **Instant proof** - Not abstract warnings, actual evidence
3. **Zero setup** - Works out of the box
4. **Shareable output** - Badges for flexing on Product Hunt
5. **One rule, one red line** - No config hell

## The Landing Pitch

> "Stop shipping pretend features. guardrail runs your app and catches the lies."

Demo flow:
1. Paste repo
2. Click "Reality Mode"
3. Watch it run
4. Get a red/green verdict + replay

That alone converts because it's not abstract scanning—it's proof.

---

*Context Enhanced by guardrail AI*
