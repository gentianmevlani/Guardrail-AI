# guardrail Product Roadmap - "Proof-of-Work for Software"

## Vision

**"guardrail is Proof-of-Work for Software."**

Not blockchain-y. Literal: show your work.

Competitors sell "confidence." You sell receipts.

## Completed Features ✅

### 1. Proof-of-Execution Receipts ✅

**Status**: Complete

**What it does**: Every PASS/SHIP verdict includes a machine-verifiable receipt bundle with cryptographic attestation.

**What's inside**:
- Build + dependency lock hashes
- Exact commands run
- Runtime traces (requests, routes, DB queries)
- Screenshots/video artifacts
- Coverage of critical paths
- Signed attestation (org key) - tamper-evident

**Key Files**:
- `packages/cli/src/reality/receipt-generator.ts`
- `packages/cli/src/reality/runtime-tracer.ts`
- `docs/PROOF_OF_EXECUTION_RECEIPTS.md`

**Usage**:
```bash
guardrail reality --url https://app.example.com --flow checkout --receipt
guardrail receipt:verify --path .guardrail/receipts
```

**Impact**: CTOs can ask "did you actually hit `/api/billing/upgrade`?" and get cryptographic proof.

### 2. Reality Graph ✅

**Status**: Complete

**What it does**: Evidence-based dependency + behavior graph showing what exists and what actually executes.

**Node Types**: files, routes, handlers, DB tables, external APIs, permissions, secrets, feature flags

**Edge Types**: calls, writes, reads, requires, guards, uses, imports, depends_on

**Proof Scores**: Each edge has static + observed proof scores (40% static, 60% observed)

**Key Queries**:
- "These 3 endpoints exist but were never executed"
- "This permission check is declared but not enforced on write paths"
- "This feature flag guards UI but not API"

**Key Files**:
- `packages/cli/src/reality/reality-graph.ts`
- `docs/REALITY_GRAPH.md`

**Usage**:
```bash
guardrail reality:graph --path /path/to/project
guardrail reality:graph --query unhit-routes
guardrail reality:graph --query unguarded-writes
```

**Impact**: Turns guardrail into a living map of reality, not just scan results.

## Next Features (Priority Order)

### 3. Agent-Safe Autopatch: "Verified Fixes Only" ✅

**Status**: Complete

**What it does**: Fix Packs only ship if they pass verification gates.

**Pipeline**:
1. Generate patch
2. Apply in sandbox branch
3. Run proof suite (build, tests, flows, policy checks)
4. Only then: "Verified Fix" badge + one-click merge

**Why it matters**: First tool that can honestly say "We don't just suggest fixes. We prove they work."

**Estimated Time**: 2-3 weeks

**Key Components**:
- Sandbox branch creation
- Automated patch application
- Proof suite execution
- Verification gate system
- One-click merge integration

### 4. Intent Drift Guard

**Status**: Planned

**What it does**: Prevents agents from quietly changing semantics, bypassing checks, or adding mock data.

**Intent Contract**:
- What the user is trying to do (feature requirements)
- Invariants that must never change (auth rules, billing rules, data ownership, security controls)
- Constraints (no demo data in prod, no fake endpoints, no silent catch blocks)

**Enforcement**:
- Pre-commit hooks
- PR checks
- CI gates
- Agent tool call validation

**Why it matters**: Hallucinations aren't the biggest risk. Intent drift is.

**Estimated Time**: 2-3 weeks

**Key Components**:
- Intent contract definition
- Drift detection engine
- Enforcement hooks
- Agent tool call validation

### 5. Ghost User / Attack QA

**Status**: Planned

**What it does**: Automated security testing without being "security scanner #9000".

**Ghost User Runner**:
- Signs up
- Logs in/out
- Attempts forbidden actions
- Tests role boundaries
- Tries broken flows (expired sessions, webhook retries, double submits)

**Why it matters**: Most dev tools don't validate product behavior like this automatically.

**Estimated Time**: 2-3 weeks

**Key Components**:
- Ghost user test suite
- Role boundary testing
- Broken flow testing
- Attack pattern library

### 6. Production Drift Detection

**Status**: Planned

**What it does**: Continuous monitoring for drift between CI and production.

**Truth Canary Mode**:
- Scheduled proof runs against staging/prod
- Compare RealityGraph snapshots over time
- Alert on drift: new endpoints, changed permissions, dead routes, external API failures, mock signatures

**Why it matters**: "It worked in CI, why is prod broken?" becomes answerable.

**Estimated Time**: 2-3 weeks

**Key Components**:
- Scheduled proof runs
- Graph comparison engine
- Drift detection alerts
- Production monitoring dashboard

## Implementation Sequence

### Phase 1: Foundation (Completed ✅)
- [x] Proof-of-Execution Receipts
- [x] Reality Graph

### Phase 2: Verification (In Progress)
- [x] Agent-Safe Autopatch ✅
- [ ] Intent Drift Guard (Next)

### Phase 3: Expansion
- [ ] Ghost User / Attack QA
- [ ] Production Drift Detection

## Positioning

### Current Positioning
"Anti-hallucination tool"

### Next-Level Positioning
**"guardrail is Proof-of-Work for Software."**

Not blockchain-y. Literal: show your work.

### Key Messages
- Competitors show findings; you show evidence
- Competitors sell confidence; you sell receipts
- Competitors scan code; you map reality
- Competitors suggest fixes; you prove they work

## Success Metrics

### Proof-of-Execution Receipts
- [ ] Receipt generation rate: >90% of SHIP verdicts
- [ ] Receipt verification success: >95%
- [ ] CTO questions answered: "Did you actually test X?" → Receipt proof

### Reality Graph
- [ ] Graph coverage: >80% of routes/handlers/tables discovered
- [ ] Query accuracy: >90% true positives
- [ ] Dead code found: X routes never executed

### Agent-Safe Autopatch
- [ ] Verified fix rate: >80% of fixes pass verification
- [ ] False positive rate: <5%
- [ ] Time saved: X hours/week

### Intent Drift Guard
- [ ] Drift detected: X instances prevented
- [ ] False positive rate: <10%
- [ ] Developer satisfaction: >4/5

### Ghost User / Attack QA
- [ ] Security gaps found: X per project
- [ ] Coverage: >70% of critical flows
- [ ] False positive rate: <15%

### Production Drift Detection
- [ ] Drift alerts: X per week
- [ ] Alert accuracy: >85%
- [ ] Time to detect: <1 hour

## Competitive Advantage

### The Moat

1. **Proof-of-Work**: Not "we think", but "we observed"
2. **Evidence-Based**: Cryptographic receipts, not vibes
3. **Living Map**: Reality Graph, not static scans
4. **Verified Fixes**: Proved to work, not just suggested
5. **Intent Protection**: Prevents drift, not just detects it
6. **Reality Testing**: Ghost users, not just scanners

### Why This Wins

- **CTOs trust receipts**: Cryptographic proof beats confidence
- **Developers trust verified fixes**: Proved to work beats "try this"
- **Security teams trust reality testing**: Actual behavior beats static analysis
- **Everyone trusts the map**: Living graph beats outdated docs

## Next Steps

1. **Complete Phase 2** (Agent-Safe Autopatch + Intent Drift Guard)
2. **Validate with users**: Get feedback on receipts and graph
3. **Build Phase 3** (Ghost User + Drift Detection)
4. **Scale**: Make it work for enterprise customers

## Resources

- [Proof-of-Execution Receipts](./PROOF_OF_EXECUTION_RECEIPTS.md)
- [Reality Graph](./REALITY_GRAPH.md)
- [Receipt Implementation](./REALITY_RECEIPTS_IMPLEMENTATION.md)
