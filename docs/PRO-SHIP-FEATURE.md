# Pro Ship Feature - $99/month

## Overview

The Pro Ship feature is a comprehensive deployment readiness solution that runs ALL available scans and provides an overall ship/no-ship decision with dynamic badge generation.

## Features

### Comprehensive Scanning
- **MockProof Scan**: Detects banned imports (MockProvider, useMock, localhost, etc.)
- **Reality Mode**: Runtime fake detection (requires baseUrl)
- **Security Scan**: Vulnerability and security issue detection
- **Performance Check**: Bundle size, load time, and performance metrics
- **Accessibility Check**: WCAG compliance and accessibility issues

### Dynamic Badge System
- **SVG Badge**: `GET /api/badge/:org/:repo.svg`
- **JSON Data**: `GET /api/badge/:org/:repo.json`
- **Report Page**: `GET /report/:org/:repo`

### Smart Scoring Algorithm
- Weighted scoring based on scan importance
- Ship/No-Ship/Review verdict logic
- Critical issue and warning tracking

## Usage

### CLI Commands

#### Basic Ship Check (Starter+)
```bash
guardrail ship --path ./my-app --mockproof
```

#### Pro Ship Check (Pro - $99/mo)
```bash
guardrail ship:pro --path ./my-app --url https://myapp.com
```

#### Pro Ship with Options
```bash
guardrail ship:pro \
  --path ./my-app \
  --url https://myapp.com \
  --format json \
  --output ship-report.json \
  --no-accessibility  # Skip accessibility check
```

### API Endpoints

#### Run Pro Ship Scan
```bash
POST /api/ship/pro
{
  "projectPath": "/path/to/project",
  "baseUrl": "https://myapp.com",
  "includeRealityMode": true,
  "includeSecurityScan": true,
  "includePerformanceCheck": true,
  "includeAccessibilityCheck": true
}
```

#### Get Dynamic Badge
```bash
# SVG Badge
GET /api/badge/myorg/myrepo.svg

# JSON Data
GET /api/badge/myorg/myrepo.json

# Test Badge
GET /api/badge/test.svg?v=SHIP&s=92
```

#### View Report
```bash
GET /report/myorg/myrepo
```

## Badge Integration

### README.md Integration
```markdown
[![guardrail](https://yourdomain.com/api/badge/OWNER/REPO.svg)](https://yourdomain.com/report/OWNER/REPO)
```

### Badge Colors
- 🟢 **SHIP** (#2ea44f): Ready to deploy
- 🔴 **NO-SHIP** (#d73a49): Critical issues block deployment
- 🟡 **REVIEW** (#f59e0b): Warnings need attention

## Scoring Algorithm

### Weight Distribution
- MockProof: 30%
- Reality Mode: 25%
- Security Scan: 20%
- Performance Check: 15%
- Accessibility Check: 10%

### Verdict Logic
- **SHIP**: Score ≥85, no critical issues, ≤5 warnings
- **NO-SHIP**: Score <70, any critical issues, or failed scans
- **REVIEW**: Everything else

## Architecture

### Components
1. **ProShipScanner**: Orchestrates all scans
2. **BadgeRoutes**: Dynamic SVG/JSON badge generation
3. **ShipRoutes**: API endpoints for scanning
4. **CLI Integration**: Command-line interface

### File Structure
```
packages/ship/src/
├── pro-ship/
│   ├── pro-ship-scanner.ts    # Main orchestration
│   └── index.ts              # Exports
├── ship-badge/               # Existing badge generation
├── mockproof/               # Existing MockProof scanner
└── reality-mode/            # Existing reality mode scanner

apps/api/src/routes/
├── ship.ts                  # Updated with pro endpoint
└── badge.ts                 # New badge API routes

packages/cli/src/
└── index.ts                 # Updated with ship:pro command
```

## Data Flow

1. User runs `guardrail ship:pro`
2. ProShipScanner orchestrates all enabled scans
3. Results are aggregated and scored
4. Overall verdict is calculated
5. Report is saved to `.guardrail/pro-ship/`
6. Dynamic badge endpoints read latest results
7. Badge reflects current ship status

## Subscription Integration

The feature includes subscription tier checking:
- **Pro Required**: Full comprehensive scanning
- **Starter+**: Basic ship check only
- **Free**: Read-only access to public badges

## Example Output

### CLI Output
```
🚀 PRO SHIP CHECK
✅ SHIP
Overall Score: 92/100
Scans Completed: 5/5
Passed: 4
Failed: 0
Critical Issues: 0
Warnings: 3
Duration: 12.34s

SCAN RESULTS
1. MockProof
   Status: ✓ PASS
   Score: 100/100
   Duration: 2.1s

2. Reality Mode
   Status: ✓ PASS
   Score: 95/100
   Duration: 4.2s

3. Security Scan
   Status: ✓ PASS
   Score: 88/100
   Duration: 3.1s
   Warnings: 2

4. Performance Check
   Status: ⚠️ WARNING
   Score: 78/100
   Duration: 1.8s
   Warnings: 1

5. Accessibility Check
   Status: ✓ PASS
   Score: 92/100
   Duration: 1.1s

RECOMMENDATION
✅ Your project is ready to ship! All critical checks passed and quality score is excellent.

DYNAMIC BADGE
SVG URL: /api/badge/myorg/myrepo.svg
JSON URL: /api/badge/myorg/myrepo.json
Embed Code:
  [![guardrail](https://yourdomain.com/api/badge/myorg/myrepo.svg)](https://yourdomain.com/report/myorg/myrepo)
```

## Benefits

1. **Comprehensive**: Runs all available scans in one command
2. **Smart Scoring**: Weighted algorithm for accurate ship readiness
3. **Dynamic Badges**: Real-time status badges for README
4. **Professional**: Enterprise-grade deployment gating
5. **Monetizable**: Premium feature justifies $99/month price

This implementation provides a complete, production-ready Pro Ship feature that delivers significant value and justifies the premium pricing tier.
