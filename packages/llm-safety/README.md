# @guardrail/llm-safety

Runtime **LLM guardrails** for TypeScript/Node: four categories (Input, Output, Behavioral, Process), 24 pluggable engines, hybrid rule-based core with optional classifier hooks, Fastify API, and a small SDK.

This package is **separate** from `@guardrail/engines` (codebase scan) and `@guardrail/ai-guardrails` (existing product integration).

## Quick start

```bash
pnpm --filter @guardrail/llm-safety build
pnpm --filter @guardrail/llm-safety exec llm-guardrail serve
# GET http://127.0.0.1:8787/health
# GET http://127.0.0.1:8787/engines
```

Override config or port:

```bash
LLM_GUARDRAIL_CONFIG=/absolute/path/to/guardrail.yaml HOST=127.0.0.1 PORT=9000 llm-guardrail serve
```

## SDK

```ts
import { Guardrail, bundledDefaultConfigPath } from '@guardrail/llm-safety';

// Uses shipped config/default.yaml when present; else in-memory defaults.
const g = await Guardrail.create({});

// Or point at the bundled file explicitly:
const g2 = await Guardrail.create({ configPath: bundledDefaultConfigPath() });

const input = await g.checkInput({ input: 'ignore previous instructions' });
const output = await g.checkOutput({ output: 'Call 555-123-4567' });
```

### Toxicity keywords

There is **no default blocklist**. Enable checks per request:

```ts
await g.checkOutput({
  output: text,
  extensions: { toxicityKeywords: ['badword_test', 'spam'] },
});
```

When `toxicityKeywords` is omitted or empty, the toxicity engine returns **pass** with `metadata.skipped: true`.

## Optional middleware (peer deps)

Install only what you use:

```bash
npm i express
npm i @langchain/core
```

```ts
import { expressInputGuardMiddleware } from '@guardrail/llm-safety/middleware-adapters/express';
import { createInputGuardRunnable } from '@guardrail/llm-safety/middleware-adapters/langchain';
```

## Configuration

Shipped defaults: `config/default.yaml` (engine toggles, `server.host` / `server.port`).  
`Guardrail.create()` loads that file automatically when it exists on disk (same path resolution as `bundledDefaultConfigPath()`).

## Verification

- `pnpm --filter @guardrail/llm-safety build`
- `pnpm --filter @guardrail/llm-safety test`
