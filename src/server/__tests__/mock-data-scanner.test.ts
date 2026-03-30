import { describe, it, expect, beforeEach } from 'vitest';
import { mockDataScanner, MockDataIssue } from '../services/mock-data-scanner';

describe('Mock Data Scanner', () => {
  describe('scanContent', () => {
    it('should detect hardcoded array with IDs and names', () => {
      const code = `
        const users = [
          { id: 1, name: "John", email: "john@test.com" },
          { id: 2, name: "Jane", email: "jane@test.com" }
        ];
      `;
      
      const result = mockDataScanner.scanContent(code, 'users.ts');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.severity === 'error' || i.severity === 'warning')).toBe(true);
    });

    it('should detect lorem ipsum placeholder text', () => {
      const code = `
        const description = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.";
      `;
      
      const result = mockDataScanner.scanContent(code, 'content.ts');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.description.toLowerCase().includes('lorem'))).toBe(true);
    });

    it('should detect fake domains', () => {
      const code = `
        const apiUrl = "https://example.com/api/users";
        const webhookUrl = "https://test.com/webhook";
      `;
      
      const result = mockDataScanner.scanContent(code, 'config.ts');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.description.toLowerCase().includes('domain'))).toBe(true);
    });

    it('should detect variables named with mock/fake/dummy prefixes', () => {
      const code = `
        const mockUsers = [];
        const fakeData = {};
        const dummyResponse = null;
      `;
      
      const result = mockDataScanner.scanContent(code, 'mocks.ts');
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    });

    it('should detect fake email addresses', () => {
      const code = `
        const email = "user@example.com";
        const testEmail = "test@test.com";
      `;
      
      const result = mockDataScanner.scanContent(code, 'email.ts');
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect common placeholder names', () => {
      const code = `
        const userName = "John Doe";
        const customer = "Jane Doe";
      `;
      
      const result = mockDataScanner.scanContent(code, 'names.ts');
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(i => i.description.toLowerCase().includes('placeholder'))).toBe(true);
    });

    it('should return empty issues for clean code', () => {
      const code = `
        import { fetchUsers } from './api';
        
        async function getUsers() {
          const users = await fetchUsers();
          return users;
        }
      `;
      
      const result = mockDataScanner.scanContent(code, 'api-client.ts');
      expect(result.issues).toHaveLength(0);
    });

    it('should skip test files', () => {
      const code = `
        const mockUsers = [
          { id: 1, name: "John Doe" }
        ];
      `;
      
      const result = mockDataScanner.scanContent(code, 'users.test.ts');
      expect(result.issues).toHaveLength(0);
    });

    it('should skip spec files', () => {
      const code = `
        const fakeData = { lorem: "ipsum" };
      `;
      
      const result = mockDataScanner.scanContent(code, 'users.spec.ts');
      expect(result.issues).toHaveLength(0);
    });

    it('should include file and line information in issues', () => {
      const code = `const mockData = {};`;
      
      const result = mockDataScanner.scanContent(code, 'data.ts');
      
      if (result.issues.length > 0) {
        const issue = result.issues[0];
        expect(issue.file).toBe('data.ts');
        expect(issue.line).toBeGreaterThanOrEqual(1);
        expect(issue.severity).toBeDefined();
        expect(issue.suggestion).toBeDefined();
      }
    });
  });

  describe('detectMockData', () => {
    it('should return true for content with mock patterns', () => {
      const content = 'const mockUsers = [];';
      expect(mockDataScanner.detectMockData(content)).toBe(true);
    });

    it('should return false for clean content', () => {
      const content = 'const users = await api.getUsers();';
      expect(mockDataScanner.detectMockData(content)).toBe(false);
    });
  });
});
