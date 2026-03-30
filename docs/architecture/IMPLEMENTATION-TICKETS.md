# guardrail AI - Implementation Tickets
## Priority-Ordered Action Items

**Generated:** December 30, 2025  
**Status:** Ready for Implementation  

---

## 🔴 CRITICAL PRIORITY (Week 1)

### TICKET-001: Replace Vault Simulation with Real Implementation
**File:** `@/packages/security/src/secrets/vault-integration.ts`  
**Priority:** P0  
**Effort:** 4 hours  

**Current Issue:**
```typescript
private simulateMigration(_detection: SecretDetection, vaultConfig: VaultConfig): string {
  return `vault_${vaultConfig.type}_${Date.now()}_${Math.random()}`;
}
```

**Required Changes:**
1. Add AWS SDK: `@aws-sdk/client-secrets-manager`
2. Add HashiCorp Vault: `node-vault`
3. Add Azure: `@azure/keyvault-secrets`
4. Add GCP: `@google-cloud/secret-manager`
5. Implement real vault operations with proper error handling

---

### TICKET-002: Implement Real License Fetching
**File:** `@/packages/security/src/license/engine.ts`  
**Priority:** P0  
**Effort:** 3 hours  

**Current Issue:**
```typescript
return Object.entries(deps).map(([name, version]) => ({
  license: 'MIT', // Hardcoded!
}));
```

**Required Changes:**
1. Query npm registry API: `https://registry.npmjs.org/{package}`
2. Parse license field from package metadata
3. Handle SPDX expressions
4. Cache results for performance
5. Add fallback for private packages

---

### TICKET-003: Wire Up LLM Providers
**Files:** 
- `@/src/lib/ai/providers/openai-provider.ts`
- `@/src/lib/ai/providers/anthropic-provider.ts`  
**Priority:** P0  
**Effort:** 6 hours  

**Required Changes:**
1. Add OpenAI API key configuration
2. Implement actual API calls with retry logic
3. Add streaming support for real-time analysis
4. Implement token counting and rate limiting
5. Add cost tracking per request

---

### TICKET-004: Fix MCP Server Placeholder Tools
**File:** `@/mcp-server/index.js`  
**Priority:** P0  
**Effort:** 8 hours  

**Tools Needing Implementation:**
- `semantic_search` - Implement with embeddings
- `analyze_change_impact` - Full dependency analysis
- `generate_code_context` - Complete context building

---

## 🟠 HIGH PRIORITY (Week 2)

### TICKET-005: Unit Test Coverage - AI Guardrails
**Directory:** `@/packages/ai-guardrails/src/__tests__/`  
**Priority:** P1  
**Effort:** 8 hours  
**Target Coverage:** 80%  

**Files to Test:**
- `injection/detector.ts` - 100% coverage needed
- `injection/patterns.ts` - Pattern validation
- `validation/*.ts` - All validation logic
- `sandbox/action-interceptor.ts` - Critical security

---

### TICKET-006: Unit Test Coverage - Security Package
**Directory:** `@/packages/security/src/__tests__/`  
**Priority:** P1  
**Effort:** 8 hours  
**Target Coverage:** 80%  

**Files to Test:**
- `supply-chain/typosquat.ts`
- `supply-chain/detector.ts`
- `license/engine.ts`
- `attack-surface/analyzer.ts`

---

### TICKET-007: API Integration Tests
**Directory:** `@/apps/api/src/__tests__/`  
**Priority:** P1  
**Effort:** 12 hours  

**Routes to Test:**
- `/api/auth/*` - Full auth flow
- `/api/injection/*` - Injection scanning
- `/api/secrets/*` - Secret detection
- `/api/compliance/*` - Compliance checks
- `/api/projects/*` - Project management

---

### TICKET-008: Implement Vulnerability Database Integration
**New File:** `@/packages/security/src/supply-chain/vulnerability-db.ts`  
**Priority:** P1  
**Effort:** 8 hours  

**Required Integrations:**
1. OSV API (Open Source Vulnerabilities)
2. GitHub Security Advisories API
3. npm audit integration
4. CVE lookup service

---

### TICKET-009: Redis Caching Layer
**File:** `@/src/lib/cache/redis-cache.ts` (enhance existing)  
**Priority:** P1  
**Effort:** 6 hours  

**Cache Targets:**
- Knowledge base results (TTL: 1 hour)
- Semantic search embeddings (TTL: 24 hours)
- Compliance assessments (TTL: 30 minutes)
- License lookups (TTL: 7 days)

---

## 🟡 MEDIUM PRIORITY (Week 3-4)

### TICKET-010: E2E Test Suite
**Directory:** `@/e2e/`  
**Priority:** P2  
**Effort:** 16 hours  

**Scenarios:**
- Full security scan workflow
- Project onboarding flow
- Compliance assessment
- Real-time collaboration
- MCP tool usage

---

### TICKET-011: Prometheus Metrics
**New File:** `@/src/lib/metrics/prometheus.ts`  
**Priority:** P2  
**Effort:** 6 hours  

**Metrics to Implement:**
- `Guardrail_scans_total` - Counter
- `Guardrail_scan_duration_seconds` - Histogram
- `Guardrail_injections_detected_total` - Counter by severity
- `Guardrail_vulnerabilities_found_total` - Counter by severity
- `Guardrail_api_requests_total` - Counter by endpoint

---

### TICKET-012: Additional Compliance Frameworks
**Directory:** `@/packages/compliance/src/frameworks/`  
**Priority:** P2  
**Effort:** 16 hours  

**New Frameworks:**
- `iso27001.ts` - ISO 27001 controls
- `nist.ts` - NIST Cybersecurity Framework
- `ccpa.ts` - California Consumer Privacy Act
- `cis.ts` - CIS Benchmarks

---

### TICKET-013: SBOM Generation
**New File:** `@/packages/security/src/sbom/generator.ts`  
**Priority:** P2  
**Effort:** 8 hours  

**Formats:**
- CycloneDX JSON/XML
- SPDX JSON/RDF
- Custom JSON export

---

### TICKET-014: CI/CD Integration Hooks
**New Directory:** `@/packages/ci-integration/`  
**Priority:** P2  
**Effort:** 12 hours  

**Platforms:**
- GitHub Actions workflow
- GitLab CI template
- Jenkins plugin config
- Azure DevOps extension

---

## 🟢 ENHANCEMENT PRIORITY (Week 5+)

### TICKET-015: ML Model Training Pipeline
**New Directory:** `@/src/lib/ml/`  
**Priority:** P3  
**Effort:** 24 hours  

**Components:**
- `training-pipeline.ts` - Data preparation
- `pattern-model.ts` - Pattern recognition model
- `bug-predictor.ts` - Bug prediction model
- `model-server.ts` - Model serving

---

### TICKET-016: Visual Dependency Graph
**New File:** `@/src/lib/visualization/dependency-graph.ts`  
**Priority:** P3  
**Effort:** 12 hours  

**Features:**
- D3.js-based visualization
- Interactive node exploration
- Risk highlighting
- Export as SVG/PNG

---

### TICKET-017: Policy as Code (OPA Integration)
**New Directory:** `@/packages/policy/`  
**Priority:** P3  
**Effort:** 16 hours  

**Features:**
- Rego policy support
- Policy evaluation engine
- Custom policy editor
- Policy testing framework

---

### TICKET-018: guardrail Marketplace
**New Directory:** `@/packages/marketplace/`  
**Priority:** P3  
**Effort:** 24 hours  

**Features:**
- Shareable guardrail definitions
- Community contributions
- Rating system
- Auto-update mechanism

---

### TICKET-019: Multi-Language Support
**New Directory:** `@/packages/language-analyzers/`  
**Priority:** P3  
**Effort:** 32 hours  

**Languages:**
- Python (security patterns)
- Java (Spring patterns)
- Go (common vulnerabilities)
- Rust (unsafe code detection)

---

### TICKET-020: VS Code Extension
**New Directory:** `@/packages/vscode-extension/`  
**Priority:** P3  
**Effort:** 24 hours  

**Features:**
- Real-time code validation
- Inline guardrail warnings
- Quick fix suggestions
- Settings sync with server

---

## 📊 Effort Summary

| Priority | Tickets | Total Effort |
|----------|---------|--------------|
| P0 (Critical) | 4 | 21 hours |
| P1 (High) | 5 | 42 hours |
| P2 (Medium) | 5 | 58 hours |
| P3 (Enhancement) | 6 | 132 hours |
| **Total** | **20** | **253 hours** |

---

## 🏃 Sprint Planning Suggestion

### Sprint 1 (Week 1-2): Foundation
- TICKET-001 through TICKET-004
- Goal: Replace all simulations with real implementations

### Sprint 2 (Week 2-3): Testing
- TICKET-005 through TICKET-007
- Goal: Achieve 80% test coverage

### Sprint 3 (Week 3-4): Production Readiness
- TICKET-008 through TICKET-011
- Goal: Production-ready infrastructure

### Sprint 4 (Week 5-6): Feature Expansion
- TICKET-012 through TICKET-014
- Goal: Enterprise feature completeness

### Sprint 5+ (Ongoing): Innovation
- TICKET-015 through TICKET-020
- Goal: Competitive differentiation

---

**Context Enhanced by guardrail AI**
