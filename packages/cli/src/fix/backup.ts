import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, dirname, relative } from 'path';

export interface BackupMetadata {
  runId: string;
  timestamp: string;
  projectPath: string;
  files: string[];
  packs: string[];
}

export class BackupManager {
  private projectPath: string;
  private backupRoot: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.backupRoot = join(projectPath, '.guardrail', 'backups');
  }

  /**
   * Create a backup before applying fixes
   */
  async createBackup(runId: string, files: string[], packs: string[]): Promise<void> {
    const backupDir = join(this.backupRoot, runId);
    
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Copy each file to backup directory
    for (const file of files) {
      const sourcePath = join(this.projectPath, file);
      const targetPath = join(backupDir, file);
      
      if (existsSync(sourcePath)) {
        const targetDir = dirname(targetPath);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        
        copyFileSync(sourcePath, targetPath);
      }
    }

    // Save metadata
    const metadata: BackupMetadata = {
      runId,
      timestamp: new Date().toISOString(),
      projectPath: this.projectPath,
      files,
      packs,
    };

    writeFileSync(
      join(backupDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );
  }

  /**
   * Rollback to a previous backup
   */
  async rollback(runId: string): Promise<{ success: boolean; restoredFiles: string[]; error?: string }> {
    const backupDir = join(this.backupRoot, runId);
    
    if (!existsSync(backupDir)) {
      return {
        success: false,
        restoredFiles: [],
        error: `Backup ${runId} not found`,
      };
    }

    // Load metadata
    const metadataPath = join(backupDir, 'metadata.json');
    if (!existsSync(metadataPath)) {
      return {
        success: false,
        restoredFiles: [],
        error: 'Backup metadata not found',
      };
    }

    const metadata: BackupMetadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    const restoredFiles: string[] = [];

    // Restore each file
    for (const file of metadata.files) {
      const backupPath = join(backupDir, file);
      const targetPath = join(this.projectPath, file);
      
      if (existsSync(backupPath)) {
        const targetDir = dirname(targetPath);
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        
        copyFileSync(backupPath, targetPath);
        restoredFiles.push(file);
      }
    }

    return {
      success: true,
      restoredFiles,
    };
  }

  /**
   * List all available backups
   */
  listBackups(): BackupMetadata[] {
    if (!existsSync(this.backupRoot)) {
      return [];
    }

    const backups: BackupMetadata[] = [];
    const entries = readdirSync(this.backupRoot);

    for (const entry of entries) {
      const backupDir = join(this.backupRoot, entry);
      const metadataPath = join(backupDir, 'metadata.json');
      
      if (existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
          backups.push(metadata);
        } catch {
          // Skip invalid metadata
        }
      }
    }

    return backups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Delete a backup
   */
  deleteBackup(runId: string): boolean {
    const backupDir = join(this.backupRoot, runId);
    
    if (!existsSync(backupDir)) {
      return false;
    }

    try {
      rmSync(backupDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get backup size
   */
  getBackupSize(runId: string): number {
    const backupDir = join(this.backupRoot, runId);
    
    if (!existsSync(backupDir)) {
      return 0;
    }

    return this.calculateDirSize(backupDir);
  }

  private calculateDirSize(dir: string): number {
    let size = 0;
    
    try {
      const entries = readdirSync(dir);
      
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
          size += this.calculateDirSize(fullPath);
        } else {
          size += stat.size;
        }
      }
    } catch {
      // Ignore errors
    }
    
    return size;
  }
}
