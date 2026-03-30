# Setting Up npm Scope for Publishing

## Current Status
- **Logged in as**: `guardrailai`
- **Desired scope**: `@guardrail`
- **Package names**: 
  - `@guardrail/cli`
  - `guardrail-mcp-server` (unscoped)

## Options

### Option 1: Use Your Username Scope (Easiest)
Change to use your username scope `@guardrailai`:
- `@guardrailai/cli`
- `guardrail-mcp-server` (can stay unscoped)

### Option 2: Create/Join `guardrail` Organization
1. Go to https://www.npmjs.com/org/create
2. Create organization named `guardrail`
3. Add your account as owner
4. Then you can publish `@guardrail/cli`

### Option 3: Use Unscoped Names
- `guardrail-cli`
- `guardrail-mcp-server`

## Recommendation

Since you're logged in as `guardrailai`, the easiest is **Option 1**:
- Use `@guardrailai/cli` (your username scope - automatically available)
- Keep `guardrail-mcp-server` as is (unscoped)

This requires no organization setup and works immediately.
