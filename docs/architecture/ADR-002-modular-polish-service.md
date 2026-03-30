# ADR-002: Modular Polish Service Architecture

## Status
Accepted

## Context
The original `polish-service.ts` file was 1200+ lines, making it:
- Hard to maintain
- Difficult to test
- Prone to merge conflicts
- Hard to understand

## Decision
Split the polish service into a modular architecture:
- Main orchestrator (`polish-service.ts`) - ~150 lines
- Individual checkers in `checkers/` directory
- Shared types and utilities
- Plugin-style architecture for extensibility

## Implementation
```
src/lib/polish/
├── types.ts              # Shared types
├── utils.ts              # Shared utilities
├── polish-service.ts     # Orchestrator
└── checkers/
    ├── frontend-checker.ts
    ├── backend-checker.ts
    ├── security-checker.ts
    └── ...
```

## Consequences
### Positive
- Much easier to maintain (small, focused files)
- Easy to test individual checkers
- Easy to add new checkers
- Better code organization
- Reduced merge conflicts

### Negative
- More files to navigate
- Need to understand the architecture
- Slight overhead from orchestrator

## Examples
```typescript
// Adding a new checker
export class CustomPolishChecker implements PolishChecker {
  getCategory(): string {
    return 'Custom';
  }

  async check(projectPath: string): Promise<PolishIssue[]> {
    // Implementation
  }
}

// Register it
polishService.registerChecker(new CustomPolishChecker());
```

## Date
2024-12-XX


