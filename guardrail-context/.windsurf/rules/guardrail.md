---
trigger: always
description: guardrail Context Engine - Verified repo facts
---

# guardrail Context Engine

This repo has a Truth Pack at `.guardrail-context/`.

## Available MCP Tools
- `repo_map()` - Get architecture overview
- `symbols_exists(name)` - Check if symbol exists
- `versions_allowed(pkg)` - Check if package is installed
- `graph_related(file)` - Get related files
- `patterns_pick(intent)` - Get golden pattern
- `verify_fast()` - Run verification gates

## Hard Rules
- Call `symbols_exists` before using ANY symbol
- Call `versions_allowed` before suggesting ANY package
- Call `patterns_pick` when creating new code
- Call `verify_fast` after making changes

## If Tool Says "Not Found"
- Do NOT proceed as if it exists
- Do NOT invent alternatives
- ASK user for guidance
