# Enhanced guardrail System

## Overview

This document describes the comprehensive enhancements made to the guardrail system to provide:

1. **Clear SHIP/NO SHIP decisions** with detailed criteria and confidence scores
2. **Advanced Context Engine** that prevents AI hallucinations and drift
3. **Prompt Firewall Service** with task breakdown, verification, version control, and immediate fixes
4. **Long-Term Improvement Tracking** for best practices, testing, and code reviews

---

## 🚀 Enhanced Ship Decision Engine

### Location
`packages/core/src/ship/enhanced-ship-decision.ts`

### Features

- **Multi-Criteria Evaluation**: Evaluates multiple criteria (MockProof, Ship Badge, Hallucination Check, Security, Performance)
- **Confidence Scores**: Each criterion includes a confidence score (0-1)
- **Actionable Blockers**: Clear, prioritized blockers with fix steps
- **Drift Detection**: Compares current state with previous decisions to detect drift
- **Context-Aware**: Uses project context and git information

### Usage

```typescript
import { enhancedShipDecisionEngine } from '@guardrail/core/ship/enhanced-ship-decision';

const decision = await enhancedShipDecisionEngine.decide(projectPath, {
  includeReality: true,
  includeSecurity: true,
  includePerformance: true,
  checkDrift: true,
});

console.log(decision.verdict); // 'SHIP' | 'NO_SHIP' | 'REVIEW'
console.log(decision.score); // 0-100
console.log(decision.confidence); // 0-1
console.log(decision.blockers); // Array of actionable blockers
console.log(decision.recommendations); // Immediate, short-term, long-term
```

### Decision Criteria

1. **MockProof** (30% weight): No mock data or placeholders
2. **Ship Badge** (25% weight): Quality gates passed
3. **Hallucination Check** (20% weight): No AI hallucinations detected
4. **Security Scan** (15% weight): No critical vulnerabilities
5. **Performance** (10% weight): Performance benchmarks met

### Verdict Logic

- **NO_SHIP**: Critical failures OR score < 70
- **REVIEW**: Score < 85 OR warnings present
- **SHIP**: Score >= 85 AND no critical failures

---

## 🧠 Enhanced Context Engine

### Location
`src/lib/context/enhanced-context-engine.ts`

### Features

- **Real-Time Validation**: Validates context for completeness, freshness, and accuracy
- **Drift Detection**: Detects when code drifts from project patterns and conventions
- **Pattern Enforcement**: Ensures generated code follows project patterns
- **Learning System**: Learns from corrections to improve future context

### Usage

```typescript
import { enhancedContextEngine } from '@guardrail/core/context/enhanced-context-engine';

const result = await enhancedContextEngine.getValidatedContext(projectPath, {
  file: 'src/components/Button.tsx',
  purpose: 'Add click handler',
  checkDrift: true,
});

console.log(result.validation.valid); // true/false
console.log(result.validation.issues); // Array of issues
console.log(result.drift?.detected); // true/false
```

### Validation Checks

1. **Context Completeness**: Ensures context layers are present
2. **Freshness**: Checks if context is up-to-date
3. **Confidence**: Validates confidence scores
4. **Pattern Consistency**: Ensures patterns align with project
5. **Hallucination Risk**: Assesses risk of hallucinations

### Drift Detection

Detects drift in:
- **Patterns**: Changes in code patterns
- **Conventions**: Changes in coding conventions
- **Context Layers**: Changes in context structure

---

## 🛡️ Advanced Prompt Firewall Service

### Location
`packages/ai-guardrails/src/firewall/advanced-prompt-firewall.ts`

### Features

- **Task Breakdown**: Automatically breaks down prompts into detailed, actionable tasks
- **Verification**: Verifies prompts against context, patterns, and project standards
- **Version Control Integration**: Tracks changes, conflicts, and git state
- **Immediate Fixes**: Generates and applies immediate fixes for common issues
- **Future Planning**: Creates comprehensive plans for implementation

### Usage

```typescript
import { createPromptFirewall } from '@guardrail/ai-guardrails/firewall/advanced-prompt-firewall';

const firewall = createPromptFirewall(projectPath);

const result = await firewall.process(prompt, {
  autoBreakdown: true,
  autoVerify: true,
  autoFix: false, // Set to true to auto-apply fixes
  includeVersionControl: true,
  generatePlan: true,
});

console.log(result.taskBreakdown); // Array of tasks
console.log(result.verification.passed); // true/false
console.log(result.versionControl.branch); // Current git branch
console.log(result.immediateFixes); // Array of fixes
console.log(result.futurePlan); // Implementation plan
```

### Task Breakdown

Each task includes:
- **ID**: Unique identifier
- **Title & Description**: Clear task description
- **Priority**: critical | high | medium | low
- **Estimated Time**: In minutes
- **Dependencies**: Other tasks this depends on
- **Verification**: How to verify completion
- **Status**: pending | in_progress | completed | blocked

### Verification Checks

1. **Context Relevance**: How relevant is prompt to project context
2. **Pattern Compliance**: Does prompt align with project patterns
3. **Hallucination Risk**: Risk of AI hallucinations
4. **Completeness**: Is prompt complete with all details

### Immediate Fixes

Fixes include:
- **Type**: code | config | dependency | test
- **Description**: What the fix does
- **File**: File to modify
- **Change**: Before/after code
- **Confidence**: 0-1 confidence score
- **Applied**: Whether fix was applied
- **Verified**: Whether fix was verified

---

## 📊 Long-Term Improvement Tracking

### Location
`packages/core/src/improvements/long-term-tracking.ts`

### Features

- **Best Practices Tracking**: Tracks adoption of best practices
- **Test Metrics**: Monitors test coverage and quality
- **Code Review Metrics**: Tracks code review process
- **Tool Efficiency**: Monitors tool usage and success rates
- **Improvement Plans**: Creates and tracks improvement plans

### Usage

```typescript
import { createLongTermTracking } from '@guardrail/core/improvements/long-term-tracking';

const tracking = createLongTermTracking(projectPath);

// Generate report
const report = await tracking.generateReport();

// Track best practice
await tracking.trackBestPractice({
  id: 'unit-testing',
  name: 'Unit Testing',
  category: 'testing',
  description: 'Write unit tests for all critical functions',
  status: 'adopted',
  evidence: ['test files found'],
  impact: 'high',
});

// Record test run
await tracking.recordTestRun({
  coverage: 85,
  passing: 120,
  failing: 5,
});

// Record code review
await tracking.recordCodeReview({
  issuesFound: 3,
  issuesResolved: 3,
  reviewTime: 45,
  quality: 90,
});
```

### Best Practices Categories

- **Testing**: Unit tests, integration tests, E2E tests
- **Code Quality**: Linting, formatting, complexity
- **Security**: Scanning, vulnerability management
- **Performance**: Optimization, monitoring
- **Documentation**: API docs, code comments
- **Process**: CI/CD, code reviews, workflows

### Metrics Tracked

1. **Test Coverage**: Percentage of code covered
2. **Test Counts**: Unit, integration, E2E tests
3. **Review Quality**: Code review effectiveness
4. **Tool Success Rate**: How often tools succeed
5. **Overall Score**: Composite score (0-100)

---

## 🔗 Unified guardrail System

### Location
`packages/core/src/unified-guardrail.ts`

### Features

Integrates all systems into a single, easy-to-use interface:

- **Comprehensive Check**: Runs all checks in one call
- **Unified Report**: Single report combining all results
- **Status Summary**: Overall status (ready | needs_attention | blocked)
- **Prioritized Recommendations**: Actionable recommendations

### Usage

```typescript
import { createUnifiedGuardrail } from '@guardrail/core/unified-guardrail';

const guardrail = createUnifiedGuardrail({
  projectPath: './my-project',
});

// Run comprehensive check
const result = await guardrail.runComprehensiveCheck('Add user authentication', {
  checkShip: true,
  checkContext: true,
  checkLongTerm: true,
});

console.log(result.summary.overallStatus); // 'ready' | 'needs_attention' | 'blocked'
console.log(result.summary.score); // 0-100
console.log(result.summary.blockers); // Array of blockers
console.log(result.summary.recommendations); // Array of recommendations

// Generate report
const report = await guardrail.generateReport('Add user authentication');
console.log(report); // Human-readable report
```

### Overall Status

- **ready**: All checks passed, score >= 85
- **needs_attention**: Some issues, score < 85
- **blocked**: Critical blockers present

---

## 🎯 Key Benefits

### 1. Clear SHIP/NO SHIP Decisions

- **Transparent Criteria**: Know exactly why something can or can't ship
- **Confidence Scores**: Understand how confident the system is
- **Actionable Blockers**: Clear steps to fix issues
- **Drift Detection**: Catch issues before they become problems

### 2. Prevents AI Hallucinations

- **Context Validation**: Ensures context is accurate and up-to-date
- **Pattern Enforcement**: Forces code to follow project patterns
- **Drift Detection**: Catches when code drifts from standards
- **Learning System**: Improves over time from corrections

### 3. Comprehensive Prompt Analysis

- **Task Breakdown**: Clear, actionable tasks
- **Verification**: Ensures prompts are valid and complete
- **Version Control**: Tracks all changes
- **Immediate Fixes**: Fixes issues automatically
- **Future Planning**: Plans implementation steps

### 4. Long-Term Quality

- **Best Practices**: Tracks adoption of best practices
- **Testing**: Monitors test coverage and quality
- **Code Reviews**: Tracks review process effectiveness
- **Tool Efficiency**: Monitors tool performance
- **Continuous Improvement**: Plans and tracks improvements

---

## 📝 Integration Examples

### CLI Integration

```typescript
// In bin/runners/runShip.js or similar
import { enhancedShipDecisionEngine } from '@guardrail/core/ship/enhanced-ship-decision';

async function runShip(args) {
  const decision = await enhancedShipDecisionEngine.decide(process.cwd(), {
    checkDrift: true,
  });
  
  console.log(enhancedShipDecisionEngine.generateReport(decision));
  
  process.exit(decision.verdict === 'SHIP' ? 0 : 1);
}
```

### API Integration

```typescript
// In apps/api/src/routes/ship.ts
import { enhancedShipDecisionEngine } from '@guardrail/core/ship/enhanced-ship-decision';

fastify.post('/ship/check', async (request, reply) => {
  const decision = await enhancedShipDecisionEngine.decide(request.body.projectPath);
  return reply.send(decision);
});
```

### MCP Integration

```typescript
// In mcp-server/guardrail-tools.js
import { createPromptFirewall } from '@guardrail/ai-guardrails/firewall/advanced-prompt-firewall';

async function handlePromptFirewall(args) {
  const firewall = createPromptFirewall(args.projectPath);
  const result = await firewall.process(args.prompt);
  return result;
}
```

---

## 🔧 Configuration

All systems use sensible defaults but can be configured:

### Ship Decision Thresholds

```typescript
// Customize verdict thresholds
const decision = await enhancedShipDecisionEngine.decide(projectPath, {
  // Custom thresholds can be added to options
});
```

### Context Engine Settings

```typescript
// Configure drift threshold
enhancedContextEngine.driftThreshold = 0.2; // 20% change indicates drift
```

### Prompt Firewall Options

```typescript
const result = await firewall.process(prompt, {
  autoBreakdown: true,      // Auto-breakdown tasks
  autoVerify: true,         // Auto-verify prompt
  autoFix: false,           // Don't auto-apply fixes
  includeVersionControl: true, // Include git info
  generatePlan: true,       // Generate future plan
});
```

---

## 📈 Next Steps

1. **Integrate into CLI**: Add commands for each system
2. **Add API Endpoints**: Expose via REST API
3. **Create UI Dashboard**: Visualize reports and metrics
4. **Add Notifications**: Alert on critical issues
5. **Extend Learning**: Improve from user feedback

---

## 🐛 Troubleshooting

### Import Errors

If you see import errors, ensure:
- All packages are built: `pnpm build`
- TypeScript paths are configured correctly
- Dependencies are installed: `pnpm install`

### Context Not Found

If context engine can't find context:
- Run: `guardrail context` or build knowledge base
- Ensure `.guardrail/` directory exists
- Check project path is correct

### Git Errors

If version control integration fails:
- Ensure project is a git repository
- Check git is installed and accessible
- Verify git commands work in project directory

---

## 📚 Related Documentation

- [Ship Decision Engine](./SHIP_DECISION.md)
- [Context Engine](./CONTEXT_ENGINE.md)
- [Prompt Firewall](./PROMPT_FIREWALL.md)
- [Long-Term Tracking](./LONG_TERM_TRACKING.md)

---

**Last Updated**: 2026-01-07
**Version**: 1.0.0
