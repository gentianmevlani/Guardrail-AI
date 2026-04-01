# Package Name Options

## Current Situation
- You want: `@guardrail/cli` and `guardrail-mcp-server`
- Currently logged in as: `guardrailai`
- `guardrail-mcp-server@2.0.1` is already published ✅

## Options

### Option 1: Create `guardrail` Organization (Recommended)
To use `@guardrail/cli`:

1. Go to: https://www.npmjs.com/org/create
2. Create organization named `guardrail`
3. Add your `guardrailai` account as owner
4. Then we can publish `@guardrail/cli`

**After creating org, we'll update:**
- `@guardrail/cli@2.5.2`

### Option 2: Use Unscoped Names (Current)
- `guardrail-cli@2.5.2` ✅ Ready
- `guardrail-mcp-server@2.0.1` ✅ Already published

### Option 3: Unpublish and Republish
If `guardrail-cli` is taken, we can:
1. Unpublish `@guardrailai/cli@2.5.1` (if needed)
2. Create `guardrail` org
3. Publish `@guardrail/cli`

## Recommendation

**Create the `guardrail` organization** so you can use:
- `@guardrail/cli` (scoped, professional)
- `guardrail-mcp-server` (already published, keep as is)

This gives you the clean package names you want.

## Next Steps

1. Create org at: https://www.npmjs.com/org/create
2. Let me know when it's created
3. I'll update package.json and republish
