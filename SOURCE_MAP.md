# Root `src/` source map (deprecation)

Repository-root `src/` is **deprecated**. New TypeScript must land under `apps/web-ui/src`, `apps/api/src`, or `packages/*`. CI blocks **new** `.ts`/`.tsx` files here (see `scripts/check-no-new-root-src-ts.mjs`).

## Legend

| Tag | Meaning |
| --- | --- |
| **(a)** | Belongs in `apps/web-ui/src` (UI, legacy pages mirror) |
| **(b)** | Belongs in `packages/*` or `apps/api/src` (shared logic, API) |
| **(c)** | Dead / remove: stale duplicate `.js` next to `.ts`, or obsolete artifacts |

## Counts

| Category | Files |
| --- | ---: |
| (a) | 8 |
| (b) | 386 |
| (c) | 19 |

## Per-file manifest

| Path (under `src/`) | Tag | Intended home |
| --- | --- | --- |
| `bin/badge.ts` | (b) | packages/cli |
| `bin/design.ts` | (b) | packages/cli |
| `bin/fix.ts` | (b) | packages/cli |
| `bin/reality-check.ts` | (b) | packages/cli |
| `components/EmptyState.css` | (a) | apps/web-ui/src |
| `components/EmptyState.tsx` | (a) | apps/web-ui/src |
| `components/ErrorBoundary.css` | (a) | apps/web-ui/src |
| `components/ErrorBoundary.tsx` | (a) | apps/web-ui/src |
| `components/LoadingState.css` | (a) | apps/web-ui/src |
| `components/LoadingState.tsx` | (a) | apps/web-ui/src |
| `config/api-endpoints.ts` | (b) | apps/api/src/config (or shared config package) |
| `config/env.ts` | (b) | apps/api/src/config (or shared config package) |
| `lib/__tests__/accessibility-checker.simple.test.ts` | (b) | packages/core |
| `lib/__tests__/accessibility-checker.test.ts` | (b) | packages/core |
| `lib/__tests__/architect-agent.test.ts` | (b) | packages/core |
| `lib/__tests__/code-smell-predictor.test.ts` | (b) | packages/core |
| `lib/__tests__/codebase-knowledge.test.ts` | (b) | packages/core |
| `lib/__tests__/errors.test.ts` | (b) | packages/core |
| `lib/__tests__/natural-language-search.test.ts` | (b) | packages/core |
| `lib/__tests__/polish-service.test.ts` | (b) | packages/core |
| `lib/__tests__/production-anomaly-predictor.test.ts` | (b) | packages/core |
| `lib/__tests__/result-types.test.ts` | (b) | packages/core |
| `lib/__tests__/semantic-search-service.test.ts` | (b) | packages/core |
| `lib/__tests__/universal-guardrails.test.ts` | (b) | packages/core |
| `lib/accessibility-checker.ts` | (b) | packages/core |
| `lib/advanced-ai.ts` | (b) | packages/core |
| `lib/advanced-auto-fixer.ts` | (b) | packages/core |
| `lib/advanced-context-manager.d.ts` | (b) | packages/core |
| `lib/advanced-context-manager.d.ts.map` | (b) | packages/core |
| `lib/advanced-context-manager.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/advanced-context-manager.ts` | (b) | packages/core |
| `lib/ai-behavior-learner.ts` | (b) | packages/core |
| `lib/ai-co-architect.ts` | (b) | packages/core |
| `lib/ai-code-explainer.ts` | (b) | packages/core |
| `lib/ai-code-reviewer.ts` | (b) | packages/core |
| `lib/ai-pattern-learner.ts` | (b) | packages/core |
| `lib/ai-production-integrity.ts` | (b) | packages/core |
| `lib/ai/README.md` | (b) | packages/ai-guardrails |
| `lib/ai/ai-hub.ts` | (b) | packages/ai-guardrails |
| `lib/ai/bug-prediction.ts` | (b) | packages/ai-guardrails |
| `lib/ai/code-generator.ts` | (b) | packages/ai-guardrails |
| `lib/ai/contextual-recommendation-system.ts` | (b) | packages/ai-guardrails |
| `lib/ai/examples.ts` | (b) | packages/ai-guardrails |
| `lib/ai/index.ts` | (b) | packages/ai-guardrails |
| `lib/ai/install-dependencies.bat` | (b) | packages/ai-guardrails |
| `lib/ai/install-dependencies.sh` | (b) | packages/ai-guardrails |
| `lib/ai/learning-system.ts` | (b) | packages/ai-guardrails |
| `lib/ai/llm-provider-interface.ts` | (b) | packages/ai-guardrails |
| `lib/ai/package.json` | (b) | packages/ai-guardrails |
| `lib/ai/providers/anthropic-provider.ts` | (b) | packages/ai-guardrails |
| `lib/ai/providers/openai-provider.ts` | (b) | packages/ai-guardrails |
| `lib/ai/refactoring-engine.ts` | (b) | packages/ai-guardrails |
| `lib/ai/smart-code-analyzer.ts` | (b) | packages/ai-guardrails |
| `lib/analysis/__tests__/static-analyzer.test.ts` | (b) | packages/core |
| `lib/analysis/index.ts` | (b) | packages/core |
| `lib/analysis/llm-analyzer.ts` | (b) | packages/core |
| `lib/analysis/scan-service.ts` | (b) | packages/core |
| `lib/analysis/static-analyzer.ts` | (b) | packages/core |
| `lib/analytics.ts` | (b) | packages/core |
| `lib/anthropic-service.ts` | (b) | packages/core |
| `lib/api-endpoint-tracker.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/api-endpoint-tracker.ts` | (b) | packages/core |
| `lib/api-validator.ts` | (b) | packages/core |
| `lib/architect-agent.ts` | (b) | packages/core |
| `lib/architecture-drift-predictor.ts` | (b) | packages/core |
| `lib/auth-system.ts` | (b) | packages/core |
| `lib/auto-fixer.ts` | (b) | packages/core |
| `lib/auto-setup.ts` | (b) | packages/core |
| `lib/automated-reports.ts` | (b) | packages/core |
| `lib/batch-validator.ts` | (b) | packages/core |
| `lib/build-enforcer.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/build-enforcer.ts` | (b) | packages/core |
| `lib/cache-manager.d.ts` | (b) | packages/core |
| `lib/cache-manager.d.ts.map` | (b) | packages/core |
| `lib/cache-manager.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/cache-manager.ts` | (b) | packages/core |
| `lib/cache/query-optimizer.ts` | (b) | packages/core |
| `lib/cache/redis-cache-manager.ts` | (b) | packages/core |
| `lib/cdn/cdn-manager.ts` | (b) | packages/core |
| `lib/certification/badge-generator.ts` | (b) | packages/core |
| `lib/change-impact-analyzer.ts` | (b) | packages/core |
| `lib/change-impact.ts` | (b) | packages/core |
| `lib/change-tracker.d.ts` | (b) | packages/core |
| `lib/change-tracker.d.ts.map` | (b) | packages/core |
| `lib/change-tracker.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/change-tracker.ts` | (b) | packages/core |
| `lib/cli-utils.ts` | (b) | packages/core |
| `lib/cli/cache-manager.ts` | (b) | packages/cli |
| `lib/cli/output-contract.ts` | (b) | packages/cli |
| `lib/cli/verdict-formatter.ts` | (b) | packages/cli |
| `lib/code-context-generator.ts` | (b) | packages/core |
| `lib/code-evolution-tracker.ts` | (b) | packages/core |
| `lib/code-generation-validator.ts` | (b) | packages/core |
| `lib/code-generator.ts` | (b) | packages/core |
| `lib/code-health-score.ts` | (b) | packages/core |
| `lib/code-pattern-dna.d.ts` | (b) | packages/core |
| `lib/code-pattern-dna.d.ts.map` | (b) | packages/core |
| `lib/code-pattern-dna.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/code-pattern-dna.ts` | (b) | packages/core |
| `lib/code-relationship-visualizer.ts` | (b) | packages/core |
| `lib/code-smell-predictor.ts` | (b) | packages/core |
| `lib/codebase-knowledge.d.ts` | (b) | packages/core |
| `lib/codebase-knowledge.d.ts.map` | (b) | packages/core |
| `lib/codebase-knowledge.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/codebase-knowledge.ts` | (b) | packages/core |
| `lib/codebase-size.ts` | (b) | packages/core |
| `lib/command-aliases.ts` | (b) | packages/core |
| `lib/community-features.ts` | (b) | packages/core |
| `lib/component-registry.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/component-registry.ts` | (b) | packages/core |
| `lib/config-loader.ts` | (b) | packages/core |
| `lib/context-generator.ts` | (b) | packages/core |
| `lib/context-manager.ts` | (b) | packages/core |
| `lib/context/enhanced-context-engine.d.ts` | (b) | packages/core |
| `lib/context/enhanced-context-engine.d.ts.map` | (b) | packages/core |
| `lib/context/enhanced-context-engine.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/context/enhanced-context-engine.ts` | (b) | packages/core |
| `lib/cross-project-analyzer.ts` | (b) | packages/core |
| `lib/cross-repo-intelligence.ts` | (b) | packages/core |
| `lib/decision-tracker.ts` | (b) | packages/core |
| `lib/deep-context-agent.ts` | (b) | packages/core |
| `lib/dependency-analyzer.ts` | (b) | packages/core |
| `lib/dependency-impact-analyzer.ts` | (b) | packages/core |
| `lib/design-system-builder.ts` | (b) | packages/core |
| `lib/design-system-enforcer.ts` | (b) | packages/core |
| `lib/design-validator.ts` | (b) | packages/core |
| `lib/documentation-checker.ts` | (b) | packages/core |
| `lib/documentation-generator.ts` | (b) | packages/core |
| `lib/documentation-updater.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/documentation-updater.ts` | (b) | packages/core |
| `lib/duplicate-detector.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/duplicate-detector.ts` | (b) | packages/core |
| `lib/embedding-service.d.ts` | (b) | packages/core |
| `lib/embedding-service.d.ts.map` | (b) | packages/core |
| `lib/embedding-service.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/embedding-service.ts` | (b) | packages/core |
| `lib/enhanced-embedding-service.ts` | (b) | packages/core |
| `lib/enhanced-performance-monitor.ts` | (b) | packages/core |
| `lib/enhanced-team-collaboration.ts` | (b) | packages/core |
| `lib/entitlements.ts` | (b) | packages/core |
| `lib/env-validation.ts` | (b) | packages/core |
| `lib/env-validator.ts` | (b) | packages/core |
| `lib/error-enhancer.ts` | (b) | packages/core |
| `lib/error-recovery.ts` | (b) | packages/core |
| `lib/errors/index.ts` | (b) | packages/core |
| `lib/file-watcher.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/file-watcher.ts` | (b) | packages/core |
| `lib/framework-adapters/angular-adapter.ts` | (b) | packages/core |
| `lib/framework-adapters/backend-adapter.ts` | (b) | packages/core |
| `lib/framework-adapters/python-adapter.ts` | (b) | packages/core |
| `lib/framework-adapters/react-adapter.ts` | (b) | packages/core |
| `lib/framework-adapters/vue-adapter.ts` | (b) | packages/core |
| `lib/framework-detector.ts` | (b) | packages/core |
| `lib/framework-integration-manager.ts` | (b) | packages/core |
| `lib/github-integration.ts` | (b) | packages/core |
| `lib/hallucination-detector.ts` | (b) | packages/core |
| `lib/health-badge-generator.ts` | (b) | packages/core |
| `lib/health-checker.ts` | (b) | packages/core |
| `lib/integration-hub.ts` | (b) | packages/core |
| `lib/intelligence/cross-project-intelligence.ts` | (b) | packages/core |
| `lib/interactive-onboarding.ts` | (b) | packages/core |
| `lib/language-detector.ts` | (b) | packages/core |
| `lib/license-manager.ts` | (b) | packages/core |
| `lib/llm-orchestrator.ts` | (b) | packages/core |
| `lib/massive-repo-processor.ts` | (b) | packages/core |
| `lib/mcp-connector.ts` | (b) | packages/core |
| `lib/mcp/doctor.ts` | (b) | packages/cli |
| `lib/mcp/finding-explainer.ts` | (b) | packages/cli |
| `lib/mcp/index.ts` | (b) | packages/cli |
| `lib/mcp/policy-manager.ts` | (b) | packages/cli |
| `lib/mcp/sarif-generator.ts` | (b) | packages/cli |
| `lib/mcp/state-manager.ts` | (b) | packages/cli |
| `lib/mdc-generator/breaking-change-detector.ts` | (b) | packages/cli |
| `lib/mdc-generator/code-quality-analyzer.ts` | (b) | packages/cli |
| `lib/mdc-generator/hallucination-detector.ts` | (b) | packages/cli |
| `lib/mdc-generator/incremental-updater.ts` | (b) | packages/cli |
| `lib/mdc-generator/index.ts` | (b) | packages/cli |
| `lib/mdc-generator/intelligent-updater.ts` | (b) | packages/cli |
| `lib/mdc-generator/mdc-generator.ts` | (b) | packages/cli |
| `lib/mdc-generator/source-anchor.ts` | (b) | packages/cli |
| `lib/mdc-generator/test-coverage-mapper.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/__tests__/critical-invariants.test.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/__tests__/deterministic-pack-generator.test.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/__tests__/golden.test.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/__tests__/lane-router.test.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/change-aware-selector.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/critical-invariants.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/deterministic-pack-generator.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/index.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/lane-router.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/mdc-generator-v3.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/reality-scan-integration.ts` | (b) | packages/cli |
| `lib/mdc-generator/v3/truth-index-extractor.ts` | (b) | packages/cli |
| `lib/mdc-generator/verification-engine.ts` | (b) | packages/cli |
| `lib/migration-assistant.ts` | (b) | packages/core |
| `lib/ml-model.ts` | (b) | packages/core |
| `lib/mockproof/__tests__/import-graph-scanner.test.ts` | (b) | packages/core |
| `lib/mockproof/import-graph-scanner.d.ts` | (b) | packages/core |
| `lib/mockproof/import-graph-scanner.d.ts.map` | (b) | packages/core |
| `lib/mockproof/import-graph-scanner.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/mockproof/import-graph-scanner.ts` | (b) | packages/core |
| `lib/mockproof/index.ts` | (b) | packages/core |
| `lib/monitoring/sentry.ts` | (b) | packages/core |
| `lib/multi-source-verifier.ts` | (b) | packages/core |
| `lib/natural-language-cli.ts` | (b) | packages/core |
| `lib/natural-language-search.ts` | (b) | packages/core |
| `lib/openai-service.ts` | (b) | packages/core |
| `lib/optimization-engine.ts` | (b) | packages/core |
| `lib/orchestrator/index.ts` | (b) | packages/core |
| `lib/orchestrator/policy-engine.ts` | (b) | packages/core |
| `lib/orchestrator/secret-scanner.ts` | (b) | packages/core |
| `lib/orchestrator/semgrep-integration.ts` | (b) | packages/core |
| `lib/orchestrator/supply-chain-integration.ts` | (b) | packages/core |
| `lib/path-validator.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/path-validator.ts` | (b) | packages/core |
| `lib/pattern-library.ts` | (b) | packages/core |
| `lib/performance-monitor.ts` | (b) | packages/core |
| `lib/performance-optimizer.ts` | (b) | packages/core |
| `lib/platform-detector.ts` | (b) | packages/core |
| `lib/platform-plugins.ts` | (b) | packages/core |
| `lib/polish/checkers/accessibility-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/backend-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/configuration-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/documentation-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/frontend-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/infrastructure-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/performance-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/security-checker.ts` | (b) | packages/core |
| `lib/polish/checkers/seo-checker.ts` | (b) | packages/core |
| `lib/polish/polish-service.ts` | (b) | packages/core |
| `lib/polish/types.ts` | (b) | packages/core |
| `lib/polish/utils.ts` | (b) | packages/core |
| `lib/predeploy-checker.ts` | (b) | packages/core |
| `lib/predictive-quality.ts` | (b) | packages/core |
| `lib/predictive-refactorer.ts` | (b) | packages/core |
| `lib/production-anomaly-predictor.ts` | (b) | packages/core |
| `lib/project-growth.ts` | (b) | packages/core |
| `lib/project-healer.ts` | (b) | packages/core |
| `lib/project-health.ts` | (b) | packages/core |
| `lib/real-time-validator.ts` | (b) | packages/core |
| `lib/reality-check-service.ts` | (b) | packages/core |
| `lib/reality-mode/ai-agent/agent-runner.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/ai-agent/fix-suggestions.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/ai-agent/index.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/ai-agent/openai-provider.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/ai-agent/types.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/auth-enforcer.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/enhanced-runner.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/fake-success-detector.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/index.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/project-detector.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/reality-scanner.d.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/reality-scanner.d.ts.map` | (b) | packages/ai-guardrails |
| `lib/reality-mode/reality-scanner.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/reality-mode/reality-scanner.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/report-generator.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/test-flows.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/traffic-classifier.ts` | (b) | packages/ai-guardrails |
| `lib/reality-mode/types.ts` | (b) | packages/ai-guardrails |
| `lib/reality-sniff/README.md` | (b) | packages/core |
| `lib/reality-sniff/ast-verifier.ts` | (b) | packages/core |
| `lib/reality-sniff/config-truth-detector.ts` | (b) | packages/core |
| `lib/reality-sniff/index.ts` | (b) | packages/core |
| `lib/reality-sniff/reality-proof-graph.ts` | (b) | packages/core |
| `lib/reality-sniff/reality-sniff-scanner.ts` | (b) | packages/core |
| `lib/reality-sniff/replay-engine.ts` | (b) | packages/core |
| `lib/reality-sniff/route-reality-checker.ts` | (b) | packages/core |
| `lib/realtime-quality-guardian.ts` | (b) | packages/core |
| `lib/refactoring-automation.ts` | (b) | packages/core |
| `lib/response-style-examples.md` | (b) | packages/core |
| `lib/response-style-service.ts` | (b) | packages/core |
| `lib/route-integrity/ast/file-scanner.ts` | (b) | packages/core |
| `lib/route-integrity/ast/link-extractor.ts` | (b) | packages/core |
| `lib/route-integrity/discovery/project-discovery.ts` | (b) | packages/core |
| `lib/route-integrity/graph/navigation-graph.ts` | (b) | packages/core |
| `lib/route-integrity/index.ts` | (b) | packages/core |
| `lib/route-integrity/normalization/route-normalizer.ts` | (b) | packages/core |
| `lib/route-integrity/orchestrator.ts` | (b) | packages/core |
| `lib/route-integrity/reality/playwright-crawler.ts` | (b) | packages/core |
| `lib/route-integrity/reporting/report-generator.ts` | (b) | packages/core |
| `lib/route-integrity/truth/framework-adapters/index.ts` | (b) | packages/core |
| `lib/route-integrity/truth/framework-adapters/next-adapter.ts` | (b) | packages/core |
| `lib/route-integrity/truth/framework-adapters/react-router-adapter.ts` | (b) | packages/core |
| `lib/route-integrity/tsconfig.json` | (b) | packages/core |
| `lib/route-integrity/types.ts` | (b) | packages/core |
| `lib/route-integrity/verdict/verdict-engine.ts` | (b) | packages/core |
| `lib/rule-suggester.ts` | (b) | packages/core |
| `lib/scaling/auto-scaling-manager.ts` | (b) | packages/core |
| `lib/security-scanner-enhanced.ts` | (b) | packages/core |
| `lib/security-scanner.ts` | (b) | packages/core |
| `lib/security/incident-response.ts` | (b) | packages/security |
| `lib/security/ip-utils.ts` | (b) | packages/security |
| `lib/security/security-scanner.ts` | (b) | packages/security |
| `lib/security/threat-detection.test.ts` | (b) | packages/security |
| `lib/security/threat-detection.ts` | (b) | packages/security |
| `lib/security/zero-trust-engine.ts` | (b) | packages/security |
| `lib/semantic-search-service.ts` | (b) | packages/core |
| `lib/semantic-search.ts` | (b) | packages/core |
| `lib/semantic-vibe-analyzer.ts` | (b) | packages/core |
| `lib/ship-badge/__tests__/ship-badge-generator.test.ts` | (b) | packages/ship |
| `lib/ship-badge/index.ts` | (b) | packages/ship |
| `lib/ship-badge/ship-badge-generator.d.ts` | (b) | packages/ship |
| `lib/ship-badge/ship-badge-generator.d.ts.map` | (b) | packages/ship |
| `lib/ship-badge/ship-badge-generator.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/ship-badge/ship-badge-generator.ts` | (b) | packages/ship |
| `lib/ship/index.ts` | (b) | packages/ship |
| `lib/ship/run-manager.ts` | (b) | packages/ship |
| `lib/ship/ship-engine.ts` | (b) | packages/ship |
| `lib/smart-file-filter.ts` | (b) | packages/core |
| `lib/strict-env.ts` | (b) | packages/core |
| `lib/strictness-config.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/strictness-config.ts` | (b) | packages/core |
| `lib/stripe-service.ts` | (b) | packages/core |
| `lib/subscription-tiers.ts` | (b) | packages/core |
| `lib/suites/ai-intelligence-suite.ts` | (b) | packages/core |
| `lib/suites/architecture-health-suite.ts` | (b) | packages/core |
| `lib/suites/index.ts` | (b) | packages/core |
| `lib/suites/predictive-analytics-suite.ts` | (b) | packages/core |
| `lib/suites/security-suite.ts` | (b) | packages/core |
| `lib/suites/supply-chain-suite.ts` | (b) | packages/core |
| `lib/suites/team-intelligence-suite.ts` | (b) | packages/core |
| `lib/team-collaboration.ts` | (b) | packages/core |
| `lib/team-knowledge-graph.ts` | (b) | packages/core |
| `lib/template-applier.ts` | (b) | packages/core |
| `lib/template-generator.ts` | (b) | packages/core |
| `lib/temporal-code-intelligence.ts` | (b) | packages/core |
| `lib/test-generator.ts` | (b) | packages/core |
| `lib/types/advanced-ai.ts` | (b) | packages/core |
| `lib/types/advanced-context.d.ts` | (b) | packages/core |
| `lib/types/advanced-context.d.ts.map` | (b) | packages/core |
| `lib/types/advanced-context.js` | (c) | remove duplicate .js after migration (keep .ts only) |
| `lib/types/advanced-context.ts` | (b) | packages/core |
| `lib/types/common.ts` | (b) | packages/core |
| `lib/types/framework.ts` | (b) | packages/core |
| `lib/types/github.ts` | (b) | packages/core |
| `lib/types/health-score.ts` | (b) | packages/core |
| `lib/types/llm-orchestrator.ts` | (b) | packages/core |
| `lib/types/pattern-learner.ts` | (b) | packages/core |
| `lib/types/result.ts` | (b) | packages/core |
| `lib/universal-guardrails.ts` | (b) | packages/core |
| `lib/usage-analytics.ts` | (b) | packages/core |
| `lib/usage-tracker.ts` | (b) | packages/core |
| `lib/vector-store.ts` | (b) | packages/core |
| `lib/verification/__tests__/command-safety.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/command-tooling.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/diff-validator.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/format-validator.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/path-validator.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/pipeline.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/secret-detector.test.ts` | (b) | packages/core |
| `lib/verification/__tests__/stub-detector.test.ts` | (b) | packages/core |
| `lib/verification/checks/command-safety.ts` | (b) | packages/core |
| `lib/verification/checks/command-tooling.ts` | (b) | packages/core |
| `lib/verification/checks/diff-validator.ts` | (b) | packages/core |
| `lib/verification/checks/index.ts` | (b) | packages/core |
| `lib/verification/checks/path-validator.ts` | (b) | packages/core |
| `lib/verification/checks/secret-detector.ts` | (b) | packages/core |
| `lib/verification/checks/stub-detector.ts` | (b) | packages/core |
| `lib/verification/exec-utils.ts` | (b) | packages/core |
| `lib/verification/failure-context.ts` | (b) | packages/core |
| `lib/verification/format-validator.ts` | (b) | packages/core |
| `lib/verification/index.ts` | (b) | packages/core |
| `lib/verification/pipeline.ts` | (b) | packages/core |
| `lib/verification/repo-fingerprint.ts` | (b) | packages/core |
| `lib/verification/scope-lock.ts` | (b) | packages/core |
| `lib/verification/types.ts` | (b) | packages/core |
| `lib/verification/workspace.ts` | (b) | packages/core |
| `lib/vibecoder-detector.ts` | (b) | packages/core |
| `lib/watch-validator.ts` | (b) | packages/core |
| `lib/web-search.ts` | (b) | packages/core |
| `lib/worker-pool.ts` | (b) | packages/core |
| `lib/workflow-sandbox.ts` | (b) | packages/core |
| `lib/workflow-versioning.ts` | (b) | packages/core |
| `pages/NotFound.css` | (a) | apps/web-ui/src |
| `pages/NotFound.tsx` | (a) | apps/web-ui/src |
| `server/__tests__/ai-explainer.test.ts` | (b) | apps/api/src |
| `server/__tests__/code-search-service.test.ts` | (b) | apps/api/src |
| `server/__tests__/integration/api.test.ts` | (b) | apps/api/src |
| `server/__tests__/mock-data-scanner.test.ts` | (b) | apps/api/src |
| `server/index.ts` | (b) | apps/api/src |
| `server/middleware/__tests__/auth-rate-limiter.test.ts` | (b) | apps/api/src |
| `server/middleware/auth-rate-limiter.ts` | (b) | apps/api/src |
| `server/middleware/auth.ts` | (b) | apps/api/src |
| `server/middleware/enhanced-auth.ts` | (b) | apps/api/src |
| `server/middleware/enhanced-error-handler.ts` | (b) | apps/api/src |
| `server/middleware/enhanced-validation.ts` | (b) | apps/api/src |
| `server/middleware/security.ts` | (b) | apps/api/src |
| `server/services/ai-explainer.ts` | (b) | apps/api/src |
| `server/services/ast-parsing-service.ts` | (b) | apps/api/src |
| `server/services/auth-service.ts` | (b) | apps/api/src |
| `server/services/code-evolution-service.ts` | (b) | apps/api/src |
| `server/services/code-relationships-service.ts` | (b) | apps/api/src |
| `server/services/code-search-service.ts` | (b) | apps/api/src |
| `server/services/database-service.ts` | (b) | apps/api/src |
| `server/services/dependency-analyzer-service.ts` | (b) | apps/api/src |
| `server/services/enhanced-ai-service.ts` | (b) | apps/api/src |
| `server/services/enhanced-api-validator.ts` | (b) | apps/api/src |
| `server/services/enhanced-code-search-service.ts` | (b) | apps/api/src |
| `server/services/enhanced-metrics-service.ts` | (b) | apps/api/src |
| `server/services/enhanced-websocket-service.ts` | (b) | apps/api/src |
| `server/services/git-history-service.ts` | (b) | apps/api/src |
| `server/services/github-api-service.ts` | (b) | apps/api/src |
| `server/services/metrics-service.ts` | (b) | apps/api/src |
| `server/services/mock-data-scanner.ts` | (b) | apps/api/src |
| `server/services/predictive-quality-service.ts` | (b) | apps/api/src |
| `server/services/production-predictor-service.ts` | (b) | apps/api/src |
| `server/services/project-analyzer.ts` | (b) | apps/api/src |
| `server/services/realtime-quality-service.ts` | (b) | apps/api/src |
| `server/services/websocket-service.ts` | (b) | apps/api/src |
| `server/start.ts` | (b) | apps/api/src |
| `services/__tests__/auth-service.test.ts` | (b) | apps/api/src |
| `services/auth-service.ts` | (b) | apps/api/src |
| `services/project-service.ts` | (b) | apps/api/src |

---
*Regenerate: `node scripts/generate-source-map.mjs`*
