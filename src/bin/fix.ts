/**
 * Auto-Fix CLI Command
 *
 * Automatically applies templates to fix missing vibe features.
 */

import { vibecoderDetector } from "../lib/vibecoder-detector";
import { templateApplier } from "../lib/template-applier";
import { envValidator } from "../lib/env-validator";
import * as fs from "fs";
import * as path from "path";

const ANSI = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgCyan: "\x1b[36m",
};

async function main() {
  const projectPath = process.cwd();

  console.log(`${ANSI.FgCyan}${ANSI.Bright}
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║              🔧  guardrail Auto-Fix  🔧                      ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
${ANSI.Reset}`);

  console.log(
    `${ANSI.Dim}Analyzing project at: ${projectPath}...${ANSI.Reset}\n`,
  );

  try {
    // 1. Run vibe check to find issues
    process.stdout.write("🔍 Scanning for missing features... ");
    const vibeReport = await vibecoderDetector.analyze(projectPath);
    console.log("✅\n");

    // Collect all missing features
    const allMissing = [
      ...vibeReport.missingCritical,
      ...vibeReport.missingEssential,
      ...vibeReport.missingImportant,
    ];

    if (allMissing.length === 0) {
      console.log(
        `${ANSI.FgGreen}✅ No critical issues found! Your project is in good shape.${ANSI.Reset}\n`,
      );
      return;
    }

    console.log(
      `${ANSI.Bright}Found ${allMissing.length} fixable issues:${ANSI.Reset}\n`,
    );

    // 2. Get recommended templates
    const featureNames = allMissing.map((m) => m.feature);
    const templates = templateApplier.getRecommendedTemplates(featureNames);

    // Also add templates based on polish issues
    const polishTemplates = templateApplier.getRecommendedTemplates([
      "Error Boundary",
      "Loading States",
      "Empty States",
      "404 Page",
    ]);

    const allTemplates = Array.from(
      new Set([...templates, ...polishTemplates]),
    );

    if (allTemplates.length === 0) {
      console.log(
        `${ANSI.FgYellow}⚠️  No auto-fixable templates found for the detected issues.${ANSI.Reset}\n`,
      );
      console.log("Manual fixes needed for:");
      allMissing.forEach((m) => console.log(`  • ${m.feature}`));
      return;
    }

    // 3. Check dependencies
    console.log(`${ANSI.Bright}Checking dependencies...${ANSI.Reset}`);
    const { missing: missingDeps } = await templateApplier.checkDependencies(
      allTemplates,
      projectPath,
    );

    if (missingDeps.length > 0) {
      console.log(`\n${ANSI.FgYellow}⚠️  Missing dependencies:${ANSI.Reset}`);
      missingDeps.forEach((dep) => console.log(`  • ${dep}`));
      console.log(
        `\n${ANSI.Dim}Run: ${templateApplier.generateInstallCommand(missingDeps)}${ANSI.Reset}\n`,
      );
    }

    // 4. Apply templates
    console.log(
      `\n${ANSI.Bright}Applying ${allTemplates.length} templates:${ANSI.Reset}\n`,
    );

    let successCount = 0;
    let skipCount = 0;

    for (const template of allTemplates) {
      const info = templateApplier.getTemplateInfo(template);
      process.stdout.write(`  📦 ${info?.description || template}... `);

      const result = await templateApplier.apply(template, projectPath, {
        overwrite: false,
      });

      if (result.success) {
        if (result.filesCreated.length > 0) {
          console.log(`${ANSI.FgGreen}✅ Created${ANSI.Reset}`);
          result.filesCreated.forEach((f) => {
            console.log(
              `     ${ANSI.Dim}→ ${path.relative(projectPath, f)}${ANSI.Reset}`,
            );
          });
          successCount++;
        } else {
          console.log(`${ANSI.FgYellow}⏭️  Already exists${ANSI.Reset}`);
          skipCount++;
        }
      } else {
        console.log(`${ANSI.FgRed}❌ Failed: ${result.message}${ANSI.Reset}`);
      }
    }

    // 5. Generate env config if needed
    const envExamplePath = path.join(projectPath, ".env.example");
    const envExists = await fileExists(envExamplePath);

    if (!envExists) {
      console.log(
        `\n${ANSI.Bright}Generating environment configuration...${ANSI.Reset}`,
      );
      const envConfig = await envValidator.detectProjectEnvNeeds(projectPath);
      const envContent = envValidator.generateEnvExample(envConfig);

      await fs.promises.writeFile(envExamplePath, envContent, "utf8");
      console.log(`  ${ANSI.FgGreen}✅ Created .env.example${ANSI.Reset}`);

      // Also generate validation code
      const validationCode = envValidator.generateValidationCode(envConfig);
      const envValidatorPath = path.join(
        projectPath,
        "src",
        "config",
        "env.ts",
      );

      try {
        await fs.promises.mkdir(path.dirname(envValidatorPath), {
          recursive: true,
        });
        await fs.promises.writeFile(envValidatorPath, validationCode, "utf8");
        console.log(
          `  ${ANSI.FgGreen}✅ Created src/config/env.ts (validation)${ANSI.Reset}`,
        );
      } catch (error) {
        // Directory creation might fail, that's ok
      }
    }

    // 6. Summary
    console.log(
      `\n${ANSI.Bright}═══════════════════════════════════════════════════════════════${ANSI.Reset}`,
    );
    console.log(`${ANSI.Bright}Summary:${ANSI.Reset}`);
    console.log(
      `  ${ANSI.FgGreen}✅ Created: ${successCount} templates${ANSI.Reset}`,
    );
    console.log(
      `  ${ANSI.FgYellow}⏭️  Skipped: ${skipCount} (already exist)${ANSI.Reset}`,
    );

    if (missingDeps.length > 0) {
      console.log(
        `\n${ANSI.FgYellow}⚠️  Don't forget to install dependencies:${ANSI.Reset}`,
      );
      console.log(`   ${templateApplier.generateInstallCommand(missingDeps)}`);
    }

    console.log(
      `\n${ANSI.Dim}Run 'npm run cli vibe' to re-check your project.${ANSI.Reset}\n`,
    );
  } catch (error) {
    console.error(
      `\n${ANSI.FgRed}❌ Error running auto-fix:${ANSI.Reset}`,
      error,
    );
    if (error instanceof Error) {
      console.error(error.message);
    }
  }
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
