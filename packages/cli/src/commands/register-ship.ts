import { Command } from 'commander';
import { resolve, basename } from 'path';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { SecretsGuardian, SBOMGenerator } from 'guardrail-security';
import {
  loadAuthState,
  saveAuthState,
  clearAuthState,
  type AuthState,
  type Tier,
  getConfigPath,
} from '../runtime/creds';
import { validateCredentials, validateApiKey, getCacheExpiry } from '../runtime/client';
import { ExitCode, exitWith, getExitCodeForFindings } from '../runtime/exit-codes';
import { createJsonOutput, formatScanResults } from '../runtime/json-output';
import { isAffected } from '../runtime/semver';
import {
  scanVulnerabilitiesOSV,
  outputOSVVulnResults,
  toSarifVulnerabilitiesOSV,
} from './scan-vulnerabilities-osv';
import { maskApiKey, isExpiryWarning, formatExpiry, validateApiKeyFormat, hoursUntilExpiry } from '../runtime/auth-utils';
import { printCommandHeader } from '../ui/frame';
import {
  detectFramework,
  formatFrameworkName,
  getTemplate,
  validateConfig,
  mergeWithFrameworkDefaults,
  getTemplateChoices,
  generateCIWorkflow,
  getCIProviderFromProject,
  installHooks,
  getRecommendedRunner,
  type TemplateType,
} from '../init';
import { CLI_VERSION } from '../cli-program';
import { loadConfig, saveConfig, CONFIG_FILE, isInteractiveAllowed, defaultReportPath } from '../runtime/cli-config';
import { requireAuth, requireAuthAsync } from '../runtime/cli-auth';
import { delay } from '../utils/delay';
import { icons, styles, box, c, frameLines, truncatePath, printDivider, printLogo, spinner, promptSelect, promptInput, promptConfirm, promptPassword } from '../ui';
import { printMenuHeader } from '../ui/cli-menus';
import { runScanEnterprise, outputResultsEnterprise } from '../runtime/enterprise-scan-cli';
import { runScan } from '../runtime/local-scan-demo';
import { scanSecrets, scanVulnerabilities } from '../runtime/scan-secrets-vuln-cli';
import { scanCompliance, generateSBOM, generateContainerSBOM } from '../runtime/compliance-sbom-cli';
import { initProject } from '../runtime/init-project-cli';
import {
  outputResults,
  outputSecretsResults,
  outputVulnResults,
  outputComplianceResults,
} from '../runtime/scan-output-cli';
import { getCriticalPathsForFlow } from '../reality/critical-paths';


export function registerShipCommands(program: Command): void {
// Ship command (Starter+ feature)
program
  .command('ship')
  .description('Ship Check - Plain English audit and readiness assessment (Starter+)')  
  .option('-p, --path <path>', 'Project path to analyze', '.')
  .option('-f, --format <format>', 'Output format: table, json, markdown', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--badge', 'Generate ship badge', false)
  .option('--mockproof', 'Run MockProof gate', false)
  .action(async (options) => {
    const config = requireAuth('starter');
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'SHIP CHECK',
      icon: icons.ship,
      projectName,
      projectPath,
      metadata: [
        { key: 'MockProof', value: options.mockproof ? 'Enabled' : 'Disabled' },
      ],
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      // Import ship functionality
      const { shipBadgeGenerator } = require('guardrail-ship');
      const { importGraphScanner } = require('guardrail-ship');
      
      // Run ship check
      const shipResult = await shipBadgeGenerator.generateShipBadge({
        projectPath,
        projectName: basename(projectPath)
      });
      
      // Run MockProof if requested
      let mockproofResult = null;
      if (options.mockproof) {
        mockproofResult = await importGraphScanner.scan(projectPath);
      }
      
      if (options.format === 'json') {
        const output = {
          ship: shipResult,
          mockproof: mockproofResult,
          summary: {
            ready: shipResult.verdict === 'ship',
            score: shipResult.score,
            issues: (shipResult.checks || []).filter((c: any) => c.status !== 'pass').length
          }
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Styled table format
        const statusColor = shipResult.verdict === 'ship' ? styles.brightGreen :
                           shipResult.verdict === 'no-ship' ? styles.brightRed : styles.brightYellow;
        const statusText = shipResult.verdict === 'ship' ? `${icons.success} READY TO SHIP` :
                          shipResult.verdict === 'no-ship' ? `${icons.error} NOT READY` : `${icons.warning} NEEDS REVIEW`;
        
        const readinessLines = [
          `${statusColor}${styles.bold}${statusText}${styles.reset}`,
          '',
          `${styles.dim}Score:${styles.reset}       ${styles.bold}${shipResult.score}${styles.reset}/100`,
          `${styles.dim}Issues:${styles.reset}      ${(shipResult.checks || []).filter((c: any) => c.status !== 'pass').length} found`,
        ];
        
        const framedReadiness = frameLines(readinessLines, { padding: 2 });
        console.log(framedReadiness.join('\n'));
        console.log('');
        
        const failedChecks = (shipResult.checks || []).filter((c: any) => c.status !== 'pass');
        if (failedChecks.length > 0) {
          console.log(`  ${styles.bold}ISSUES FOUND${styles.reset}`);
          printDivider();
          failedChecks.forEach((check: any, index: number) => {
            const severity = check.status === 'fail' ? styles.brightRed : 
                           check.status === 'warning' ? styles.brightYellow : styles.cyan;
            console.log(`  ${styles.cyan}${index + 1}.${styles.reset} ${severity}${check.status.toUpperCase()}${styles.reset} - ${check.message}`);
            console.log(`     ${styles.dim}${check.details?.join(', ') || 'No details'}${styles.reset}`);
            console.log('');
          });
        }
        
        if (mockproofResult) {
          const mockStatus = mockproofResult.verdict === 'pass' ? `${styles.brightGreen}✓ PASSED${styles.reset}` : `${styles.brightRed}✗ FAILED${styles.reset}`;
          const mockLines = [
            `${styles.bold}MOCKPROOF GATE${styles.reset}`,
            '',
            `${styles.dim}Status:${styles.reset}      ${mockStatus}`,
            `${styles.dim}Violations:${styles.reset}  ${mockproofResult.violations.length}`,
          ];
          const framedMock = frameLines(mockLines, { padding: 2 });
          console.log(framedMock.join('\n'));
          console.log('');
          
          if (mockproofResult.violations.length > 0) {
            console.log(`  ${styles.bold}BANNED IMPORTS${styles.reset}`);
            printDivider();
            mockproofResult.violations.forEach((violation: any, index: number) => {
              console.log(`  ${styles.cyan}${index + 1}.${styles.reset} ${styles.brightRed}${violation.bannedImport}${styles.reset} in ${violation.entrypoint}`);
              console.log(`     ${styles.dim}Path:${styles.reset} ${violation.importChain.join(' → ')}`);
              console.log('');
            });
          }
        }
        
        // Show badge embed code
        if (shipResult.embedCode) {
          console.log(`${styles.bold}BADGE EMBED CODE${styles.reset}`);
          printDivider();
          console.log(`  ${styles.dim}${shipResult.embedCode}${styles.reset}`);
          console.log('');
        }
      }
      
      if (options.output) {
        const output = {
          ship: shipResult,
          mockproof: mockproofResult,
          timestamp: new Date().toISOString(),
          project: {
            name: projectName,
            path: projectPath
          }
        };
        writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`${styles.dim}Report saved to:${styles.reset} ${options.output}`);
      }
      
      // Exit with appropriate code
      const exitCode = shipResult.verdict === 'ship' ? ExitCode.SUCCESS : ExitCode.POLICY_FAIL;
      exitWith(exitCode);
      
    } catch (error: any) {
      console.error(`${styles.brightRed}Error:${styles.reset} ${error.message}`);
      exitWith(ExitCode.SYSTEM_ERROR, 'Ship check failed');
    }
  });

// Pro Ship command (Pro feature - $99/month)
program
  .command('ship:pro')
  .description('Pro Ship Check - Comprehensive scanning with all services (Pro $99/mo)')
  .option('-p, --path <path>', 'Project path to analyze', '.')
  .option('-f, --format <format>', 'Output format: table, json, markdown', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--url <baseUrl>', 'Base URL for reality mode scanning')
  .option('--no-reality', 'Skip reality mode scan')
  .option('--no-security', 'Skip security scan')
  .option('--no-performance', 'Skip performance check')
  .option('--no-accessibility', 'Skip accessibility check')
  .option('--badge', 'Generate dynamic badge', true)
  .action(async (options) => {
    const config = requireAuth('pro');
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'PRO SHIP CHECK',
      icon: icons.ship,
      projectName,
      projectPath,
      metadata: [
        { key: 'Reality Mode', value: !options.noReality ? 'Enabled' : 'Disabled' },
        { key: 'Security Scan', value: !options.noSecurity ? 'Enabled' : 'Disabled' },
        { key: 'Performance', value: !options.noPerformance ? 'Enabled' : 'Disabled' },
        { key: 'Accessibility', value: !options.noAccessibility ? 'Enabled' : 'Disabled' },
        { key: 'Dynamic Badge', value: options.badge ? 'Enabled' : 'Disabled' },
      ],
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      // Import pro ship scanner
      const { ProShipScanner } = require('guardrail-ship');
      const proShipScanner = new ProShipScanner();
      
      const scanConfig = {
        projectPath,
        baseUrl: options.url,
        includeRealityMode: !options.noReality,
        includeSecurityScan: !options.noSecurity,
        includePerformanceCheck: !options.noPerformance,
        includeAccessibilityCheck: !options.noAccessibility,
      };
      
      console.log(`${styles.dim}Running comprehensive scan...${styles.reset}`);
      console.log('');
      
      const result = await proShipScanner.runComprehensiveScan(scanConfig);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Display comprehensive results
        const verdictColor = result.verdict === 'SHIP' ? styles.brightGreen :
                           result.verdict === 'NO-SHIP' ? styles.brightRed : styles.brightYellow;
        const verdictIcon = result.verdict === 'SHIP' ? icons.success :
                           result.verdict === 'NO-SHIP' ? icons.error : icons.warning;
        
        const verdictLines = [
          `${verdictColor}${styles.bold}${verdictIcon} ${result.verdict}${styles.reset}`,
          '',
          `${styles.dim}Overall Score:${styles.reset} ${styles.bold}${result.overallScore}${styles.reset}/100`,
          `${styles.dim}Scans Completed:${styles.reset} ${result.summary.totalScans}/${result.summary.totalScans}`,
          `${styles.dim}Passed:${styles.reset} ${styles.brightGreen}${result.summary.passedScans}${styles.reset}`,
          `${styles.dim}Failed:${styles.reset} ${styles.brightRed}${result.summary.failedScans}${styles.reset}`,
          `${styles.dim}Critical Issues:${styles.reset} ${styles.brightRed}${result.summary.criticalIssues}${styles.reset}`,
          `${styles.dim}Warnings:${styles.reset} ${styles.brightYellow}${result.summary.warnings}${styles.reset}`,
          `${styles.dim}Duration:${styles.reset} ${(result.summary.totalDuration / 1000).toFixed(2)}s`,
        ];
        
        const framedVerdict = frameLines(verdictLines, { padding: 2 });
        console.log(framedVerdict.join('\n'));
        console.log('');
        
        // Show individual scan results
        console.log(`${styles.bold}SCAN RESULTS${styles.reset}`);
        printDivider();
        
        result.scans.forEach((scan: any, index: number) => {
          const statusColor = scan.status === 'pass' ? styles.brightGreen :
                             scan.status === 'fail' ? styles.brightRed :
                             scan.status === 'warning' ? styles.brightYellow : styles.brightRed;
          const statusIcon = scan.status === 'pass' ? icons.success :
                             scan.status === 'fail' ? icons.error :
                             scan.status === 'warning' ? icons.warning : icons.error;
          
          console.log(`${styles.cyan}${index + 1}.${styles.reset} ${styles.bold}${scan.name}${styles.reset}`);
          console.log(`   Status: ${statusColor}${statusIcon} ${scan.status.toUpperCase()}${styles.reset}`);
          console.log(`   Score: ${styles.bold}${scan.score}${styles.reset}/100`);
          console.log(`   Duration: ${(scan.duration / 1000).toFixed(2)}s`);
          
          if (scan.criticalIssues > 0) {
            console.log(`   Critical: ${styles.brightRed}${scan.criticalIssues}${styles.reset}`);
          }
          if (scan.warnings > 0) {
            console.log(`   Warnings: ${styles.brightYellow}${scan.warnings}${styles.reset}`);
          }
          console.log('');
        });
        
        // Show recommendation
        console.log(`${styles.bold}RECOMMENDATION${styles.reset}`);
        printDivider();
        console.log(`${styles.dim}${result.recommendation}${styles.reset}`);
        console.log('');
        
        // Show badge info
        if (options.badge && result.badge) {
          console.log(`${styles.bold}DYNAMIC BADGE${styles.reset}`);
          printDivider();
          console.log(`${styles.dim}SVG URL:${styles.reset} ${result.badge.svgUrl}`);
          console.log(`${styles.dim}JSON URL:${styles.reset} ${result.badge.jsonUrl}`);
          console.log(`${styles.dim}Embed Code:${styles.reset}`);
          console.log(`  ${styles.dim}${result.badge.embedCode}${styles.reset}`);
          console.log('');
        }
      }
      
      if (options.output) {
        writeFileSync(options.output, JSON.stringify(result, null, 2));
        console.log(`${styles.dim}Report saved to:${styles.reset} ${options.output}`);
      }
      
      // Exit with appropriate code
      const exitCode = result.verdict === 'SHIP' ? ExitCode.SUCCESS : ExitCode.POLICY_FAIL;
      exitWith(exitCode);
      
    } catch (error: any) {
      console.error(`${styles.brightRed}Error:${styles.reset} ${error.message}`);
      exitWith(ExitCode.SYSTEM_ERROR, 'Pro ship check failed');
    }
  });

}
