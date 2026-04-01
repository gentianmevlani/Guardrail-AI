# Reality Graph - Evidence-Based Dependency + Behavior Graph

## Overview

Reality Graph transforms guardrail from "scan results" to a **living map of reality** - an evidence-based dependency and behavior graph that shows what actually exists and what actually executes.

## What is Reality Graph?

Reality Graph is a knowledge graph where:

- **Nodes** represent: files, routes, handlers, DB tables, external APIs, permissions, secrets, feature flags
- **Edges** represent relationships: "this route calls this handler", "this handler writes this table", "this flow hits this external API"
- **Proof Scores** on each edge combine static analysis certainty with observed execution evidence

## Why Reality Graph Matters

### Competitors show findings. You show evidence.

Reality Graph enables queries nobody else can answer:

1. **"These 3 endpoints exist but were never executed in any proof run."**
   - Find dead code that's deployed but never used
   - Identify routes that exist but aren't tested

2. **"This permission check is declared but not enforced on write paths."**
   - Find security gaps where permissions exist but aren't enforced
   - Identify missing authorization checks

3. **"This feature flag guards UI but not API."**
   - Find incomplete feature flag implementations
   - Identify security bypasses through API endpoints

## Node Types

### Files
- Source code files discovered in the project
- Proof: Static (100%) - Found in filesystem

### Routes
- API endpoints and page routes
- Proof: Static (100%) - Found in route definitions
- Proof: Observed (0-100%) - Hit during runtime execution

### Handlers
- Request handlers, controllers, actions
- Proof: Static (80%) - Found in code
- Proof: Observed (0-100%) - Called during execution

### DB Tables
- Database tables from Prisma schema
- Proof: Static (100%) - Found in schema
- Proof: Observed (0-100%) - Queried during execution

### External APIs
- Third-party API integrations
- Proof: Static (60%) - Found in code
- Proof: Observed (0-100%) - Called during execution

### Permissions
- Permission checks in code
- Proof: Static (70%) - Found in code
- Proof: Observed (0-100%) - Enforced during execution

### Secrets
- Secret references (env vars, secrets)
- Proof: Static (80%) - Found in code
- Proof: Observed (0-100%) - Used during execution

### Feature Flags
- Feature flag checks
- Proof: Static (70%) - Found in code
- Proof: Observed (0-100%) - Evaluated during execution

## Edge Types

### calls
- Route → Handler: "This route calls this handler"
- Handler → Handler: "This handler calls another handler"

### writes
- Handler → DB Table: "This handler writes to this table"
- Route → DB Table: "This route modifies this table"

### reads
- Handler → DB Table: "This handler reads from this table"
- Route → DB Table: "This route queries this table"

### requires
- Route → Permission: "This route requires this permission"
- Handler → Permission: "This handler requires this permission"

### guards
- Feature Flag → Route: "This flag guards this route"
- Feature Flag → Handler: "This flag guards this handler"

### uses
- Handler → Secret: "This handler uses this secret"
- Handler → External API: "This handler calls this API"

### imports
- File → File: "This file imports this file"

### depends_on
- Route → External API: "This route depends on this API"
- Handler → Service: "This handler depends on this service"

## Proof Scores

Each node and edge has a proof score:

```typescript
{
  static: 0-100,      // Certainty from static analysis
  observed: 0-100,    // Evidence from runtime execution
  combined: 0-100,    // Weighted combination (40% static, 60% observed)
  evidence: string[]  // Proof artifacts (screenshots, traces, logs)
}
```

### Scoring Rules

- **Static Score**: Based on how certain we are from code analysis
  - Found in filesystem: 100%
  - Found in code: 60-80%
  - Inferred from patterns: 40-60%

- **Observed Score**: Based on runtime execution
  - Never seen: 0%
  - Seen once: 10%
  - Seen multiple times: Up to 100%

- **Combined Score**: Weighted average
  - Formula: `static * 0.4 + observed * 0.6`
  - Execution evidence is weighted higher (proves it actually works)

## Usage

### Generate Graph

```bash
# Build graph from project
guardrail reality:graph --path /path/to/project

# Load graph from receipt
guardrail reality:graph --receipt receipt-123

# Export graph
guardrail reality:graph --export json
```

### Query Graph

```bash
# Find unexecuted nodes
guardrail reality:graph --query unexecuted

# Find unhit routes
guardrail reality:graph --query unhit-routes

# Find unguarded write paths
guardrail reality:graph --query unguarded-writes

# Find incomplete feature flags
guardrail reality:graph --query incomplete-flags
```

## Integration with Receipts

Reality Graph is automatically generated with every Proof-of-Execution Receipt:

```
.guardrail/receipts/receipt-{runId}/
├── receipt.json          # Receipt bundle
├── reality-graph.json    # Reality Graph snapshot
└── artifacts/            # Evidence artifacts
```

The graph captures:
- Static discovery from code analysis
- Runtime evidence from execution traces
- Proof scores based on observed behavior

## Example Queries

### 1. Find Dead Routes

```bash
guardrail reality:graph --query unhit-routes
```

Output:
```
Unhit Routes: 3
  • GET /api/admin/users
  • POST /api/admin/delete
  • GET /api/legacy/reports
```

### 2. Find Security Gaps

```bash
guardrail reality:graph --query unguarded-writes
```

Output:
```
Unguarded Write Paths: 2
  • POST /api/users/update (missing permission:users:write)
  • DELETE /api/projects/:id (missing permission:projects:delete)
```

### 3. Find Incomplete Feature Flags

```bash
guardrail reality:graph --query incomplete-flags
```

Output:
```
Incomplete Feature Flags: 1
  • feature:new-checkout (UI: true, API: false)
```

## Graph Structure

```json
{
  "nodes": [
    {
      "id": "route:POST:/api/billing/upgrade",
      "type": "route",
      "label": "POST /api/billing/upgrade",
      "metadata": {
        "file": "src/routes/billing.ts",
        "route": "/api/billing/upgrade",
        "method": "POST"
      },
      "proofScore": {
        "static": 100,
        "observed": 85,
        "combined": 91,
        "evidence": ["screenshots/checkout-1.png", "traces/trace.zip"]
      }
    }
  ],
  "edges": [
    {
      "id": "route:POST:/api/billing/upgrade->handler:upgradeHandler:calls",
      "source": "route:POST:/api/billing/upgrade",
      "target": "handler:upgradeHandler",
      "type": "calls",
      "proofScore": {
        "static": 100,
        "observed": 85,
        "combined": 91,
        "evidence": []
      }
    }
  ]
}
```

## Future Enhancements

- [ ] Graph visualization (D3.js, Cytoscape)
- [ ] Graph comparison (diff between snapshots)
- [ ] Drift detection (compare graphs over time)
- [ ] Graph API endpoints
- [ ] Real-time graph updates
- [ ] Graph-based recommendations

## Benefits

1. **Evidence-Based**: Not "we think", but "we observed"
2. **Actionable**: Find actual problems, not false positives
3. **Comprehensive**: Maps entire application structure
4. **Living**: Updates with every execution
5. **Queryable**: Answer questions nobody else can

## The Moat

Reality Graph becomes your moat because:

- **Nobody else maps reality**: Competitors show static findings; you show what actually happens
- **Evidence-based decisions**: Proof scores enable confident decisions
- **Living documentation**: Graph becomes the source of truth
- **Security insights**: Find gaps competitors miss

This turns guardrail into a **living map of reality**, not just a scanner.
