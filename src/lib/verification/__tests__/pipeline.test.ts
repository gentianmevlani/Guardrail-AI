/**
 * Pipeline Tests
 * Tests for the verification pipeline ordering and fail-fast behavior
 */

import { verifyAgentOutput } from '../pipeline';
import { VerificationContext } from '../types';

describe('verifyAgentOutput', () => {
  const baseContext: VerificationContext = {
    projectRoot: process.cwd(),
    mode: 'build',
    strict: false,
    runTests: false,
  };

  describe('format validation', () => {
    it('should fail on invalid JSON', async () => {
      const result = await verifyAgentOutput('not json', baseContext);
      expect(result.success).toBe(false);
      expect(result.checks[0].check).toBe('format-validation');
      expect(result.failureContext).toBeDefined();
    });

    it('should fail on wrong format field', async () => {
      const result = await verifyAgentOutput(JSON.stringify({
        format: 'wrong-format',
        diff: 'some diff',
      }), baseContext);
      expect(result.success).toBe(false);
    });

    it('should fail on empty diff', async () => {
      const result = await verifyAgentOutput(JSON.stringify({
        format: 'guardrail-v1',
        diff: '',
      }), baseContext);
      expect(result.success).toBe(false);
    });
  });

  describe('path validation (phase 1)', () => {
    it('should fail on path traversal before workspace setup', async () => {
      const result = await verifyAgentOutput(JSON.stringify({
        format: 'guardrail-v1',
        diff: `diff --git a/../../../etc/passwd b/../../../etc/passwd
--- a/../../../etc/passwd
+++ b/../../../etc/passwd
@@ -1 +1 @@
-root:x:0:0:root:/root:/bin/bash
+hacked`,
      }), baseContext);
      
      expect(result.success).toBe(false);
      expect(result.checks.some(c => c.check === 'path-safety' && c.status === 'fail')).toBe(true);
    });

    it('should fail on protected path modification', async () => {
      const result = await verifyAgentOutput(JSON.stringify({
        format: 'guardrail-v1',
        diff: `diff --git a/.env b/.env
--- a/.env
+++ b/.env
@@ -1 +1 @@
-SECRET=old
+SECRET=new`,
      }), baseContext);
      
      expect(result.success).toBe(false);
      expect(result.blockers.some(b => b.includes('.env'))).toBe(true);
    });
  });

  describe('command validation (phase 1)', () => {
    it('should fail on dangerous commands before workspace setup', async () => {
      const result = await verifyAgentOutput(JSON.stringify({
        format: 'guardrail-v1',
        diff: `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1 +1 @@
-old
+new`,
        commands: ['rm -rf /'],
      }), baseContext);
      
      expect(result.success).toBe(false);
      expect(result.checks.some(c => c.check === 'command-safety' && c.status === 'fail')).toBe(true);
    });
  });

  describe('agent error handling', () => {
    it('should surface agent error without retry', async () => {
      const result = await verifyAgentOutput(JSON.stringify({
        format: 'guardrail-v1',
        error: 'Cannot make changes because the file does not exist',
      }), baseContext);
      
      expect(result.success).toBe(false);
      expect(result.parsedOutput?.error).toBe('Cannot make changes because the file does not exist');
    });
  });

  describe('fenced JSON handling', () => {
    it('should extract JSON from fenced code block', async () => {
      const input = `Here's the change:
\`\`\`json
{
  "format": "guardrail-v1",
  "diff": "diff --git a/t.ts b/t.ts\\n--- a/t.ts\\n+++ b/t.ts\\n@@ -1 +1 @@\\n-a\\n+b"
}
\`\`\``;
      
      const result = await verifyAgentOutput(input, baseContext);
      expect(result.parsedOutput?.format).toBe('guardrail-v1');
    });
  });
});
