import { pool } from "@guardrail/database";
import { logger } from "../logger";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";
const execAsync = promisify(exec);

interface GitHubRepoInfo {
  id: string;
  fullName: string;
  cloneUrl: string;
  defaultBranch: string;
}

/**
 * GitHub Repository Cloner Service
 * 
 * Handles cloning GitHub repositories for scanning
 */
export class GitHubCloner {
  private static readonly CLONE_DIR = "/tmp/guardrail-clones";

  /**
   * Clone a GitHub repository for scanning
   */
  static async cloneRepository(
    userId: string,
    repoFullName: string
  ): Promise<{ projectPath: string; repoInfo: GitHubRepoInfo }> {
    // Get repository info from database
    const repoQuery = `
      SELECT r.id, r.github_id, r.full_name, r.clone_url, r.default_branch, g.access_token
      FROM repositories r
      JOIN github_accounts g ON g.user_id = r.user_id
      WHERE r.user_id = $1 AND r.full_name = $2 AND r.is_active = true
      AND g.is_active = true
    `;
    
    const repoResult = await pool.query(repoQuery, [userId, repoFullName]);
    
    if (repoResult.rows.length === 0) {
      throw new Error(`Repository ${repoFullName} not found or not accessible`);
    }

    const repo = repoResult.rows[0];
    const repoInfo: GitHubRepoInfo = {
      id: repo.id,
      fullName: repo.full_name,
      cloneUrl: repo.clone_url,
      defaultBranch: repo.default_branch,
    };

    // Create clone directory if it doesn't exist
    await fs.promises.mkdir(this.CLONE_DIR, { recursive: true });

    // Create unique directory for this clone
    const cloneId = `${userId}-${repo.id}-${Date.now()}`;
    const clonePath = path.join(this.CLONE_DIR, cloneId);
    
    try {
      // Clone the repository
      logger.info({ repoFullName, clonePath }, "Cloning GitHub repository");
      
      const cloneUrlWithAuth = repo.cloneUrl.replace(
        "https://github.com/",
        `https://x-access-token:${repo.access_token}@github.com/`
      );

      await execAsync(`git clone --depth 1 --branch ${repo.defaultBranch} "${cloneUrlWithAuth}" "${clonePath}"`, {
        timeout: 60000, // 60 seconds timeout
      });

      logger.info({ repoFullName, clonePath }, "Repository cloned successfully");

      return {
        projectPath: clonePath,
        repoInfo,
      };
    } catch (error: unknown) {
      // Clean up on failure
      try {
        await fs.promises.rm(clonePath, { recursive: true, force: true });
      } catch (cleanupError) {
        logger.error({ error: cleanupError }, "Failed to clean up clone directory");
      }
      
      logger.error({ error: toErrorMessage(error), repoFullName }, "Failed to clone repository");
      throw new Error(`Failed to clone repository: ${toErrorMessage(error)}`);
    }
  }

  /**
   * Clean up cloned repository
   */
  static async cleanupClone(projectPath: string): Promise<void> {
    try {
      if (fs.existsSync(projectPath)) {
        await fs.promises.rm(projectPath, { recursive: true, force: true });
        logger.info({ projectPath }, "Cleaned up cloned repository");
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error), projectPath }, "Failed to clean up repository");
    }
  }

  /**
   * Clean up old clones (older than 1 hour)
   */
  static async cleanupOldClones(): Promise<void> {
    try {
      if (!fs.existsSync(this.CLONE_DIR)) {
        return;
      }

      const entries = await fs.promises.readdir(this.CLONE_DIR, { withFileTypes: true });
      const oneHourAgo = Date.now() - 60 * 60 * 1000;

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(this.CLONE_DIR, entry.name);
          const stats = await fs.promises.stat(entryPath);
          
          if (stats.mtime.getTime() < oneHourAgo) {
            await fs.promises.rm(entryPath, { recursive: true, force: true });
            logger.info({ path: entryPath }, "Cleaned up old repository clone");
          }
        }
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, "Failed to clean up old clones");
    }
  }
}
