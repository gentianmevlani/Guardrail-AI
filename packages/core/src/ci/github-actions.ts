/**
 * GitHub Actions Integration
 * 
 * Provides integration with GitHub Actions for automated security scanning
 */

export interface GitHubActionsConfig {
  workflowName: string;
  triggers: {
    push?: { branches: string[] };
    pullRequest?: { branches: string[] };
    schedule?: { cron: string }[];
    workflowDispatch?: boolean;
  };
  scanTypes: ('security' | 'secrets' | 'vulnerabilities' | 'compliance' | 'sbom')[];
  failOnCritical: boolean;
  failOnHigh: boolean;
  uploadArtifacts: boolean;
  createPRComments: boolean;
}

export interface WorkflowStep {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, string | boolean | number>;
  env?: Record<string, string>;
  if?: string;
}

export interface WorkflowJob {
  name: string;
  runsOn: string;
  permissions?: Record<string, string>;
  steps: WorkflowStep[];
}

export interface GitHubWorkflow {
  name: string;
  on: Record<string, any>;
  permissions?: Record<string, string>;
  jobs: Record<string, WorkflowJob>;
}

export class GitHubActionsGenerator {
  /**
   * Generate a complete GitHub Actions workflow
   */
  generateWorkflow(config: GitHubActionsConfig): string {
    const workflow: GitHubWorkflow = {
      name: config.workflowName,
      on: this.buildTriggers(config.triggers),
      permissions: {
        contents: 'read',
        'security-events': 'write',
        'pull-requests': config.createPRComments ? 'write' : 'read',
      },
      jobs: {
        'guardrail-scan': this.buildScanJob(config),
      },
    };

    return this.toYAML(workflow);
  }

  /**
   * Build workflow triggers
   */
  private buildTriggers(triggers: GitHubActionsConfig['triggers']): Record<string, any> {
    const on: Record<string, any> = {};

    if (triggers.push) {
      on['push'] = { branches: triggers.push.branches };
    }

    if (triggers.pullRequest) {
      on['pull_request'] = { branches: triggers.pullRequest.branches };
    }

    if (triggers.schedule) {
      on['schedule'] = triggers.schedule.map(s => ({ cron: s.cron }));
    }

    if (triggers.workflowDispatch) {
      on['workflow_dispatch'] = {};
    }

    return on;
  }

  /**
   * Build the main scan job
   */
  private buildScanJob(config: GitHubActionsConfig): WorkflowJob {
    const steps: WorkflowStep[] = [
      {
        name: 'Checkout code',
        uses: 'actions/checkout@v4',
        with: { 'fetch-depth': 0 },
      },
      {
        name: 'Setup Node.js',
        uses: 'actions/setup-node@v4',
        with: { 'node-version': '20' },
      },
      {
        name: 'Install dependencies',
        run: 'npm ci',
      },
    ];

    // Add scan steps based on config
    if (config.scanTypes.includes('secrets')) {
      steps.push({
        name: 'Scan for secrets',
        run: 'npx guardrail scan:secrets --format sarif --output secrets-results.sarif',
        env: { Guardrail_CI: 'true' },
      });
    }

    if (config.scanTypes.includes('vulnerabilities')) {
      steps.push({
        name: 'Scan for vulnerabilities',
        run: 'npx guardrail scan:vulnerabilities --format sarif --output vuln-results.sarif',
        env: { Guardrail_CI: 'true' },
      });
    }

    if (config.scanTypes.includes('security')) {
      steps.push({
        name: 'Security scan',
        run: 'npx guardrail scan:security --format sarif --output security-results.sarif',
        env: { Guardrail_CI: 'true' },
      });
    }

    if (config.scanTypes.includes('compliance')) {
      steps.push({
        name: 'Compliance check',
        run: 'npx guardrail scan:compliance --format json --output compliance-results.json',
        env: { Guardrail_CI: 'true' },
      });
    }

    if (config.scanTypes.includes('sbom')) {
      steps.push({
        name: 'Generate SBOM',
        run: 'npx guardrail sbom:generate --format cyclonedx --output sbom.json',
        env: { Guardrail_CI: 'true' },
      });
    }

    // Upload SARIF results
    steps.push({
      name: 'Upload SARIF results',
      uses: 'github/codeql-action/upload-sarif@v3',
      with: {
        'sarif_file': '.',
        'category': 'guardrail-security',
      },
      if: 'always()',
    });

    // Upload artifacts
    if (config.uploadArtifacts) {
      steps.push({
        name: 'Upload scan artifacts',
        uses: 'actions/upload-artifact@v4',
        with: {
          name: 'guardrail-results',
          path: '*.sarif\n*.json',
          'retention-days': 30,
        },
        if: 'always()',
      });
    }

    // Check results and fail if needed
    steps.push({
      name: 'Check scan results',
      run: this.buildCheckScript(config),
      env: { 
        FAIL_ON_CRITICAL: String(config.failOnCritical),
        FAIL_ON_HIGH: String(config.failOnHigh),
      },
    });

    return {
      name: 'guardrail Security Scan',
      runsOn: 'ubuntu-latest',
      steps,
    };
  }

  /**
   * Build result check script
   */
  private buildCheckScript(config: GitHubActionsConfig): string {
    return `
npx guardrail results:check \\
  --fail-on-critical=${config.failOnCritical} \\
  --fail-on-high=${config.failOnHigh}
`.trim();
  }

  /**
   * Convert workflow object to YAML
   */
  private toYAML(workflow: GitHubWorkflow): string {
    const lines: string[] = [];

    lines.push(`name: ${workflow.name}`);
    lines.push('');
    lines.push('on:');
    lines.push(this.objectToYAML(workflow.on, 2));
    lines.push('');

    if (workflow.permissions) {
      lines.push('permissions:');
      for (const [key, value] of Object.entries(workflow.permissions)) {
        lines.push(`  ${key}: ${value}`);
      }
      lines.push('');
    }

    lines.push('jobs:');
    for (const [jobId, job] of Object.entries(workflow.jobs)) {
      lines.push(`  ${jobId}:`);
      lines.push(`    name: ${job.name}`);
      lines.push(`    runs-on: ${job.runsOn}`);
      lines.push('    steps:');
      
      for (const step of job.steps) {
        lines.push(`      - name: ${step.name}`);
        if (step.uses) {
          lines.push(`        uses: ${step.uses}`);
        }
        if (step.run) {
          if (step.run.includes('\n')) {
            lines.push('        run: |');
            for (const line of step.run.split('\n')) {
              lines.push(`          ${line}`);
            }
          } else {
            lines.push(`        run: ${step.run}`);
          }
        }
        if (step.with) {
          lines.push('        with:');
          for (const [key, value] of Object.entries(step.with)) {
            if (typeof value === 'string' && value.includes('\n')) {
              lines.push(`          ${key}: |`);
              for (const line of value.split('\n')) {
                lines.push(`            ${line}`);
              }
            } else {
              lines.push(`          ${key}: ${value}`);
            }
          }
        }
        if (step.env) {
          lines.push('        env:');
          for (const [key, value] of Object.entries(step.env)) {
            lines.push(`          ${key}: ${value}`);
          }
        }
        if (step.if) {
          lines.push(`        if: ${step.if}`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Convert object to YAML with indentation
   */
  private objectToYAML(obj: Record<string, any>, indent: number): string {
    const lines: string[] = [];
    const prefix = ' '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && !Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        lines.push(this.objectToYAML(value, indent + 2));
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          if (typeof item === 'object') {
            const entries = Object.entries(item);
            if (entries.length > 0) {
              const firstEntry = entries[0];
              if (!firstEntry) continue;
              const [firstKey, firstValue] = firstEntry;
              lines.push(`${prefix}  - ${firstKey}: ${firstValue}`);
              for (const [k, v] of entries.slice(1)) {
                lines.push(`${prefix}    ${k}: ${v}`);
              }
            }
          } else {
            lines.push(`${prefix}  - ${item}`);
          }
        }
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate default workflow for quick setup
   */
  generateDefaultWorkflow(): string {
    return this.generateWorkflow({
      workflowName: 'guardrail Security Scan',
      triggers: {
        push: { branches: ['main', 'master'] },
        pullRequest: { branches: ['main', 'master'] },
        schedule: [{ cron: '0 0 * * 0' }], // Weekly on Sunday
        workflowDispatch: true,
      },
      scanTypes: ['security', 'secrets', 'vulnerabilities', 'sbom'],
      failOnCritical: true,
      failOnHigh: false,
      uploadArtifacts: true,
      createPRComments: true,
    });
  }
}

// Export singleton
export const githubActionsGenerator = new GitHubActionsGenerator();
