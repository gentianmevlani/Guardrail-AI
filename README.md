# Guardrail — Enterprise AI Code Safety

> **Powered by VibeCheck engines.**

Guardrail is the enterprise-grade AI code safety platform built on top of [VibeCheck](https://github.com/your-org/vibecheck)'s battle-tested scan engine layer. It adds RBAC, compliance dashboards, audit trails, SSO, 5-tier billing, and a full LLM safety pipeline on top of VibeCheck's 16 code analysis engines.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    GUARDRAIL — Enterprise Layer                      │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ @guardrail/  │  │ @guardrail/  │  │ @guardrail/  │  │ @guardrail│ │
│  │    cli       │  │ llm-safety   │  │    core      │  │  /billing │ │
│  │              │  │              │  │              │  │           │ │
│  │ • scan       │  │ INPUT:       │  │ • Engine     │  │ • 5-tier  │ │
│  │ • guard      │  │  Content     │  │   Adapter    │  │   plans   │ │
│  │ • score      │  │  PII         │  │ • Enterprise │  │ • Entitle │ │
│  │ • audit      │  │  Schema      │  │   Types      │  │   ments   │ │
│  │ • status     │  │              │  │ • RBAC       │  │ • Stripe  │ │
│  │              │  │ OUTPUT:      │  │ • Compliance │  │           │ │
│  │              │  │  Toxicity    │  │ • Audit      │  │           │ │
│  │              │  │  PII Leak    │  │ • SSO        │  │           │ │
│  │              │  │  Grounding   │  │              │  │           │ │
│  │              │  │              │  │ 4 EXCLUSIVE  │  │           │ │
│  │              │  │ BEHAVIORAL:  │  │ ENGINES:     │  │           │ │
│  │              │  │  Rate Limit  │  │ • ErrorHandl │  │           │ │
│  │              │  │  Tool Policy │  │ • Incomplete │  │           │ │
│  │              │  │  Conv Bounds │  │ • LogicGap   │  │           │ │
│  │              │  │  CoT Monitor │  │ • OutcomeVer │  │           │ │
│  │              │  │              │  │              │  │           │ │
│  │              │  │ PROCESS:     │  │              │  │           │ │
│  │              │  │  Review Gate │  │              │  │           │ │
│  │              │  │  Kill Switch │  │              │  │           │ │
│  │              │  │  Escalation  │  │              │  │           │ │
│  │              │  │  Red Team    │  │              │  │           │ │
│  │              │  │  Eval Suite  │  │              │  │           │ │
│  │              │  │  Monitoring  │  │              │  │           │ │
│  └─────────────┘  └──────────────┘  └──────────────┘  └──────────┘ │
├──────────────────────────────────────────────────────────────────────┤
│                    VIBECHECK — Engine Layer                           │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ @vibecheck/engines  (16 scan engines)                          │ │
│  │                                                                 │ │
│  │  DEFAULT:  DeadCode • OverEngineering • CopiedCode             │ │
│  │  CONTEXT:  APITruth • PhantomDep • VersionHallucination        │ │
│  │            EnvVar • GhostRoute • Credentials • Security        │ │
│  │            FakeFeatures • RuntimeProbe                          │ │
│  │  POLISH:   TypeCoercion • ResourceLeak • AsyncMisuse           │ │
│  │            BoundaryValidation • ConfigDrift • StyleConsistency  │ │
│  │            DependencyHealth                                     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ @vibecheck/core  (types, trust score, telemetry, registry)     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@guardrail/core` | Engine adapter wrapping VibeCheck + enterprise types (RBAC, compliance, billing) + 4 exclusive engines |
| `@guardrail/cli` | CLI with `scan`, `guard`, `score`, `audit`, `status` commands |
| `@guardrail/llm-safety` | Runtime LLM guardrails — engines, SDK, middleware adapters, optional API server |
| `@vibecheck/core` | *(upstream)* Engine types, trust score, telemetry |
| `@vibecheck/engines` | *(upstream)* 16 code analysis scan engines |

## Quick Start

```bash
# Install dependencies (links VibeCheck workspace)
pnpm install

# Scan a project
pnpm scan

# Guard (CI/CD gate — exits non-zero on policy violations)
pnpm guard

# Build all packages
pnpm build
```

## CLI Usage

```bash
# Scan files with all 20 engines
guardrail scan ./src

# Guard mode — block on policy violations (for CI/CD)
guardrail guard ./src --block-threshold 1

# Score — compute trust score
guardrail score ./src

# Filter by severity
guardrail scan ./src --min-severity high

# Select specific engines
guardrail scan ./src --engines credentials,security,error_handling

# JSON output
guardrail scan ./src --format json
```

## LLM runtime guardrails (`@guardrail/llm-safety`)

```typescript
import { Guardrail } from '@guardrail/llm-safety';

const gr = await Guardrail.create();

const input = await gr.checkInput({ input: userPrompt });
if (input.verdict === 'fail') {
  console.log('Input blocked:', input.results);
}

const modelOut = await llm.complete(userPrompt);

const output = await gr.checkOutput({ output: modelOut });
if (output.verdict === 'fail') {
  console.log('Output blocked:', output.results);
}

await gr.shutdown();
```

## 20 Scan Engines

### VibeCheck Engines (16)
| Engine | Description |
|--------|-------------|
| `dead_code` | Detects unused functions, variables, imports |
| `over_engineering` | Flags unnecessary complexity |
| `copied_code` | Identifies copy-paste patterns |
| `api_truth` | Validates API endpoint usage |
| `phantom_dep` | Detects missing/undeclared dependencies |
| `version_hallucination` | Catches hallucinated package versions |
| `env_var` | Validates environment variable usage |
| `ghost_route` | Finds routes with no handlers |
| `credentials` | Detects hardcoded secrets and API keys |
| `security` | Scans for security vulnerabilities |
| `fake_features` | Detects feature flags with no implementation |
| `runtime_probe` | Runtime behavior analysis |
| `type_coercion` | Unsafe type coercion patterns |
| `resource_leak` | Unclosed handles, streams, connections |
| `async_misuse` | Async/await anti-patterns |
| `boundary_validation` | Input/output boundary checks |

### Guardrail-Exclusive Engines (4)
| Engine | Description |
|--------|-------------|
| `error_handling` | Missing try/catch, unhandled promise rejections |
| `incomplete_impl` | TODOs, stubs, placeholder code |
| `logic_gap` | Missing default cases, unchecked nulls |
| `outcome_verification` | Code behavior vs. documented intent |

## Billing Tiers

| Tier | Code Engines | AI Safety | Enterprise |
|------|-------------|-----------|------------|
| **Starter** | 5 basic | — | — |
| **Pro** | All 20 | Basic input/output | — |
| **Team** | All 20 + priority | Full pipeline | Team management |
| **Business** | All 20 + custom | Full + Red Team | RBAC, SSO, audit |
| **Enterprise** | Unlimited + custom | Full + custom | Full compliance, SLA |

## Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Type check
pnpm lint
```

## License

Proprietary. All rights reserved.

---

*Guardrail — Enterprise AI Code Safety. Powered by VibeCheck engines.*
