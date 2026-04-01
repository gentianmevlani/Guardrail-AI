import { CodeIntent, RequestIntent, IntentComparison } from '@guardrail/core';

/**
 * Intent Matcher
 *
 * Ensures generated code aligns with user's original request
 */
export class IntentMatcher {
  /**
   * Extract intent from generated code
   */
  async extractCodeIntent(code: string): Promise<CodeIntent> {
    const entities: string[] = [];
    const operations: string[] = [];

    // Extract function/class names
    const functionMatches = code.matchAll(/(?:function|const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
    for (const match of functionMatches) {
      if (match[1]) {
        entities.push(match[1]);
      }
    }

    // Extract class names
    const classMatches = code.matchAll(/class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g);
    for (const match of classMatches) {
      if (match[1]) {
        entities.push(match[1]);
      }
    }

    // Detect operations
    if (code.includes('fetch') || code.includes('axios') || code.includes('http')) {
      operations.push('API call');
    }
    if (code.includes('fs.') || code.includes('writeFile') || code.includes('readFile')) {
      operations.push('File I/O');
    }
    if (code.includes('database') || code.includes('prisma') || code.includes('mongoose')) {
      operations.push('Database operation');
    }
    if (code.includes('map') || code.includes('filter') || code.includes('reduce')) {
      operations.push('Data transformation');
    }
    if (code.includes('useState') || code.includes('useEffect')) {
      operations.push('React hooks');
    }

    // Determine primary intent from code structure
    let primary = 'Unknown';
    if (code.includes('export default') || code.includes('export class')) {
      primary = 'Module export';
    } else if (code.includes('function') || code.includes('const')) {
      primary = 'Function definition';
    } else if (code.includes('class')) {
      primary = 'Class definition';
    }

    return {
      primary,
      secondary: operations,
      entities,
      operations,
    };
  }

  /**
   * Parse user request to extract intent
   */
  async parseRequestIntent(request: string, _history?: string[]): Promise<RequestIntent> {
    const lowerRequest = request.toLowerCase();

    // Extract goal
    let goal = 'Unknown';
    if (lowerRequest.includes('create') || lowerRequest.includes('build')) {
      goal = 'Create new functionality';
    } else if (lowerRequest.includes('fix') || lowerRequest.includes('debug')) {
      goal = 'Fix issue';
    } else if (lowerRequest.includes('refactor') || lowerRequest.includes('improve')) {
      goal = 'Improve code';
    } else if (lowerRequest.includes('add')) {
      goal = 'Add feature';
    }

    // Extract constraints
    const constraints: string[] = [];
    if (lowerRequest.includes('without')) {
      const withoutMatch = lowerRequest.match(/without\s+([^.,;]+)/);
      if (withoutMatch) {
        constraints.push(`Avoid: ${withoutMatch[1]}`);
      }
    }
    if (lowerRequest.includes('using')) {
      const usingMatch = lowerRequest.match(/using\s+([^.,;]+)/);
      if (usingMatch) {
        constraints.push(`Use: ${usingMatch[1]}`);
      }
    }

    // Extract expected entities (libraries, frameworks, etc.)
    const expectedEntities: string[] = [];
    const commonFrameworks = ['react', 'vue', 'angular', 'express', 'fastify', 'next', 'prisma'];
    for (const framework of commonFrameworks) {
      if (lowerRequest.includes(framework)) {
        expectedEntities.push(framework);
      }
    }

    // Extract expected operations
    const expectedOperations: string[] = [];
    if (lowerRequest.includes('api') || lowerRequest.includes('fetch') || lowerRequest.includes('request')) {
      expectedOperations.push('API call');
    }
    if (lowerRequest.includes('database') || lowerRequest.includes('store') || lowerRequest.includes('save')) {
      expectedOperations.push('Database operation');
    }
    if (lowerRequest.includes('file') || lowerRequest.includes('read') || lowerRequest.includes('write')) {
      expectedOperations.push('File I/O');
    }
    if (lowerRequest.includes('validate') || lowerRequest.includes('check')) {
      expectedOperations.push('Validation');
    }

    return {
      goal,
      constraints,
      expectedEntities,
      expectedOperations,
    };
  }

  /**
   * Compare and score alignment between request and code
   */
  async compareIntents(
    requested: RequestIntent,
    actual: CodeIntent
  ): Promise<IntentComparison> {
    const matches: string[] = [];
    const mismatches: string[] = [];
    let score = 0;

    // Check if expected entities are present
    for (const expectedEntity of requested.expectedEntities) {
      const found = actual.entities.some((e: string) =>
        e.toLowerCase().includes(expectedEntity.toLowerCase())
      );

      if (found) {
        matches.push(`Expected entity '${expectedEntity}' found`);
        score += 20;
      } else {
        mismatches.push(`Expected entity '${expectedEntity}' not found`);
      }
    }

    // Check if expected operations are present
    for (const expectedOp of requested.expectedOperations) {
      const found = actual.operations.some((o: string) =>
        o.toLowerCase().includes(expectedOp.toLowerCase())
      );

      if (found) {
        matches.push(`Expected operation '${expectedOp}' found`);
        score += 20;
      } else {
        mismatches.push(`Expected operation '${expectedOp}' not found`);
      }
    }

    // Check constraints
    for (const constraint of requested.constraints) {
      if (constraint.startsWith('Avoid:')) {
        const toAvoid = constraint.replace('Avoid:', '').trim().toLowerCase();
        const found = actual.entities.some((e: string) => e.toLowerCase().includes(toAvoid));

        if (!found) {
          matches.push(`Successfully avoided '${toAvoid}'`);
          score += 10;
        } else {
          mismatches.push(`Constraint violated: used '${toAvoid}'`);
          score -= 20;
        }
      }

      if (constraint.startsWith('Use:')) {
        const toUse = constraint.replace('Use:', '').trim().toLowerCase();
        const found = actual.entities.some((e: string) => e.toLowerCase().includes(toUse));

        if (found) {
          matches.push(`Required technology '${toUse}' used`);
          score += 15;
        } else {
          mismatches.push(`Required technology '${toUse}' not used`);
          score -= 15;
        }
      }
    }

    // Normalize score to 0-100
    const alignmentScore = Math.max(0, Math.min(100, score));

    let recommendation = '';
    if (alignmentScore >= 80) {
      recommendation = 'Code aligns well with request';
    } else if (alignmentScore >= 60) {
      recommendation = 'Code partially aligns with request, minor adjustments needed';
    } else if (alignmentScore >= 40) {
      recommendation = 'Code has significant misalignment with request';
    } else {
      recommendation = 'Code does not align with request, regeneration recommended';
    }

    return {
      alignmentScore,
      matches,
      mismatches,
      recommendation,
    };
  }
}

// Export singleton instance
export const intentMatcher = new IntentMatcher();
