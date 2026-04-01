/**
 * Enterprise CLI Commands
 *
 * guardrail sbom     — Generate SBOM (CycloneDX/SPDX)
 * guardrail policy   — Policy-as-code management
 * guardrail audit    — Audit trail management
 * guardrail analytics — Dashboard trend analytics
 * guardrail sso      — SSO configuration
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs';

// ─── SBOM Command ─────────────────────────────────────────────

export function registerSBOMCommand(program: Command): void {
  const sbom = program
    .command('sbom')
    .description('Generate Software Bill of Materials (Enterprise)')
    .option('-f, --format <format>', 'Output format: cyclonedx or spdx', 'cyclonedx')
    .option('-o, --output <path>', 'Output file path')
    .option('--dev', 'Include dev dependencies', false)
    .option('--no-licenses', 'Skip license detection')
    .option('--no-hashes', 'Skip integrity hashes')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--json', 'Output raw JSON to stdout')
    .action(async (options) => {
      try {
        const { generateSBOM, formatSBOMSummary } = await import('@guardrail/compliance');

        const projectPath = resolve(options.path);

        if (!existsSync(projectPath)) {
          console.error(`Project path not found: ${projectPath}`);
          process.exit(1);
        }

        const format = options.format === 'spdx' ? 'spdx' as const : 'cyclonedx' as const;

        const defaultOutput = format === 'cyclonedx'
          ? 'guardrail-sbom.cdx.json'
          : 'guardrail-sbom.spdx.json';

        const result = await generateSBOM({
          projectPath,
          format,
          includeDevDependencies: options.dev,
          includeLicenses: options.licenses !== false,
          includeHashes: options.hashes !== false,
          outputPath: options.output || defaultOutput,
        });

        if (options.json) {
          console.log(result.serialized);
        } else {
          console.log(formatSBOMSummary(result));
        }
      } catch (error) {
        console.error(`SBOM generation failed: ${error}`);
        process.exit(1);
      }
    });
}

// ─── Policy Command ───────────────────────────────────────────

export function registerPolicyCommand(program: Command): void {
  const policy = program
    .command('policy')
    .description('Policy-as-Code management (Enterprise)');

  // guardrail policy init
  policy
    .command('init')
    .description('Initialize policy directory with default policy')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (options) => {
      try {
        const { PolicyManager } = await import('@guardrail/compliance');
        const manager = new PolicyManager(resolve(options.path));
        const filePath = await manager.init();
        console.log(`\n  Policy initialized: ${filePath}\n`);
        console.log('  Edit the policy file to customize rules for your organization.');
        console.log('  Run "guardrail policy validate" to check policy syntax.\n');
      } catch (error) {
        console.error(`Policy init failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail policy validate
  policy
    .command('validate')
    .description('Validate policy files')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (options) => {
      try {
        const { PolicyManager } = await import('@guardrail/compliance');
        const manager = new PolicyManager(resolve(options.path));
        const policies = await manager.loadPolicies();

        if (policies.length === 0) {
          console.log('\n  No policies found. Run "guardrail policy init" first.\n');
          return;
        }

        console.log(`\n  Validating ${policies.length} policy file(s)...`);
        let allValid = true;

        for (const pol of policies) {
          const result = manager.validate(pol);
          if (result.valid) {
            console.log(`  \u2705 ${pol.metadata.name} v${pol.metadata.version} — valid`);
          } else {
            allValid = false;
            console.log(`  \u274C ${pol.metadata.name} v${pol.metadata.version} — invalid`);
            for (const err of result.errors) {
              console.log(`     ${err}`);
            }
          }
        }

        console.log('');
        process.exit(allValid ? 0 : 1);
      } catch (error) {
        console.error(`Policy validation failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail policy evaluate
  policy
    .command('evaluate')
    .description('Evaluate policies against current scan results')
    .option('-p, --path <path>', 'Project path', '.')
    .option('-n, --name <name>', 'Evaluate specific policy by name')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const { PolicyManager, formatPolicyResults } = await import('@guardrail/compliance');

        const manager = new PolicyManager(resolve(options.path));

        // Load latest scan results if available
        const lastScorePath = resolve(options.path, '.guardrail', 'last-scan.json');
        let scanResults;

        if (existsSync(lastScorePath)) {
          scanResults = JSON.parse(readFileSync(lastScorePath, 'utf8'));
        }

        const results = await manager.evaluate(
          { scanResults, project: { name: '', path: resolve(options.path) } },
          options.name
        );

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log(formatPolicyResults(results));
        }

        const anyBlocked = results.some(r => !r.passed && r.action === 'block');
        process.exit(anyBlocked ? 1 : 0);
      } catch (error) {
        console.error(`Policy evaluation failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail policy list
  policy
    .command('list')
    .description('List loaded policies')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (options) => {
      try {
        const { PolicyManager } = await import('@guardrail/compliance');
        const manager = new PolicyManager(resolve(options.path));
        const policies = await manager.loadPolicies();

        if (policies.length === 0) {
          console.log('\n  No policies found. Run "guardrail policy init" first.\n');
          return;
        }

        console.log(`\n  Policies (${policies.length}):`);
        console.log(`  ${'─'.repeat(50)}`);

        for (const pol of policies) {
          console.log(`  ${pol.metadata.name} v${pol.metadata.version}`);
          console.log(`    Target: ${pol.spec.target} | Scope: ${pol.spec.scope}`);
          console.log(`    Rules: ${pol.spec.rules.length} | Overrides: ${pol.spec.overrides?.length || 0}`);
          console.log('');
        }
      } catch (error) {
        console.error(`Policy list failed: ${error}`);
        process.exit(1);
      }
    });
}

// ─── Audit Command ────────────────────────────────────────────

export function registerAuditCommand(program: Command): void {
  const audit = program
    .command('audit')
    .description('Audit trail management (Enterprise)');

  // guardrail audit show
  audit
    .command('show')
    .description('Show recent audit events')
    .option('-n, --count <number>', 'Number of events to show', '20')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--category <cat>', 'Filter by category')
    .option('--surface <surface>', 'Filter by surface (cli, vscode, mcp, etc.)')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const { LocalJSONLStorage } = await import('@guardrail/compliance');
        const storage = new LocalJSONLStorage(resolve(options.path));

        const events = await storage.read({
          limit: parseInt(options.count, 10),
          category: options.category,
          surface: options.surface,
        });

        if (options.json) {
          console.log(JSON.stringify(events, null, 2));
          return;
        }

        if (events.length === 0) {
          console.log('\n  No audit events found.\n');
          return;
        }

        console.log(`\n  Audit Trail (${events.length} events):`);
        console.log(`  ${'─'.repeat(60)}`);

        for (const event of events.slice(-parseInt(options.count, 10))) {
          const time = new Date(event.timestamp).toLocaleString();
          console.log(`  [${time}] ${event.action} (${event.surface})`);
          console.log(`    Actor: ${event.actor.id} | Result: ${event.result}`);
          if (event.metadata?.score !== undefined) {
            console.log(`    Score: ${event.metadata.score}`);
          }
        }
        console.log('');
      } catch (error) {
        console.error(`Audit show failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail audit verify
  audit
    .command('verify')
    .description('Verify audit chain integrity')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--signed', 'Verify signed audit trail (includes signature checks)')
    .action(async (options) => {
      try {
        if (options.signed) {
          const { SignedJSONLStorage } = await import('@guardrail/compliance');
          const storage = new SignedJSONLStorage(resolve(options.path));
          const result = await storage.validateChain();

          console.log(`\n  Signed Audit Chain Verification:`);
          console.log(`  ${'─'.repeat(50)}`);
          console.log(`  Chain Valid:         ${result.valid ? '\u2705 Yes' : '\u274C No'}`);
          console.log(`  Total Events:        ${result.totalEvents}`);
          console.log(`  Valid Events:        ${result.validEvents}`);
          console.log(`  Invalid Events:      ${result.invalidEvents}`);
          console.log(`  Valid Signatures:    ${result.signatureResults.validSignatures}`);
          console.log(`  Invalid Signatures:  ${result.signatureResults.invalidSignatures}`);

          if (result.brokenLinks.length > 0) {
            console.log('\n  Broken Chain Links:');
            for (const link of result.brokenLinks) {
              console.log(`    Event #${link.index}: ${link.eventId}`);
            }
          }

          if (result.signatureResults.invalidSignatures > 0) {
            console.log('\n  Invalid Signatures:');
            for (const detail of result.signatureResults.details) {
              if (!detail.valid) {
                console.log(`    Event #${detail.index}: ${detail.eventId} — ${detail.reason}`);
              }
            }
          }

          console.log('');
          process.exit(result.valid ? 0 : 1);
        } else {
          const { LocalJSONLStorage } = await import('@guardrail/compliance');
          const storage = new LocalJSONLStorage(resolve(options.path));
          const result = await storage.validateChain();

          console.log(`\n  Audit Chain Verification:`);
          console.log(`  ${'─'.repeat(50)}`);
          console.log(`  Chain Valid:    ${result.valid ? '\u2705 Yes' : '\u274C No'}`);
          console.log(`  Total Events:   ${result.totalEvents}`);
          console.log(`  Valid Events:   ${result.validEvents}`);
          console.log(`  Invalid Events: ${result.invalidEvents}`);

          if (result.tamperedEvents.length > 0) {
            console.log('\n  Tampered Events:');
            for (const evt of result.tamperedEvents) {
              console.log(`    Event #${evt.index}: ${evt.eventId} — ${evt.reason}`);
            }
          }

          console.log('');
          process.exit(result.valid ? 0 : 1);
        }
      } catch (error) {
        console.error(`Audit verify failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail audit export
  audit
    .command('export')
    .description('Export audit trail')
    .option('-f, --format <format>', 'Export format: json or csv', 'json')
    .option('-o, --output <path>', 'Output file path')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--from <date>', 'Start date (ISO 8601)')
    .option('--to <date>', 'End date (ISO 8601)')
    .action(async (options) => {
      try {
        const { LocalJSONLStorage } = await import('@guardrail/compliance');
        const storage = new LocalJSONLStorage(resolve(options.path));

        const format = options.format === 'csv' ? 'csv' as const : 'json' as const;
        const exported = await storage.export(format, {
          startDate: options.from ? new Date(options.from) : undefined,
          endDate: options.to ? new Date(options.to) : undefined,
          includeMetadata: true,
        });

        if (options.output) {
          writeFileSync(resolve(options.output), exported, 'utf8');
          console.log(`\n  Audit trail exported to ${options.output}\n`);
        } else {
          console.log(exported);
        }
      } catch (error) {
        console.error(`Audit export failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail audit rotate-key
  audit
    .command('rotate-key')
    .description('Rotate the audit signing key')
    .option('-p, --path <path>', 'Project path', '.')
    .action(async (options) => {
      try {
        const { SignedJSONLStorage } = await import('@guardrail/compliance');
        const storage = new SignedJSONLStorage(resolve(options.path));
        const newKeyId = await storage.rotateSigningKey();
        console.log(`\n  Signing key rotated. New key ID: ${newKeyId}\n`);
      } catch (error) {
        console.error(`Key rotation failed: ${error}`);
        process.exit(1);
      }
    });
}

// ─── Analytics Command ────────────────────────────────────────

export function registerAnalyticsCommand(program: Command): void {
  const analytics = program
    .command('analytics')
    .description('Trust score analytics dashboard (Enterprise)');

  // guardrail analytics dashboard
  analytics
    .command('dashboard')
    .description('Show analytics dashboard')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--days <number>', 'Number of days to analyze', '30')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const { TrendAnalyticsEngine } = await import('@guardrail/compliance');
        const engine = new TrendAnalyticsEngine(resolve(options.path));

        const days = parseInt(options.days, 10);
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const dashboard = await engine.generateDashboard({ from });

        if (options.json) {
          console.log(JSON.stringify(dashboard, null, 2));
        } else {
          console.log(engine.formatDashboard(dashboard));
        }
      } catch (error) {
        console.error(`Analytics dashboard failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail analytics trends
  analytics
    .command('trends')
    .description('Show score trends over time')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--period <period>', 'Aggregation period: day, week, month', 'day')
    .option('--days <number>', 'Number of days to analyze', '30')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const { TrendAnalyticsEngine } = await import('@guardrail/compliance');
        const engine = new TrendAnalyticsEngine(resolve(options.path));

        const days = parseInt(options.days, 10);
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const trends = await engine.getTrends({
          period: options.period as 'day' | 'week' | 'month',
          from,
        });

        if (options.json) {
          console.log(JSON.stringify(trends, null, 2));
          return;
        }

        console.log(`\n  Score Trends (${options.period}ly, last ${days} days):`);
        console.log(`  ${'─'.repeat(60)}`);

        for (const t of trends) {
          const bar = '\u2588'.repeat(Math.round(t.averageScore / 5));
          console.log(`  ${t.period.padEnd(12)} ${bar} ${t.averageScore} (${t.scanCount} scans, ${t.totalIssues} issues)`);
        }
        console.log('');
      } catch (error) {
        console.error(`Analytics trends failed: ${error}`);
        process.exit(1);
      }
    });

  // guardrail analytics hotspots
  analytics
    .command('hotspots')
    .description('Show violation hotspots')
    .option('-p, --path <path>', 'Project path', '.')
    .option('-n, --count <number>', 'Number of hotspots to show', '10')
    .option('--json', 'Output raw JSON')
    .action(async (options) => {
      try {
        const { TrendAnalyticsEngine } = await import('@guardrail/compliance');
        const engine = new TrendAnalyticsEngine(resolve(options.path));

        const hotspots = await engine.getHotspots({ limit: parseInt(options.count, 10) });

        if (options.json) {
          console.log(JSON.stringify(hotspots, null, 2));
          return;
        }

        if (hotspots.length === 0) {
          console.log('\n  No hotspot data found. Run scans to accumulate trend data.\n');
          return;
        }

        console.log(`\n  Violation Hotspots (top ${options.count}):`);
        console.log(`  ${'─'.repeat(60)}`);

        for (const h of hotspots) {
          const trendIcon = h.trend === 'improving' ? '\u2193' : h.trend === 'worsening' ? '\u2191' : '\u2192';
          console.log(`  ${trendIcon} ${h.file}`);
          console.log(`    Violations: ${h.totalViolations} | Trend: ${h.trend}`);
          console.log(`    First seen: ${h.firstSeen.split('T')[0]} | Last seen: ${h.lastSeen.split('T')[0]}`);
        }
        console.log('');
      } catch (error) {
        console.error(`Analytics hotspots failed: ${error}`);
        process.exit(1);
      }
    });
}

// ─── Register All Enterprise Commands ─────────────────────────

export function registerEnterpriseCommands(program: Command): void {
  registerSBOMCommand(program);
  registerPolicyCommand(program);
  registerAuditCommand(program);
  registerAnalyticsCommand(program);
}
