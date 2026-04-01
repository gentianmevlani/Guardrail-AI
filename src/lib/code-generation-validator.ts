/**
 * Code Generation Validator
 * 
 * Validates AI-generated code before it's used
 * Prevents hallucinations by checking against real codebase
 */

import { hallucinationDetector } from './hallucination-detector';
import { multiSourceVerifier } from './multi-source-verifier';
import { advancedContextManager } from './advanced-context-manager';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface ValidationResult {
  isValid: boolean;
  canUse: boolean;
  hallucinationScore: number; // 0-100, lower is better
  verificationScore: number; // 0-100, higher is better
  issues: Array<{
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    fix?: string;
  }>;
  recommendations: string[];
  confidence: number;
}

class CodeGenerationValidator {
  /**
   * Validate generated code
   */
  async validate(
    generatedCode: string,
    projectPath: string,
    context?: {
      file?: string;
      purpose?: string;
      relatedFiles?: string[];
    }
  ): Promise<ValidationResult> {
    // Step 1: Hallucination detection
    const hallucinationReport = await hallucinationDetector.detect(
      generatedCode,
      projectPath,
      context
    );

    // Step 2: Multi-source verification
    const verificationResult = await multiSourceVerifier.verify(
      generatedCode,
      projectPath,
      context
    );

    // Step 3: Combine results
    const issues: ValidationResult['issues'] = [];

    // Add hallucination issues
    for (const check of hallucinationReport.checks) {
      issues.push({
        type: check.type,
        severity: check.severity,
        message: check.suggestion,
        fix: check.expected,
      });
    }

    // Add verification issues
    for (const issue of verificationResult.issues) {
      issues.push({
        type: issue.type,
        severity: issue.severity,
        message: issue.message,
        fix: issue.suggestion,
      });
    }

    // Calculate scores
    const hallucinationScore = hallucinationReport.score;
    const verificationScore = verificationResult.confidence * 100;

    // Determine if code can be used
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');
    
    const canUse = criticalIssues.length === 0 && 
                   highIssues.length <= 2 &&
                   hallucinationScore < 30 &&
                   verificationScore > 60;

    const isValid = hallucinationScore < 50 && verificationScore > 50;

    // Generate recommendations
    const recommendations = [
      ...hallucinationReport.suggestions,
      ...verificationResult.recommendations,
    ];

    // Calculate overall confidence
    const confidence = (1 - hallucinationScore / 100) * 0.5 + 
                      (verificationScore / 100) * 0.5;

    return {
      isValid,
      canUse,
      hallucinationScore,
      verificationScore,
      issues,
      recommendations,
      confidence,
    };
  }

  /**
   * Get enhanced context for generation
   */
  async getGenerationContext(
    projectPath: string,
    request: {
      file?: string;
      purpose?: string;
      relatedFiles?: string[];
    }
  ): Promise<string> {
    return await advancedContextManager.generatePrompt(projectPath, request);
  }

  /**
   * Validate and fix code
   */
  async validateAndFix(
    generatedCode: string,
    projectPath: string,
    context?: {
      file?: string;
      purpose?: string;
    }
  ): Promise<{
    original: string;
    fixed: string;
    changes: Array<{ type: string; description: string }>;
    validation: ValidationResult;
  }> {
    const validation = await this.validate(generatedCode, projectPath, context);
    
    let fixed = generatedCode;
    const changes: Array<{ type: string; description: string }> = [];

    // Auto-fix critical issues
    for (const issue of validation.issues.filter(i => i.severity === 'critical' && i.fix)) {
      // Simplified auto-fix
      if (issue.type === 'fake-endpoint') {
        // Remove or comment out fake endpoints
        const endpointRegex = new RegExp(`['"]${issue.message.match(/['"]([^'"]+)['"]/)?.[1] || ''}['"]`, 'g');
        fixed = fixed.replace(endpointRegex, '/* INVALID ENDPOINT - REMOVED */');
        changes.push({
          type: 'endpoint-removal',
          description: `Removed invalid endpoint: ${issue.message}`,
        });
      }
    }

    return {
      original: generatedCode,
      fixed,
      changes,
      validation,
    };
  }
}

export const codeGenerationValidator = new CodeGenerationValidator();

