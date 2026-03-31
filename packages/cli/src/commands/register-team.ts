/**
 * guardrail team — team conventions from git (same engine as guardrail context).
 */
import type { Command } from "commander";
import { join } from "path";

export function registerTeamCommand(program: Command): void {
  program
    .command("team")
    .description(
      "Print team conventions from git history (same data as guardrail context writes to .guardrail/team-conventions.json)",
    )
    .option("--format <fmt>", "Output format: json | text", "text")
    .action((opts: { format?: string }) => {
      const fmt = String(opts.format || "text").toLowerCase();
      const projectPath = process.cwd();
      const teamModPath = join(__dirname, "..", "context", "team-conventions.js");
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
        const mod = require(teamModPath) as {
          generateTeamReport: (cwd: string) => {
            available?: boolean;
            message?: string;
            summary?: { teamSize?: number; totalFilesAnalyzed?: number };
            recommendations?: string[];
          };
        };
        const report = mod.generateTeamReport(projectPath);
        if (fmt === "json") {
          process.stdout.write(JSON.stringify(report));
          process.stdout.write("\n");
          process.exit(report.available ? 0 : 2);
          return;
        }
        if (!report.available) {
          console.error(
            report.message ||
              "No team data — use a git repository with commit history, or run: guardrail context",
          );
          process.exit(1);
        }
        const teamSize = report.summary?.teamSize ?? 0;
        const files = report.summary?.totalFilesAnalyzed ?? 0;
        console.log(`Team contributors (git): ${teamSize}`);
        console.log(`Files contributed (aggregate): ${files}`);
        if (report.recommendations?.length) {
          console.log("\nRecommendations:");
          for (const r of report.recommendations) {
            console.log(`  - ${r}`);
          }
        }
        process.exit(0);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`team failed: ${msg}`);
        process.exit(1);
      }
    });
}
