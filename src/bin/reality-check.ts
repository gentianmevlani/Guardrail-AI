import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import {
  realityScanner,
  RealityModeConfig,
  RealityModeResult,
  ReportGenerator,
} from "../lib/reality-mode";

const program = new Command();

program
  .name("reality-check")
  .description("Reality Mode CLI helper")
  .version("1.0.0");

program
  .command("generate")
  .description("Generate Playwright test spec")
  .option("--url <url>", "Base URL", "http://localhost:3000")
  .option("--output <dir>", "Output directory", ".guardrail/ship/reality-mode")
  .option("--auth", "Enable auth checks", true)
  .action((options) => {
    const config = {
      baseUrl: options.url,
      clickPaths: realityScanner.generateDefaultClickPaths(),
      outputDir: path.resolve(options.output),
    };

    // Configure scanner
    // realityScanner.config.checkAuth = options.auth; // private, need to pass in constructor or update method
    // For now we assume default behavior or re-instantiate if needed,
    // but realityScanner singleton is exported.
    // Let's just pass options to generatePlaywrightTest if possible or instantiate new one.

    // The singleton is fine for now.

    const testCode = realityScanner.generatePlaywrightTest(config);

    const specPath = path.join(config.outputDir, "reality-mode.spec.ts");
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }
    fs.writeFileSync(specPath, testCode);
    console.log(`Generated test spec at ${specPath}`);
  });

program
  .command("report")
  .description("Generate HTML report from scan artifacts")
  .argument("<outputDir>", "Directory containing scan artifacts")
  .option(
    "--output <file>",
    "Output HTML file name",
    "reality-mode-report.html",
  )
  .action((outputDir, options) => {
    try {
      const replayPath = path.join(outputDir, "reality-replay.json");
      const authResultPath = path.join(outputDir, "auth-result.json");
      const resultJsonPath = path.join(outputDir, "reality-mode-result.json");
      const reportHtmlPath = path.join(outputDir, options.output);

      if (!fs.existsSync(replayPath)) {
        console.error(`Error: Replay file not found at ${replayPath}`);
        process.exit(1);
      }

      // Load Replay
      const replay = JSON.parse(fs.readFileSync(replayPath, "utf8"));

      // Load Auth Results (optional)
      let authViolations = [];
      if (fs.existsSync(authResultPath)) {
        try {
          const authData = JSON.parse(fs.readFileSync(authResultPath, "utf8"));
          authViolations = authData.violations || [];
        } catch (e) {
          console.warn("Warning: Failed to parse auth-result.json");
        }
      }

      // Process Replay -> Generate Analysis
      const processedResult = realityScanner.processReplay(
        replay,
        authViolations,
      );

      // Save Full Result JSON
      fs.writeFileSync(
        resultJsonPath,
        JSON.stringify(processedResult, null, 2),
      );
      console.log(`Saved analysis result to ${resultJsonPath}`);

      // Generate HTML Report
      const generator = new ReportGenerator();
      const html = generator.generateHtml(processedResult);

      fs.writeFileSync(reportHtmlPath, html);
      console.log(`Generated HTML report at ${reportHtmlPath}`);

      if (processedResult.verdict === "fake") {
        console.error(
          "\n❌ REALITY CHECK FAILED: Fake/Mock data detected (NO-GO).",
        );
        process.exit(1);
      }
    } catch (err) {
      console.error("Failed to generate report:", err);
      process.exit(2); // Use 2 for internal errors
    }
  });

program.parse();
