/**
 * Semantic Search Service Tests
 */

import { semanticSearchService } from '../semantic-search-service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('SemanticSearchService', () => {
  const testProjectPath = '/test/project';
  const testFiles = [
    path.join(testProjectPath, 'src', 'utils', 'helper.ts'),
    path.join(testProjectPath, 'src', 'components', 'Button.tsx'),
    path.join(testProjectPath, 'src', 'services', 'api.ts')
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildIndex', () => {
    it('should build index for all source files', async () => {
      // Mock readdir to return test files
      mockFs.readdir.mockImplementation((dirPath) => {
        if (dirPath === testProjectPath) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
            { name: '.git', isDirectory: () => true, isFile: () => false }
          ] as any);
        }
        if (dirPath === path.join(testProjectPath, 'src')) {
          return Promise.resolve([
            { name: 'utils', isDirectory: () => true, isFile: () => false },
            { name: 'components', isDirectory: () => true, isFile: () => false },
            { name: 'services', isDirectory: () => true, isFile: () => false }
          ] as any);
        }
        if (typeof dirPath === 'string' && (dirPath.includes('utils') || dirPath.includes('components') || dirPath.includes('services'))) {
          return Promise.resolve([
            { name: 'helper.ts', isDirectory: () => false, isFile: () => true },
            { name: 'Button.tsx', isDirectory: () => false, isFile: () => true },
            { name: 'api.ts', isDirectory: () => false, isFile: () => true }
          ] as any);
        }
        return Promise.resolve([] as any);
      });

      // Mock readFile
      mockFs.readFile.mockImplementation((_filePath) => {
        const content = `
          export function testFunction() {
            return 'test';
          }
          
          export class TestClass {
            method() {
              return 'method';
            }
          }
        `;
        return Promise.resolve(content);
      });

      await semanticSearchService.buildIndex(testProjectPath);

      // Verify files were read
      expect(mockFs.readFile).toHaveBeenCalledTimes(9); // 3 directories x 3 files each
    });

    it('should handle file read errors gracefully', async () => {
      // Mock readdir to return files
      mockFs.readdir.mockResolvedValue([
        { name: 'test.ts', isDirectory: () => false, isFile: () => true }
      ] as any);

      // Mock readFile to throw error
      mockFs.readFile.mockRejectedValue(new Error('Permission denied'));

      // Should not throw error
      await expect(semanticSearchService.buildIndex(testProjectPath)).resolves.not.toThrow();
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      // Clear any existing index
      (semanticSearchService as any).index = { files: new Map() };
      
      // Pre-build index with test data
      mockFs.readdir.mockImplementation((dirPath) => {
        if (dirPath === testProjectPath) {
          return Promise.resolve([
            { name: 'test.ts', isDirectory: () => false, isFile: () => true }
          ] as any);
        }
        return Promise.resolve([] as any);
      });

      mockFs.readFile.mockResolvedValue(`
        export function searchHelper() {
          return 'helps with search';
        }
        
        export function anotherFunction() {
          return 'another function';
        }
      `);

      await semanticSearchService.buildIndex(testProjectPath);
    });

    it('should return relevant search results', async () => {
      const results = await semanticSearchService.search('search', testProjectPath);

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]?.file).toContain('test.ts');
      expect(results[0]?.score).toBeGreaterThan(0);
      expect(results[0]?.content).toContain('searchHelper');
    });

    it('should return empty results for no matches', async () => {
      const results = await semanticSearchService.search('zzzzzzzzzz', testProjectPath);

      expect(results).toHaveLength(0);
    });

    it('should limit results to specified number', async () => {
      // Clear and rebuild with multiple files
      (semanticSearchService as any).index = { files: new Map() };
      
      mockFs.readdir.mockResolvedValue([
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file3.ts', isDirectory: () => false, isFile: () => true }
      ] as any);

      mockFs.readFile.mockResolvedValue(`
        export function matchFunction() {
          return 'matches';
        }
      `);

      await semanticSearchService.buildIndex(testProjectPath);

      const results = await semanticSearchService.search('match', testProjectPath, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('extractFunctions', () => {
    it('should extract TypeScript functions', async () => {
      const content = `
        export function testFunction(param: string) {
          return param;
        }
        
        const arrowFunction = (x: number) => x * 2;
        
        export async function asyncFunction() {
          return await Promise.resolve();
        }
      `;

      // Access private method through type assertion
      const service = semanticSearchService as any;
      const functions = service.extractFunctions(content, 'test.ts');

      expect(functions).toHaveLength(2);
      expect(functions[0].name).toBe('testFunction');
      expect(functions[1].name).toBe('asyncFunction');
    });

    it('should extract Python functions', async () => {
      const content = `
        def python_function(arg1, arg2):
            return arg1 + arg2
            
        async def async_python_function():
            return await something()
      `;

      const service = semanticSearchService as any;
      const functions = service.extractFunctions(content, 'test.py');

      expect(functions).toHaveLength(2);
      expect(functions[0].name).toBe('python_function');
      expect(functions[1].name).toBe('async_python_function');
    });
  });

  describe('calculateScore', () => {
    it('should give higher score for exact matches', () => {
      const service = semanticSearchService as any;
      
      const exactScore = service.calculateScore(['search'], 'search function', 'search');
      const partialScore = service.calculateScore(['search'], 'research function', 'search');
      
      expect(exactScore).toBeGreaterThanOrEqual(partialScore);
    });

    it('should boost camel case matches', () => {
      const service = semanticSearchService as any;
      
      const camelCaseScore = service.calculateScore(['sf'], 'SearchFunction', 'sf');
      const normalScore = service.calculateScore(['sf'], 'search function', 'sf');
      
      expect(camelCaseScore).toBeGreaterThanOrEqual(normalScore);
    });
  });

  describe('findSourceFiles', () => {
    it('should find all TypeScript and JavaScript files', async () => {
      mockFs.readdir.mockImplementation((dirPath) => {
        if (dirPath === testProjectPath) {
          return Promise.resolve([
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'test.ts', isDirectory: () => false, isFile: () => true },
            { name: 'test.js', isDirectory: () => false, isFile: () => true },
            { name: 'test.txt', isDirectory: () => false, isFile: () => true },
            { name: 'node_modules', isDirectory: () => true, isFile: () => false }
          ] as any);
        }
        if (dirPath === path.join(testProjectPath, 'src')) {
          return Promise.resolve([
            { name: 'component.tsx', isDirectory: () => false, isFile: () => true },
            { name: 'style.css', isDirectory: () => false, isFile: () => true }
          ] as any);
        }
        return Promise.resolve([] as any);
      });

      const service = semanticSearchService as any;
      const files = await service.findSourceFiles(testProjectPath);

      expect(files).toHaveLength(3);
      expect(files.some((f: string) => f.endsWith('.ts'))).toBe(true);
      expect(files.some((f: string) => f.endsWith('.js'))).toBe(true);
      expect(files.some((f: string) => f.endsWith('.tsx'))).toBe(true);
      expect(files.some((f: string) => f.endsWith('.css'))).toBe(false);
    });

    it('should ignore hidden directories and node_modules', async () => {
      mockFs.readdir.mockResolvedValue([
        { name: '.git', isDirectory: () => true, isFile: () => false },
        { name: '.hidden', isDirectory: () => true, isFile: () => false },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false },
        { name: 'valid.ts', isDirectory: () => false, isFile: () => true }
      ] as any);

      const service = semanticSearchService as any;
      const files = await service.findSourceFiles(testProjectPath);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('valid.ts');
    });
  });
});
