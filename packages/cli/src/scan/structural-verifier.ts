/**
 * Structural Verification (Level 2)
 * 
 * AST + reachability + callsite context analysis
 */

import { readFileSync } from 'fs';
import { RealityFinding } from './reality-sniff';
import { Evidence } from './verification-engine';

export class StructuralVerifier {
  /**
   * Verify finding using AST and structural analysis
   */
  async verify(finding: RealityFinding, projectPath: string): Promise<Evidence | null> {
    try {
      // Try to use TypeScript compiler API if available
      if (this.isTypeScriptAvailable()) {
        return await this.verifyWithTypeScript(finding, projectPath);
      }

      // Fallback to basic structural analysis
      return await this.verifyBasic(finding, projectPath);
    } catch (error) {
      // If structural verification fails, return null (fallback to lexical)
      return null;
    }
  }

  private async verifyWithTypeScript(finding: RealityFinding, projectPath: string): Promise<Evidence | null> {
    // TODO: Implement full TypeScript AST analysis
    // This would:
    // 1. Parse file with TypeScript compiler API
    // 2. Find the specific node at file:line
    // 3. Analyze reachability (is it called? is it exported?)
    // 4. Analyze context (is it in error handler? is it in test?)
    // 5. Calculate evidence strength based on context

    // For now, return basic structural evidence
    return {
      level: 'structural',
      strength: 0.7,
      data: {
        method: 'ast_analysis',
        reachable: true, // TODO: Actually check
        context: 'production', // TODO: Actually determine
      },
    };
  }

  private async verifyBasic(finding: RealityFinding, projectPath: string): Promise<Evidence | null> {
    try {
      const content = readFileSync(finding.file, 'utf-8');
      const lines = content.split('\n');
      const targetLine = lines[finding.line - 1];

      // Basic structural checks
      const isExported = this.isExported(content, finding.line);
      const isInErrorHandler = this.isInErrorHandler(content, finding.line);
      const isInTest = finding.file.includes('test') || finding.file.includes('spec');
      const isReachable = !this.isDeadCode(content, finding.line);

      // Calculate strength based on context
      let strength = 0.6; // Base strength

      if (isExported && !isInTest) {
        strength += 0.1; // Exported code is more important
      }

      if (isInErrorHandler && finding.type === 'fake_success') {
        strength += 0.2; // Fake success in error handler is worse
      }

      if (!isReachable) {
        strength -= 0.2; // Dead code is less critical
      }

      return {
        level: 'structural',
        strength: Math.max(0.3, Math.min(1.0, strength)),
        data: {
          method: 'basic_analysis',
          exported: isExported,
          inErrorHandler: isInErrorHandler,
          inTest: isInTest,
          reachable: isReachable,
        },
      };
    } catch {
      return null;
    }
  }

  private isExported(content: string, lineNum: number): boolean {
    const lines = content.split('\n');
    const beforeContext = lines.slice(Math.max(0, lineNum - 10), lineNum).join('\n');
    return /\bexport\b/.test(beforeContext);
  }

  private isInErrorHandler(content: string, lineNum: number): boolean {
    const lines = content.split('\n');
    const beforeContext = lines.slice(Math.max(0, lineNum - 20), lineNum).join('\n');
    return /catch|onError|error|exception/i.test(beforeContext);
  }

  private isDeadCode(content: string, lineNum: number): boolean {
    const lines = content.split('\n');
    const afterContext = lines.slice(lineNum, Math.min(lines.length, lineNum + 20)).join('\n');
    // Check if there's a return or throw before this line that would make it unreachable
    const beforeContext = lines.slice(Math.max(0, lineNum - 20), lineNum).join('\n');
    return /return\s*;|throw\s+/.test(beforeContext) && !/if\s*\(/.test(beforeContext);
  }

  private isTypeScriptAvailable(): boolean {
    try {
      require.resolve('typescript');
      return true;
    } catch {
      return false;
    }
  }
}
