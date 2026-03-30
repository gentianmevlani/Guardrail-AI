/**
 * Automated Test Generator
 * 
 * Generates comprehensive tests based on codebase patterns
 * Unique: Learns your testing style and generates matching tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';
import { codePatternDNA } from './code-pattern-dna';

export interface TestCase {
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  code: string;
  assertions: string[];
}

export interface TestSuite {
  file: string;
  framework: 'jest' | 'vitest' | 'mocha' | 'jasmine';
  testCases: TestCase[];
  setup?: string;
  teardown?: string;
}

class TestGenerator {
  /**
   * Generate tests for a file
   */
  async generateTests(
    filePath: string,
    projectPath: string,
    options?: {
      framework?: 'jest' | 'vitest' | 'mocha' | 'jasmine';
      type?: 'unit' | 'integration' | 'e2e' | 'all';
      coverage?: number; // 0-100
    }
  ): Promise<TestSuite> {
    // Read source file
    const code = await fs.promises.readFile(filePath, 'utf8');

    // Detect framework
    const framework = options?.framework || this.detectFramework(projectPath);

    // Extract functions/classes to test
    const testables = this.extractTestables(code);

    // Generate test cases
    const testCases: TestCase[] = [];

    for (const testable of testables) {
      const cases = await this.generateTestCases(testable, code, projectPath, framework);
      testCases.push(...cases);
    }

    // Generate setup/teardown
    const setup = this.generateSetup(framework);
    const teardown = this.generateTeardown(framework);

    return {
      file: filePath,
      framework,
      testCases,
      setup,
      teardown,
    };
  }

  /**
   * Detect testing framework
   */
  private detectFramework(projectPath: string): 'jest' | 'vitest' | 'mocha' | 'jasmine' {
    // Check package.json
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps.vitest) return 'vitest';
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
      if (deps.jasmine) return 'jasmine';
    } catch {
      // Error reading package.json
    }

    return 'jest'; // Default
  }

  /**
   * Extract testable functions/classes
   */
  private extractTestables(code: string): Array<{
    name: string;
    type: 'function' | 'class' | 'component';
    line: number;
    params: string[];
    returnType?: string;
  }> {
    const testables: Array<{
      name: string;
      type: 'function' | 'class' | 'component';
      line: number;
      params: string[];
      returnType?: string;
    }> = [];

    // Extract functions
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    while ((match = functionRegex.exec(code)) !== null) {
      const params = match[2].split(',').map(p => p.trim()).filter(Boolean);
      testables.push({
        name: match[1],
        type: 'function',
        line: code.substring(0, match.index).split('\n').length,
        params,
      });
    }

    // Extract classes
    const classRegex = /(?:export\s+)?class\s+(\w+)/g;
    while ((match = classRegex.exec(code)) !== null) {
      testables.push({
        name: match[1],
        type: 'class',
        line: code.substring(0, match.index).split('\n').length,
        params: [],
      });
    }

    // Extract React components
    const componentRegex = /(?:export\s+)?(?:const|function)\s+(\w+)\s*[:=]\s*(?:\([^)]*\)\s*=>|\([^)]*\)\s*\{)/g;
    while ((match = componentRegex.exec(code)) !== null) {
      if (match[1][0] === match[1][0].toUpperCase()) {
        testables.push({
          name: match[1],
          type: 'component',
          line: code.substring(0, match.index).split('\n').length,
          params: [],
        });
      }
    }

    return testables;
  }

  /**
   * Generate test cases for a testable
   */
  private async generateTestCases(
    testable: ReturnType<typeof this.extractTestables>[0],
    code: string,
    projectPath: string,
    framework: string
  ): Promise<TestCase[]> {
    const cases: TestCase[] = [];

    // Get knowledge base for patterns
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    const testPatterns = (knowledge?.patterns as Array<Record<string, unknown>>)?.filter((p) => 
      p.category === 'testing' || p.name.includes('test')
    ) || [];

    // Generate basic test case
    cases.push({
      name: `should work correctly`,
      description: `Test ${testable.name}`,
      type: 'unit',
      code: this.generateTestCode(testable, framework, 'basic'),
      assertions: ['should be defined', 'should return expected value'],
    });

    // Generate edge case tests
    if (testable.params.length > 0) {
      cases.push({
        name: `should handle edge cases`,
        description: `Test ${testable.name} with edge cases`,
        type: 'unit',
        code: this.generateTestCode(testable, framework, 'edge'),
        assertions: ['should handle null', 'should handle empty', 'should handle invalid input'],
      });
    }

    // Generate error case tests
    cases.push({
      name: `should handle errors`,
      description: `Test ${testable.name} error handling`,
      type: 'unit',
      code: this.generateTestCode(testable, framework, 'error'),
      assertions: ['should throw error on invalid input', 'should handle exceptions'],
    });

    return cases;
  }

  /**
   * Generate test code
   */
  private generateTestCode(
    testable: ReturnType<typeof this.extractTestables>[0],
    framework: string,
    type: 'basic' | 'edge' | 'error'
  ): string {
    const frameworkTemplates: Record<string, Record<string, string>> = {
      jest: {
        basic: `test('${testable.name} should work correctly', () => {
  // Arrange
  ${this.generateArrange(testable)}
  
  // Act
  const result = ${testable.name}(${this.generateActParams(testable)});
  
  // Assert
  expect(result).toBeDefined();
});`,
        edge: `test('${testable.name} should handle edge cases', () => {
  // Test with null
  expect(() => ${testable.name}(null)).not.toThrow();
  
  // Test with empty
  expect(() => ${testable.name}('')).not.toThrow();
});`,
        error: `test('${testable.name} should handle errors', () => {
  // Test invalid input
  expect(() => ${testable.name}(undefined)).toThrow();
});`,
      },
      vitest: {
        basic: `import { describe, it, expect } from 'vitest';

describe('${testable.name}', () => {
  it('should work correctly', () => {
    ${this.generateArrange(testable)}
    const result = ${testable.name}(${this.generateActParams(testable)});
    expect(result).toBeDefined();
  });
});`,
        edge: `import { describe, it, expect } from 'vitest';

describe('${testable.name}', () => {
  it('should handle edge cases', () => {
    expect(() => ${testable.name}(null)).not.toThrow();
    expect(() => ${testable.name}('')).not.toThrow();
  });
});`,
        error: `import { describe, it, expect } from 'vitest';

describe('${testable.name}', () => {
  it('should handle errors', () => {
    expect(() => ${testable.name}(undefined)).toThrow();
  });
});`,
      },
    };

    return frameworkTemplates[framework]?.[type] || frameworkTemplates.jest[type];
  }

  /**
   * Generate arrange section
   */
  private generateArrange(testable: ReturnType<typeof this.extractTestables>[0]): string {
    if (testable.params.length === 0) return '';
    return testable.params.map((p, i) => {
      const paramName = p.split(':')[0].trim();
      return `const ${paramName} = 'test${i}';`;
    }).join('\n  ');
  }

  /**
   * Generate act params
   */
  private generateActParams(testable: ReturnType<typeof this.extractTestables>[0]): string {
    if (testable.params.length === 0) return '';
    return testable.params.map(p => p.split(':')[0].trim()).join(', ');
  }

  /**
   * Generate setup
   */
  private generateSetup(framework: string): string {
    const setups: Record<string, string> = {
      jest: `beforeEach(() => {
  // Setup before each test
});`,
      vitest: `import { beforeEach } from 'vitest';

beforeEach(() => {
  // Setup before each test
});`,
    };
    return setups[framework] || setups.jest;
  }

  /**
   * Generate teardown
   */
  private generateTeardown(framework: string): string {
    const teardowns: Record<string, string> = {
      jest: `afterEach(() => {
  // Cleanup after each test
});`,
      vitest: `import { afterEach } from 'vitest';

afterEach(() => {
  // Cleanup after each test
});`,
    };
    return teardowns[framework] || teardowns.jest;
  }

  /**
   * Write test file
   */
  async writeTestFile(
    testSuite: TestSuite,
    outputPath?: string
  ): Promise<string> {
    const sourceFile = testSuite.file;
    const ext = path.extname(sourceFile);
    const baseName = path.basename(sourceFile, ext);
    const dir = path.dirname(sourceFile);

    const testFileName = `${baseName}.test${ext}`;
    const testFilePath = outputPath || path.join(dir, testFileName);

    // Generate full test file
    const testFileContent = this.generateTestFileContent(testSuite);

    await fs.promises.writeFile(testFilePath, testFileContent, 'utf8');

    return testFilePath;
  }

  /**
   * Generate test file content
   */
  private generateTestFileContent(testSuite: TestSuite): string {
    const imports = this.generateImports(testSuite);
    const setup = testSuite.setup ? `\n${testSuite.setup}\n` : '';
    const teardown = testSuite.teardown ? `\n${testSuite.teardown}\n` : '';
    
    const testCases = testSuite.testCases.map(tc => `\n${tc.code}`).join('\n');

    return `${imports}${setup}${testCases}${teardown}`;
  }

  /**
   * Generate imports
   */
  private generateImports(testSuite: TestSuite): string {
    const imports: Record<string, string> = {
      jest: `import { ${testSuite.testCases[0]?.name ? testSuite.testCases[0].name : 'test'}, expect } from '@jest/globals';
import { ${path.basename(testSuite.file, path.extname(testSuite.file))} } from './${path.basename(testSuite.file)}';
`,
      vitest: `import { describe, it, expect } from 'vitest';
import { ${path.basename(testSuite.file, path.extname(testSuite.file))} } from './${path.basename(testSuite.file)}';
`,
    };
    return imports[testSuite.framework] || imports.jest;
  }
}

export const testGenerator = new TestGenerator();

