import { BackupManager } from '../backup';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('BackupManager', () => {
  let testDir: string;
  let backupManager: BackupManager;

  beforeEach(() => {
    testDir = join(tmpdir(), `backup-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    backupManager = new BackupManager(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createBackup', () => {
    it('should create backup with metadata', async () => {
      const testFile = 'test.ts';
      const content = 'const x = 1;';
      writeFileSync(join(testDir, testFile), content);

      const runId = 'test-run-001';
      await backupManager.createBackup(runId, [testFile], ['security-fixes']);

      const backupDir = join(testDir, '.guardrail', 'backups', runId);
      expect(existsSync(backupDir)).toBe(true);
      expect(existsSync(join(backupDir, testFile))).toBe(true);
      expect(existsSync(join(backupDir, 'metadata.json'))).toBe(true);

      const metadata = JSON.parse(readFileSync(join(backupDir, 'metadata.json'), 'utf-8'));
      expect(metadata.runId).toBe(runId);
      expect(metadata.files).toContain(testFile);
      expect(metadata.packs).toContain('security-fixes');
    });

    it('should backup multiple files', async () => {
      const files = ['file1.ts', 'file2.ts', 'dir/file3.ts'];
      
      for (const file of files) {
        const filePath = join(testDir, file);
<<<<<<< HEAD
        const firstSeg = file.split('/')[0];
        if (firstSeg === undefined) throw new Error('invalid test path');
        const dir = join(testDir, firstSeg);
=======
        const dir = join(testDir, file.split('/')[0]);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
        if (file.includes('/')) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(filePath, `content of ${file}`);
      }

      const runId = 'test-run-002';
      await backupManager.createBackup(runId, files, ['quality-fixes']);

      for (const file of files) {
        const backupPath = join(testDir, '.guardrail', 'backups', runId, file);
        expect(existsSync(backupPath)).toBe(true);
        const content = readFileSync(backupPath, 'utf-8');
        expect(content).toBe(`content of ${file}`);
      }
    });
  });

  describe('rollback', () => {
    it('should restore files from backup', async () => {
      const testFile = 'test.ts';
      const originalContent = 'const x = 1;';
      const modifiedContent = 'const x = 2;';
      
      writeFileSync(join(testDir, testFile), originalContent);

      const runId = 'test-run-003';
      await backupManager.createBackup(runId, [testFile], ['test-pack']);

      // Modify the file
      writeFileSync(join(testDir, testFile), modifiedContent);
      expect(readFileSync(join(testDir, testFile), 'utf-8')).toBe(modifiedContent);

      // Rollback
      const result = await backupManager.rollback(runId);

      expect(result.success).toBe(true);
      expect(result.restoredFiles).toContain(testFile);
      expect(readFileSync(join(testDir, testFile), 'utf-8')).toBe(originalContent);
    });

    it('should return error for non-existent backup', async () => {
      const result = await backupManager.rollback('non-existent-run');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.restoredFiles.length).toBe(0);
    });

    it('should restore multiple files', async () => {
      const files = ['file1.ts', 'file2.ts'];
      const contents = ['content1', 'content2'];
      
      files.forEach((file, i) => {
<<<<<<< HEAD
        const c = contents[i];
        if (c === undefined) throw new Error('contents mismatch');
        writeFileSync(join(testDir, file), c);
=======
        writeFileSync(join(testDir, file), contents[i]);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      });

      const runId = 'test-run-004';
      await backupManager.createBackup(runId, files, ['test-pack']);

      // Modify files
      files.forEach(file => {
        writeFileSync(join(testDir, file), 'modified');
      });

      // Rollback
      const result = await backupManager.rollback(runId);

      expect(result.success).toBe(true);
      expect(result.restoredFiles.length).toBe(files.length);
      files.forEach((file, i) => {
        expect(readFileSync(join(testDir, file), 'utf-8')).toBe(contents[i]);
      });
    });
  });

  describe('listBackups', () => {
    it('should list all backups sorted by timestamp', async () => {
      const runIds = ['run-001', 'run-002', 'run-003'];
      
      for (const runId of runIds) {
        writeFileSync(join(testDir, 'test.ts'), 'content');
        await backupManager.createBackup(runId, ['test.ts'], ['pack']);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const backups = backupManager.listBackups();

      expect(backups.length).toBe(3);
<<<<<<< HEAD
      expect(backups[0]!.runId).toBe('run-003'); // Most recent first
      expect(backups[2]!.runId).toBe('run-001');
=======
      expect(backups[0].runId).toBe('run-003'); // Most recent first
      expect(backups[2].runId).toBe('run-001');
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    });

    it('should return empty array when no backups exist', () => {
      const backups = backupManager.listBackups();
      expect(backups).toEqual([]);
    });
  });

  describe('deleteBackup', () => {
    it('should delete a backup', async () => {
      const runId = 'test-run-005';
      writeFileSync(join(testDir, 'test.ts'), 'content');
      await backupManager.createBackup(runId, ['test.ts'], ['pack']);

      const backupDir = join(testDir, '.guardrail', 'backups', runId);
      expect(existsSync(backupDir)).toBe(true);

      const result = backupManager.deleteBackup(runId);

      expect(result).toBe(true);
      expect(existsSync(backupDir)).toBe(false);
    });

    it('should return false for non-existent backup', () => {
      const result = backupManager.deleteBackup('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getBackupSize', () => {
    it('should calculate backup size', async () => {
      const testFile = 'test.ts';
      const content = 'x'.repeat(1000);
      writeFileSync(join(testDir, testFile), content);

      const runId = 'test-run-006';
      await backupManager.createBackup(runId, [testFile], ['pack']);

      const size = backupManager.getBackupSize(runId);

      expect(size).toBeGreaterThan(1000);
    });

    it('should return 0 for non-existent backup', () => {
      const size = backupManager.getBackupSize('non-existent');
      expect(size).toBe(0);
    });
  });
});
