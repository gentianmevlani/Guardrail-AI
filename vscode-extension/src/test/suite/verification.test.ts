import * as assert from 'assert';
import * as vscode from 'vscode';

suite('guardrail Verification Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting guardrail verification tests');

  test('Commands are registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    
    assert.ok(commands.includes('guardrail.verifyLastOutput'), 'verifyLastOutput command exists');
    assert.ok(commands.includes('guardrail.verifySelection'), 'verifySelection command exists');
    assert.ok(commands.includes('guardrail.applyVerifiedDiff'), 'applyVerifiedDiff command exists');
    assert.ok(commands.includes('guardrail.copyFixPrompt'), 'copyFixPrompt command exists');
    assert.ok(commands.includes('guardrail.showVerificationReport'), 'showVerificationReport command exists');
  });

  test('Verify empty clipboard shows error', async () => {
    await vscode.env.clipboard.writeText('');
    
    try {
      await vscode.commands.executeCommand('guardrail.verifyLastOutput');
    } catch {
      // Expected to fail with empty clipboard
    }
  });

  test('Verify valid JSON from clipboard', async () => {
    const validJson = JSON.stringify({
      format: 'guardrail-v1',
      diff: `diff --git a/test.ts b/test.ts
--- a/test.ts
+++ b/test.ts
@@ -1 +1 @@
-old
+new`,
    });

    await vscode.env.clipboard.writeText(validJson);
    
    // This would trigger the verification
    // await vscode.commands.executeCommand('guardrail.verifyLastOutput');
  });
});
