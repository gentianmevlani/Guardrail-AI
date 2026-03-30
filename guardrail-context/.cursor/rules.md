# Cursor Rules - guardrail Context Engine

This repo has a Truth Pack at `.guardrail-context/`.

## Before Coding
- Check symbols.json for available functions/components
- Check deps.json for installed packages
- Check patterns.json for correct patterns

## MCP Tools Available
- repo_map() - Architecture overview
- symbols_exists(name) - Verify symbol exists
- versions_allowed(pkg) - Verify package installed
- patterns_pick(intent) - Get golden pattern
- verify_fast() - Run verification

## Hard Rules
1. NEVER invent symbols - verify with symbols_exists first
2. NEVER suggest packages not in deps.json
3. ALWAYS use patterns from patterns.json
4. ALWAYS run verify after changes

## After Coding
Run: `guardrail-context verify`
