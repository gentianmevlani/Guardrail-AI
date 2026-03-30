const fs = require("fs");
const path = require("path");

const VERSION = "2.0.0";

// ANSI color codes for terminal output
const colors = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

const c = colors;

function ensureOutputDir(outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function detectProjectFeatures(projectPath) {
  const features = {
    isMonorepo: false,
    frameworks: [],
    orm: null,
    ci: !!process.env.CI,
  };

  try {
    // Monorepo
    if (
      fs.existsSync(path.join(projectPath, "turbo.json")) ||
      fs.existsSync(path.join(projectPath, "pnpm-workspace.yaml")) ||
      fs.existsSync(path.join(projectPath, "lerna.json"))
    ) {
      features.isMonorepo = true;
    }

    // Frameworks
    const pkgPath = path.join(projectPath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Full-stack frameworks
      if (allDeps.next) features.frameworks.push("nextjs");
      if (allDeps.nuxt || allDeps["@nuxt/core"]) features.frameworks.push("nuxt");
      if (allDeps["@remix-run/node"] || allDeps["@remix-run/react"]) features.frameworks.push("remix");
      
      // Frontend frameworks
      if (allDeps.react || allDeps["react-dom"]) features.frameworks.push("react");
      if (allDeps.vue) features.frameworks.push("vue");
      if (allDeps.svelte || allDeps["svelte-kit"]) features.frameworks.push("svelte");
      if (allDeps["@angular/core"]) features.frameworks.push("angular");
      
      // Build tools
      if (allDeps.vite || allDeps["@vitejs/plugin-react"] || allDeps["@vitejs/plugin-vue"]) {
        features.frameworks.push("vite");
      }
      if (allDeps.webpack) features.frameworks.push("webpack");
      if (allDeps.turbopack) features.frameworks.push("turbopack");
      
      // Backend frameworks
      if (allDeps.fastify) features.frameworks.push("fastify");
      if (allDeps.express) features.frameworks.push("express");
      if (allDeps["@nestjs/core"]) features.frameworks.push("nestjs");
      if (allDeps.koa) features.frameworks.push("koa");
    }

    // Config files
    if (
      fs.existsSync(path.join(projectPath, "next.config.js")) ||
      fs.existsSync(path.join(projectPath, "next.config.mjs"))
    ) {
      if (!features.frameworks.includes("nextjs"))
        features.frameworks.push("nextjs");
    }
    
    // Vite config files
    if (
      fs.existsSync(path.join(projectPath, "vite.config.ts")) ||
      fs.existsSync(path.join(projectPath, "vite.config.js")) ||
      fs.existsSync(path.join(projectPath, "vite.config.mjs"))
    ) {
      if (!features.frameworks.includes("vite"))
        features.frameworks.push("vite");
    }

    // ORM
    if (
      fs.existsSync(path.join(projectPath, "prisma")) ||
      fs.existsSync(path.join(projectPath, "schema.prisma"))
    ) {
      features.orm = "prisma";
    }
    if (fs.existsSync(path.join(projectPath, "drizzle.config.ts"))) {
      features.orm = "drizzle";
    }
  } catch (err) {
    // ignore detection errors
  }

  return features;
}

function writeArtifacts(outputDir, results) {
  ensureOutputDir(outputDir);

  const timestamp = new Date().toISOString();

  // Always write summary.json (machine-readable)
  const summary = {
    version: VERSION,
    timestamp,
    score: results.score || 0,
    grade: results.grade || "F",
    canShip: results.canShip || false,
    checks: results.checks || {},
    counts: results.counts || {},
  };
  fs.writeFileSync(
    path.join(outputDir, "summary.json"),
    JSON.stringify(summary, null, 2),
  );

  // Write summary.md (human-readable)
  const md = generateMarkdownSummary(results);
  fs.writeFileSync(path.join(outputDir, "summary.md"), md);

  // Write report.html (shareable)
  const html = generateHtmlReport(results);
  fs.writeFileSync(path.join(outputDir, "report.html"), html);

  // Write per-module artifacts
  const artifactsDir = path.join(outputDir, "artifacts");
  ensureOutputDir(artifactsDir);

  if (results.integrity) {
    fs.writeFileSync(
      path.join(artifactsDir, "integrity.json"),
      JSON.stringify(results.integrity, null, 2),
    );
  }
  if (results.hygiene) {
    fs.writeFileSync(
      path.join(artifactsDir, "hygiene.json"),
      JSON.stringify(results.hygiene, null, 2),
    );
  }
  if (results.security) {
    fs.writeFileSync(
      path.join(artifactsDir, "security.json"),
      JSON.stringify(results.security, null, 2),
    );
  }

  return summary;
}

function generateMarkdownSummary(results) {
  const lines = [];
  lines.push("# 🛡️ guardrail Scan Summary\n");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Score:** ${results.score}/100 (Grade: ${results.grade})`);
  lines.push(`**Verdict:** ${results.canShip ? "✅ SHIP" : "🚫 NO-SHIP"}\n`);

  if (results.deductions?.length > 0) {
    lines.push("## Score Breakdown\n");
    lines.push("| Category | Points | Reason |");
    lines.push("|----------|--------|--------|");
    for (const d of results.deductions) {
      lines.push(`| ${d.category} | ${d.points} | ${d.reason} |`);
    }
    lines.push("");
  }

  if (results.blockers?.length > 0) {
    lines.push("## 🚨 Blockers\n");
    for (const b of results.blockers.slice(0, 10)) {
      lines.push(`- **${b.type}**: ${b.detail} (\`${b.file}\`)`);
    }
    lines.push("");
  }

  lines.push("---\n_Generated by Guardrail_");
  return lines.join("\n");
}

function generateHtmlReport(results) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>guardrail Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; }
    .score { font-size: 3rem; font-weight: bold; text-align: center; padding: 2rem; border-radius: 1rem; }
    .ship { background: #d4edda; color: #155724; }
    .no-ship { background: #f8d7da; color: #721c24; }
    table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #ddd; }
    .blocker { background: #fff3cd; padding: 0.5rem; margin: 0.25rem 0; border-radius: 0.25rem; }
  </style>
</head>
<body>
  <h1>🛡️ guardrail Report</h1>
  <div class="score ${results.canShip ? "ship" : "no-ship"}">
    ${results.score}/100 (${results.grade})<br>
    <small>${results.canShip ? "✅ CLEAR TO SHIP" : "🚫 NOT READY"}</small>
  </div>
  <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
  ${
    results.blockers?.length > 0
      ? `
  <h2>🚨 Blockers</h2>
  ${results.blockers
    .slice(0, 10)
    .map(
      (b) =>
        `<div class="blocker"><strong>${b.type}</strong>: ${b.detail} (<code>${b.file}</code>)</div>`,
    )
    .join("")}
  `
      : ""
  }
  <hr>
  <p><em>Generated by guardrail v${VERSION}</em></p>
</body>
</html>`;
}

function printResults(results, format) {
  if (format === "json" || (Array.isArray(format) && format.includes("json"))) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return c.green;
    if (score >= 50) return c.yellow;
    return c.red;
  };

  const scoreColor = getScoreColor(results.score);
  const gradeEmoji =
    results.score >= 80 ? "🟢" : results.score >= 50 ? "🟡" : "🔴";

  // Text format - pretty print with colors
  console.log("");
  console.log(`  ${c.bold}${c.cyan}🛡️  guardrail SCAN RESULTS${c.reset}`);
  console.log("");

  // Score box with color
  const boxColor = results.canShip ? c.green : c.red;
  console.log(
    `  ${boxColor}╔════════════════════════════════════════════════╗${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}                                                ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}   ${gradeEmoji}  ${c.bold}INTEGRITY SCORE:${c.reset} ${scoreColor}${c.bold}${String(results.score).padStart(3)}${c.reset} / 100            ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}      ${c.bold}GRADE:${c.reset} ${scoreColor}${c.bold}${results.grade}${c.reset}                                 ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}║${c.reset}                                                ${boxColor}║${c.reset}`,
  );
  if (results.canShip) {
    console.log(
      `  ${boxColor}║${c.reset}      ${c.bgGreen}${c.bold} ✅ CLEAR TO SHIP ${c.reset}                       ${boxColor}║${c.reset}`,
    );
  } else {
    console.log(
      `  ${boxColor}║${c.reset}      ${c.bgRed}${c.bold} 🚫 NOT READY TO SHIP ${c.reset}                   ${boxColor}║${c.reset}`,
    );
  }
  console.log(
    `  ${boxColor}║${c.reset}                                                ${boxColor}║${c.reset}`,
  );
  console.log(
    `  ${boxColor}╚════════════════════════════════════════════════╝${c.reset}`,
  );
  console.log("");

  // Category breakdown with visual bars
  console.log(`  ${c.bold}📊 CATEGORY BREAKDOWN${c.reset}\n`);
  const categories = [
    { key: "api", icon: "🔗", name: "API Wiring" },
    { key: "auth", icon: "🔐", name: "Auth Coverage" },
    { key: "secrets", icon: "🔑", name: "Secrets" },
    { key: "routes", icon: "🗺️ ", name: "Route Integrity" },
    { key: "mock", icon: "🧪", name: "Mock Blocker" },
    { key: "iac", icon: "☁️ ", name: "IaC Security" },
    { key: "pii", icon: "🕵️ ", name: "PII Privacy" },
    { key: "hallucinations", icon: "🤖", name: "AI Guardrails" },
  ];

  for (const cat of categories) {
    if (results.counts?.[cat.key] !== undefined) {
      const count = results.counts?.[cat.key] || 0;
      const isPass = count === 0;
      const status = isPass ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      const countStr = isPass
        ? `${c.green}${c.bold}0 issues${c.reset}`
        : `${c.red}${c.bold}${count} issue${count !== 1 ? "s" : ""}${c.reset}`;
      console.log(
        `  ${status} ${cat.icon} ${c.dim}${cat.name.padEnd(16)}${c.reset} ${countStr}`,
      );
    }
  }
  console.log("");

  // Blockers with severity colors
  if (results.blockers?.length > 0) {
    console.log(`  ${c.bold}${c.red}🚨 TOP BLOCKERS${c.reset}\n`);
    for (const b of results.blockers.slice(0, 5)) {
      const priorityColor = b.priority === "P0" ? c.red : c.yellow;
      console.log(
        `  ${priorityColor}${c.bold}${b.priority}${c.reset} ${b.icon} ${c.bold}${b.type.padEnd(10)}${c.reset} ${c.dim}${b.detail}${c.reset}`,
      );
      console.log(`       ${c.cyan}${b.file}${c.reset}`);
    }
    console.log("");
  }

  // Footer
  console.log(
    `  ${c.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}`,
  );
  console.log(
    `  ${c.dim}📄 Full report:${c.reset} ${c.cyan}${results.outputDir}/report.html${c.reset}`,
  );
  console.log(
    `  ${c.dim}🔧 Fix issues:${c.reset}  ${c.cyan}guardrail fix${c.reset}`,
  );
  console.log("");
}

module.exports = {
  ensureOutputDir,
  writeArtifacts,
  generateMarkdownSummary,
  generateHtmlReport,
  printResults,
  detectProjectFeatures,
  VERSION,
};
