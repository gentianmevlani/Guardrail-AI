/**
 * Test Coverage Mapper
 * 
 * Maps test coverage to components, showing which components are tested
 * and which need tests - saving hours of manual test coverage analysis.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ComponentSpec } from './mdc-generator';

export interface TestCoverageInfo {
  component: string;
  componentPath: string;
  hasTests: boolean;
  testFiles: string[];
  testCoverage: 'full' | 'partial' | 'none';
  testTypes: ('unit' | 'integration' | 'e2e')[];
  confidence: number;
}

export interface CoverageSummary {
  totalComponents: number;
  testedComponents: number;
  untestedComponents: number;
  coveragePercentage: number;
  byType: Record<string, { total: number; tested: number }>;
  needsAttention: ComponentSpec[];
}

export class TestCoverageMapper {
  private projectPath: string;
  private testPatterns = [
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /__tests__\//,
    /\.test\./,
    /\.spec\./,
  ];

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Map test coverage for all components
   */
  async mapCoverage(components: ComponentSpec[]): Promise<Map<string, TestCoverageInfo>> {
    const coverageMap = new Map<string, TestCoverageInfo>();

    console.log('🧪 Mapping test coverage...\n');

    for (const component of components) {
      const coverage = await this.findTestsForComponent(component);
      coverageMap.set(component.name, coverage);

      const emoji = coverage.hasTests ? '✅' : '❌';
      console.log(`   ${emoji} ${component.name}: ${coverage.testCoverage} (${coverage.testFiles.length} test files)`);
    }

    console.log('');
    return coverageMap;
  }

  /**
   * Find tests for a component
   */
  private async findTestsForComponent(component: ComponentSpec): Promise<TestCoverageInfo> {
    const testFiles: string[] = [];
    const testTypes: ('unit' | 'integration' | 'e2e')[] = [];
    
    const componentDir = path.dirname(component.path);
    const componentBaseName = path.basename(component.path, path.extname(component.path));
    
    // Look for test files in same directory
    const sameDirTests = await this.findTestFilesInDirectory(componentDir, componentBaseName);
    testFiles.push(...sameDirTests);

    // Look for test files in __tests__ directory
    const testDir = path.join(componentDir, '__tests__');
    const testDirTests = await this.findTestFilesInDirectory(testDir, componentBaseName);
    testFiles.push(...testDirTests);

    // Look in test directories
    const testDirs = ['tests', 'test', '__tests__'];
    for (const testDirName of testDirs) {
      const fullTestDir = path.join(this.projectPath, testDirName);
      const tests = await this.findTestFilesInDirectory(fullTestDir, component.name);
      testFiles.push(...tests);
    }

    // Classify test types
    for (const testFile of testFiles) {
      const content = await this.readFileIfExists(testFile);
      if (content) {
        if (content.includes('describe(') || content.includes('it(') || content.includes('test(')) {
          if (content.includes('e2e') || content.includes('end-to-end') || testFile.includes('e2e')) {
            testTypes.push('e2e');
          } else if (content.includes('integration') || testFile.includes('integration')) {
            testTypes.push('integration');
          } else {
            testTypes.push('unit');
          }
        }
      }
    }

    // Determine coverage level
    let testCoverage: 'full' | 'partial' | 'none' = 'none';
    if (testFiles.length > 0) {
      // Read test files to check if they actually test this component
      let relevantTests = 0;
      for (const testFile of testFiles) {
        const content = await this.readFileIfExists(testFile);
        if (content && (
          content.includes(component.name) ||
          content.includes(componentBaseName) ||
          content.includes(path.basename(component.path))
        )) {
          relevantTests++;
        }
      }

      if (relevantTests === testFiles.length && testFiles.length >= 2) {
        testCoverage = 'full';
      } else if (relevantTests > 0) {
        testCoverage = 'partial';
      }
    }

    // Calculate confidence
    const confidence = testFiles.length > 0 ? 
      (testCoverage === 'full' ? 1.0 : testCoverage === 'partial' ? 0.6 : 0.3) : 0.0;

    return {
      component: component.name,
      componentPath: component.path,
      hasTests: testFiles.length > 0 && testCoverage !== 'none',
      testFiles: [...new Set(testFiles)],
      testCoverage,
      testTypes: [...new Set(testTypes)],
      confidence,
    };
  }

  /**
   * Find test files in a directory matching a pattern
   */
  private async findTestFilesInDirectory(dir: string, pattern: string): Promise<string[]> {
    const testFiles: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile()) {
          const fullPath = path.join(dir, entry.name);
          
          // Check if it matches test patterns
          const isTestFile = this.testPatterns.some(pattern => 
            entry.name.match(pattern) || fullPath.match(pattern)
          );

          if (isTestFile) {
            // Check if it mentions the component
            const content = await this.readFileIfExists(fullPath);
            if (content && (
              content.includes(pattern) ||
              content.includes(path.basename(pattern, path.extname(pattern)))
            )) {
              testFiles.push(path.relative(this.projectPath, fullPath));
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return testFiles;
  }

  /**
   * Generate coverage summary
   */
  async generateSummary(components: ComponentSpec[], coverageMap: Map<string, TestCoverageInfo>): Promise<CoverageSummary> {
    const totalComponents = components.length;
    let testedComponents = 0;
    const needsAttention: ComponentSpec[] = [];

    const byType: Record<string, { total: number; tested: number }> = {};

    for (const component of components) {
      const coverage = coverageMap.get(component.name);
      
      if (coverage?.hasTests) {
        testedComponents++;
      } else {
        // High importance untested components need attention
        if (component.importanceScore >= 80) {
          needsAttention.push(component);
        }
      }

      // Group by type
      if (!byType[component.type]) {
        byType[component.type] = { total: 0, tested: 0 };
      }
      byType[component.type].total++;
      if (coverage?.hasTests) {
        byType[component.type].tested++;
      }
    }

    const coveragePercentage = totalComponents > 0 
      ? Math.round((testedComponents / totalComponents) * 100)
      : 0;

    return {
      totalComponents,
      testedComponents,
      untestedComponents: totalComponents - testedComponents,
      coveragePercentage,
      byType,
      needsAttention: needsAttention.sort((a, b) => b.importanceScore - a.importanceScore),
    };
  }

  /**
   * Format test coverage for MDC file
   */
  formatTestCoverage(coverage: TestCoverageInfo): string {
    let output = `\n## 🧪 Test Coverage\n\n`;
    
    if (coverage.hasTests) {
      const emoji = coverage.testCoverage === 'full' ? '✅' : '⚠️';
      output += `${emoji} **Coverage: ${coverage.testCoverage.toUpperCase()}**\n\n`;
      output += `**Test Files (${coverage.testFiles.length}):**\n`;
      coverage.testFiles.forEach(file => {
        output += `- \`${file}\`\n`;
      });
      
      if (coverage.testTypes.length > 0) {
        output += `\n**Test Types:** ${coverage.testTypes.join(', ')}\n`;
      }
      
      output += `\n**Confidence:** ${Math.round(coverage.confidence * 100)}%\n`;
    } else {
      output += `❌ **No tests found**\n\n`;
      output += `⚠️ This component has no test coverage. Consider adding tests.\n`;
    }

    return output;
  }

  /**
   * Read file if it exists
   */
  private async readFileIfExists(filePath: string): Promise<string | null> {
    try {
      return await fs.readFile(filePath, 'utf8');
    } catch {
      return null;
    }
  }
}

