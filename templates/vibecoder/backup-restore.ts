/**
 * Backup & Restore
 * 
 * What AI app builders forget: Users need to backup their data
 */

import { Request, Response } from 'express';
import { query, transaction } from '../backend/utils/database.util';
import { logger } from '../backend/utils/logger.util';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Create backup
 */
export async function createBackup(
  userId: string,
  res: Response
): Promise<void> {
  try {
    // Collect all user data
    const backup = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      userId,
      data: {
        profile: await getUserData(userId, 'users'),
        posts: await getUserData(userId, 'posts'),
        comments: await getUserData(userId, 'comments'),
        settings: await getUserData(userId, 'user_settings'),
      },
    };

    // Save backup
    const backupDir = path.join(process.cwd(), 'backups', userId);
    await fs.promises.mkdir(backupDir, { recursive: true });

    const backupFile = path.join(backupDir, `backup-${Date.now()}.json`);
    await fs.promises.writeFile(backupFile, JSON.stringify(backup, null, 2));

    // Store backup metadata
    await query(
      `INSERT INTO backups (user_id, file_path, created_at)
       VALUES ($1, $2, NOW())`,
      [userId, backupFile]
    );

    res.json({
      success: true,
      backupId: path.basename(backupFile),
      timestamp: backup.timestamp,
    });

    logger.info('Backup created', { userId, backupFile });
  } catch (error: any) {
    logger.error('Backup creation failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create backup',
    });
  }
}

/**
 * Restore from backup
 */
export async function restoreBackup(
  userId: string,
  backupId: string
): Promise<{ success: boolean; restored: number; errors: string[] }> {
  const restored: number[] = [];
  const errors: string[] = [];

  try {
    // Load backup
    const backupResult = await query(
      'SELECT file_path FROM backups WHERE user_id = $1 AND file_path LIKE $2',
      [userId, `%${backupId}%`]
    );

    if (backupResult.rows.length === 0) {
      throw new Error('Backup not found');
    }

    const backupPath = backupResult.rows[0].file_path;
    const backupData = JSON.parse(
      await fs.promises.readFile(backupPath, 'utf8')
    );

    // Restore in transaction
    await transaction(async (client) => {
      // Restore profile
      if (backupData.data.profile) {
        try {
          await client.query(
            `UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3`,
            [backupData.data.profile.name, backupData.data.profile.email, userId]
          );
          restored.push(1);
        } catch (error: any) {
          errors.push(`Profile: ${error.message}`);
        }
      }

      // Restore posts
      if (backupData.data.posts && Array.isArray(backupData.data.posts)) {
        for (const post of backupData.data.posts) {
          try {
            await client.query(
              `INSERT INTO posts (id, user_id, title, content, created_at)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO UPDATE SET title = $3, content = $4`,
              [post.id, userId, post.title, post.content, post.created_at]
            );
            restored.push(1);
          } catch (error: any) {
            errors.push(`Post ${post.id}: ${error.message}`);
          }
        }
      }
    });

    logger.info('Backup restored', { userId, backupId, restored: restored.length });

    return {
      success: errors.length === 0,
      restored: restored.length,
      errors,
    };
  } catch (error: any) {
    logger.error('Backup restore failed', error);
    throw error;
  }
}

/**
 * List backups
 */
export async function listBackups(userId: string): Promise<Array<{
  id: string;
  timestamp: string;
  size: number;
}>> {
  const result = await query(
    `SELECT file_path, created_at FROM backups 
     WHERE user_id = $1 
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => {
    const stats = fs.statSync(row.file_path);
    return {
      id: path.basename(row.file_path),
      timestamp: row.created_at,
      size: stats.size,
    };
  });
}

// Helper
async function getUserData(userId: string, table: string) {
  const result = await query(
    `SELECT * FROM ${table} WHERE user_id = $1`,
    [userId]
  );
  return result.rows;
}

