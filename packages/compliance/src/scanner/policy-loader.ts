import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { PolicyRule, PolicyDefinition, EvaluationContext, RuleResult, CheckDefinition } from './types';

export class PolicyLoader {
  private policiesDir: string;

  constructor(policiesDir: string = '.guardrail/policies') {
    this.policiesDir = policiesDir;
  }

  loadPolicies(framework: string): PolicyRule[] {
    const builtInPolicies = this.loadBuiltInPolicies(framework);
    const customPolicies = this.loadCustomPolicies(framework);
    return [...builtInPolicies, ...customPolicies];
  }

  private loadBuiltInPolicies(framework: string): PolicyRule[] {
    const policyFile = join(__dirname, '../policies', `${framework}.json`);
    if (!existsSync(policyFile)) {
      return [];
    }

    const policyDef: PolicyDefinition = JSON.parse(readFileSync(policyFile, 'utf-8'));
    return policyDef.rules.map(rule => this.createPolicyRule(rule));
  }

  private loadCustomPolicies(framework: string): PolicyRule[] {
    const customDir = join(process.cwd(), this.policiesDir);
    if (!existsSync(customDir)) {
      return [];
    }

    const policies: PolicyRule[] = [];
    const files = readdirSync(customDir).filter(f => 
      f.endsWith('.json') && f.includes(framework)
    );

    for (const file of files) {
      try {
        const policyDef: PolicyDefinition = JSON.parse(
          readFileSync(join(customDir, file), 'utf-8')
        );
        policies.push(...policyDef.rules.map(rule => this.createPolicyRule(rule)));
      } catch (error) {
        console.error(`Failed to load custom policy ${file}:`, error);
      }
    }

    return policies;
  }

  private createPolicyRule(ruleDef: PolicyDefinition['rules'][0]): PolicyRule {
    return {
      id: ruleDef.id,
      controlId: ruleDef.controlId,
      framework: 'custom',
      title: ruleDef.title,
      description: ruleDef.description,
      severity: ruleDef.severity,
      category: ruleDef.category,
      remediation: ruleDef.remediation,
      evaluate: async (context: EvaluationContext): Promise<RuleResult> => {
        const checkResults = await Promise.all(
          ruleDef.checks.map(check => this.evaluateCheck(check, context))
        );

        const allPassed = checkResults.every(r => r.passed);
        const evidenceRefs = checkResults
          .flatMap(r => r.evidenceRefs)
          .filter((ref): ref is string => ref !== undefined);

        return {
          passed: allPassed,
          controlId: ruleDef.controlId,
          severity: ruleDef.severity,
          message: allPassed 
            ? `${ruleDef.title}: All checks passed`
            : `${ruleDef.title}: ${checkResults.filter(r => !r.passed).length} check(s) failed`,
          evidenceRefs,
          remediation: ruleDef.remediation,
          metadata: {
            checks: checkResults.map(r => ({
              passed: r.passed,
              message: r.message
            }))
          }
        };
      }
    };
  }

  private async evaluateCheck(
    check: CheckDefinition,
    context: EvaluationContext
  ): Promise<{ passed: boolean; message: string; evidenceRefs?: string[] }> {
    switch (check.type) {
      case 'file-exists':
        return this.checkFileExists(check.target!, context);
      
      case 'dependency-present':
        return this.checkDependency(check.target!, context);
      
      case 'config-value':
        return this.checkConfigValue(check.target!, check.expected, context);
      
      case 'pattern-match':
        return this.checkPattern(check.target!, check.pattern!, context);
      
      default:
        return { passed: false, message: `Unknown check type: ${check.type}` };
    }
  }

  private checkFileExists(
    target: string,
    context: EvaluationContext
  ): { passed: boolean; message: string; evidenceRefs: string[] } {
    const fullPath = join(context.projectPath, target);
    const exists = existsSync(fullPath);
    
    return {
      passed: exists,
      message: exists ? `File exists: ${target}` : `File not found: ${target}`,
      evidenceRefs: exists ? [target] : []
    };
  }

  private checkDependency(
    depName: string,
    context: EvaluationContext
  ): { passed: boolean; message: string; evidenceRefs: string[] } {
    const hasDep = depName in context.dependencies;
    
    return {
      passed: hasDep,
      message: hasDep 
        ? `Dependency found: ${depName}@${context.dependencies[depName]}`
        : `Dependency not found: ${depName}`,
      evidenceRefs: hasDep ? ['package.json'] : []
    };
  }

  private checkConfigValue(
    key: string,
    expected: any,
    context: EvaluationContext
  ): { passed: boolean; message: string; evidenceRefs: string[] } {
    const configKey = key as keyof typeof context.config;
    const actual = context.config[configKey];
    const passed = actual === expected;
    
    return {
      passed,
      message: passed
        ? `Config check passed: ${key} = ${expected}`
        : `Config check failed: ${key} = ${actual}, expected ${expected}`,
      evidenceRefs: passed ? ['config'] : []
    };
  }

  private checkPattern(
    target: string,
    pattern: string,
    context: EvaluationContext
  ): { passed: boolean; message: string; evidenceRefs: string[] } {
    const content = context.files.get(target);
    if (!content) {
      return {
        passed: false,
        message: `File not found for pattern check: ${target}`,
        evidenceRefs: []
      };
    }

    const regex = new RegExp(pattern);
    const matches = regex.test(content);
    
    return {
      passed: matches,
      message: matches
        ? `Pattern found in ${target}`
        : `Pattern not found in ${target}`,
      evidenceRefs: matches ? [target] : []
    };
  }
}
