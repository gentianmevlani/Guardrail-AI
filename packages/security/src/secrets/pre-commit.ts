import { secretsGuardian } from './guardian';
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Staged file info
 */
export interface StagedFile {
  path: string;
  content: string;
}

/**
 * Pre-commit scan result
 */
export interface PreCommitScanResult {
  passed: boolean;
  detections: number;
  files: string[];
  message: string;
}

/**
 * Pre-Commit Hook for Secrets Detection
 */
export class PreCommitHook {
  /**
   * Generate pre-commit hook script
   */
  generateHookScript(): string {
    return `#!/bin/bash
# guardrail Secrets Detection Pre-Commit Hook

echo "🔍 Scanning for secrets..."

# Run secrets scan via API or CLI
npx guardrail secrets scan-staged

if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Commit blocked."
  echo "Please remove secrets or add to .gitignore"
  exit 1
fi

echo "✅ No secrets detected"
exit 0
`;
  }

  /**
   * Scan staged files
   */
  async scanStagedFiles(gitRoot: string): Promise<PreCommitScanResult> {
    try {
      // Get staged files
      const stagedFiles = this.getStagedFiles(gitRoot);

      if (stagedFiles.length === 0) {
        return {
          passed: true,
          detections: 0,
          files: [],
          message: 'No files to scan',
        };
      }

      // Scan each staged file
      const allDetections: string[] = [];

      for (const file of stagedFiles) {
        const detections = await secretsGuardian.scanContent(
          file.content,
          file.path,
          'pre-commit',
          {
            excludeTests: true,
            minConfidence: 0.7,
          }
        );

        if (detections.length > 0) {
          allDetections.push(file.path);
        }
      }

      const passed = allDetections.length === 0;

      return {
        passed,
        detections: allDetections.length,
        files: allDetections,
        message: passed
          ? 'No secrets detected in staged files'
          : `Secrets detected in ${allDetections.length} file(s)`,
      };
    } catch (error) {
      throw new Error(`Pre-commit scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get staged files from git
   */
  private getStagedFiles(gitRoot: string): StagedFile[] {
    try {
      // Get list of staged files
      const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
        cwd: gitRoot,
        encoding: 'utf-8',
      });

      const filePaths = output.trim().split('\n').filter((f) => f);

      // Read content of each staged file
      const stagedFiles: StagedFile[] = [];

      for (const filePath of filePaths) {
        try {
          // Get staged content (not working directory)
          const content = execSync(`git show :${filePath}`, {
            cwd: gitRoot,
            encoding: 'utf-8',
          });

          stagedFiles.push({
            path: filePath,
            content,
          });
        } catch (error) {
          // File might be deleted or binary, skip
          continue;
        }
      }

      return stagedFiles;
    } catch (error) {
      throw new Error(`Failed to get staged files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Install pre-commit hook
   */
  installHook(gitRoot: string): void {
    const hookPath = join(gitRoot, '.git', 'hooks', 'pre-commit');
    const hookScript = this.generateHookScript();

    try {
      writeFileSync(hookPath, hookScript, { mode: 0o755 });
      console.log('✅ Pre-commit hook installed successfully');
    } catch (error) {
      throw new Error(`Failed to install hook: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton
export const preCommitHook = new PreCommitHook();
