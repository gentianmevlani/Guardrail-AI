# No Dead Buttons System

A comprehensive engineering system to prevent dead buttons and silent failures in guardrail's UI.

## Overview

The "No Dead Buttons" system systematically prevents button failures by:

1. **Static Scanning** - Fast scan (<1s) that blocks obvious deadness before tests
2. **Button Sweep Testing** - Playwright test that clicks all buttons and validates behavior
3. **Integration with Reality CLI** - Seamlessly integrated into `guardrail reality` command

## Why Buttons Fail (The Real Culprits)

- No handler (UI wired to nothing, or conditional handler becomes undefined)
- Handler runs but throws (unhandled promise, missing await, exception swallowed)
- Handler calls an API that 404s/500s (route mismatch, deploy drift, missing env)
- Auth/plan gate mismatch (UI allows click, API blocks—or UI blocks but API allows)
- State doesn't update (optimistic UI wrong, cache stale, missing invalidation)
- Double-submit / race (click twice, second request cancels the first or corrupts state)
- Disabled overlay (button clickable visually but covered by div, pointer-events, z-index)
- Routing broke (href points to dead route; SPA navigation fails silently)
- Feature-flag dead path (flag disables the effect but UI still shows button)
- Environment drift (works in dev, prod missing secrets/webhooks/scope)
- Integration flake (GitHub/Stripe fails → UI shows "success" anyway)
- Silent failures (empty catch, "best effort" returning success)

## Components

### 1. Static Scanner (`static-scanner.ts`)

Fast static scan that detects dead UI patterns:

- TODO/stub/placeholder in button context
- Empty onClick handlers: `onClick={() => {}}`
- Dead href patterns: `href="#"`, `href="javascript:void(0)"`
- Disabled buttons with TODO text
- Empty catch blocks (silent failures)
- Fake success patterns (toast in catch block)

**Usage:**
```typescript
import { runStaticScan, formatStaticScanResults } from './static-scanner';

const result = runStaticScan(projectPath, ['src', 'app', 'components']);
console.log(formatStaticScanResults(result));
```

### 2. Button Sweep Generator (`button-sweep-generator.ts`)

Generates Playwright tests that:

- Log in (test user)
- Navigate all major pages
- Click every visible button
- Fail if:
  - Any console error occurs
  - Any network request returns 4xx/5xx (except explicitly allowed)
  - Any click produces no state change when expected
  - Any toast says "success" but request failed

**Usage:**
```typescript
import { generateButtonSweepTest } from './button-sweep-generator';

const testCode = generateButtonSweepTest({
  baseUrl: 'http://localhost:3000',
  auth: { email: 'test@example.com', password: 'password' },
  pages: ['/', '/dashboard', '/settings'],
});
```

## CLI Integration

The system is integrated into the `guardrail reality` command:

### Options

- `--no-dead-ui` - Run static scan for dead UI patterns before tests
- `--button-sweep` - Generate and run button sweep test
- `--auth-email <email>` - Email for button sweep authentication
- `--auth-password <password>` - Password for button sweep authentication

### Examples

**Run static scan:**
```bash
guardrail reality --no-dead-ui --path ./my-app
```

**Generate button sweep test:**
```bash
guardrail reality --button-sweep --url http://localhost:3000
```

**Run button sweep test with authentication:**
```bash
guardrail reality --button-sweep --run \
  --url http://localhost:3000 \
  --auth-email test@example.com \
  --auth-password password123
```

**Combined (static scan + button sweep):**
```bash
guardrail reality --no-dead-ui --button-sweep --run \
  --url http://localhost:3000 \
  --auth-email test@example.com \
  --auth-password password123
```

## Definition of Done

A button passes the "No Dead Buttons" system if:

- ✅ Button uses actionRegistry (no inline fetch strings) - *future*
- ✅ Action has permission + telemetry + result validation - *future*
- ✅ UI shows loading + success + error states - *validated by button sweep*
- ✅ Server route has auth/plan enforcement - *validated by button sweep*
- ✅ Integration failures are visible and not marked success - *validated by button sweep*
- ✅ Playwright button sweep passes - *validated by button sweep*
- ✅ No console errors, no unhandled rejections - *validated by button sweep*
- ✅ If disabled, UI shows why + how to unblock - *validated by static scan*
- ✅ No dead UI patterns (TODO/stub/placeholder) - *validated by static scan*

## Architecture Notes

### Static Scanner Patterns

The static scanner uses regex patterns to detect common dead UI anti-patterns. Patterns are designed to catch:

- Empty handlers: `onClick={() => {}}`
- Dead links: `href="#"`, `href="javascript:void(0)"`
- Silent failures: `catch (e) {}`
- Fake success: `catch { toast.success() }`

### Button Sweep Test Structure

The generated Playwright test:

1. Sets up error capture (console errors, network errors)
2. Authenticates if credentials provided
3. For each page:
   - Navigates to page
   - Finds all buttons (or buttons with `data-action-id`)
   - Clicks each button
   - Validates state changes and error absence
4. Fails on any error or unexpected behavior

### Future Enhancements

- Action Registry system for centralized action management
- Action Wrapper for standardized loading/error/success handling
- Typed API contracts (OpenAPI/tRPC)
- Server-side gating validation
- Telemetry with correlation IDs

## Testing

Unit tests are provided:

```bash
npm test -- static-scanner.test.ts
npm test -- button-sweep-generator.test.ts
```

## Related Files

- `packages/cli/src/reality/no-dead-buttons/static-scanner.ts` - Static scanner implementation
- `packages/cli/src/reality/no-dead-buttons/button-sweep-generator.ts` - Button sweep generator
- `packages/cli/src/index.ts` - CLI integration (Reality command)
- `packages/cli/src/reality/no-dead-buttons/__tests__/` - Unit tests
