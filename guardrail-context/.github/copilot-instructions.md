# Guardrail Context Engine - Repository Instructions

This repository has a Truth Pack at `.guardrail-context/` with verified facts.

## Before Writing Code
1. Check `.guardrail-context/symbols.json` before using any function/component
2. Check `.guardrail-context/deps.json` before suggesting package usage
3. Check `.guardrail-context/patterns.json` for the correct patterns to follow

## Hard Rules
- ❌ NEVER claim a symbol exists unless it's in symbols.json
- ❌ NEVER suggest a package unless it's in deps.json
- ❌ NEVER invent API endpoints - check the codebase first
- ✅ ALWAYS follow existing patterns from patterns.json
- ✅ ALWAYS run `guardrail-context verify` after changes

## After Making Changes
Run: `guardrail-context verify`
Fix any failures before finalizing.
