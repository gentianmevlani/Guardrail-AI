/**
 * `guardrail checkpoint` - Fast verification on changed files
 * Quick pre-write check for AI agents
 */
import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";
import { verifyFast } from "@guardrail-context/engine";

interface CheckpointOptions {
  json?: boolean;
  verbose?: boolean;
}

interface CheckpointResult {
  ok: boolean;
  changedFiles: string[];
  issues: CheckpointIssue[];
  timestamp: string;
}

interface CheckpointIssue {
  type: "todo" | "console" | "mock" | "any" | "ignore" | "secret" | "other";
  file: string;
  line?: number;
  message: string;
}

const ANSI = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

const CHECKPOINT_PATTERNS: Array<{ type: CheckpointIssue["type"]; pattern: RegExp; message: string }> = [
  { type: "todo", pattern: /\/\/\s*(TODO|FIXME|XXX|HACK)/i, message: "Unresolved TODO/FIXME" },
  { type: "console", pattern: /console\.(log|debug|info|warn|error)\s*\(/, message: "Console statement" },
  { type: "mock", pattern: /(mock|fake|dummy|placeholder|lorem)/i, message: "Mock/placeholder code" },
  { type: "any", pattern: /:\s*any\b/, message: "TypeScript any type" },
  { type: "ignore", pattern: /@ts-ignore|@ts-nocheck|eslint-disable/, message: "Suppressed check" },
  { type: "secret", pattern: /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]+['"]/, message: "Potential hardcoded secret" },
];

export async function cmdCheckpoint(repoPath: string, opts: CheckpointOptions = {}): Promise<CheckpointResult> {
  const changedFiles = getChangedFiles(repoPath);
  const issues: CheckpointIssue[] = [];

  if (!opts.json) {
    console.log(`${ANSI.cyan}🔍 guardrail Checkpoint${ANSI.reset}`);
    console.log(`${ANSI.dim}Checking ${changedFiles.length} changed files...${ANSI.reset}\n`);
  }

  for (const file of changedFiles) {
    const filePath = path.join(repoPath, file);
    if (!fs.existsSync(filePath)) continue;
    if (!isCodeFile(file)) continue;

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const { type, pattern, message } of CHECKPOINT_PATTERNS) {
          if (pattern.test(line)) {
            issues.push({
              type,
              file,
              line: i + 1,
              message,
            });
          }
        }
      }
    } catch (e) {
      // Skip files that can't be read
    }
  }

  const result: CheckpointResult = {
    ok: issues.length === 0,
    changedFiles,
    issues,
    timestamp: new Date().toISOString(),
  };

  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printCheckpointResult(result, opts);
  }

  if (!result.ok) {
    process.exitCode = 1;
  }

  return result;
}

function getChangedFiles(repoPath: string): string[] {
  try {
    // Get staged + unstaged changes
    const staged = execSync("git diff --cached --name-only", { cwd: repoPath, encoding: "utf-8" });
    const unstaged = execSync("git diff --name-only", { cwd: repoPath, encoding: "utf-8" });
    
    const files = new Set<string>();
    for (const f of staged.split("\n").filter(Boolean)) {
      files.add(f);
    }
    for (const f of unstaged.split("\n").filter(Boolean)) {
      files.add(f);
    }
    
    return Array.from(files);
  } catch (e) {
    // Not a git repo or git not available
    return [];
  }
}

function isCodeFile(file: string): boolean {
  return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file);
}

function printCheckpointResult(result: CheckpointResult, opts: CheckpointOptions): void {
  if (result.ok) {
    console.log(`${ANSI.green}✓ Checkpoint passed${ANSI.reset}`);
    console.log(`${ANSI.dim}No blocking issues found in ${result.changedFiles.length} files${ANSI.reset}\n`);
    return;
  }

  console.log(`${ANSI.red}✗ Checkpoint blocked${ANSI.reset}`);
  console.log(`${ANSI.dim}Found ${result.issues.length} issues to fix before proceeding${ANSI.reset}\n`);

  // Group by type
  const byType = new Map<string, CheckpointIssue[]>();
  for (const issue of result.issues) {
    const existing = byType.get(issue.type) || [];
    existing.push(issue);
    byType.set(issue.type, existing);
  }

  for (const [type, issues] of byType) {
    const icon = getTypeIcon(type as CheckpointIssue["type"]);
    console.log(`${icon} ${ANSI.bold}${type.toUpperCase()}${ANSI.reset} (${issues.length})`);
    
    const shown = opts.verbose ? issues : issues.slice(0, 3);
    for (const issue of shown) {
      console.log(`  ${ANSI.dim}→${ANSI.reset} ${issue.file}:${issue.line}`);
    }
    if (!opts.verbose && issues.length > 3) {
      console.log(`  ${ANSI.dim}... and ${issues.length - 3} more${ANSI.reset}`);
    }
    console.log();
  }

  console.log(`${ANSI.dim}Fix these issues before proceeding.${ANSI.reset}`);
  console.log(`${ANSI.dim}Use --verbose for full list.${ANSI.reset}\n`);
}

function getTypeIcon(type: CheckpointIssue["type"]): string {
  switch (type) {
    case "todo": return "📝";
    case "console": return "🖥️";
    case "mock": return "🎭";
    case "any": return "❓";
    case "ignore": return "🙈";
    case "secret": return "🔑";
    default: return "⚠️";
  }
}
