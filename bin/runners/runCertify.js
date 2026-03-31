#!/usr/bin/env node

/**
 * guardrail Certify Command
 *
 * Generates verifiable certification badges for READMEs
 * Each badge = backlink = SEO fuel
 *
 * Usage:
 *   guardrail certify              # Generate certification badge
 *   guardrail certify --output md  # Output markdown only
 *   guardrail certify --embed      # Add badge to README.md automatically
 */

const fs = require("fs/promises");
const path = require("path");
const { execSync } = require("child_process");

const COLORS = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
  reset: "\x1b[0m",
  bold: "\x1b[1m",
};

async function runCertify(args, projectPath) {
  const outputFormat = args.output || "all";
  const shouldEmbed = args.embed || false;
  const style = args.style || "flat";

  console.log(`\n${COLORS.cyan}🏅 guardrail Certification${COLORS.reset}\n`);

  try {
    // Step 1: Run a scan to get the score
    console.log(`${COLORS.dim}Running scan...${COLORS.reset}`);

    let scanResult;
    try {
      const summaryPath = path.join(projectPath, ".guardrail", "summary.json");
      const summaryContent = await fs.readFile(summaryPath, "utf-8");
      scanResult = JSON.parse(summaryContent);
    } catch {
      // No existing scan, run one
      console.log(
        `${COLORS.dim}No existing scan found. Running guardrail scan...${COLORS.reset}`,
      );
      try {
        execSync("node bin/guardrail.js scan --profile=ship --json", {
          cwd: projectPath,
          encoding: "utf-8",
          stdio: "pipe",
        });
        const summaryPath = path.join(
          projectPath,
          ".guardrail",
          "summary.json",
        );
        const summaryContent = await fs.readFile(summaryPath, "utf-8");
        scanResult = JSON.parse(summaryContent);
      } catch (scanErr) {
        console.error(
          `${COLORS.red}Failed to run scan: ${scanErr.message}${COLORS.reset}`,
        );
        console.error(`${COLORS.dim}Receipt: scan execution${COLORS.reset}`);
        throw new Error(`Scan failed: ${scanErr.message}`);
      }
    }

    const score = scanResult.score || 0;
    const grade = getGrade(score);
    const certified = score >= 70;

    // Step 2: Generate project ID
    const projectId = await generateProjectId(projectPath);

    // Step 3: Generate certification
    const timestamp = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const verifyUrl = `https://guardrailai.dev/verify/${projectId}`;

    // Step 4: Generate badges
    const badges = generateBadges(score, projectId, verifyUrl, style);

    // Step 5: Save certification files
    const certDir = path.join(projectPath, ".guardrail", "certification");
    await fs.mkdir(certDir, { recursive: true });

    // Save badge SVG
    await fs.writeFile(path.join(certDir, "badge.svg"), badges.svg);

    // Save certification JSON
    const certData = {
      $schema: "https://guardrailai.dev/schemas/certification.json",
      version: "1.0.0",
      certified,
      score,
      grade,
      timestamp,
      expiresAt,
      projectId,
      verifyUrl,
    };
    await fs.writeFile(
      path.join(certDir, "certification.json"),
      JSON.stringify(certData, null, 2),
    );

    // Output results
    console.log("");

    if (certified) {
      console.log(`${COLORS.green}${COLORS.bold}✅ CERTIFIED${COLORS.reset}`);
    } else {
      console.log(
        `${COLORS.yellow}${COLORS.bold}⚠️ NOT CERTIFIED (need 70+)${COLORS.reset}`,
      );
    }

    console.log(`${COLORS.bold}Score:${COLORS.reset} ${score}/100 (${grade})`);
    console.log(`${COLORS.bold}Project ID:${COLORS.reset} ${projectId}`);
    console.log(`${COLORS.bold}Verify URL:${COLORS.reset} ${verifyUrl}`);
    console.log("");

    // Output badges based on format
    if (
      outputFormat === "all" ||
      outputFormat === "md" ||
      outputFormat === "markdown"
    ) {
      console.log(`${COLORS.cyan}📋 Markdown (for README.md):${COLORS.reset}`);
      console.log(`${COLORS.dim}${badges.markdown}${COLORS.reset}`);
      console.log("");
    }

    if (outputFormat === "all" || outputFormat === "html") {
      console.log(`${COLORS.cyan}📋 HTML (for websites):${COLORS.reset}`);
      console.log(`${COLORS.dim}${badges.html}${COLORS.reset}`);
      console.log("");
    }

    if (outputFormat === "all") {
      console.log(`${COLORS.cyan}📁 Files saved:${COLORS.reset}`);
      console.log(
        `   ${COLORS.dim}.guardrail/certification/badge.svg${COLORS.reset}`,
      );
      console.log(
        `   ${COLORS.dim}.guardrail/certification/certification.json${COLORS.reset}`,
      );
      console.log("");
    }

    // Step 6: Optionally embed in README
    if (shouldEmbed) {
      await embedBadgeInReadme(projectPath, badges.markdown);
    }

    // Success message
    console.log(
      `${COLORS.green}✨ Add the badge to your README for a backlink to guardrailai.dev${COLORS.reset}`,
    );
    console.log("");

    return 0;
  } catch (error) {
    console.error(
      `${COLORS.red}Certification failed: ${error.message}${COLORS.reset}`,
    );
    if (error.message.includes("Scan failed")) {
      console.error(`${COLORS.dim}Receipt: scan execution${COLORS.reset}`);
    }
    return 1;
  }
}

function getGrade(score) {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D";
  return "F";
}

async function generateProjectId(projectPath) {
  // Try to get from git remote
  try {
    const remoteUrl = execSync("git remote get-url origin", {
      cwd: projectPath,
      encoding: "utf-8",
    }).trim();

    const match = remoteUrl.match(/github\.com[:/]([^\/]+)\/([^\/\.]+)/);
    if (match) {
      const [, org, repo] = match;
      const hash = simpleHash(`${org}/${repo}`).toString(16).slice(0, 8);
      return `${org}-${repo}-${hash}`;
    }
  } catch {}

  // Fallback: use directory name + timestamp
  const dirName = path.basename(projectPath);
  return `${dirName}-${Date.now().toString(36)}`;
}

function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateBadges(score, projectId, verifyUrl, style) {
  const label = "guardrail";
  const statusText = score >= 70 ? `${score}/100 certified` : `${score}/100`;
  const color =
    score >= 80
      ? "4ade80"
      : score >= 70
        ? "facc15"
        : score >= 50
          ? "fb923c"
          : "f87171";

  // SVG Badge
  const labelWidth = label.length * 6.5 + 10;
  const statusWidth = statusText.length * 6.5 + 10;
  const totalWidth = labelWidth + statusWidth;
  const borderRadius = style === "flat-square" ? 0 : 3;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${statusText}">
  <title>${label}: ${statusText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${borderRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="#${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + statusWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${statusText}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${statusText}</text>
  </g>
</svg>`;

  // Markdown
  const markdown = `[![guardrail Certified](${verifyUrl}/badge.svg)](${verifyUrl})`;

  // HTML
  const html = `<a href="${verifyUrl}"><img src="${verifyUrl}/badge.svg" alt="guardrail Certified: ${score}/100" /></a>`;

  return { svg, markdown, html };
}

async function embedBadgeInReadme(projectPath, badgeMarkdown) {
  const readmePaths = ["README.md", "readme.md", "Readme.md"];

  for (const readmeName of readmePaths) {
    const readmePath = path.join(projectPath, readmeName);
    try {
      let content = await fs.readFile(readmePath, "utf-8");

      // Check if badge already exists
      if (content.includes("guardrailai.dev/verify")) {
        console.log(
          `${COLORS.dim}Badge already in ${readmeName}${COLORS.reset}`,
        );
        return;
      }

      // Find the first heading and add badge after it
      const lines = content.split("\n");
      let insertIndex = 0;

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("#")) {
          insertIndex = i + 1;
          break;
        }
      }

      // Insert badge
      lines.splice(insertIndex, 0, "", badgeMarkdown, "");
      content = lines.join("\n");

      await fs.writeFile(readmePath, content);
      console.log(
        `${COLORS.green}✅ Badge added to ${readmeName}${COLORS.reset}`,
      );
      return;
    } catch {
      continue;
    }
  }

  console.log(
    `${COLORS.yellow}⚠️ No README.md found to embed badge${COLORS.reset}`,
  );
}

// CommonJS export
module.exports = { runCertify };

// CLI entry point
if (require.main === module) {
  const args = {};
  const argv = process.argv.slice(2);

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--output" && argv[i + 1]) {
      args.output = argv[++i];
    } else if (argv[i] === "--style" && argv[i + 1]) {
      args.style = argv[++i];
    } else if (argv[i] === "--embed") {
      args.embed = true;
    }
  }

  runCertify(args, process.cwd());
}
