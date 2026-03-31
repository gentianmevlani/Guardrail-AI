import {
  ActionAttempt,
  ActionDecision,
  Evaluation,
  FilesystemDetails,
  NetworkDetails,
  ShellDetails,
  FilesystemPermissions,
  NetworkPermissions,
  ShellPermissions,
} from '@guardrail/core';
import { isPathAllowed, isDomainAllowed } from '@guardrail/core';
import { permissionManager } from './permission-manager';
import { circuitBreaker } from './circuit-breaker';
import { approvalQueue } from './approval-queue';
import { toolPolicyEnforcer } from './tool-policy';

/**
 * Intercepts and evaluates agent actions before execution
 *
 * Pipeline:
 * 1. Circuit breaker check (kill switch)
 * 2. Tool policy check (declarative allow/deny)
 * 3. Permission evaluation (existing logic)
 * 4. HITL approval queue (if high-risk)
 */
export class ActionInterceptor {
  /**
   * Main interception method - evaluates any action attempt.
   * Now integrates circuit breaker, tool policies, and HITL approval.
   */
  async intercept(action: ActionAttempt): Promise<ActionDecision> {
    // ── Stage 0: Circuit Breaker (kill switch) ──────────────
    const riskGuess = this.estimateRisk(action);
    const circuitCheck = circuitBreaker.canProceed(riskGuess);
    if (!circuitCheck.allowed) {
      circuitBreaker.recordFailure('Action blocked by circuit breaker');
      return {
        allowed: false,
        reason: circuitCheck.reason,
        riskLevel: 'CRITICAL',
        requiresApproval: false,
      };
    }

    // ── Stage 0.5: Tool Policy Check ────────────────────────
    const toolCheck = toolPolicyEnforcer.evaluate(action);
    if (!toolCheck.allowed) {
      circuitBreaker.recordFailure('Action blocked by tool policy');
      return {
        allowed: false,
        reason: toolCheck.reason,
        riskLevel: toolCheck.riskLevel ?? 'HIGH',
        requiresApproval: false,
      };
    }

    // ── Stage 1: Agent status ───────────────────────────────
    // Check if agent is active
    const isActive = await permissionManager.isAgentActive(action.agentId);
    if (!isActive) {
      circuitBreaker.recordFailure('Inactive agent attempted action');
      return {
        allowed: false,
        reason: 'Agent is not active (suspended or revoked)',
        riskLevel: 'CRITICAL',
        requiresApproval: false,
      };
    }

    // Get agent permissions
    const permissions = await permissionManager.getPermissions(action.agentId);
    if (!permissions) {
      circuitBreaker.recordFailure('Agent permissions not found');
      return {
        allowed: false,
        reason: 'Agent permissions not found',
        riskLevel: 'CRITICAL',
        requiresApproval: false,
      };
    }

    // ── Stage 2: Permission evaluation ──────────────────────
    // Evaluate based on action category
    let evaluation: Evaluation;
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    switch (action.category) {
      case 'file':
        evaluation = this.evaluateFilesystemAction(
          action.details as FilesystemDetails,
          permissions.filesystem
        );
        riskLevel = this.calculateFilesystemRisk(
          action.details as FilesystemDetails
        );
        break;

      case 'network':
        evaluation = this.evaluateNetworkAction(
          action.details as NetworkDetails,
          permissions.network
        );
        riskLevel = this.calculateNetworkRisk(
          action.details as NetworkDetails
        );
        break;

      case 'shell':
        evaluation = this.evaluateShellAction(
          action.details as ShellDetails,
          permissions.shell
        );
        riskLevel = this.calculateShellRisk(
          action.details as ShellDetails
        );
        break;

      case 'code':
        // Code generation/modification is always allowed but logged
        evaluation = { passed: true, reason: 'Code action', violatedRules: [], suggestions: [] };
        riskLevel = 'LOW';
        break;

      default:
        return {
          allowed: false,
          reason: `Unknown action category: ${action.category}`,
          riskLevel: 'MEDIUM',
          requiresApproval: false,
        };
    }

    // Determine if approval is required
    const requiresApproval = riskLevel === 'CRITICAL' || !evaluation.passed;

    return {
      allowed: evaluation.passed,
      reason: evaluation.reason,
      alternativeSuggestion: evaluation.suggestions[0],
      riskLevel,
      requiresApproval,
    };
  }

  /**
   * Evaluate filesystem action against permissions
   */
  private evaluateFilesystemAction(
    details: FilesystemDetails,
    permissions: FilesystemPermissions
  ): Evaluation {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check operation is allowed
    if (!permissions.operations.includes(details.operation)) {
      violations.push(`Operation '${details.operation}' is not permitted`);
      return {
        passed: false,
        reason: `Operation '${details.operation}' is not allowed`,
        violatedRules: violations,
        suggestions,
      };
    }

    // Check path is allowed
    if (!isPathAllowed(details.path, permissions.allowedPaths, permissions.deniedPaths)) {
      violations.push(`Path '${details.path}' is not accessible`);
      suggestions.push('Check allowed and denied paths in agent permissions');
      return {
        passed: false,
        reason: `Access to path '${details.path}' is denied`,
        violatedRules: violations,
        suggestions,
      };
    }

    // Check file size if applicable
    if (details.size && details.size > permissions.maxFileSize) {
      violations.push(`File size ${details.size} exceeds limit ${permissions.maxFileSize}`);
      return {
        passed: false,
        reason: `File size exceeds maximum allowed (${permissions.maxFileSize} bytes)`,
        violatedRules: violations,
        suggestions: ['Reduce file size or increase limit'],
      };
    }

    return {
      passed: true,
      reason: 'Filesystem action approved',
      violatedRules: [],
      suggestions: [],
    };
  }

  /**
   * Evaluate network action against permissions
   */
  private evaluateNetworkAction(
    details: NetworkDetails,
    permissions: NetworkPermissions
  ): Evaluation {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check if network access is allowed at all
    if (permissions.maxRequests === 0) {
      violations.push('Network access is not permitted');
      return {
        passed: false,
        reason: 'Network access is disabled for this agent',
        violatedRules: violations,
        suggestions: ['Enable network permissions if needed'],
      };
    }

    // Check domain is allowed
    if (!isDomainAllowed(details.url, permissions.allowedDomains, permissions.deniedDomains)) {
      violations.push(`Domain in URL '${details.url}' is not accessible`);
      suggestions.push('Check allowed and denied domains in agent permissions');
      return {
        passed: false,
        reason: `Access to domain in '${details.url}' is denied`,
        violatedRules: violations,
        suggestions,
      };
    }

    // Check protocol
    const protocol = new URL(details.url).protocol.replace(':', '');
    if (!permissions.allowedProtocols.includes(protocol as any)) {
      violations.push(`Protocol '${protocol}' is not allowed`);
      return {
        passed: false,
        reason: `Protocol '${protocol}' is not permitted`,
        violatedRules: violations,
        suggestions: [`Use one of: ${permissions.allowedProtocols.join(', ')}`],
      };
    }

    return {
      passed: true,
      reason: 'Network action approved',
      violatedRules: [],
      suggestions: [],
    };
  }

  /**
   * Evaluate shell action against permissions
   */
  private evaluateShellAction(
    details: ShellDetails,
    permissions: ShellPermissions
  ): Evaluation {
    const violations: string[] = [];
    const suggestions: string[] = [];

    const fullCommand = `${details.command} ${details.args.join(' ')}`.trim();

    // Check if command is denied
    for (const deniedCmd of permissions.deniedCommands) {
      if (deniedCmd === '*' || fullCommand.includes(deniedCmd)) {
        violations.push(`Command contains denied pattern: ${deniedCmd}`);
        return {
          passed: false,
          reason: `Command '${fullCommand}' is explicitly denied`,
          violatedRules: violations,
          suggestions: ['Use an allowed command instead'],
        };
      }
    }

    // Check if command is allowed
    const isAllowed =
      permissions.allowedCommands.includes('*') ||
      permissions.allowedCommands.some(
        (allowedCmd: string) =>
          fullCommand === allowedCmd ||
          fullCommand.startsWith(allowedCmd + ' ')
      );

    if (!isAllowed) {
      violations.push(`Command '${fullCommand}' is not in allowed list`);
      suggestions.push(
        `Allowed commands: ${permissions.allowedCommands.join(', ')}`
      );
      return {
        passed: false,
        reason: `Command '${fullCommand}' is not allowed`,
        violatedRules: violations,
        suggestions,
      };
    }

    return {
      passed: true,
      reason: 'Shell action approved',
      violatedRules: [],
      suggestions: [],
    };
  }

  /**
   * Calculate risk level for filesystem operations
   */
  private calculateFilesystemRisk(details: FilesystemDetails): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Delete operations are high risk
    if (details.operation === 'delete') {
      return 'HIGH';
    }

    // Execute operations are medium-high risk
    if (details.operation === 'execute') {
      return 'MEDIUM';
    }

    // Writing to config files is medium risk
    const configFiles = [
      'package.json',
      'tsconfig.json',
      '.env',
      'docker-compose.yml',
      'Dockerfile',
    ];
    if (
      details.operation === 'write' &&
      configFiles.some((f) => details.path.endsWith(f))
    ) {
      return 'MEDIUM';
    }

    // Reading is low risk
    if (details.operation === 'read') {
      return 'LOW';
    }

    return 'LOW';
  }

  /**
   * Calculate risk level for network operations
   */
  private calculateNetworkRisk(details: NetworkDetails): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // POST/PUT/DELETE are higher risk than GET
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(details.method.toUpperCase())) {
      return 'MEDIUM';
    }

    // External APIs are medium risk
    const trustedDomains = ['github.com', 'npmjs.org'];
    const url = new URL(details.url);
    if (!trustedDomains.some((d) => url.hostname.includes(d))) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Calculate risk level for shell operations
   */
  private calculateShellRisk(details: ShellDetails): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const fullCommand = `${details.command} ${details.args.join(' ')}`.trim();

    // Critical risk commands
    const criticalPatterns = ['rm -rf', 'format', 'dd', 'mkfs', 'del /f /s'];
    if (criticalPatterns.some((p) => fullCommand.includes(p))) {
      return 'CRITICAL';
    }

    // High risk commands
    const highRiskPatterns = ['rm', 'del', 'mv', 'move', 'chmod', 'chown'];
    if (highRiskPatterns.some((p) => fullCommand.startsWith(p))) {
      return 'HIGH';
    }

    // Medium risk commands
    const mediumRiskPatterns = ['npm install', 'yarn add', 'git push'];
    if (mediumRiskPatterns.some((p) => fullCommand.includes(p))) {
      return 'MEDIUM';
    }

    return 'LOW';
  }
}

// Export singleton instance
export const actionInterceptor = new ActionInterceptor();
