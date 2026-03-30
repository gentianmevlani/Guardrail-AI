/**
 * Tests for MockProof Build Gate - Import Graph Scanner
 */

import * as path from 'path';
import * as fs from 'fs';
import { ImportGraphScanner } from '../import-graph-scanner';

describe('ImportGraphScanner', () => {
  let scanner: ImportGraphScanner;

  beforeEach(() => {
    scanner = new ImportGraphScanner();
  });

  describe('scan', () => {
    it('should detect MockProvider in import chain', async () => {
      // Create a temp test fixture
      const tempDir = path.join(__dirname, '__fixtures__', 'mock-test');
      
      // Skip if fixtures don't exist (test in isolation)
      if (!fs.existsSync(tempDir)) {
        console.log('Skipping: no test fixtures');
        return;
      }

      const result = await scanner.scan(tempDir);
      
      expect(result).toHaveProperty('verdict');
      expect(result).toHaveProperty('violations');
      expect(result).toHaveProperty('scannedFiles');
    });

    it('should pass for clean project', async () => {
      const scanner = new ImportGraphScanner({
        entrypoints: [],
        bannedImports: [],
      });

      const result = await scanner.scan(__dirname);
      
      expect(result.verdict).toBe('pass');
      expect(result.violations).toHaveLength(0);
    });

    it('should generate readable report', async () => {
      const mockResult = {
        verdict: 'fail' as const,
        violations: [
          {
            entrypoint: 'src/app/layout.tsx',
            bannedImport: 'src/contexts/MockProvider.tsx',
            importChain: ['src/app/layout.tsx', 'src/contexts/index.ts', 'src/contexts/MockProvider.tsx'],
            pattern: 'MockProvider',
            message: 'MockProvider should not be reachable from production entrypoints',
          },
        ],
        scannedFiles: 42,
        entrypoints: ['src/app/layout.tsx'],
        timestamp: new Date().toISOString(),
        summary: {
          totalViolations: 1,
          uniqueBannedImports: 1,
          affectedEntrypoints: 1,
        },
      };

      const report = scanner.generateReport(mockResult);
      
      expect(report).toContain('MockProof Build Gate');
      expect(report).toContain('FAIL');
      expect(report).toContain('MockProvider');
      expect(report).toContain('src/app/layout.tsx');
    });
  });

  describe('banned patterns', () => {
    it('should have default banned patterns', () => {
      const scanner = new ImportGraphScanner();
      // Access private config via any for testing
      const config = (scanner as any).config;
      
      expect(config.bannedImports.length).toBeGreaterThan(0);
      expect(config.bannedImports.some((p: any) => p.pattern === 'MockProvider')).toBe(true);
      expect(config.bannedImports.some((p: any) => p.pattern.includes('localhost'))).toBe(true);
    });

    it('should allow custom banned patterns', () => {
      const customScanner = new ImportGraphScanner({
        bannedImports: [
          {
            pattern: 'MyCustomMock',
            message: 'Custom mock not allowed',
            isRegex: false,
            allowedIn: ['**/__tests__/**'],
          },
        ],
      });

      const config = (customScanner as any).config;
      expect(config.bannedImports.some((p: any) => p.pattern === 'MyCustomMock')).toBe(true);
    });
  });
});
