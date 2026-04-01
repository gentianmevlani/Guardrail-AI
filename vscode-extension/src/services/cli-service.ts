/**
 * CLI Service
 * 
 * Executes guardrail CLI commands and returns structured results
 * This provides a unified interface for all dashboard features
 */

import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
<<<<<<< HEAD
import { extractJsonObject, normalizeScanJsonData } from "../scan-cli-map";
=======
import { extractJsonObject } from "../scan-cli-map";
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

/** Repo root to use as cwd when running `bin/guardrail.js` (expects project at cwd). */
function resolveGuardrailCli(workspacePath: string): {
  executable: string;
  argPrefix: string[];
  useShell: boolean;
  displayPath: string;
  defaultCwd: string;
} {
  const normalized = path.resolve(workspacePath);
  const rootsToTry = [
    normalized,
    path.join(normalized, ".."),
    path.join(normalized, "..", ".."),
  ];

  for (const root of rootsToTry) {
    const binJs = path.join(root, "bin", "guardrail.js");
    if (fs.existsSync(binJs)) {
      return {
        executable: process.execPath,
        argPrefix: [binJs],
        useShell: false,
        displayPath: binJs,
        defaultCwd: path.resolve(root),
      };
    }
  }

  const shimCandidates = [
    path.join(normalized, "node_modules", ".bin", "guardrail"),
    path.join(normalized, "..", "node_modules", ".bin", "guardrail"),
  ];
  for (const shim of shimCandidates) {
    if (fs.existsSync(shim)) {
      return {
        executable: shim,
        argPrefix: [],
        useShell: false,
        displayPath: shim,
        defaultCwd: normalized,
      };
    }
  }

  const legacyCli = path.join(
    normalized,
    "packages",
    "cli",
    "dist",
    "index.js",
  );
  if (fs.existsSync(legacyCli)) {
    return {
      executable: process.execPath,
      argPrefix: [legacyCli],
      useShell: false,
      displayPath: legacyCli,
      defaultCwd: normalized,
    };
  }

  return {
    executable: "guardrail",
    argPrefix: [],
    useShell: true,
    displayPath: "guardrail",
    defaultCwd: normalized,
  };
}

export interface CLICommand {
  /** Subcommand name (e.g. `scan`); omit when `args` already includes the full argv tail. */
  command?: string;
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

export interface CLICommandResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  duration: number;
  command: string;
}

export class CLIService {
  private readonly _spawnExecutable: string;
  private readonly _spawnArgPrefix: string[];
  private readonly _spawnShell: boolean;
  private readonly _cliDisplayPath: string;
  /** Prefer repo root when running `bin/guardrail.js` so scan/ship resolve the project. */
  private readonly _defaultCliCwd: string;

  constructor(workspacePath: string) {
    const resolved = resolveGuardrailCli(workspacePath);
    this._spawnExecutable = resolved.executable;
    this._spawnArgPrefix = resolved.argPrefix;
    this._spawnShell = resolved.useShell;
    this._cliDisplayPath = resolved.displayPath;
    this._defaultCliCwd = resolved.defaultCwd;
  }

  /**
   * Execute a CLI command and return the result
   */
  async executeCommand(command: CLICommand): Promise<CLIResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const rawArgs = command.args || [];
      const args =
        command.command && command.command.length > 0
          ? [command.command, ...rawArgs]
          : rawArgs;
      const options = command.options || {};
      const spawnArgs = [...this._spawnArgPrefix, ...args];
      const cwd = options.cwd || this._defaultCliCwd;
      const cmdLineForLog = `${this._cliDisplayPath} ${args.join(" ")}`;

      const child = spawn(this._spawnExecutable, spawnArgs, {
        cwd,
        env: { ...process.env, ...options.env },
        stdio: "pipe",
        shell: this._spawnShell,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      child.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      child.on("close", (code) => {
        const duration = Date.now() - startTime;
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code || 0,
          duration,
          command: cmdLineForLog,
        });
      });

      child.on("error", (error) => {
        const duration = Date.now() - startTime;
        resolve({
          success: false,
          stdout: "",
          stderr: error.message,
          exitCode: -1,
          duration,
          command: cmdLineForLog,
        });
      });

      if (options.timeout) {
        setTimeout(() => {
          child.kill();
          resolve({
            success: false,
            stdout: stdout,
            stderr: `Command timed out after ${options.timeout}ms`,
            exitCode: -1,
            duration: Date.now() - startTime,
            command: cmdLineForLog,
          });
        }, options.timeout);
      }
    });
  }

  private parseStdoutJson(result: CLIResult): unknown | null {
<<<<<<< HEAD
    const raw = extractJsonObject(result.stdout);
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return normalizeScanJsonData(raw as Record<string, unknown>);
    }
    return raw;
=======
    return extractJsonObject(result.stdout);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  /**
   * `guardrail scan --json` — single source of truth for security, compliance-style, and performance panels.
   */
  async runScanJson(extraArgs?: string[]): Promise<CLICommandResult<Record<string, unknown>>> {
    const args = ["scan", "--json", ...(extraArgs ?? [])];
    const result = await this.executeCommand({
      args,
      options: { timeout: 300000 },
    });
    const data = this.parseStdoutJson(result);
    if (data && typeof data === "object") {
      return {
        success: true,
        data: data as Record<string, unknown>,
        duration: result.duration,
        command: result.command,
      };
    }
    return {
      success: false,
      error: result.stderr || "scan produced no JSON",
      duration: result.duration,
      command: result.command,
    };
  }

  /** @deprecated Use runScanJson — kept for call-site compatibility */
  async runSecurityScan(targetPath?: string): Promise<CLICommandResult<Record<string, unknown>>> {
    if (targetPath) {
      return this.runScanJson(["--path", targetPath]);
    }
    return this.runScanJson();
  }

  /** Local assessment uses the same scan JSON (no separate `compliance` CLI in OSS). */
  async runComplianceCheck(_frameworks?: string[]): Promise<CLICommandResult<Record<string, unknown>>> {
    void _frameworks;
    return this.runScanJson();
  }

  /** Performance summary is derived from scan JSON in the panel. */
  async runPerformanceAnalysis(): Promise<CLICommandResult<Record<string, unknown>>> {
    return this.runScanJson();
  }

  /** Impact uses scan JSON (hotspots / findings), not a separate `impact` command. */
  async runChangeImpactAnalysis(_files?: string[]): Promise<CLICommandResult<Record<string, unknown>>> {
    void _files;
    return this.runScanJson();
  }

  /**
   * `guardrail explain <finding-id>` — stdout is text, not JSON.
   */
  async runExplainFinding(findingId: string): Promise<CLICommandResult<{ text: string }>> {
    const result = await this.executeCommand({
      args: ["explain", findingId],
      options: { timeout: 120000 },
    });
    if (result.stdout !== undefined) {
      return {
        success: result.exitCode === 0,
        data: { text: result.stdout },
        duration: result.duration,
        command: result.command,
      };
    }
    return {
      success: false,
      error: result.stderr || "explain failed",
      duration: result.duration,
      command: result.command,
    };
  }

  /**
   * `guardrail context --json --stdout` — structured routes/env/schemas (replaces fictional `mdc` command).
   */
  async runContextStdoutJson(): Promise<CLICommandResult<Record<string, unknown>>> {
    const result = await this.executeCommand({
      args: ["context", "--json", "--stdout"],
      options: { timeout: 120000 },
    });
    const data = this.parseStdoutJson(result);
    if (data && typeof data === "object") {
      return {
        success: true,
        data: data as Record<string, unknown>,
        duration: result.duration,
        command: result.command,
      };
    }
    return {
      success: false,
      error: result.stderr || "context produced no JSON",
      duration: result.duration,
      command: result.command,
    };
  }

  /** @deprecated Use runExplainFinding */
  async runAIExplanation(
    _code: string,
    _language: string,
    _options?: { detailLevel?: string; includeExamples?: boolean },
  ): Promise<CLICommandResult> {
    void _code;
    void _language;
    void _options;
    return {
      success: false,
      error:
        "Use runExplainFinding(findingId) after guardrail scan — the CLI does not accept arbitrary code.",
      duration: 0,
      command: "",
    };
  }

  /** @deprecated Use runContextStdoutJson */
  async generateMDC(_options?: {
    framework?: string;
    output?: string;
    template?: string;
  }): Promise<CLICommandResult> {
    void _options;
    return this.runContextStdoutJson() as Promise<CLICommandResult>;
  }

  /**
   * Get team collaboration data
   */
  async getTeamData(): Promise<CLICommandResult> {
    const result = await this.executeCommand({
      args: ["team", "--format", "json"],
      options: { timeout: 30000 },
    });

    const out = result.stdout?.trim();
    if (out) {
      try {
        const data = JSON.parse(out);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse team data: ${error}`,
          duration: result.duration,
          command: result.command,
        };
      }
    }

    return {
      success: false,
      error: result.stderr || "Failed to get team data",
      duration: result.duration,
      command: result.command,
    };
  }

  /**
<<<<<<< HEAD
   * `guardrail vibe-check` — shipping readiness analysis (stdout text or JSON).
   */
  async runVibeCheck(extraArgs: string[] = []): Promise<CLIResult> {
    return this.executeCommand({
      args: ["vibe-check", ...extraArgs],
      options: { timeout: 300000 },
    });
  }

  /**
   * `guardrail list-templates --json`
   */
  async runListTemplatesJson(): Promise<CLICommandResult<{ templates: unknown[] }>> {
    const result = await this.executeCommand({
      args: ["list-templates", "--json"],
      options: { timeout: 60000 },
    });
    const out = result.stdout?.trim();
    if (out) {
      try {
        const data = JSON.parse(out) as { templates: unknown[] };
        return {
          success: result.exitCode === 0,
          data,
          duration: result.duration,
          command: result.command,
        };
      } catch (e) {
        return {
          success: false,
          error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          duration: result.duration,
          command: result.command,
        };
      }
    }
    return {
      success: false,
      error: result.stderr || "list-templates produced no output",
      duration: result.duration,
      command: result.command,
    };
  }

  /**
   * `guardrail apply-template <type> --json`
   */
  async runApplyTemplateJson(
    templateId: string,
    extraFlags: string[] = [],
  ): Promise<CLICommandResult<Record<string, unknown>>> {
    const result = await this.executeCommand({
      args: ["apply-template", templateId, "--json", ...extraFlags],
      options: { timeout: 120000 },
    });
    const out = result.stdout?.trim();
    if (out) {
      try {
        const data = JSON.parse(out) as Record<string, unknown>;
        const ok =
          result.exitCode === 0 &&
          (data.success === undefined || data.success === true);
        return {
          success: ok,
          data,
          duration: result.duration,
          command: result.command,
        };
      } catch (e) {
        return {
          success: false,
          error: `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
          duration: result.duration,
          command: result.command,
        };
      }
    }
    return {
      success: false,
      error: result.stderr || "apply-template produced no output",
      duration: result.duration,
      command: result.command,
    };
  }

  /**
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
   * `guardrail doctor` — environment and CLI health (stdout text).
   */
  async runDoctor(): Promise<CLIResult> {
    return this.executeCommand({
      args: ["doctor"],
      options: { timeout: 120000 },
    });
  }

  /**
   * `guardrail whoami` — current user / plan when logged in.
   */
  async runWhoami(): Promise<CLIResult> {
    return this.executeCommand({
      args: ["whoami"],
      options: { timeout: 30000 },
    });
  }

  /**
   * CI-style gate — `guardrail gate --json` (structured result).
   */
  async runGateJson(): Promise<CLICommandResult<Record<string, unknown>>> {
    const result = await this.executeCommand({
      args: ["gate", "--json"],
      options: { timeout: 300000 },
    });
    const data = this.parseStdoutJson(result);
    if (data && typeof data === "object") {
      return {
        success: result.exitCode === 0,
        data: data as Record<string, unknown>,
        duration: result.duration,
        command: result.command,
      };
    }
    return {
      success: false,
      error: result.stderr || "gate produced no JSON",
      duration: result.duration,
      command: result.command,
    };
  }

  /**
   * Workspace ship gate — maps to `guardrail ship --json` (no separate integrity subcommand).
   */
  async getProductionIntegrity(): Promise<CLICommandResult> {
    const result = await this.executeCommand({
      args: ["ship", "--json"],
      options: { timeout: 120000 },
    });

    const out = result.stdout?.trim();
    if (out) {
      try {
        const data = JSON.parse(out);
        return {
          success: true,
          data,
          duration: result.duration,
          command: result.command,
        };
      } catch (error) {
        return {
          success: false,
          error: `Failed to parse ship JSON: ${error}`,
          duration: result.duration,
          command: result.command,
        };
      }
    }

    return {
      success: false,
      error: result.stderr || "Ship check produced no JSON output",
      duration: result.duration,
      command: result.command,
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
