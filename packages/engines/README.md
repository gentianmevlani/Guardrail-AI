# @guardrail/engines

Detection engines for Guardrail — catches AI hallucinations, phantom dependencies, ghost routes, credentials, security vulnerabilities, and more.

## Engines

| Engine | ID | What It Catches |
|--------|-----|----------------|
| **GhostRouteEngine** | `ghost_route` | API routes called but never defined |
| **PhantomDepEngine** | `phantom_dep` | Imports of packages that don't exist on npm |
| **APITruthEngine** | `api_truth` | SDK method calls that don't exist |
| **VersionHallucinationEngine** | `version_hallucination` | Fabricated version numbers |
| **EnvVarEngine** | `env_var` | `process.env` references not defined in .env |
| **CredentialsEngine** | `credentials` | Hardcoded API keys, secrets, tokens |
| **SecurityEngine** | `security` | SQL injection, XSS, SSRF, and more |
| **FakeFeaturesEngine** | `fake_features` | Mock/stub code in production |
| **SecurityPatternEngine** | `security` | Security anti-patterns |
| **PerformanceAntipatternEngine** | `performance` | Performance issues |
| **RuntimeProbeEngine** | `runtime_probe` | Runtime verification |
| **TypeContractEngine** | `type_contract` | Type/contract validation |

## Usage

```typescript
import {
  EngineRegistry,
  createDefaultRegistry,
  PhantomDepEngine,
  SecurityEngine,
  GhostRouteEngine,
} from '@guardrail/engines';

// Create registry with default engines
const registry = createDefaultRegistry();

// Add additional engines
registry.register(new PhantomDepEngine(workspaceRoot), { priority: 10 });
registry.register(new SecurityEngine(), { priority: 20 });

// Scan a file
const delta = {
  documentUri: 'file:///project/src/index.ts',
  documentLanguage: 'typescript',
  fullText: sourceCode,
  changedRanges: [{ start: 0, end: sourceCode.length }],
  changedText: sourceCode,
};

const signal = new AbortController().signal;
for (const slot of registry.getActive()) {
  const { findings } = await registry.runEngine(slot, delta, signal);
  console.log(`${slot.engine.id}: ${findings.length} findings`);
}
```

## Build

```bash
pnpm install
pnpm build
```

## License

MIT
