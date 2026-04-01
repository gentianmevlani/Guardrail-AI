/**
 * AST-Based Structural Verification
 * 
 * Verifies findings from lexical pass using AST analysis:
 * - Empty catch blocks: verify no logging/rethrow
 * - Fake success: detect returns in catch/error handlers
 * - Auth bypass: verify reachability in production
 */

// Dynamic import for TypeScript - may not be available in all environments
let ts: typeof import('typescript') | null = null;

try {
  ts = require('typescript');
} catch {
  // TypeScript not available - AST verification will be limited
}
import * as fs from 'fs';
import { RealityFinding, Evidence } from './reality-sniff-scanner';

export interface ASTVerificationResult {
  verified: boolean;
  evidence: Evidence[];
  confidence: number;
  details: string;
}

export class ASTVerifier {
  /**
   * Verify empty catch block has no error handling
   */
  verifyEmptyCatch(filePath: string, line: number): ASTVerificationResult {
    if (!ts) {
      return {
        verified: false,
        evidence: [],
        confidence: 0.3,
        details: 'TypeScript compiler not available for AST parsing',
      };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const evidence: Evidence[] = [];
      let hasErrorHandling = false;
      let catchNode: ts.CatchClause | null = null;

      const visit = (node: ts.Node) => {
        // Find catch clause at or near the line
        if (ts.isCatchClause(node)) {
          const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
          const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;

          if (line >= startLine && line <= endLine) {
            catchNode = node;
            const block = node.block;

            // Check if block has statements
            if (block.statements.length === 0) {
              evidence.push({
                type: 'structural',
                description: 'Catch block is completely empty',
                file: filePath,
                line,
                code: node.getText(sourceFile),
              });
            } else {
              // Check if any statement handles the error
              for (const stmt of block.statements) {
                // Check for logging
                if (this.hasLogging(stmt, sourceFile)) {
                  hasErrorHandling = true;
                  evidence.push({
                    type: 'structural',
                    description: 'Catch block contains logging',
                    file: filePath,
                    line: sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
                    code: stmt.getText(sourceFile),
                  });
                }

                // Check for rethrow
                if (this.hasRethrow(stmt)) {
                  hasErrorHandling = true;
                  evidence.push({
                    type: 'structural',
                    description: 'Catch block rethrows error',
                    file: filePath,
                    line: sourceFile.getLineAndCharacterOfPosition(stmt.getStart()).line + 1,
                    code: stmt.getText(sourceFile),
                  });
                }
              }
            }
          }
        }

        if (ts) ts.forEachChild(node, visit);
      };

      if (ts) visit(sourceFile);

      return {
        verified: !hasErrorHandling && catchNode !== null,
        evidence,
        confidence: catchNode ? 0.95 : 0.5,
        details: hasErrorHandling
          ? 'Catch block contains error handling (logging or rethrow)'
          : 'Catch block is empty or has no error handling',
      };
    } catch (error) {
      return {
        verified: false,
        evidence: [],
        confidence: 0.3,
        details: `AST parsing failed: ${error}`,
      };
    }
  }

  /**
   * Verify fake success pattern is in error path
   */
  verifyFakeSuccessInErrorPath(
    filePath: string,
    line: number,
    pattern: string
  ): ASTVerificationResult {
    if (!ts) {
      return {
        verified: false,
        evidence: [],
        confidence: 0.3,
        details: 'TypeScript compiler not available for AST parsing',
      };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const evidence: Evidence[] = [];
      let inCatchBlock = false;
      let inErrorHandler = false;
      let returnNode: ts.ReturnStatement | null = null;

      const visit = (node: ts.Node) => {
        const nodeLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

        if (ts && ts.isCatchClause(node)) {
          inCatchBlock = true;
          ts.forEachChild(node, visit);
          inCatchBlock = false;
          return;
        }

        if (ts && ts.isReturnStatement(node) && nodeLine === line) {
          returnNode = node;
          const returnText = node.getText(sourceFile);

          if (pattern.includes('success') && returnText.includes('success')) {
            evidence.push({
              type: 'structural',
              description: `Return statement found: ${returnText}`,
              file: filePath,
              line,
              code: returnText,
            });

            if (inCatchBlock) {
              evidence.push({
                type: 'structural',
                description: 'Return statement is inside catch block',
                file: filePath,
                line,
              });
              inErrorHandler = true;
            }
          }
        }

        if (ts) ts.forEachChild(node, visit);
      };

      if (ts) visit(sourceFile);

      return {
        verified: inErrorHandler && returnNode !== null,
        evidence,
        confidence: inErrorHandler ? 0.9 : 0.6,
        details: inErrorHandler
          ? 'Fake success return is inside catch/error handler'
          : 'Fake success return is not in error path',
      };
    } catch (error) {
      return {
        verified: false,
        evidence: [],
        confidence: 0.3,
        details: `AST parsing failed: ${error}`,
      };
    }
  }

  /**
   * Verify auth bypass is reachable in production
   */
  verifyAuthBypassReachability(
    filePath: string,
    line: number
  ): ASTVerificationResult {
    if (!ts) {
      return {
        verified: false,
        evidence: [],
        confidence: 0.3,
        details: 'TypeScript compiler not available for AST parsing',
      };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const evidence: Evidence[] = [];
      let hasProductionGuard = false;
      let hasDevOnlyGuard = false;

      const visit = (node: ts.Node) => {
        const nodeLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

        if (nodeLine === line) {
          // Check parent nodes for guards
          let parent = node.parent;
          while (parent) {
            const parentText = parent.getText(sourceFile);

            // Check for NODE_ENV guards
            if (/process\.env\.NODE_ENV\s*[!=]==\s*['"]production['"]/i.test(parentText)) {
              hasProductionGuard = true;
              evidence.push({
                type: 'structural',
                description: 'Auth bypass is guarded by NODE_ENV check',
                file: filePath,
                line: sourceFile.getLineAndCharacterOfPosition(parent.getStart()).line + 1,
                code: parentText,
              });
            }

            // Check for dev-only guards
            if (/process\.env\.NODE_ENV\s*[!=]==\s*['"]development['"]/i.test(parentText)) {
              hasDevOnlyGuard = true;
            }

            parent = parent.parent;
          }
        }

        if (ts) ts.forEachChild(node, visit);
      };

      if (ts) visit(sourceFile);

      return {
        verified: !hasProductionGuard && !hasDevOnlyGuard,
        evidence,
        confidence: hasProductionGuard ? 0.1 : hasDevOnlyGuard ? 0.3 : 0.9,
        details: hasProductionGuard
          ? 'Auth bypass is guarded and not reachable in production'
          : hasDevOnlyGuard
            ? 'Auth bypass is guarded by dev-only check'
            : 'Auth bypass is not guarded and may be reachable in production',
      };
    } catch (error) {
      return {
        verified: false,
        evidence: [],
        confidence: 0.3,
        details: `AST parsing failed: ${error}`,
      };
    }
  }

  private hasLogging(node: any, sourceFile: any): boolean {
    if (!ts || !sourceFile) return false;
    const text = node.getText(sourceFile).toLowerCase();
    return /console\.(log|error|warn|info)|logger\.(log|error|warn|info)|\.log\(|\.error\(/.test(text);
  }

  private hasRethrow(node: any): boolean {
    if (!ts) return false;
    return ts.isThrowStatement(node) || 
           (ts.isReturnStatement(node) && node.expression && ts.isIdentifier(node.expression));
  }
}

export const astVerifier = new ASTVerifier();
