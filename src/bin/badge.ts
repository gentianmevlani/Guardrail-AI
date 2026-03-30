/**
 * Badge Generator CLI Command
 *
 * Generates health badges for README files.
 */

import { vibecoderDetector } from "../lib/vibecoder-detector";
import { polishService } from "../lib/polish/polish-service";
import { healthBadgeGenerator } from "../lib/health-badge-generator";
import * as fs from "fs";
import * as path from "path";

const ANSI = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgCyan: "\x1b[36m",
};

async function main() {
  const projectPath = process.cwd();

  console.log(`${ANSI.FgCyan}${ANSI.Bright}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║           🏷️  guardrail Badge Generator  🏷️                  ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${ANSI.Reset}`);

  console.log(
    `${ANSI.Dim}Analyzing project at: ${projectPath}...${ANSI.Reset}\n`,
  );

  try {
    // 1. Run analyzers to get scores
    process.stdout.write("📊 Calculating scores... ");

    const vibeReport = await vibecoderDetector.analyze(projectPath);
    const polishReport = await polishService.analyzeProject(projectPath);

    console.log("✅\n");

    // Calculate scores
    const vibeScore = vibeReport.score;
    const polishScore = polishReport.score;
    const securityScore = Math.max(
      0,
      100 - vibeReport.missingCritical.length * 15,
    );

    console.log(`${ANSI.Bright}Scores:${ANSI.Reset}`);
    console.log(`  • Vibe Score: ${vibeScore}%`);
    console.log(`  • Polish Score: ${polishScore}%`);
    console.log(`  • Security Score: ${securityScore}%`);

    // 2. Generate badges
    console.log(`\n${ANSI.Bright}Generating badges...${ANSI.Reset}`);

    const badges = healthBadgeGenerator.generateBadges({
      vibe: vibeScore,
      security: securityScore,
      polish: polishScore,
      compliance:
        vibeScore >= 70
          ? "compliant"
          : vibeScore >= 50
            ? "partial"
            : "non-compliant",
    });

    // 3. Save badges to .guardrail/badges directory
    const badgesDir = path.join(projectPath, ".guardrail", "badges");
    const savedFiles = await healthBadgeGenerator.saveBadges(badges, badgesDir);

    console.log(
      `\n${ANSI.FgGreen}✅ Badges saved to ${path.relative(projectPath, badgesDir)}:${ANSI.Reset}`,
    );
    savedFiles.forEach((f) => {
      console.log(`  ${ANSI.Dim}→ ${path.basename(f)}${ANSI.Reset}`);
    });

    // 4. Generate README markdown
    const markdown = healthBadgeGenerator.generateReadmeMarkdown(badges);

    console.log(`\n${ANSI.Bright}Add this to your README.md:${ANSI.Reset}`);
    console.log(
      `${ANSI.Dim}─────────────────────────────────────────${ANSI.Reset}`,
    );
    console.log(markdown);
    console.log(
      `${ANSI.Dim}─────────────────────────────────────────${ANSI.Reset}`,
    );

    // 5. Optionally update README
    const readmePath = path.join(projectPath, "README.md");
    if (await fileExists(readmePath)) {
      const readmeContent = await fs.promises.readFile(readmePath, "utf8");

      // Check if badges already exist
      if (readmeContent.includes("<!-- guardrail Health Badges")) {
        console.log(
          `\n${ANSI.FgYellow}ℹ️  README.md already has guardrail badges.${ANSI.Reset}`,
        );
        console.log(
          `   ${ANSI.Dim}To update, replace the section between the badge comments.${ANSI.Reset}`,
        );
      } else {
        console.log(
          `\n${ANSI.FgYellow}💡 Tip: Add the badges above to your README.md${ANSI.Reset}`,
        );
      }
    }

    // 6. Summary with visual preview
    console.log(`\n${ANSI.Bright}Badge Preview:${ANSI.Reset}`);

    const overall = Math.round((vibeScore + securityScore + polishScore) / 3);
    const grade = getGrade(overall);
    const gradeColor = overall >= 70 ? ANSI.FgGreen : ANSI.FgYellow;

    console.log(`
  ┌─────────────────────────────────────┐
  │  🏥 Project Health: ${gradeColor}${grade} (${overall}%)${ANSI.Reset}        │
  │  🔮 Vibe: ${vibeScore}%  ✨ Polish: ${polishScore}%  🛡️ Security: ${securityScore}% │
  └─────────────────────────────────────┘
`);
  } catch (error) {
    console.error(
      `\n${ANSI.FgCyan}❌ Error generating badges:${ANSI.Reset}`,
      error,
    );
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
}

function getGrade(score: number): string {
  if (score >= 97) return "S+";
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

main().catch(console.error);
