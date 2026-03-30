/**
 * Design System Check CLI Command
 *
 * Analyzes CSS/Tailwind for design token compliance.
 */

import { designSystemEnforcer } from "../lib/design-system-enforcer";
import * as path from "path";

const ANSI = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgCyan: "\x1b[36m",
  FgMagenta: "\x1b[35m",
};

async function main() {
  const projectPath = process.cwd();

  console.log(`${ANSI.FgCyan}${ANSI.Bright}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          🎨  guardrail Design System Check  🎨               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${ANSI.Reset}`);

  console.log(
    `${ANSI.Dim}Analyzing project at: ${projectPath}...${ANSI.Reset}\n`,
  );

  try {
    // Run design system analysis
    process.stdout.write("🔍 Scanning styles and components... ");
    const report = await designSystemEnforcer.analyze(projectPath);
    console.log("✅\n");

    // Display score
    const scoreColor =
      report.score >= 80
        ? ANSI.FgGreen
        : report.score >= 60
          ? ANSI.FgYellow
          : ANSI.FgRed;

    console.log(
      `${ANSI.Bright}📊 Design System Score: ${scoreColor}${report.score}/100${ANSI.Reset}\n`,
    );

    // Display summary
    console.log(`${ANSI.Bright}Summary:${ANSI.Reset}`);
    console.log(`  • Files analyzed: ${report.summary.totalFiles}`);
    console.log(`  • Files with issues: ${report.summary.filesWithViolations}`);
    console.log(
      `  • ${ANSI.FgRed}Errors: ${report.summary.errorCount}${ANSI.Reset}`,
    );
    console.log(
      `  • ${ANSI.FgYellow}Warnings: ${report.summary.warningCount}${ANSI.Reset}`,
    );
    console.log(
      `  • ${ANSI.Dim}Info: ${report.summary.infoCount}${ANSI.Reset}`,
    );

    // Display token coverage
    console.log(`\n${ANSI.Bright}Token Coverage:${ANSI.Reset}`);
    displayCoverage("Colors", report.tokenCoverage.colors);
    displayCoverage("Spacing", report.tokenCoverage.spacing);
    displayCoverage("Typography", report.tokenCoverage.typography);
    displayCoverage("Shadows", report.tokenCoverage.shadows);

    // Display violations
    if (report.violations.length > 0) {
      console.log(`\n${ANSI.Bright}Violations:${ANSI.Reset}`);

      // Group by file
      const byFile = new Map<string, typeof report.violations>();
      for (const v of report.violations) {
        const relativePath = path.relative(projectPath, v.file);
        if (!byFile.has(relativePath)) {
          byFile.set(relativePath, []);
        }
        byFile.get(relativePath)!.push(v);
      }

      let displayedCount = 0;
      const maxDisplay = 15;

      for (const [file, violations] of Array.from(byFile.entries())) {
        if (displayedCount >= maxDisplay) {
          console.log(
            `\n${ANSI.Dim}...and ${report.violations.length - displayedCount} more violations${ANSI.Reset}`,
          );
          break;
        }

        console.log(`\n  ${ANSI.FgCyan}${file}${ANSI.Reset}`);

        for (const v of violations.slice(0, 5)) {
          const icon =
            v.severity === "error"
              ? "❌"
              : v.severity === "warning"
                ? "⚠️"
                : "ℹ️";
          const color =
            v.severity === "error"
              ? ANSI.FgRed
              : v.severity === "warning"
                ? ANSI.FgYellow
                : ANSI.Dim;

          console.log(
            `    ${icon} ${color}Line ${v.line}: ${v.issue}${ANSI.Reset}`,
          );
          console.log(
            `       ${ANSI.Dim}${v.property}: ${v.value}${ANSI.Reset}`,
          );
          console.log(`       ${ANSI.FgMagenta}→ ${v.suggestion}${ANSI.Reset}`);
          displayedCount++;
        }

        if (violations.length > 5) {
          console.log(
            `    ${ANSI.Dim}...and ${violations.length - 5} more in this file${ANSI.Reset}`,
          );
          displayedCount += violations.length - 5;
        }
      }
    } else {
      console.log(
        `\n${ANSI.FgGreen}✅ No design system violations found!${ANSI.Reset}`,
      );
    }

    // Recommendations
    console.log(`\n${ANSI.Bright}Recommendations:${ANSI.Reset}`);

    if (report.tokenCoverage.colors < 80) {
      console.log(
        `  • ${ANSI.FgYellow}Define color tokens in tailwind.config or CSS variables${ANSI.Reset}`,
      );
    }
    if (report.tokenCoverage.spacing < 80) {
      console.log(
        `  • ${ANSI.FgYellow}Use Tailwind spacing scale instead of arbitrary pixel values${ANSI.Reset}`,
      );
    }
    if (report.summary.warningCount > 10) {
      console.log(
        `  • ${ANSI.FgYellow}Consider a design system audit to reduce magic numbers${ANSI.Reset}`,
      );
    }
    if (report.violations.some((v) => v.property === "font-size")) {
      console.log(
        `  • ${ANSI.FgYellow}Use rem units for font-size for better accessibility${ANSI.Reset}`,
      );
    }

    if (report.score >= 80) {
      console.log(
        `  • ${ANSI.FgGreen}Great job! Your design system is well maintained.${ANSI.Reset}`,
      );
    }

    console.log("");
  } catch (error) {
    console.error(
      `\n${ANSI.FgRed}❌ Error running design check:${ANSI.Reset}`,
      error,
    );
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

function displayCoverage(name: string, value: number): void {
  const bar =
    "█".repeat(Math.floor(value / 10)) +
    "░".repeat(10 - Math.floor(value / 10));
  const color =
    value >= 80 ? ANSI.FgGreen : value >= 60 ? ANSI.FgYellow : ANSI.FgRed;
  console.log(`  ${name.padEnd(12)} ${color}${bar} ${value}%${ANSI.Reset}`);
}

main().catch(console.error);
