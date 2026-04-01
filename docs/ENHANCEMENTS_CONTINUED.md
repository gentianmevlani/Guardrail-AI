# Continued Enhancements - Integration & Configuration

## Overview

This document describes the additional enhancements made to integrate the new systems into the CLI and API, plus a comprehensive configuration system.

---

## 🖥️ CLI Integration

### New Commands

#### 1. Enhanced Ship Decision

**Command**: `guardrail enhanced-ship`

**Description**: Uses the enhanced ship decision engine with multi-criteria evaluation, confidence scores, and drift detection.

**Usage**:
```bash
# Basic usage
guardrail enhanced-ship

# With options
guardrail enhanced-ship --check-drift --security --performance

# JSON output
guardrail enhanced-ship --json

# Exclude reality mode
guardrail enhanced-ship --no-reality
```

**Options**:
- `--check-drift`: Enable drift detection (default: true)
- `--security`: Include security scan (default: true)
- `--performance`: Include performance check (default: true)
- `--reality`: Include reality mode (default: true)
- `--no-reality`: Exclude reality mode
- `--json`: Output JSON format
- `--path <path>`: Project path (default: current directory)

**Exit Codes**:
- `0`: SHIP - Ready to ship
- `1`: NO_SHIP - Blockers present
- `2`: REVIEW - Needs attention

**Example Output**:
```
━━━ Enhanced Ship Decision ━━━

✅ VERDICT: SHIP
   Score: 92/100
   Confidence: 87%

📊 CRITERIA BREAKDOWN:
   ✅ MockProof - No Mock Data
      Status: PASS
      Score: 100/100 (95% confidence)
   
   ✅ Ship Badge - Quality Gates
      Status: PASS
      Score: 95/100 (90% confidence)
   
   ✅ AI Hallucination Check
      Status: PASS
      Score: 100/100 (85% confidence)
```

#### 2. Prompt Firewall

**Command**: `guardrail prompt-firewall` or `guardrail firewall`

**Description**: Processes prompts through the advanced firewall with task breakdown, verification, and immediate fixes.

**Usage**:
```bash
# Basic usage
guardrail prompt-firewall "Add user authentication"

# With auto-fix
guardrail prompt-firewall "Fix security issues" --auto-fix

# JSON output
guardrail prompt-firewall "Your prompt" --json

# Without version control
guardrail prompt-firewall "Your prompt" --no-version-control
```

**Options**:
- `--prompt <prompt>`: The prompt to analyze
- `--auto-fix`: Automatically apply immediate fixes (default: false)
- `--no-version-control`: Exclude git version control info
- `--no-plan`: Don't generate future plan
- `--json`: Output JSON format
- `--path <path>`: Project path (default: current directory)

**Example Output**:
```
━━━ Prompt Firewall Analysis ━━━

Prompt: Add user authentication

✅ VERIFICATION: PASSED
   Score: 85/100

🔍 VERIFICATION CHECKS:
   ✅ Context Relevance: PASS
      Prompt relevance to project context: 85%
   
   ✅ Pattern Compliance: PASS
      Prompt aligns with project patterns
   
   ✅ Hallucination Risk: PASS
      Low hallucination risk

📋 TASK BREAKDOWN:
   [CRITICAL] Task 1: Create authentication service
      Implement authentication service based on project patterns
      Estimated time: 45 minutes
   
   [HIGH] Task 2: Add login endpoint
      Create login API endpoint
      Estimated time: 30 minutes
      Depends on: task-1

🔀 VERSION CONTROL:
   Branch: main
   Commit: abc12345
   Changes: 3 file(s)

💡 RECOMMENDATIONS:
   • Review task breakdown and adjust priorities
   • Run ship check after implementation
```

---

## 🌐 API Endpoints

### Base URL
- **v1**: `/api/v1/enhanced-guardrail`
- **Legacy**: `/api/enhanced-guardrail`

### Endpoints

#### 1. Enhanced Ship Decision

**POST** `/enhanced-ship/check`

**Request Body**:
```json
{
  "projectPath": "/path/to/project",
  "includeReality": true,
  "includeSecurity": true,
  "includePerformance": true,
  "checkDrift": true
}
```

**Response**:
```json
{
  "success": true,
  "decision": {
    "verdict": "SHIP",
    "score": 92,
    "confidence": 0.87,
    "criteria": [...],
    "blockers": [...],
    "recommendations": {...}
  }
}
```

#### 2. Prompt Firewall

**POST** `/prompt-firewall/process`

**Request Body**:
```json
{
  "prompt": "Add user authentication",
  "projectPath": "/path/to/project",
  "autoBreakdown": true,
  "autoVerify": true,
  "autoFix": false,
  "includeVersionControl": true,
  "generatePlan": true
}
```

**Response**:
```json
{
  "success": true,
  "result": {
    "taskBreakdown": [...],
    "verification": {...},
    "versionControl": {...},
    "immediateFixes": [...],
    "futurePlan": {...}
  }
}
```

#### 3. Apply Immediate Fix

**POST** `/prompt-firewall/apply-fix`

**Request Body**:
```json
{
  "fix": {
    "id": "fix-123",
    "type": "code",
    "description": "Fix hallucination issues",
    "file": "src/main.ts",
    "change": {
      "before": "// TODO: Fix",
      "after": "// Fixed"
    },
    "confidence": 0.8
  },
  "projectPath": "/path/to/project"
}
```

#### 4. Context Validation

**POST** `/context/validate`

**Request Body**:
```json
{
  "projectPath": "/path/to/project",
  "file": "src/components/Button.tsx",
  "purpose": "Add click handler",
  "checkDrift": true
}
```

#### 5. Long-Term Tracking Report

**GET** `/long-term-tracking/report?projectPath=/path/to/project`

**Response**:
```json
{
  "success": true,
  "report": {
    "bestPractices": [...],
    "testMetrics": {...},
    "codeReviewMetrics": {...},
    "toolEfficiency": [...],
    "overallScore": 85
  }
}
```

#### 6. Unified guardrail Check

**POST** `/unified/check`

**Request Body**:
```json
{
  "prompt": "Add user authentication",
  "projectPath": "/path/to/project",
  "checkShip": true,
  "checkContext": true,
  "checkLongTerm": true
}
```

#### 7. Generate Comprehensive Report

**POST** `/unified/report`

**Request Body**:
```json
{
  "prompt": "Add user authentication",
  "projectPath": "/path/to/project"
}
```

**Response**:
```json
{
  "success": true,
  "report": "╔══════════════════════════════════════════════════════════════╗\n..."
}
```

---

## ⚙️ Configuration System

### Location
Configuration is stored in `.guardrail/config.json` in your project root.

### Configuration Structure

```json
{
  "version": "1.0.0",
  "shipDecision": {
    "thresholds": {
      "ship": 85,
      "review": 70,
      "noShip": 70
    },
    "weights": {
      "mockproof": 0.3,
      "badge": 0.25,
      "hallucination": 0.2,
      "security": 0.15,
      "performance": 0.1
    },
    "requireAllCritical": false
  },
  "contextEngine": {
    "driftThreshold": 0.15,
    "freshnessThreshold": 0.5,
    "confidenceThreshold": 0.7,
    "maxSnapshots": 20,
    "cacheTTL": 300000
  },
  "promptFirewall": {
    "autoBreakdown": true,
    "autoVerify": true,
    "autoFix": false,
    "includeVersionControl": true,
    "generatePlan": true,
    "maxTasks": 20,
    "verificationThreshold": 75
  },
  "longTermTracking": {
    "trackBestPractices": true,
    "trackTestMetrics": true,
    "trackCodeReviews": true,
    "trackToolEfficiency": true,
    "minTestCoverage": 80,
    "minReviewQuality": 80
  }
}
```

### Configuration Options

#### Ship Decision Config

- **thresholds.ship**: Minimum score for SHIP verdict (default: 85)
- **thresholds.review**: Minimum score for REVIEW verdict (default: 70)
- **thresholds.noShip**: Maximum score for NO_SHIP verdict (default: 70)
- **weights**: Adjust weights for each criteria (must sum to 1.0)
- **requireAllCritical**: Require all critical criteria to pass (default: false)

#### Context Engine Config

- **driftThreshold**: Percentage change that indicates drift (default: 0.15 = 15%)
- **freshnessThreshold**: Minimum freshness score (default: 0.5)
- **confidenceThreshold**: Minimum confidence score (default: 0.7)
- **maxSnapshots**: Maximum snapshots to keep (default: 20)
- **cacheTTL**: Cache TTL in milliseconds (default: 300000 = 5 minutes)

#### Prompt Firewall Config

- **autoBreakdown**: Auto-breakdown tasks (default: true)
- **autoVerify**: Auto-verify prompts (default: true)
- **autoFix**: Auto-apply fixes (default: false)
- **includeVersionControl**: Include git info (default: true)
- **generatePlan**: Generate future plan (default: true)
- **maxTasks**: Maximum tasks in breakdown (default: 20)
- **verificationThreshold**: Minimum verification score (default: 75)

#### Long-Term Tracking Config

- **trackBestPractices**: Track best practices (default: true)
- **trackTestMetrics**: Track test metrics (default: true)
- **trackCodeReviews**: Track code reviews (default: true)
- **trackToolEfficiency**: Track tool efficiency (default: true)
- **minTestCoverage**: Minimum test coverage target (default: 80)
- **minReviewQuality**: Minimum review quality target (default: 80)

### Using Configuration

```typescript
import { createConfigManager } from '@guardrail/core/config/guardrail-config';

const configManager = createConfigManager(projectPath);

// Load config
const config = await configManager.load();

// Get specific config
const shipConfig = await configManager.getShipDecisionConfig();

// Update config
await configManager.save({
  shipDecision: {
    thresholds: {
      ship: 90, // Higher threshold
    },
  },
});

// Reset to defaults
await configManager.reset();
```

---

## 🔗 Integration Examples

### CLI Integration

```bash
# Run enhanced ship check
guardrail enhanced-ship

# Process prompt through firewall
guardrail prompt-firewall "Add user authentication"

# With auto-fix enabled
guardrail prompt-firewall "Fix security issues" --auto-fix
```

### API Integration

```typescript
// Enhanced ship decision
const response = await fetch('/api/v1/enhanced-guardrail/enhanced-ship/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    projectPath: '/path/to/project',
    checkDrift: true,
  }),
});

const { decision } = await response.json();
console.log(decision.verdict); // 'SHIP' | 'NO_SHIP' | 'REVIEW'
```

### Programmatic Usage

```typescript
import { createUnifiedGuardrail } from '@guardrail/core/unified-guardrail';

const guardrail = createUnifiedGuardrail({
  projectPath: './my-project',
});

// Run comprehensive check
const result = await guardrail.runComprehensiveCheck('Add user auth', {
  checkShip: true,
  checkContext: true,
  checkLongTerm: true,
});

// Generate report
const report = await guardrail.generateReport('Add user auth');
console.log(report);
```

---

## 📊 Next Steps

1. **Build packages**: Run `pnpm build` in `packages/core` and `packages/ai-guardrails`
2. **Test CLI commands**: Try `guardrail enhanced-ship` and `guardrail prompt-firewall`
3. **Test API endpoints**: Use the API endpoints in your web UI
4. **Configure**: Customize `.guardrail/config.json` for your needs
5. **Integrate**: Add to CI/CD pipelines and development workflows

---

**Last Updated**: 2026-01-07
**Version**: 1.1.0
