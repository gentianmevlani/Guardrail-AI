# 🛡️ Strictness Control System

## Quick Start

Control how strict your AI agent and build process should be with visual toggles and simple commands.

### In UI (Easiest)
1. Open Vibecoder Dashboard
2. Click "Strictness" tab
3. Choose a preset or customize rules
4. Build will automatically enforce your settings

### Via CLI
```bash
# Set strictness level
guardrail strictness set moderate

# Show current settings
guardrail strictness show

# Test build
guardrail strictness test
```

### Via Natural Language
```bash
guardrail "set strictness to strict"
guardrail "make it more strict"
guardrail "show strictness settings"
```

## Preset Levels

- **😌 Relaxed** - Build passes with warnings
- **⚖️ Moderate** - Blocks errors, allows warnings (Recommended)
- **🛡️ Strict** - Blocks errors and warnings
- **🔒 Maximum** - Everything must be perfect

## Key Features

✅ **Visual Toggles** - Easy-to-use UI with clear descriptions  
✅ **Build Enforcement** - Automatically blocks builds based on rules  
✅ **Pre-Commit Integration** - Prevents bad commits  
✅ **Customizable** - Toggle individual rules  
✅ **Natural Language** - Talk to guardrail about strictness  

## Example

```bash
# Set to strict mode
guardrail strictness set strict

# Try to build
npm run build

# ❌ Build blocked: 3 ESLint error(s), 1 TypeScript error(s)
# Fix the issues above before building.
```

---

**Make your AI agent work exactly how you want!** 🎯

