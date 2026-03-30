# ADR-003: Testing Strategy with Vitest

## Status
Accepted

## Context
The codebase had 0% test coverage, making it:
- Risky to refactor
- Hard to verify correctness
- Prone to regressions
- Not production-ready

## Decision
Use Vitest for testing with:
- 80%+ coverage target for core systems
- Unit tests for all modules
- Integration tests for workflows
- E2E tests for CLI commands

## Implementation
- Vitest configuration with coverage thresholds
- Test files in `__tests__/` directories
- Coverage reporting with v8 provider
- CI/CD integration

## Consequences
### Positive
- Safe refactoring
- Regression prevention
- Better code quality
- Production-ready

### Negative
- Time investment to write tests
- Maintenance overhead
- Need to keep tests updated

## Examples
```typescript
// Unit test
describe('UniversalGuardrails', () => {
  it('should reject files in root directory', async () => {
    const result = await universalGuardrails.validateFile(
      'UserProfile.tsx',
      'export const UserProfile = () => <div>Profile</div>;'
    );
    expect(result.valid).toBe(false);
  });
});
```

## Date
2024-12-XX


