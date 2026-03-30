/**
 * CI Workflow Generator
 * Generates working GitHub Actions workflows with SARIF upload support
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generateGitHubActions, generatePreCommitHooks } from '@guardrail/core';
import type { GuardrailConfig } from './templates';

export interface CIGeneratorOptions {
  projectPath: string;
  config: GuardrailConfig;
  provider?: 'github' | 'gitlab' | 'azure' | 'bitbucket';
}

export interface CIGeneratorResult {
  success: boolean;
  workflowPath: string;
  provider: string;
}

function generateGitHubActionsWorkflow(config: GuardrailConfig): string {
  const useSarif = config.output.format === 'sarif' || config.output.sarifUpload;
  const runCompliance = config.scans.compliance.enabled;
  const runSbom = config.scans.sbom?.enabled;

  const workflow = `name: guardrail Security Scan

on:
  push:
    branches: [main, master, develop]
  pull_request:
    branches: [main, master, develop]
  workflow_dispatch:

permissions:
  contents: read
  security-events: write
  actions: read

jobs:
  guardrail-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --ignore-scripts
        timeout-minutes: 10
        retry-on-error: true

      - name: Install guardrail CLI
        run: npm install -g guardrail-cli-tool
        timeout-minutes: 5
        retry-on-error: true

      - name: Run Secrets Scan
        id: secrets
        run: |
          set -e
          MAX_RETRIES=3
          RETRY_COUNT=0
          while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if guardrail scan:secrets \\
              --path . \\
              --format ${useSarif ? 'sarif' : 'json'} \\
              ${useSarif ? '--output secrets-results.sarif' : '--output secrets-results.json'} \\
              --exit-code; then
              exit 0
            fi
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
              echo "Scan failed, retrying in 5 seconds... (attempt $RETRY_COUNT/$MAX_RETRIES)"
              sleep 5
            fi
          done
          echo "Secrets scan failed after $MAX_RETRIES attempts"
          exit 1
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
        timeout-minutes: 10
        # Note: Removed continue-on-error - failures should be visible

      - name: Run Vulnerability Scan
        id: vulns
        run: |
          set -e
          MAX_RETRIES=3
          RETRY_COUNT=0
          while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if guardrail scan:vulnerabilities \\
              --path . \\
              --format ${useSarif ? 'sarif' : 'json'} \\
              ${useSarif ? '--output vuln-results.sarif' : '--output vuln-results.json'} \\
              --exit-code; then
              exit 0
            fi
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
              echo "Scan failed, retrying in 5 seconds... (attempt $RETRY_COUNT/$MAX_RETRIES)"
              sleep 5
            fi
          done
          echo "Vulnerability scan failed after $MAX_RETRIES attempts"
          exit 1
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
        timeout-minutes: 15
        # Note: Removed continue-on-error - failures should be visible
${runCompliance ? `
      - name: Run Compliance Scan
        id: compliance
        run: |
          guardrail scan:compliance\\
            --path . \\
            --framework ${config.scans.compliance.frameworks?.[0] || 'soc2'} \\
            --format json \\
            --output compliance-results.json \\
            --exit-code
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
        continue-on-error: true
` : ''}${runSbom ? `
      - name: Generate SBOM
        id: sbom
        run: |
          guardrail sbom:generate \\
            --path . \\
            --format cyclonedx \\
            --output sbom.json
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
        # Note: Optional scan - continue-on-error acceptable
        continue-on-error: true
` : ''}${runSbom ? `
      - name: Generate SBOM
        id: sbom
        run: |
          guardrail sbom:generate \\
            --path . \\
            --format cyclonedx \\
            --output sbom.json
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
        # Note: Optional scan - continue-on-error acceptable
        continue-on-error: true
` : ''}
      - name: Run Ship Check
        id: ship
        run: |
          set -e
          MAX_RETRIES=2
          RETRY_COUNT=0
          while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if guardrail ship \\
              --path . \\
              --format json \\
              --output ship-results.json; then
              exit 0
            fi
            RETRY_COUNT=$((RETRY_COUNT + 1))
            if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
              echo "Ship check failed, retrying in 5 seconds... (attempt $RETRY_COUNT/$MAX_RETRIES)"
              sleep 5
            fi
          done
          echo "Ship check failed after $MAX_RETRIES attempts"
          exit 1
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
        timeout-minutes: 20
        # Note: Removed continue-on-error - ship check failures should be visible

      - name: Sync results to Guardrail Cloud
        if: always()
        continue-on-error: true
        run: |
          if [ -f ship-results.json ]; then
            guardrail ci-upload -f ship-results.json --kind auto
          elif [ -f .guardrail/ship.json ]; then
            guardrail ci-upload -f .guardrail/ship.json --kind ship
          elif [ -f .guardrail/scan.json ]; then
            guardrail ci-upload -f .guardrail/scan.json --kind scan
          else
            guardrail ci-upload --kind auto || echo "No guardrail JSON artifact found for cloud upload"
          fi
        env:
          GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
          GUARDRAIL_API_URL: \${{ secrets.GUARDRAIL_API_URL }}

${useSarif ? `
      - name: Upload Secrets SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always() && hashFiles('secrets-results.sarif') != ''
        with:
          sarif_file: secrets-results.sarif
          category: guardrail-secrets
        continue-on-error: true
        timeout-minutes: 5

      - name: Upload Vulnerability SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always() && hashFiles('vuln-results.sarif') != ''
        with:
          sarif_file: vuln-results.sarif
          category: guardrail-vulnerabilities
        continue-on-error: true
        timeout-minutes: 5
` : ''}
      - name: Upload Scan Artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: guardrail-results
          path: |
            *-results.json
            *-results.sarif
            sbom.json
          retention-days: 30

      - name: Check Scan Results
        run: |
          echo "=== guardrail Security Scan Summary ==="
          
          if [ -f ship-results.json ]; then
            VERDICT=$(cat ship-results.json | jq -r '.verdict // "unknown"')
            SCORE=$(cat ship-results.json | jq -r '.score // "N/A"')
            echo "Ship Status: $VERDICT (Score: $SCORE)"
          fi
          
          # Fail the workflow if critical issues were found
          FAILED=false
          
          if [ "\${{ steps.secrets.outcome }}" == "failure" ]; then
            echo "❌ Secrets scan found issues"
            FAILED=true
          else
            echo "✅ Secrets scan passed"
          fi
          
          if [ "\${{ steps.vulns.outcome }}" == "failure" ]; then
            echo "❌ Vulnerability scan found issues"
            FAILED=true
          else
            echo "✅ Vulnerability scan passed"
          fi
          
          if [ "$FAILED" == "true" ]; then
            echo ""
            echo "Security issues detected. Please review the scan results."
            exit 1
          fi
          
          echo ""
          echo "All security checks passed! ✅"
`;

  return workflow;
}

function generateGitLabCI(config: GuardrailConfig): string {
  const runCompliance = config.scans.compliance.enabled;

  return `stages:
  - security

guardrail-scan:
  stage: security
  image: node:20-alpine
  before_script:
    - npm ci --ignore-scripts
    - npm install -g guardrail-cli-tool
  script:
    - guardrail scan:secrets --path . --format json --output secrets-results.json --exit-code || true
    - guardrail scan:vulnerabilities --path . --format json --output vuln-results.json --exit-code || true
${runCompliance ? `    - guardrail scan:compliance --path . --framework ${config.scans.compliance.frameworks?.[0] || 'soc2'} --format json --output compliance-results.json || true` : ''}
    - guardrail ship --path . --format json --output ship-results.json
  artifacts:
    paths:
      - "*-results.json"
    reports:
      sast: secrets-results.json
    expire_in: 30 days
  variables:
    GUARDRAIL_API_KEY: $GUARDRAIL_API_KEY
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`;
}

export function generateCIWorkflow(options: CIGeneratorOptions): CIGeneratorResult {
  const { projectPath, config, provider = 'github' } = options;

  let workflowContent: string;
  let workflowPath: string;

  switch (provider) {
    case 'github': {
      workflowContent = generateGitHubActionsWorkflow(config);
      const workflowDir = join(projectPath, '.github', 'workflows');
      if (!existsSync(workflowDir)) {
        mkdirSync(workflowDir, { recursive: true });
      }
      workflowPath = join(workflowDir, 'guardrail.yml');
      break;
    }
    case 'gitlab': {
      workflowContent = generateGitLabCI(config);
      workflowPath = join(projectPath, '.gitlab-ci.yml');
      break;
    }
    default:
      workflowContent = generateGitHubActionsWorkflow(config);
      const defaultDir = join(projectPath, '.github', 'workflows');
      if (!existsSync(defaultDir)) {
        mkdirSync(defaultDir, { recursive: true });
      }
      workflowPath = join(defaultDir, 'guardrail.yml');
  }

  writeFileSync(workflowPath, workflowContent, 'utf-8');

  return {
    success: true,
    workflowPath,
    provider,
  };
}

export function getCIProviderFromProject(projectPath: string): 'github' | 'gitlab' | 'azure' | 'bitbucket' | null {
  if (existsSync(join(projectPath, '.github'))) {
    return 'github';
  }
  if (existsSync(join(projectPath, '.gitlab-ci.yml'))) {
    return 'gitlab';
  }
  if (existsSync(join(projectPath, 'azure-pipelines.yml'))) {
    return 'azure';
  }
  if (existsSync(join(projectPath, 'bitbucket-pipelines.yml'))) {
    return 'bitbucket';
  }
  return null;
}
