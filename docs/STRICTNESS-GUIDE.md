# Strictness Settings Guide

## 🛡️ Control Your AI Agent's Strictness

guardrail AI lets you control exactly how strict your AI agent and build process should be.

## 🎯 Quick Presets

### 😌 Relaxed
**Best for:** Learning, prototyping, early development

- ✅ Build blocks on errors only
- ❌ Warnings allowed
- ❌ Lint errors allowed
- ❌ Type errors allowed
- ❌ Tests not required

**Use when:** You want to move fast and fix issues later.

### ⚖️ Moderate (Recommended)
**Best for:** Most projects, balanced approach

- ✅ Build blocks on errors
- ✅ Build blocks on lint errors
- ✅ Build blocks on type errors
- ❌ Warnings allowed
- ✅ Type safety required
- ✅ Pre-commit blocks on lint errors

**Use when:** You want quality without being too strict.

### 🛡️ Strict
**Best for:** Production code, team projects

- ✅ Build blocks on errors AND warnings
- ✅ Build blocks on lint errors
- ✅ Build blocks on type errors
- ✅ Tests required
- ✅ Documentation required
- ✅ All quality checks enabled

**Use when:** You want high quality code.

### 🔒 Maximum
**Best for:** Critical systems, enterprise code

- ✅ Everything must be perfect
- ✅ All errors and warnings block build
- ✅ Tests required
- ✅ Documentation required
- ✅ All optimizations required
- ✅ All security checks enabled

**Use when:** Code quality is non-negotiable.

## 🎛️ Custom Rules

You can customize individual rules:

### Build & Compilation
- **Block build on errors** - Build fails if there are any errors
- **Block build on warnings** - Build fails if there are warnings
- **Block build on ESLint errors** - Build fails if ESLint finds errors
- **Block build on TypeScript errors** - Build fails if TypeScript finds errors

### Code Quality
- **Require tests** - Code must have tests before building
- **Require documentation** - Functions must be documented
- **Require type safety** - All code must be typed
- **Block "any" types** - Prevent use of "any" type

### API & Data
- **Block mock data** - Prevent use of fake/mock data
- **Require real endpoints** - Only use registered API endpoints
- **Validate API calls** - Validate all API calls

### Security
- **Require input validation** - All inputs must be validated
- **Require auth checks** - Protected routes must check auth
- **Block security issues** - Block known security vulnerabilities

### Pre-Commit
- **Block on pre-commit** - Prevent commits that fail checks
- **Require tests before commit** - Tests must pass before commit
- **Require lint before commit** - Lint must pass before commit

## 🚀 Usage

### Set Strictness Level
```bash
guardrail strictness set moderate
guardrail strictness set strict
guardrail strictness set maximum
```

### Show Current Settings
```bash
guardrail strictness show
```

### Test Build
```bash
guardrail strictness test
```

### In UI
Use the Vibecoder Dashboard to visually configure strictness:
- Click "Strictness" tab
- Choose a preset or customize rules
- Changes apply immediately

## 🔨 Build Enforcement

When strictness rules are enabled, `npm run build` will:

1. **Check ESLint** - If `buildBlocksOnLintErrors` is enabled
2. **Check TypeScript** - If `buildBlocksOnTypeErrors` is enabled
3. **Check Warnings** - If `buildBlocksOnWarnings` is enabled
4. **Block Build** - If any blocking issues found

### Example

With **Strict** level:
```bash
npm run build
# ❌ Build blocked: 3 ESLint error(s), 1 TypeScript error(s)
# Fix the issues above before building.
```

With **Relaxed** level:
```bash
npm run build
# ✅ Build passes (warnings and lint errors allowed)
```

## 💡 Best Practices

### For Vibecoders (New Users)
- Start with **Relaxed** or **Moderate**
- Gradually increase strictness as you learn
- Use UI to toggle rules visually

### For Teams
- Use **Strict** for shared code
- Use **Moderate** for personal branches
- Enforce via CI/CD

### For Production
- Use **Maximum** for critical systems
- Use **Strict** for most production code
- Never use **Relaxed** in production

## 🎯 Examples

### Example 1: Learning Project
```bash
guardrail strictness set relaxed
# Build passes with warnings, allows learning
```

### Example 2: Team Project
```bash
guardrail strictness set strict
# High quality, blocks on warnings
```

### Example 3: Critical System
```bash
guardrail strictness set maximum
# Everything must be perfect
```

## 🔧 Integration

### Hook into Build
Add to `package.json`:
```json
{
  "scripts": {
    "build": "node scripts/hook-build.js && npm run build:actual",
    "build:actual": "next build"
  }
}
```

### Pre-Commit Hook
Strictness rules automatically apply to pre-commit hooks when enabled.

---

**Control your AI agent's strictness - make it work exactly how you want!** 🛡️

