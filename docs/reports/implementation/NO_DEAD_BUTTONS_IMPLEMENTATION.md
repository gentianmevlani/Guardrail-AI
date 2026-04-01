# No Dead Buttons Implementation

## Summary

Implemented a comprehensive "No Dead Buttons" system for guardrail's Reality CLI command. This system systematically prevents button failures and silent errors by combining static scanning and automated button sweep testing.

## What Was Implemented

### 1. Static Scanner (`packages/cli/src/reality/no-dead-buttons/static-scanner.ts`)

Fast static scan (<1s) that detects dead UI patterns before running e2e tests:

- ✅ Empty onClick handlers: `onClick={() => {}}`
- ✅ Dead href patterns: `href="#"`, `href="javascript:void(0)"`
- ✅ TODO/stub/placeholder in button context
- ✅ Empty catch blocks (silent failures)
- ✅ Fake success patterns (toast in catch block)
- ✅ Disabled buttons with TODO text

**Key Features:**
- Scans TypeScript/JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`)
- Recursive directory scanning with exclude patterns
- Severity levels (error/warning)
- Formatted output with file paths, line numbers, and suggestions

### 2. Button Sweep Generator (`packages/cli/src/reality/no-dead-buttons/button-sweep-generator.ts`)

Generates Playwright tests that click every button and validate behavior:

- ✅ Captures console errors
- ✅ Monitors network requests (4xx/5xx detection)
- ✅ Validates state changes after clicks
- ✅ Supports authentication
- ✅ Configurable pages to test
- ✅ Skips disabled buttons intelligently

**Key Features:**
- Generates complete Playwright test code
- Supports multiple pages
- Configurable authentication
- Error tracking and reporting
- Summary statistics

### 3. CLI Integration (`packages/cli/src/index.ts`)

Integrated into `guardrail reality` command with new options:

- ✅ `--no-dead-ui` - Run static scan before tests
- ✅ `--button-sweep` - Generate and run button sweep test
- ✅ `--auth-email` - Email for button sweep authentication
- ✅ `--auth-password` - Password for button sweep authentication

**Integration Points:**
- Static scan runs before test generation (if `--no-dead-ui` is set)
- Button sweep test generation (if `--button-sweep` is set)
- Button sweep test execution (if `--button-sweep --run` is set)
- Proper error handling and exit codes

### 4. Tests

Unit tests for both modules:

- ✅ `static-scanner.test.ts` - Tests for static scanner patterns
- ✅ `button-sweep-generator.test.ts` - Tests for test generation

## Usage Examples

### Run Static Scan

```bash
guardrail reality --no-dead-ui --path ./my-app
```

### Generate Button Sweep Test

```bash
guardrail reality --button-sweep --url http://localhost:3000
```

### Run Button Sweep Test

```bash
guardrail reality --button-sweep --run \
  --url http://localhost:3000 \
  --auth-email test@example.com \
  --auth-password password123
```

### Combined (Static Scan + Button Sweep)

```bash
guardrail reality --no-dead-ui --button-sweep --run \
  --url http://localhost:3000 \
  --auth-email test@example.com \
  --auth-password password123
```

## Architecture

### File Structure

```
packages/cli/src/reality/no-dead-buttons/
├── static-scanner.ts          # Static scanner implementation
├── button-sweep-generator.ts  # Button sweep test generator
├── index.ts                   # Public exports
├── __tests__/
│   ├── static-scanner.test.ts
│   └── button-sweep-generator.test.ts
└── README.md                  # Documentation
```

### Key Functions

**Static Scanner:**
- `runStaticScan()` - Main scanning function
- `formatStaticScanResults()` - Format results for console output
- `scanFile()` - Scan a single file
- `scanDirectory()` - Recursively scan directories

**Button Sweep Generator:**
- `generateButtonSweepTest()` - Generate full Playwright test
- `generateCIButtonSweepTest()` - Generate simplified CI version

## What This Solves

### The "No Dead Buttons" Problem

This implementation addresses all the common reasons buttons fail:

1. ✅ **No handler** - Detected by static scan (empty onClick)
2. ✅ **Handler throws** - Detected by button sweep (console errors)
3. ✅ **API 404s/500s** - Detected by button sweep (network errors)
4. ✅ **Silent failures** - Detected by static scan (empty catch blocks)
5. ✅ **Fake success** - Detected by static scan (toast in catch)
6. ✅ **Dead links** - Detected by static scan (href="#")
7. ✅ **Placeholder/TODO** - Detected by static scan

### Definition of Done

A button passes if:
- ✅ No dead UI patterns (validated by static scan)
- ✅ No console errors (validated by button sweep)
- ✅ No network errors (validated by button sweep)
- ✅ State changes as expected (validated by button sweep)

## Future Enhancements

The following were mentioned in the requirements but are out of scope for this initial implementation (they require broader architectural changes):

- **Action Registry** - Centralized registry for all UI actions
- **Action Wrapper** - Standard loading/error/success handling
- **Typed API Contracts** - Generated types from OpenAPI
- **Server-side Gating Validation** - API-side auth/plan enforcement checks
- **Telemetry** - Action events with correlation IDs

These can be added incrementally as the system evolves.

## Testing

Run the tests:

```bash
cd packages/cli
npm test -- no-dead-buttons
```

## Notes

- Static scanner uses regex patterns (fast, but may have false positives/negatives)
- Button sweep requires Playwright to be installed
- Button sweep works best with `data-action-id` attributes (optional)
- Authentication is optional (tests will skip login if not provided)

## Integration with Reality CLI

The "No Dead Buttons" system is now part of the Reality CLI command. It integrates seamlessly:

- Static scan runs before test generation (if enabled)
- Button sweep generates Playwright tests
- Both work with existing Reality CLI features (artifacts, reporting, etc.)

The system follows the same patterns as the existing Reality CLI code:
- Uses same artifact directory structure
- Integrates with Playwright test runner
- Provides formatted console output
- Handles errors gracefully
