# guardrail Context Engine

A repo-installed Context OS that exposes verified repo facts + patterns + constraints as tool calls, so Cursor/Windsurf/Copilot can't "invent reality" and can move faster with less prompt weight.

## One directory, one Truth Pack

The **Truth Pack** always lives under **`.guardrail-context/`** at the repo root. It does not matter whether you build it with:

- **`guardrail-context index`** (this package’s CLI), or  
- **`guardrail scan --with-context`** from the main **Guardrail** monorepo CLI (which uses the same `TruthPackGenerator` and the same files).

Same folder, same JSON artifacts (`truthpack.json`, `symbols.json`, `routes.json`, `deps.json`, `graph.json`, …). Use **guardrail-context** when you want MCP tools and verification gates; use **guardrail scan** when you want Reality Sniff + proof with optional indexing in one flow. The **guardrail scan** command also **weights findings** using symbol/route/`importance.json` data when that directory is present—no extra flag required once the index exists.

## Quick Start

```bash
# Install globally or use npx
npm install -g @guardrail/context

# Initialize in your project
guardrail-context init

# Build the Truth Pack
guardrail-context index

# Start MCP server (for Cursor)
guardrail-context serve

# Run verification gates
guardrail-context verify
```

## What It Does

### Layer 0 — Tiny Rules (Policy Layer)
Thin rules files that tell agents:
- "Before coding, call `repo.map` + `patterns.pick`"
- "Never claim an API exists without `symbols.exists`"
- "Never add deps without `versions.allowed`"
- "After changes, run `verify.fast`"

### Layer 1 — Truth Pack (Indexed Facts)
Generates into `.guardrail-context/`:
- `symbols.json` - All exports, functions, types, routes
- `deps.json` - package.json + lockfile truth
- `graph.json` - Import/call edges
- `risk.json` - Auth/payments/migrations/infra tags
- `importance.json` - Risk × centrality scores
- `patterns/` - Golden patterns + verified examples

### Layer 2 — MCP Server (Tool Access)
Exposes tools for Cursor/Windsurf/Copilot:
- `repo.map()` - Architecture + boundaries
- `symbols.exists(name)` - Blocks hallucinated APIs
- `symbols.find(name)` - Definition + callers
- `versions.allowed(pkg)` - Blocks version hallucinations
- `graph.related(file)` - What it touches
- `patterns.pick(intent)` - Best golden pattern
- `verify.fast()` - Run verification gates

### Layer 3 — Verification Gates
- Scope drift check
- Symbol reality check (catch hallucinated imports)
- Version constraint check
- Fast lint/typecheck/tests

## MCP Tools

| Tool | Purpose |
|------|---------|
| `repo.map` | Get architecture, stack, boundaries |
| `symbols.exists` | Check if symbol exists (blocks hallucinations) |
| `symbols.find` | Find symbol definition + location |
| `versions.allowed` | Check if package version is allowed |
| `graph.related` | Get files related by imports |
| `patterns.pick` | Get golden pattern for intent |
| `verify.fast` | Run fast verification gates |

## Commands

```bash
guardrail-context init     # Install rules/workflows
guardrail-context index    # Build Truth Pack
guardrail-context serve    # Start MCP server
guardrail-context verify   # Run verification gates
guardrail-context doctor   # Diagnose issues
```

## License

MIT
