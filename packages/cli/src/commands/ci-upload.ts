/**
 * Upload JSON artifacts from CI (or local files) to Guardrail cloud POST /api/runs/save.
 * Use after `guardrail scan --json` / `guardrail ship --json` writes output to a file.
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { basename, resolve } from 'path';
import {
  getCloudSyncEnvFromEnv,
  uploadRunToCloud,
  shipVerdictToApi,
  type SaveRunToCloudPayload,
} from '@guardrail/core';
import { styles, icons } from '../ui';

type ArtifactKind = 'auto' | 'scan' | 'ship';

function detectKind(data: Record<string, unknown>): 'scan' | 'ship' {
  if ('deadUI' in data || 'playwright' in data) {
    return 'ship';
  }
  if ('proofGraph' in data && 'findings' in data && Array.isArray(data['findings'])) {
    return 'scan';
  }
  if ('scan' in data && typeof data['scan'] === 'object' && data['scan'] !== null) {
    return 'ship';
  }
  return 'scan';
}

function buildPayload(
  data: Record<string, unknown>,
  kind: ArtifactKind,
  repo: string,
): SaveRunToCloudPayload {
  const branch =
    process.env.GUARDRAIL_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    process.env.CI_COMMIT_REF_NAME;
  const commitSha =
    process.env.GUARDRAIL_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.CI_COMMIT_SHA;

  const resolvedKind = kind === 'auto' ? detectKind(data) : kind;

  if (resolvedKind === 'ship') {
    const verdictRaw = String(data['verdict'] ?? 'WARN');
    const { verdict, score } = shipVerdictToApi(verdictRaw);
    const deadUI = data['deadUI'] as { findings?: unknown[] } | undefined;
    const scan = data['scan'] as { findings?: unknown[]; verdict?: string; summary?: unknown } | undefined;
    const findings: unknown[] = [
      ...((deadUI?.findings as unknown[]) || []).map((f) => ({
        ...(typeof f === 'object' && f !== null ? f : {}),
        layer: 'dead-ui',
      })),
      ...((scan?.findings as unknown[]) || []).map((f) => ({
        ...(typeof f === 'object' && f !== null ? f : {}),
        layer: 'scan',
      })),
    ];
    return {
      repo,
      branch,
      commitSha,
      verdict,
      score,
      source: 'ci',
      findings,
      guardrailResult: {
        tool: 'ship',
        shipVerdict: verdictRaw,
        deadUI: deadUI?.findings ? { count: deadUI.findings.length } : undefined,
        scanVerdict: scan?.verdict,
      },
      securityResult: scan?.summary ? { scanSummary: scan.summary } : undefined,
    };
  }

  const verdictRaw = String(data['verdict'] ?? 'PASS');
  const { verdict, score } = shipVerdictToApi(verdictRaw);
  const findings = Array.isArray(data['findings']) ? data['findings'] : [];
  const summary = data['summary'];
  const proofGraph = data['proofGraph'];

  return {
    repo,
    branch,
    commitSha,
    verdict,
    score,
    source: 'ci',
    findings,
    guardrailResult: {
      tool: 'scan',
      scanVerdict: verdictRaw,
      summary,
    },
    securityResult: proofGraph ? { proofGraph } : undefined,
  };
}

export function registerCiUploadCommand(program: Command): void {
  program
    .command('ci-upload')
    .alias('exec')
    .description(
      'Upload scan.json / ship.json (or CI artifact) to Guardrail cloud — set GUARDRAIL_API_URL + GUARDRAIL_API_KEY',
    )
    .option('-f, --file <path>', 'Path to JSON file (default: .guardrail/scan.json or ship.json)', '')
    .option(
      '-k, --kind <kind>',
      'Artifact type: auto | scan | ship',
      'auto',
    )
    .option(
      '-r, --repo <name>',
      'Repo label (default: directory name or GITHUB_REPOSITORY)',
      '',
    )
    .action(async (options: { file: string; kind: string; repo: string }) => {
      const env = getCloudSyncEnvFromEnv();
      if (!env) {
        console.error(
          `  ${styles.brightRed}${icons.error}${styles.reset} Missing ${styles.cyan}GUARDRAIL_API_URL${styles.reset} (or ${styles.cyan}GUARDRAIL_API_BASE_URL${styles.reset}) and ${styles.cyan}GUARDRAIL_API_KEY${styles.reset}`,
        );
        process.exit(2);
      }

      const cwd = process.cwd();
      let filePath = options.file?.trim();
      if (!filePath) {
        const scanDefault = resolve(cwd, '.guardrail', 'scan.json');
        const shipDefault = resolve(cwd, '.guardrail', 'ship.json');
        if (existsSync(scanDefault)) {
          filePath = scanDefault;
        } else if (existsSync(shipDefault)) {
          filePath = shipDefault;
        } else {
          console.error(
            `  ${styles.brightRed}${icons.error}${styles.reset} No --file and neither .guardrail/scan.json nor .guardrail/ship.json found`,
          );
          process.exit(2);
        }
      } else {
        filePath = resolve(cwd, filePath);
      }

      if (!existsSync(filePath)) {
        console.error(
          `  ${styles.brightRed}${icons.error}${styles.reset} File not found: ${filePath}`,
        );
        process.exit(2);
      }

      const raw = readFileSync(filePath, 'utf-8');
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        console.error(`  ${styles.brightRed}${icons.error}${styles.reset} Invalid JSON`);
        process.exit(2);
      }

      const kind = options.kind as ArtifactKind;
      if (kind !== 'auto' && kind !== 'scan' && kind !== 'ship') {
        console.error(`  ${styles.brightRed}${icons.error}${styles.reset} --kind must be auto, scan, or ship`);
        process.exit(2);
      }

      let repo = options.repo?.trim();
      if (!repo) {
        const gh = process.env.GITHUB_REPOSITORY;
        if (gh && gh.includes('/')) {
          repo = gh.split('/')[1] || basename(cwd);
        } else {
          repo = basename(cwd);
        }
      }

      const payload = buildPayload(data, kind, repo);
      const up = await uploadRunToCloud({
        baseUrl: env.baseUrl,
        apiKey: env.apiKey,
        payload,
      });

      if (!up.ok) {
        console.error(
          `  ${styles.brightRed}${icons.error}${styles.reset} Upload failed: ${up.error ?? 'unknown'}`,
        );
        process.exit(1);
      }

      console.log(
        `  ${styles.brightGreen}${icons.success}${styles.reset} Uploaded run to ${styles.dim}${env.baseUrl}${styles.reset}`,
      );
      process.exit(0);
    });
}
