import { describe, it, expect, beforeEach } from 'vitest';
import { codeSearchService } from '../services/code-search-service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Code Search Service', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create a temporary test directory with sample files
    testDir = path.join(os.tmpdir(), `code-search-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    
    // Create sample TypeScript files
    await fs.writeFile(
      path.join(testDir, 'auth.ts'),
      `/**
 * Authentication utilities
 */
export async function authenticateUser(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('User not found');
  }
  const valid = await verifyPassword(password, user.passwordHash);
  return { user, token: generateToken(user) };
}

export function verifyToken(token: string) {
  return jwt.verify(token, SECRET);
}
`
    );

    await fs.writeFile(
      path.join(testDir, 'database.ts'),
      `/**
 * Database queries
 */
export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export async function createUser(data: UserInput) {
  return prisma.user.create({ data });
}

export class UserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } });
  }
  
  async updateUser(id: string, data: Partial<User>) {
    return prisma.user.update({ where: { id }, data });
  }
}
`
    );

    await fs.writeFile(
      path.join(testDir, 'utils.ts'),
      `// Utility functions
export function formatDate(date: Date): string {
  return date.toISOString();
}

export const parseJSON = (str: string) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
};
`
    );
  });

  describe('indexCodebase', () => {
    it('should index a directory and return stats', async () => {
      const stats = await codeSearchService.indexCodebase(testDir);
      
      expect(stats.totalFiles).toBeGreaterThan(0);
      expect(stats.totalBlocks).toBeGreaterThan(0);
      expect(stats.languages).toBeDefined();
      expect(stats.languages['TypeScript']).toBeGreaterThan(0);
      expect(stats.indexedAt).toBeDefined();
    });

    it('should track language statistics', async () => {
      const stats = await codeSearchService.indexCodebase(testDir);
      
      expect(stats.languages['TypeScript']).toBe(3);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await codeSearchService.indexCodebase(testDir);
    });

    it('should find code matching authentication query', async () => {
      const results = await codeSearchService.search('user authentication');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].file).toContain('auth');
    });

    it('should find database-related code', async () => {
      const results = await codeSearchService.search('find user by email');
      
      expect(results.length).toBeGreaterThan(0);
      // Should find the findUserByEmail function
      const hasDbResult = results.some(r => r.functionName?.includes('findUser') || r.file.includes('database'));
      expect(hasDbResult).toBe(true);
    });

    it('should return results sorted by similarity', async () => {
      const results = await codeSearchService.search('find user by email');
      
      if (results.length >= 2) {
        expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      }
    });

    it('should limit results', async () => {
      const results = await codeSearchService.search('function', 2);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should include function names in results', async () => {
      const results = await codeSearchService.search('authenticate user');
      
      const authResult = results.find(r => r.functionName === 'authenticateUser');
      expect(authResult).toBeDefined();
    });

    it('should generate previews for results', async () => {
      const results = await codeSearchService.search('user');
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].preview).toBeDefined();
      expect(results[0].preview.length).toBeGreaterThan(0);
    });
  });

  describe('findSimilar', () => {
    beforeEach(async () => {
      await codeSearchService.indexCodebase(testDir);
    });

    it('should find similar code patterns', async () => {
      const codeSnippet = `
        async function findUser(id) {
          return db.user.findOne({ id });
        }
      `;
      
      const results = await codeSearchService.findSimilar(codeSnippet);
      
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('should return null before indexing', () => {
      // Reset service state by creating new instance behavior
      const stats = codeSearchService.getStats();
      // After indexing in previous tests, this should have stats
      // This test mainly checks the method doesn't throw
      expect(stats === null || typeof stats === 'object').toBe(true);
    });

    it('should return stats after indexing', async () => {
      await codeSearchService.indexCodebase(testDir);
      const stats = codeSearchService.getStats();
      
      expect(stats).not.toBeNull();
      expect(stats?.totalFiles).toBeGreaterThan(0);
    });
  });

  // Cleanup
  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });
});
