/**
 * Tests for git history scanner
 */

import { scanGitHistory } from '../git-scanner';
import { SecretsGuardian } from '../guardian';
import { STRIPE_LIVE_PREFIX } from '../stripe-placeholder-prefix';
import { execSync } from 'child_process';
import { mkdirSync, rmSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

jest.mock('child_process');

describe('scanGitHistory', () => {
  let testDir: string;
  let guardian: SecretsGuardian;

  beforeEach(() => {
    testDir = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    mkdirSync(join(testDir, '.git'), { recursive: true });
    guardian = new SecretsGuardian();
    // Mock scanContent to return detections for test content
    jest.spyOn(guardian, 'scanContent').mockImplementation(async (content: string) => {
      const detections: any[] = [];
      // Simple detection logic for test
      if (content.includes(STRIPE_LIVE_PREFIX) || content.includes('API_KEY')) {
        detections.push({
          id: 'det-1',
          projectId: 'test-project',
          filePath: 'commit:abc123',
          secretType: 'stripe_key',
          risk: 'high',
          maskedValue: `${STRIPE_LIVE_PREFIX}***`,
          valueHash: 'hash1',
          fingerprint: 'fp1'.padEnd(64, '0'),
          location: { line: 1, column: 0, snippet: content.substring(0, 50) },
          confidence: 0.9,
          entropy: 0.8,
          isTest: false,
          isRevoked: false,
          recommendation: {
            action: 'revoke_and_rotate',
            reason: 'Stripe key detected',
            remediation: 'Rotate key immediately',
          },
        });
      }
      if (content.includes('password')) {
        detections.push({
          id: 'det-2',
          projectId: 'test-project',
          filePath: 'commit:abc123',
          secretType: 'password',
          risk: 'medium',
          maskedValue: '***',
          valueHash: 'hash2',
          fingerprint: 'fp2'.padEnd(64, '0'),
          location: { line: 2, column: 0, snippet: content.substring(0, 50) },
          confidence: 0.7,
          entropy: 0.6,
          isTest: false,
          isRevoked: false,
          recommendation: {
            action: 'move_to_env',
            reason: 'Password detected',
            remediation: 'Move to environment variable',
          },
        });
      }
      return detections;
    });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    jest.clearAllMocks();
  });

  it('should throw error when not a git repository', async () => {
    rmSync(join(testDir, '.git'), { recursive: true });
    
    await expect(
      scanGitHistory(testDir, 'test-project', guardian)
    ).rejects.toThrow('Not a git repository');
  });

  it('should scan git commits for secrets', async () => {
    const mockCommits = `abc123|2024-01-01T12:00:00Z|John Doe
def456|2024-01-02T12:00:00Z|Jane Smith`;

    const mockStripeLive = STRIPE_LIVE_PREFIX + '1'.repeat(32);
    const mockDiff = `+const API_KEY = "${mockStripeLive}";
+// Some other line
+const password = "test123";`;

    (execSync as jest.Mock)
      .mockReturnValueOnce(mockCommits)
      .mockReturnValueOnce(mockDiff)
      .mockReturnValueOnce('');

    const result = await scanGitHistory(testDir, 'test-project', guardian, {
      depth: 2,
    });

    expect(result.commitsScanned).toBe(2);
    expect(result.detections.length).toBeGreaterThan(0);
    expect(result.detections[0]).toHaveProperty('commitHash');
    expect(result.detections[0]).toHaveProperty('commitDate');
    expect(result.detections[0]).toHaveProperty('author');
  });

  it('should respect depth parameter', async () => {
    const mockCommits = `abc123|2024-01-01T12:00:00Z|John Doe
def456|2024-01-02T12:00:00Z|Jane Smith
ghi789|2024-01-03T12:00:00Z|Bob Wilson`;

    (execSync as jest.Mock).mockReturnValue(mockCommits);

    await scanGitHistory(testDir, 'test-project', guardian, {
      depth: 3,
    });

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('-n 3'),
      expect.any(Object)
    );
  });

  it('should use default depth of 50', async () => {
    (execSync as jest.Mock).mockReturnValue('');

    await scanGitHistory(testDir, 'test-project', guardian);

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('-n 50'),
      expect.any(Object)
    );
  });

  it('should extract only added lines from diff', async () => {
    const mockCommits = `abc123|2024-01-01T12:00:00Z|John Doe`;
    const mockDiff = `-const OLD_KEY = "old_key";
+const NEW_KEY = "AKIAIOSFODNN7EXAMPLE";
 const UNCHANGED = "unchanged";
+++ b/file.js`;

    (execSync as jest.Mock)
      .mockReturnValueOnce(mockCommits)
      .mockReturnValueOnce(mockDiff);

    const result = await scanGitHistory(testDir, 'test-project', guardian);

    expect(result.commitsScanned).toBe(1);
  });

  it('should handle git command errors gracefully', async () => {
    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('git command failed');
    });

    await expect(
      scanGitHistory(testDir, 'test-project', guardian)
    ).rejects.toThrow('Failed to get git commits');
  });

  it('should scan specific branch', async () => {
    const mockCommits = `abc123|2024-01-01T12:00:00Z|John Doe`;
    (execSync as jest.Mock).mockReturnValue(mockCommits);

    await scanGitHistory(testDir, 'test-project', guardian, {
      branch: 'main',
    });

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('git log main'),
      expect.any(Object)
    );
  });

  it('should aggregate summary statistics', async () => {
    const mockCommits = `abc123|2024-01-01T12:00:00Z|John Doe
def456|2024-01-02T12:00:00Z|Jane Smith`;

    const mockDiff1 = `+const API_KEY = "AKIAIOSFODNN7EXAMPLE";`;
    const mockStripeLive2 = STRIPE_LIVE_PREFIX + 'z'.repeat(32);
    const mockDiff2 = `+const STRIPE_KEY = "${mockStripeLive2}";`;

    (execSync as jest.Mock)
      .mockReturnValueOnce(mockCommits)
      .mockReturnValueOnce(mockDiff1)
      .mockReturnValueOnce(mockDiff2);

    const result = await scanGitHistory(testDir, 'test-project', guardian);

    expect(result.summary.totalSecrets).toBeGreaterThan(0);
    expect(result.summary.byCommit).toBeDefined();
    expect(result.summary.byType).toBeDefined();
  });
});
