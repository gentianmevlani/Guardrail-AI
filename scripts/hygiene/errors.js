/**
 * Error Collection Module
 *
 * Unified collection of lint, import, syntax, and type errors.
 * CI-friendly with exit codes and threshold support.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { getAllCodeFiles } = require("./duplicates");

function collectTypeScriptErrors(projectPath) {
  const errors = [];
  try {
    execSync("npx tsc --noEmit --pretty false 2>&1", {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    });
  } catch (err) {
    if (err.stdout) {
      const lines = err.stdout.split("\n");
      for (const line of lines) {
        const match = line.match(
          /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)$/,
        );
        if (match) {
          errors.push({
            type: "typescript",
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            severity: match[4],
            code: match[5],
            message: match[6],
            fixable: false,
          });
        }
      }
    }
  }
  return errors;
}

function collectESLintErrors(projectPath) {
  const errors = [];
  try {
    const result = execSync("npx eslint . --format json 2>/dev/null || true", {
      cwd: projectPath,
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    });
    if (result) {
      try {
        const eslintResults = JSON.parse(result);
        for (const file of eslintResults) {
          for (const msg of file.messages || []) {
            errors.push({
              type: "eslint",
              file: path.relative(projectPath, file.filePath),
              line: msg.line,
              column: msg.column,
              severity: msg.severity === 2 ? "error" : "warning",
              code: msg.ruleId,
              message: msg.message,
              fixable: !!msg.fix,
            });
          }
        }
      } catch (parseErr) {
        /* not parseable */
      }
    }
  } catch (err) {
    /* eslint not available */
  }
  return errors;
}

function checkBasicSyntax(content) {
  const issues = [];
  const lines = content.split("\n");
  let braceCount = 0,
    bracketCount = 0,
    parenCount = 0;

  for (const line of lines) {
    const stripped = line
      .replace(/'[^']*'/g, "")
      .replace(/"[^"]*"/g, "")
      .replace(/`[^`]*`/g, "");
    braceCount +=
      (stripped.match(/{/g) || []).length - (stripped.match(/}/g) || []).length;
    bracketCount +=
      (stripped.match(/\[/g) || []).length -
      (stripped.match(/\]/g) || []).length;
    parenCount +=
      (stripped.match(/\(/g) || []).length -
      (stripped.match(/\)/g) || []).length;
  }

  if (braceCount !== 0)
    issues.push({ line: lines.length, message: `Unbalanced braces` });
  if (bracketCount !== 0)
    issues.push({ line: lines.length, message: `Unbalanced brackets` });
  if (parenCount !== 0)
    issues.push({ line: lines.length, message: `Unbalanced parentheses` });
  return issues;
}

function collectSyntaxErrors(projectPath) {
  const errors = [];
  const files = getAllCodeFiles(projectPath);

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const issues = checkBasicSyntax(content);
      for (const issue of issues) {
        errors.push({
          type: "syntax",
          file: path.relative(projectPath, file),
          line: issue.line,
          column: 1,
          severity: "error",
          code: "SYNTAX",
          message: issue.message,
          fixable: false,
        });
      }
    } catch (err) {
      /* skip */
    }
  }
  return errors;
}

function collectImportErrors(projectPath) {
  const errors = [];
  const files = getAllCodeFiles(projectPath);

  // Load aliases
  let aliases = {};
  try {
    const tsconfigPath = path.join(projectPath, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, "utf-8"));
      const paths = tsconfig.compilerOptions?.paths || {};
      const baseUrl = tsconfig.compilerOptions?.baseUrl || ".";
      for (const [alias, targets] of Object.entries(paths)) {
        aliases[alias.replace("/*", "")] = path.join(
          projectPath,
          baseUrl,
          targets[0]?.replace("/*", "") || "",
        );
      }
    }
  } catch (err) {
    /* ignore */
  }

  const importRegex =
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"](.*?)['"]/g;

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        let match;
        importRegex.lastIndex = 0;
        while ((match = importRegex.exec(lines[i])) !== null) {
          const source = match[1];
          if (source.startsWith(".") || source.startsWith("@/")) {
            // Try to resolve
            let resolved = false;

            // Check aliases
            for (const [alias, target] of Object.entries(aliases)) {
              if (source === alias || source.startsWith(alias + "/")) {
                const targetPath = path.join(
                  target,
                  source.slice(alias.length),
                );
                const extensions = [
                  "",
                  ".ts",
                  ".tsx",
                  ".js",
                  ".jsx",
                  "/index.ts",
                  "/index.tsx",
                ];
                for (const ext of extensions) {
                  if (fs.existsSync(targetPath + ext)) {
                    resolved = true;
                    break;
                  }
                }
                break;
              }
            }

            // Check relative
            if (!resolved && source.startsWith(".")) {
              const fromDir = path.dirname(file);
              const targetPath = path.join(fromDir, source);
              const extensions = [
                "",
                ".ts",
                ".tsx",
                ".js",
                ".jsx",
                "/index.ts",
                "/index.tsx",
              ];
              for (const ext of extensions) {
                if (fs.existsSync(targetPath + ext)) {
                  resolved = true;
                  break;
                }
              }
            }

            if (!resolved) {
              errors.push({
                type: "import",
                file: path.relative(projectPath, file),
                line: i + 1,
                column: 1,
                severity: "error",
                code: "IMPORT_NOT_FOUND",
                message: `Cannot resolve: ${source}`,
                fixable: false,
              });
            }
          }
        }
      }
    } catch (err) {
      /* skip */
    }
  }
  return errors;
}

function groupErrorsByFile(errors) {
  const byFile = {};
  for (const error of errors) {
    if (!byFile[error.file]) byFile[error.file] = [];
    byFile[error.file].push(error);
  }
  return byFile;
}

function collectAllErrors(projectPath) {
  const errors = {
    typescript: collectTypeScriptErrors(projectPath),
    eslint: collectESLintErrors(projectPath),
    syntax: collectSyntaxErrors(projectPath),
    imports: collectImportErrors(projectPath),
    summary: {
      total: 0,
      byCategory: {},
      bySeverity: { error: 0, warning: 0, info: 0 },
      autoFixable: 0,
    },
  };

  const allErrors = [
    ...errors.typescript,
    ...errors.eslint,
    ...errors.syntax,
    ...errors.imports,
  ];
  errors.summary.total = allErrors.length;
  errors.summary.byCategory = {
    typescript: errors.typescript.length,
    eslint: errors.eslint.length,
    syntax: errors.syntax.length,
    imports: errors.imports.length,
  };

  for (const err of allErrors) {
    errors.summary.bySeverity[err.severity || "error"]++;
    if (err.fixable) errors.summary.autoFixable++;
  }

  errors.byFile = groupErrorsByFile(allErrors);
  errors.topOffenders = Object.entries(errors.byFile)
    .map(([file, errs]) => ({ file, count: errs.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return errors;
}

module.exports = {
  collectAllErrors,
  collectTypeScriptErrors,
  collectESLintErrors,
  collectSyntaxErrors,
  collectImportErrors,
};
