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


export function registerFixRollbackCommands(program: Command): void {

// Fix rollback command
program
  .command('fix-rollback')
  .description('Rollback fixes to a previous backup')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--run <runId>', 'Run ID to rollback to (required)')
  .option('--list', 'List available backups', false)
  .option('--delete <runId>', 'Delete a specific backup')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    const projectPath = resolve(options.path);
    
    if (!options.json) {
      printLogo();
    }
    
    try {
      const { BackupManager } = await import('../fix');
      const backupManager = new BackupManager(projectPath);
      
      // List backups
      if (options.list) {
        const backups = backupManager.listBackups();
        
        if (options.json) {
          console.log(JSON.stringify({ backups }, null, 2));
        } else {
          console.log('');
          const headerLines = [
            `${styles.brightCyan}${styles.bold}${icons.fix} AVAILABLE BACKUPS${styles.reset}`,
            '',
            `${styles.dim}Project:${styles.reset}     ${styles.bold}${basename(projectPath)}${styles.reset}`,
            `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
          ];
          console.log(frameLines(headerLines, { padding: 2 }).join('\n'));
          console.log('');
          
          if (backups.length === 0) {
            console.log(`  ${styles.dim}No backups found${styles.reset}`);
            console.log('');
          } else {
            console.log(`  ${styles.bold}BACKUPS${styles.reset}`);
            printDivider();
            
            for (const backup of backups) {
              const size = backupManager.getBackupSize(backup.runId);
              const sizeKB = (size / 1024).toFixed(1);
              const date = new Date(backup.timestamp).toLocaleString();
              
              console.log(`  ${styles.cyan}${icons.dot}${styles.reset} ${styles.bold}${backup.runId}${styles.reset}`);
              console.log(`     ${styles.dim}Date:${styles.reset}  ${date}`);
              console.log(`     ${styles.dim}Files:${styles.reset} ${backup.files.length} | ${styles.dim}Packs:${styles.reset} ${backup.packs.join(', ')}`);
              console.log(`     ${styles.dim}Size:${styles.reset}  ${sizeKB} KB`);
              console.log('');
            }
            
            console.log(`  ${styles.dim}To rollback:${styles.reset} ${styles.bold}guardrail fix rollback --run <runId>${styles.reset}`);
            console.log('');
          }
        }
        return;
      }
      
      // Delete backup
      if (options.delete) {
        const success = backupManager.deleteBackup(options.delete);
        
        if (options.json) {
          console.log(JSON.stringify({ success, runId: options.delete }));
        } else {
          console.log('');
          if (success) {
            console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Backup deleted:${styles.reset} ${options.delete}`);
          } else {
            console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Backup not found:${styles.reset} ${options.delete}`);
          }
          console.log('');
        }
        return;
      }
      
      // Rollback
      if (!options.run) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Run ID required. Use --run <runId>' }));
        } else {
          console.log('');
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Run ID required${styles.reset}`);
          console.log(`  ${styles.dim}Use:${styles.reset} ${styles.bold}guardrail fix rollback --run <runId>${styles.reset}`);
          console.log(`  ${styles.dim}List backups:${styles.reset} ${styles.bold}guardrail fix rollback --list${styles.reset}`);
          console.log('');
        }
        exitWith(ExitCode.USER_ERROR, 'Run ID required');
      }
      
      if (!options.json) {
        console.log('');
        const headerLines = [
          `${styles.brightYellow}${styles.bold}${icons.warning} ROLLBACK${styles.reset}`,
          '',
          `${styles.dim}Project:${styles.reset}     ${styles.bold}${basename(projectPath)}${styles.reset}`,
          `${styles.dim}Run ID:${styles.reset}      ${options.run}`,
        ];
        console.log(frameLines(headerLines, { padding: 2 }).join('\n'));
        console.log('');
      }
      
      const s = !options.json ? spinner('Rolling back changes...') : null;
      const result = await backupManager.rollback(options.run);
      
      if (result.success) {
        s?.stop(true, 'Rollback complete');
        
        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            runId: options.run,
            restoredFiles: result.restoredFiles,
          }, null, 2));
        } else {
          console.log('');
          const resultLines = [
            `${styles.brightGreen}${styles.bold}${icons.success} ROLLBACK SUCCESSFUL${styles.reset}`,
            '',
            `${styles.dim}Restored files:${styles.reset}  ${styles.bold}${result.restoredFiles.length}${styles.reset}`,
          ];
          console.log(frameLines(resultLines, { padding: 2 }).join('\n'));
          console.log('');
          
          if (result.restoredFiles.length > 0) {
            console.log(`  ${styles.bold}RESTORED FILES${styles.reset}`);
            printDivider();
            result.restoredFiles.slice(0, 10).forEach(file => {
              console.log(`  ${styles.cyan}${icons.success}${styles.reset} ${file}`);
            });
            if (result.restoredFiles.length > 10) {
              console.log(`  ${styles.dim}... and ${result.restoredFiles.length - 10} more${styles.reset}`);
            }
            console.log('');
          }
        }
      } else {
        s?.stop(false, 'Rollback failed');
        
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: result.error,
          }));
        } else {
          console.log('');
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Rollback failed:${styles.reset} ${result.error}`);
          console.log('');
        }
        exitWith(ExitCode.SYSTEM_ERROR, 'Rollback failed');
      }
      
    } catch (error: any) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: error.message }));
      } else {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Rollback failed:${styles.reset} ${error.message}`);
        console.log('');
      }
      exitWith(ExitCode.SYSTEM_ERROR, 'Rollback failed');
    }
  });

}
