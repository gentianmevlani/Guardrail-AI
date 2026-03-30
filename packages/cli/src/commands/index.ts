import type { Command } from 'commander';
import { registerAuthCommands } from './register-auth';
import { registerScansCoreCommands } from './register-scans-core';
import { registerSmellsFixCommands } from './register-smells-fix';
import { registerFixRollbackCommands } from './register-fix-rollback';
import { registerShipCommands } from './register-ship';
import { registerRealityCommands } from './register-reality';
import { registerAdvancedCommandsPartA } from './register-advanced-a';
import { registerAdvancedCommandsPartB } from './register-advanced-b';
import { registerCacheCommands } from './cache';
import { registerInitCommand } from './init';
import { registerOnCommand } from './on';
import { registerStatsCommand } from './stats';
import { registerCheckpointCommand } from './checkpoint';
import { registerUpgradeCommand } from './upgrade';
import { registerWatchCommand } from './watch';
import { registerPreCommitCommand } from './pre-commit';
import { registerVerifyCommand } from './verify';
import { registerContextCommand } from './context';
import { registerProtectCommand } from './protect';
import { registerScanCommand } from './scan-consolidated';
import { registerShipCommand } from './ship-consolidated';
import { registerFixCommand } from './fix-consolidated';
import { registerExplainCommand } from './explain';
import { registerReplayCommand } from './replay';
import { registerCiUploadCommand } from './ci-upload';
import { registerDoctorCommand } from './doctor';
import { registerPluginCommand } from './plugin';
import { registerMenuCommand } from './register-menu';
import { printLogo } from '../ui/cli-terminal';

/**
 * Register all CLI commands on the shared Commander program instance.
 */
export function registerAllCommands(program: Command): void {
  registerAuthCommands(program);
  registerScansCoreCommands(program);
  registerSmellsFixCommands(program);
  registerFixRollbackCommands(program);
  registerShipCommands(program);
  registerRealityCommands(program);
  registerAdvancedCommandsPartA(program);
  registerAdvancedCommandsPartB(program);

  registerCacheCommands(program, printLogo);
  registerInitCommand(program);
  registerOnCommand(program);
  registerStatsCommand(program);
  registerCheckpointCommand(program);
  registerUpgradeCommand(program);
  registerWatchCommand(program);
  registerPreCommitCommand(program);
  registerVerifyCommand(program);
  registerContextCommand(program);
  registerProtectCommand(program);
  registerScanCommand(program);
  registerShipCommand(program);
  registerCiUploadCommand(program);
  registerFixCommand(program);
  registerExplainCommand(program);
  registerReplayCommand(program);
  registerDoctorCommand(program);
  registerPluginCommand(program);
  registerMenuCommand(program);
}

export { registerScanSecretsCommand } from './scan-secrets';
export { registerScanVulnerabilitiesCommand } from './scan-vulnerabilities';
export { generateEvidence, verifyEvidence } from './evidence';

export {
  registerEnterpriseCommands,
  registerSBOMCommand,
  registerPolicyCommand,
  registerAuditCommand,
  registerAnalyticsCommand,
} from './enterprise';
