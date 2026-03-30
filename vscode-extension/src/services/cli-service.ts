/**
 * CLI Service
 * 
 * Executes guardrail CLI commands and returns structured results
 * This provides a unified interface for all dashboard features
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

export interface CLICommand {
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  };
}

export interface CLIResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  command: string;
}

export interface CLICommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
  command: string;
}

export class CLIService {
  private readonly _cliPath: string;
  private readonly _workspacePath: string;

  constructor(workspacePath: string) {
    this._workspacePath = workspacePath;
    
    // Try to find the CLI in common locations
    const possiblePaths = [
      path.join(workspacePath, 'node_modules', '.bin', 'guardrail'),
      path.join(workspacePath, '..', 'node_modules', '.bin', 'guardrail'),
      path.join(workspacePath, 'packages', 'cli', 'dist', 'index.js'),
      'guardrail', // Assume it's in PATH
    ];

    this._cliPath = possiblePaths.find(p => {
      if (p === 'guardrail') return true; // Assume in PATH
      return fs.existsSync(p);
    }) || 'guardrail';
  }

  /**
   * Execute a CLI command and return the result
   */
  async executeCommand(command: CLICommand): Promise<CLIResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const args = command.args || [];
      const options = command.options || {};
      
      const child = spawn(this._cliPath, args, {
        cwd: options.cwd || this._workspacePath,
        env: { ...process.env, ...options.env },
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
          duration,
          command: `${this._cliPath} ${args.join(' ')}`
        });
      });

      child.on('error', (error) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          stdout: '',
          stderr: error.message,
          exitCode: -1,
          duration,
          command: `${this._cliPath} ${args.join(' ')}`
        });
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          child.kill();
          resolve({
            success: false,
            stdout: stdout,
            stderr: `Command timed out after ${options.timeout}ms`,
            exitCode: -1,
            duration: Date.now() - startTime,
            command: `${this._cliPath} ${args.join(' ')}`
          });
        }, options.timeout);
      }
    });
  }

  /**
   * Run security scan
   */
  async runSecurityScan(targetPath?: string): Promise<CLICommandResult> {
    const args = ['scan', '--format', 'json'];
    if (targetPath) {
      args.push(targetPath);
    }

    const result = await this.executeCommand({
      command: 'scan',
      args,
      options: { timeout: 300000 } // 5 minutes
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse scan results: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'Scan failed',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Run compliance check
   */
  async runComplianceCheck(frameworks?: string[]): Promise<CLICommandResult> {
    const args = ['compliance', '--format', 'json'];
    if (frameworks && frameworks.length > 0) {
      args.push('--frameworks', frameworks.join(','));
    }

    const result = await this.executeCommand({
      command: 'compliance',
      args,
      options: { timeout: 180000 } // 3 minutes
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse compliance results: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'Compliance check failed',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Run performance analysis
   */
  async runPerformanceAnalysis(): Promise<CLICommandResult> {
    const result = await this.executeCommand({
      command: 'performance',
      args: ['--format', 'json'],
      options: { timeout: 120000 } // 2 minutes
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse performance results: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'Performance analysis failed',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Run change impact analysis
   */
  async runChangeImpactAnalysis(files?: string[]): Promise<CLICommandResult> {
    const args = ['impact', '--format', 'json'];
    if (files && files.length > 0) {
      args.push('--files', files.join(','));
    }

    const result = await this.executeCommand({
      command: 'impact',
      args,
      options: { timeout: 180000 } // 3 minutes
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse impact analysis results: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'Change impact analysis failed',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Run AI code explanation
   */
  async runAIExplanation(code: string, language: string, options?: {
    detailLevel?: 'basic' | 'detailed' | 'comprehensive';
    includeExamples?: boolean;
  }): Promise<CLICommandResult> {
    const args = ['explain', '--code', code, '--language', language, '--format', 'json'];
    
    if (options?.detailLevel) {
      args.push('--detail', options.detailLevel);
    }
    if (options?.includeExamples) {
      args.push('--examples');
    }

    const result = await this.executeCommand({
      command: 'explain',
      args,
      options: { timeout: 120000 } // 2 minutes
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse AI explanation results: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'AI explanation failed',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Generate MDC (Model Definition Code)
   */
  async generateMDC(options?: {
    framework?: string;
    output?: string;
    template?: string;
  }): Promise<CLICommandResult> {
    const args = ['mdc', '--format', 'json'];
    
    if (options?.framework) {
      args.push('--framework', options.framework);
    }
    if (options?.output) {
      args.push('--output', options.output);
    }
    if (options?.template) {
      args.push('--template', options.template);
    }

    const result = await this.executeCommand({
      command: 'mdc',
      args,
      options: { timeout: 60000 } // 1 minute
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse MDC generation results: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'MDC generation failed',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Get team collaboration data
   */
  async getTeamData(): Promise<CLICommandResult> {
    const result = await this.executeCommand({
      command: 'team',
      args: ['--format', 'json'],
      options: { timeout: 30000 } // 30 seconds
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse team data: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'Failed to get team data',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Get production integrity data
   */
  async getProductionIntegrity(): Promise<CLICommandResult> {
    const result = await this.executeCommand({
      command: 'integrity',
      args: ['--format', 'json'],
      options: { timeout: 60000 } // 1 minute
    });

    try {
      if (result.success && result.stdout) {
        const data = JSON.parse(result.stdout);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse production integrity data: ${error}`,
        duration: result.duration,
        command: result.command
      };
    }

    return {
      success: false,
      error: result.stderr || 'Failed to get production integrity data',
      duration: result.duration,
      command: result.command
    };
  }

  /**
   * Check if CLI is available and working
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const result = await this.executeCommand({
        command: 'version',
        args: ['--format', 'json'],
        options: { timeout: 10000 }
      });
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get CLI version
   */
  async getVersion(): Promise<string> {
    try {
      const result = await this.executeCommand({
        command: 'version',
        options: { timeout: 10000 }
      });
      return result.success ? result.stdout : 'Unknown';
    } catch {
      return 'Unknown';
    }
  }
}
