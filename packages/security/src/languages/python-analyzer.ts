/**
 * Python Language Analyzer
 *
 * Security analysis for Python projects including:
 * - requirements.txt / Pipfile / pyproject.toml parsing
 * - Import analysis for detecting dangerous modules
 * - Secret detection patterns specific to Python
 * - Common vulnerability patterns (SQL injection, command injection, etc.)
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

export interface PythonDependency {
  name: string;
  version: string;
  source: "requirements" | "pipfile" | "pyproject" | "setup";
  extras?: string[];
}

export interface PythonSecurityIssue {
  type: "vulnerability" | "secret" | "dangerous_import" | "code_pattern";
  severity: "low" | "medium" | "high" | "critical";
  file: string;
  line?: number;
  message: string;
  recommendation: string;
}

export interface PythonAnalysisResult {
  projectPath: string;
  pythonVersion?: string;
  dependencies: PythonDependency[];
  securityIssues: PythonSecurityIssue[];
  summary: {
    totalDependencies: number;
    directDependencies: number;
    issuesBySeverity: Record<string, number>;
  };
}

// Dangerous Python imports that may indicate security issues
const DANGEROUS_IMPORTS = [
  {
    module: "pickle",
    reason: "Arbitrary code execution via deserialization",
    severity: "high" as const,
  },
  {
    module: "marshal",
    reason: "Unsafe deserialization",
    severity: "high" as const,
  },
  {
    module: "shelve",
    reason: "Uses pickle internally",
    severity: "medium" as const,
  },
  {
    module: "subprocess",
    reason: "Command execution - ensure proper sanitization",
    severity: "medium" as const,
  },
  {
    module: "os.system",
    reason: "Command execution - prefer subprocess",
    severity: "high" as const,
  },
  {
    module: "eval",
    reason: "Arbitrary code execution",
    severity: "critical" as const,
  },
  {
    module: "exec",
    reason: "Arbitrary code execution",
    severity: "critical" as const,
  },
  {
    module: "compile",
    reason: "Dynamic code compilation",
    severity: "medium" as const,
  },
  {
    module: "__import__",
    reason: "Dynamic import - potential for injection",
    severity: "medium" as const,
  },
];

// Python-specific secret patterns
const PYTHON_SECRET_PATTERNS = [
  { pattern: /(?:api_key|apikey)\s*=\s*['"][^'"]{10,}['"]/gi, type: "API Key" },
  {
    pattern: /(?:secret|password|passwd|pwd)\s*=\s*['"][^'"]{6,}['"]/gi,
    type: "Password/Secret",
  },
  {
    pattern: /(?:token|auth_token|access_token)\s*=\s*['"][^'"]{10,}['"]/gi,
    type: "Token",
  },
  {
    pattern: /AWS_(?:ACCESS_KEY_ID|SECRET_ACCESS_KEY)\s*=\s*['"][^'"]+['"]/gi,
    type: "AWS Credential",
  },
  {
    pattern: /(?:private_key|ssh_key)\s*=\s*['"]-----BEGIN/gi,
    type: "Private Key",
  },
  {
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@/gi,
    type: "MongoDB Connection String",
  },
  {
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@/gi,
    type: "PostgreSQL Connection String",
  },
];

// Vulnerability code patterns
const VULNERABILITY_PATTERNS = [
  {
    pattern: /cursor\.execute\s*\(\s*['"f].*\{.*\}/g,
    type: "SQL Injection",
    message: "String formatting in SQL query - use parameterized queries",
    severity: "critical" as const,
  },
  {
    pattern: /cursor\.execute\s*\(\s*.*%\s*\(/g,
    type: "SQL Injection",
    message: "String interpolation in SQL query - use parameterized queries",
    severity: "critical" as const,
  },
  {
    pattern: /subprocess\.(?:call|run|Popen)\s*\(\s*['"f].*\{/g,
    type: "Command Injection",
    message: "String formatting in shell command - use list arguments",
    severity: "critical" as const,
  },
  {
    pattern: /os\.system\s*\(/g,
    type: "Command Injection",
    message: "os.system is vulnerable to shell injection - use subprocess",
    severity: "high" as const,
  },
  {
    pattern: /yaml\.load\s*\([^)]*\)/g,
    type: "Unsafe Deserialization",
    message: "yaml.load is unsafe - use yaml.safe_load instead",
    severity: "high" as const,
  },
  {
    pattern: /pickle\.loads?\s*\(/g,
    type: "Unsafe Deserialization",
    message: "Pickle is unsafe with untrusted data",
    severity: "high" as const,
  },
  {
    pattern: /render_template_string\s*\(/g,
    type: "Server-Side Template Injection",
    message: "render_template_string with user input is dangerous",
    severity: "critical" as const,
  },
  {
    pattern: /DEBUG\s*=\s*True/g,
    type: "Debug Mode",
    message: "Debug mode enabled - disable in production",
    severity: "medium" as const,
  },
  {
    pattern: /verify\s*=\s*False/g,
    type: "SSL Verification Disabled",
    message: "SSL verification disabled - vulnerable to MITM attacks",
    severity: "high" as const,
  },
];

export class PythonAnalyzer {
  /**
   * Analyze a Python project
   */
  async analyze(projectPath: string): Promise<PythonAnalysisResult> {
    const dependencies = await this.extractDependencies(projectPath);
    const securityIssues: PythonSecurityIssue[] = [];

    // Scan Python files for security issues
    const pythonFiles = await this.findPythonFiles(projectPath);
    for (const file of pythonFiles) {
      const issues = await this.scanFile(file);
      securityIssues.push(...issues);
    }

    // Get Python version if available
    const pythonVersion = this.detectPythonVersion(projectPath);

    // Calculate summary
    const issuesBySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };
    for (const issue of securityIssues) {
      const severity = issue.severity;
      if (issuesBySeverity[severity] !== undefined) {
        issuesBySeverity[severity]++;
      }
    }

    return {
      projectPath,
      pythonVersion,
      dependencies,
      securityIssues,
      summary: {
        totalDependencies: dependencies.length,
        directDependencies: dependencies.length,
        issuesBySeverity,
      },
    };
  }

  /**
   * Extract dependencies from various Python dependency files
   */
  private async extractDependencies(
    projectPath: string,
  ): Promise<PythonDependency[]> {
    const dependencies: PythonDependency[] = [];

    // Check requirements.txt
    const requirementsPath = join(projectPath, "requirements.txt");
    if (existsSync(requirementsPath)) {
      const content = readFileSync(requirementsPath, "utf-8");
      dependencies.push(...this.parseRequirementsTxt(content));
    }

    // Check pyproject.toml
    const pyprojectPath = join(projectPath, "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      const content = readFileSync(pyprojectPath, "utf-8");
      dependencies.push(...this.parsePyprojectToml(content));
    }

    // Check Pipfile
    const pipfilePath = join(projectPath, "Pipfile");
    if (existsSync(pipfilePath)) {
      const content = readFileSync(pipfilePath, "utf-8");
      dependencies.push(...this.parsePipfile(content));
    }

    return dependencies;
  }

  /**
   * Parse requirements.txt format
   */
  private parseRequirementsTxt(content: string): PythonDependency[] {
    const dependencies: PythonDependency[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) {
        continue;
      }

      // Match package==version or package>=version etc.
      const match = trimmed.match(
        /^([a-zA-Z0-9_-]+)\s*([=<>!~]+)?\s*([\d.]+)?/,
      );
      if (match && match[1]) {
        dependencies.push({
          name: match[1],
          version: match[3] ?? "*",
          source: "requirements",
        });
      }
    }

    return dependencies;
  }

  /**
   * Parse pyproject.toml dependencies
   */
  private parsePyprojectToml(content: string): PythonDependency[] {
    const dependencies: PythonDependency[] = [];

    // Simple regex parsing for dependencies section
    const depsMatch = content.match(
      /\[project\.dependencies\]([\s\S]*?)(?:\[|$)/,
    );
    if (depsMatch && depsMatch[1]) {
      const lines = depsMatch[1].split("\n");
      for (const line of lines) {
        const match = line.match(/^\s*"([^"]+)"/);
        if (match && match[1]) {
          const depSpec = match[1];
          const nameMatch = depSpec.match(/^([a-zA-Z0-9_-]+)/);
          const versionMatch = depSpec.match(/[=<>!~]+([\d.]+)/);
          if (nameMatch && nameMatch[1]) {
            dependencies.push({
              name: nameMatch[1],
              version: versionMatch?.[1] ?? "*",
              source: "pyproject",
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Parse Pipfile dependencies
   */
  private parsePipfile(content: string): PythonDependency[] {
    const dependencies: PythonDependency[] = [];

    // Match [packages] section
    const packagesMatch = content.match(/\[packages\]([\s\S]*?)(?:\[|$)/);
    if (packagesMatch && packagesMatch[1]) {
      const lines = packagesMatch[1].split("\n");
      for (const line of lines) {
        const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"?([^"\n]+)"?/);
        if (match && match[1] && match[2]) {
          dependencies.push({
            name: match[1],
            version: match[2] === "*" ? "*" : match[2],
            source: "pipfile",
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Find all Python files in project
   */
  private async findPythonFiles(projectPath: string): Promise<string[]> {
    const files: string[] = [];

    // Simple recursive file finder
    const walkDir = (dir: string) => {
      try {
        const { readdirSync, statSync } = require("fs");
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);

          // Skip common non-source directories
          if (
            [
              "node_modules",
              ".git",
              "__pycache__",
              ".venv",
              "venv",
              "env",
              ".tox",
            ].includes(entry)
          ) {
            continue;
          }

          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              walkDir(fullPath);
            } else if (entry.endsWith(".py")) {
              files.push(fullPath);
            }
          } catch {
            // Skip files we can't access
          }
        }
      } catch {
        // Skip directories we can't access
      }
    };

    walkDir(projectPath);
    return files;
  }

  /**
   * Scan a Python file for security issues
   */
  private async scanFile(filePath: string): Promise<PythonSecurityIssue[]> {
    const issues: PythonSecurityIssue[] = [];

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      // Check for dangerous imports
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        for (const dangerous of DANGEROUS_IMPORTS) {
          if (
            line &&
            (line.includes(`import ${dangerous.module}`) ||
              line.includes(`from ${dangerous.module}`) ||
              line.includes(dangerous.module))
          ) {
            issues.push({
              type: "dangerous_import",
              severity: dangerous.severity,
              file: filePath,
              line: i + 1,
              message: `Dangerous import: ${dangerous.module} - ${dangerous.reason}`,
              recommendation: `Review usage of ${dangerous.module} and ensure proper security controls`,
            });
          }
        }
      }

      // Check for secrets
      for (const secretPattern of PYTHON_SECRET_PATTERNS) {
        const matches = content.matchAll(secretPattern.pattern);
        for (const match of matches) {
          const lineNum = content.substring(0, match.index).split("\n").length;
          issues.push({
            type: "secret",
            severity: "critical",
            file: filePath,
            line: lineNum,
            message: `Potential ${secretPattern.type} detected`,
            recommendation:
              "Move secrets to environment variables or a secure vault",
          });
        }
      }

      // Check for vulnerability patterns
      for (const vulnPattern of VULNERABILITY_PATTERNS) {
        const matches = content.matchAll(vulnPattern.pattern);
        for (const match of matches) {
          const lineNum = content.substring(0, match.index).split("\n").length;
          issues.push({
            type: "code_pattern",
            severity: vulnPattern.severity,
            file: filePath,
            line: lineNum,
            message: `${vulnPattern.type}: ${vulnPattern.message}`,
            recommendation: `Fix the ${vulnPattern.type.toLowerCase()} vulnerability`,
          });
        }
      }
    } catch (error) {
      // Skip files we can't read
    }

    return issues;
  }

  /**
   * Detect Python version from project
   */
  private detectPythonVersion(projectPath: string): string | undefined {
    // Check pyproject.toml for requires-python
    const pyprojectPath = join(projectPath, "pyproject.toml");
    if (existsSync(pyprojectPath)) {
      const content = readFileSync(pyprojectPath, "utf-8");
      const match = content.match(/requires-python\s*=\s*"([^"]+)"/);
      if (match) {
        return match[1];
      }
    }

    // Check .python-version file
    const pythonVersionPath = join(projectPath, ".python-version");
    if (existsSync(pythonVersionPath)) {
      return readFileSync(pythonVersionPath, "utf-8").trim();
    }

    // Check runtime.txt (Heroku)
    const runtimePath = join(projectPath, "runtime.txt");
    if (existsSync(runtimePath)) {
      const content = readFileSync(runtimePath, "utf-8").trim();
      const match = content.match(/python-([\d.]+)/);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }
}

// Export singleton
export const pythonAnalyzer = new PythonAnalyzer();
