/**
 * Tests for static scanner
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { runStaticScan, formatStaticScanResults } from '../static-scanner';

describe('Static Scanner', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `guardrail-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  it('should detect empty onClick handlers', () => {
    const testFile = join(testDir, 'test.tsx');
    writeFileSync(testFile, `
      function Test() {
        return <button onClick={() => {}}>Click me</button>;
      }
    `);

    const result = runStaticScan(testDir, ['.']);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(e => e.message.includes('Empty onClick handler'))).toBe(true);
  });

  it('should detect href="#" patterns', () => {
    const testFile = join(testDir, 'test.tsx');
    writeFileSync(testFile, `
      function Test() {
        return <a href="#">Dead link</a>;
      }
    `);

    const result = runStaticScan(testDir, ['.']);
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => e.message.includes('href="#"'))).toBe(true);
  });

  it('should detect empty catch blocks', () => {
    const testFile = join(testDir, 'test.ts');
    writeFileSync(testFile, `
      try {
        doSomething();
      } catch (e) {}
    `);

    const result = runStaticScan(testDir, ['.']);
    expect(result.passed).toBe(false);
    expect(result.errors.some(e => e.message.includes('Empty catch block'))).toBe(true);
  });

  it('should pass when no patterns found', () => {
    const testFile = join(testDir, 'test.tsx');
    writeFileSync(testFile, `
      function Test() {
        const handleClick = () => {
          console.log('clicked');
        };
        return <button onClick={handleClick}>Click me</button>;
      }
    `);

    const result = runStaticScan(testDir, ['.']);
    expect(result.passed).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('should format results correctly', () => {
    const testFile = join(testDir, 'test.tsx');
    writeFileSync(testFile, `
      function Test() {
        return <button onClick={() => {}}>Click me</button>;
      }
    `);

    const result = runStaticScan(testDir, ['.']);
    const formatted = formatStaticScanResults(result);
    
    expect(formatted).toContain('error');
    expect(formatted).toContain('test.tsx');
  });
});
