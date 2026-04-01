/**
 * Data Export/Import
 * 
 * What AI app builders forget: Users need to export their data
 */

import { Response } from 'express';
import { query } from '../backend/utils/database.util';
import { logger } from '../backend/utils/logger.util';

/**
 * Export user data (GDPR compliance)
 */
export async function exportUserData(
  userId: string,
  res: Response
): Promise<void> {
  try {
    // Collect all user data
    const userData = {
      profile: await getUserProfile(userId),
      posts: await getUserPosts(userId),
      comments: await getUserComments(userId),
      settings: await getUserSettings(userId),
      activity: await getUserActivity(userId),
    };

    // Generate JSON export
    const exportData = {
      exportDate: new Date().toISOString(),
      userId,
      data: userData,
    };

    // Set headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${userId}.json"`);

    res.json(exportData);

    logger.info('User data exported', { userId });
  } catch (error: any) {
    logger.error('Data export failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export data',
    });
  }
}

/**
 * Export as CSV
 */
export async function exportAsCSV(
  userId: string,
  dataType: 'posts' | 'comments' | 'activity',
  res: Response
): Promise<void> {
  try {
    let data: any[] = [];
    let headers: string[] = [];

    switch (dataType) {
      case 'posts':
        data = await getUserPosts(userId);
        headers = ['id', 'title', 'content', 'created_at', 'updated_at'];
        break;
      case 'comments':
        data = await getUserComments(userId);
        headers = ['id', 'content', 'post_id', 'created_at'];
        break;
      case 'activity':
        data = await getUserActivity(userId);
        headers = ['id', 'action', 'timestamp', 'details'];
        break;
    }

    // Generate CSV
    const csv = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((header) => JSON.stringify(row[header] || '')).join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${dataType}-${userId}.csv"`);
    res.send(csv);

    logger.info('CSV export completed', { userId, dataType });
  } catch (error: any) {
    logger.error('CSV export failed', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV',
    });
  }
}

/**
 * Import user data
 */
export async function importUserData(
  userId: string,
  data: any
): Promise<{ success: boolean; imported: number; errors: string[] }> {
  const imported: number[] = [];
  const errors: string[] = [];

  try {
    // Validate data structure
    if (!data.data) {
      throw new Error('Invalid data format');
    }

    // Import profile
    if (data.data.profile) {
      try {
        await updateUserProfile(userId, data.data.profile);
        imported.push(1);
      } catch (error: any) {
        errors.push(`Profile: ${error.message}`);
      }
    }

    // Import posts
    if (data.data.posts && Array.isArray(data.data.posts)) {
      for (const post of data.data.posts) {
        try {
          await importPost(userId, post);
          imported.push(1);
        } catch (error: any) {
          errors.push(`Post ${post.id}: ${error.message}`);
        }
      }
    }

    logger.info('User data imported', { userId, imported: imported.length, errors: errors.length });

    return {
      success: errors.length === 0,
      imported: imported.length,
      errors,
    };
  } catch (error: any) {
    logger.error('Data import failed', error);
    throw error;
  }
}

// Helper functions
async function getUserProfile(userId: string) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

async function getUserPosts(userId: string) {
  const result = await query('SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

async function getUserComments(userId: string) {
  const result = await query('SELECT * FROM comments WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows;
}

async function getUserSettings(userId: string) {
  const result = await query('SELECT * FROM user_settings WHERE user_id = $1', [userId]);
  return result.rows[0] || null;
}

async function getUserActivity(userId: string) {
  const result = await query('SELECT * FROM user_activity WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1000', [userId]);
  return result.rows;
}

async function updateUserProfile(userId: string, profile: any) {
  await query(
    `UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3`,
    [profile.name, profile.email, userId]
  );
}

async function importPost(userId: string, post: any) {
  await query(
    `INSERT INTO posts (user_id, title, content, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET title = $2, content = $3`,
    [userId, post.title, post.content, post.created_at]
  );
}

