/**
 * Format Validator Tests
 */

import { validateFormat } from '../format-validator';

describe('validateFormat', () => {
  describe('valid inputs', () => {
    it('should accept raw JSON with valid guardrail-v1 format', () => {
      const input = JSON.stringify({
        format: 'guardrail-v1',
        diff: `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 line1
+added
 line2`,
      });

      const result = validateFormat(input);
      expect(result.valid).toBe(true);
      expect(result.output?.format).toBe('guardrail-v1');
      expect(result.output?.diff).toContain('diff --git');
    });

    it('should accept fenced JSON block', () => {
      const input = `Here is the change:
\`\`\`json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/test.ts b/test.ts\\n--- a/test.ts\\n+++ b/test.ts\\n@@ -1 +1 @@\\n-old\\n+new"
}
\`\`\``;

      const result = validateFormat(input);
      expect(result.valid).toBe(true);
      expect(result.output?.format).toBe('guardrail-v1');
    });

    it('should accept plain fenced block with JSON', () => {
      const input = `\`\`\`
{
  "format": "guardrail-v1",
  "diff": "diff --git a/test.ts b/test.ts\\n--- a/test.ts\\n+++ b/test.ts\\n@@ -1 +1 @@\\n-old\\n+new"
}
\`\`\``;

      const result = validateFormat(input);
      expect(result.valid).toBe(true);
    });

    it('should handle error field', () => {
      const input = JSON.stringify({
        format: 'guardrail-v1',
        error: 'Cannot make the requested change because...',
      });

      const result = validateFormat(input);
      expect(result.valid).toBe(true);
      expect(result.output?.error).toBe('Cannot make the requested change because...');
    });

    it('should parse optional commands and tests', () => {
      const input = JSON.stringify({
        format: 'guardrail-v1',
        diff: `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1 +1 @@
-old
+new`,
        commands: ['pnpm install', 'pnpm build'],
        tests: ['pnpm test'],
        notes: 'Added new feature',
      });

      const result = validateFormat(input);
      expect(result.valid).toBe(true);
      expect(result.output?.commands).toEqual(['pnpm install', 'pnpm build']);
      expect(result.output?.tests).toEqual(['pnpm test']);
      expect(result.output?.notes).toBe('Added new feature');
    });
  });

  describe('invalid inputs', () => {
    it('should reject empty input', () => {
      const result = validateFormat('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Empty');
    });

    it('should reject plain text without JSON', () => {
      const result = validateFormat('This is just some text');
      expect(result.valid).toBe(false);
      expect(result.retryPrompt).toBeDefined();
    });

    it('should reject markdown without JSON', () => {
      const result = validateFormat(`
# Changes
I made some changes to the code.
- Added feature X
- Fixed bug Y
      `);
      expect(result.valid).toBe(false);
    });

    it('should reject invalid JSON', () => {
      const result = validateFormat('{ invalid json }');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('parse');
    });

    it('should reject wrong format field', () => {
      const result = validateFormat(JSON.stringify({
        format: 'other-v1',
        diff: 'some diff',
      }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('format');
    });

    it('should reject missing diff field', () => {
      const result = validateFormat(JSON.stringify({
        format: 'guardrail-v1',
      }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('diff');
    });

    it('should reject empty diff', () => {
      const result = validateFormat(JSON.stringify({
        format: 'guardrail-v1',
        diff: '',
      }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject invalid diff structure', () => {
      const result = validateFormat(JSON.stringify({
        format: 'guardrail-v1',
        diff: 'This is not a valid diff',
      }));
      expect(result.valid).toBe(false);
      expect(result.retryPrompt).toContain('diff');
    });

    it('should reject non-string array in commands', () => {
      const result = validateFormat(JSON.stringify({
        format: 'guardrail-v1',
        diff: `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1 +1 @@
-old
+new`,
        commands: [123, 'valid'],
      }));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('commands');
    });
  });

  describe('edge cases', () => {
    it('should handle whitespace around JSON', () => {
      const input = `
      
      {
        "format": "guardrail-v1",
        "diff": "diff --git a/t.ts b/t.ts\\n--- a/t.ts\\n+++ b/t.ts\\n@@ -1 +1 @@\\n-a\\n+b"
      }
      
      `;
      const result = validateFormat(input);
      expect(result.valid).toBe(true);
    });

    it('should handle multiple code blocks (only first json block)', () => {
      const input = `
\`\`\`json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/t.ts b/t.ts\\n--- a/t.ts\\n+++ b/t.ts\\n@@ -1 +1 @@\\n-a\\n+b"
}
\`\`\`

\`\`\`typescript
// some code
\`\`\`
      `;
      const result = validateFormat(input);
      expect(result.valid).toBe(true);
    });
  });
});
