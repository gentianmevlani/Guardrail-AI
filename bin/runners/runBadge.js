/**
 * guardrail badge - Generate Ship Badge for README/PR
 *
 * Creates a verifiable badge that proves your app passed guardrail checks.
 * Can be embedded in README, PR descriptions, or docs.
 */

const path = require("path");
const fs = require("fs");
const { withErrorHandling } = require("./lib/error-handler");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function parseArgs(args) {
  const opts = {
    path: ".",
    format: "svg",
    output: null,
    style: "flat",
    label: "guardrail",
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") opts.help = true;
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a.startsWith("--format=")) opts.format = a.split("=")[1];
    if (a === "--format" || a === "-f") opts.format = args[++i];
    if (a.startsWith("--output=")) opts.output = a.split("=")[1];
    if (a === "--output" || a === "-o") opts.output = args[++i];
    if (a.startsWith("--style=")) opts.style = a.split("=")[1];
    if (a.startsWith("--label=")) opts.label = a.split("=")[1];
  }

  return opts;
}

function generateSVGBadge(score, label, style) {
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  const status = score >= 80 ? "passing" : score >= 50 ? "warning" : "failing";
  const width = 120;
  const labelWidth = 60;
  const statusWidth = 60;

  if (style === "flat-square") {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20">
  <rect width="${labelWidth}" height="20" fill="#555"/>
  <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="${color}"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${status}</text>
  </g>
</svg>`;
  }

  // Default flat style with rounded corners
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img">
  <title>${label}: ${status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + statusWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${status}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${status}</text>
  </g>
</svg>`;
}

function generateMarkdownBadge(score, label) {
  const color = score >= 80 ? "brightgreen" : score >= 50 ? "yellow" : "red";
  const status = score >= 80 ? "passing" : score >= 50 ? "warning" : "failing";
  return `![${label}](https://img.shields.io/badge/${encodeURIComponent(label)}-${status}-${color})`;
}

function generateHTMLBadge(score, label) {
  const color = score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
  const status = score >= 80 ? "passing" : score >= 50 ? "warning" : "failing";
  return `<a href="https://guardrailai.dev"><img src="https://img.shields.io/badge/${encodeURIComponent(label)}-${status}-${color.replace("#", "")}" alt="${label}"></a>`;
}

async function runBadge(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    console.log(`
${c.bold}${c.cyan}🏅 guardrail BADGE${c.reset}

${c.dim}Generate a Ship Badge to prove your app passed guardrail checks.${c.reset}

${c.bold}USAGE:${c.reset}
  guardrail badge [options]

${c.bold}OPTIONS:${c.reset}
  --format, -f <type>   Output format: svg, md, html (default: svg)
  --output, -o <file>   Save to file (default: stdout)
  --style <style>       Badge style: flat, flat-square (default: flat)
  --label <text>        Badge label (default: guardrail)
  --path, -p <dir>      Project path (default: current directory)
  --help, -h            Show this help

${c.bold}EXAMPLES:${c.reset}
  ${c.dim}# Generate SVG badge${c.reset}
  guardrail badge

  ${c.dim}# Save badge to file${c.reset}
  guardrail badge --output badge.svg

  ${c.dim}# Generate Markdown for README${c.reset}
  guardrail badge --format md

  ${c.dim}# Generate HTML embed${c.reset}
  guardrail badge --format html

${c.bold}EMBED IN README:${c.reset}
  ${c.dim}# Markdown${c.reset}
  ![guardrail](https://img.shields.io/badge/guardrail-passing-brightgreen)

  ${c.dim}# HTML${c.reset}
  <img src=".guardrail/badge.svg" alt="guardrail">
`);
    return 0;
  }

  const projectPath = path.resolve(opts.path);
  const summaryPath = path.join(projectPath, ".guardrail", "summary.json");

  console.log(`\n  ${c.bold}${c.magenta}🏅 guardrail BADGE${c.reset}\n`);

  // Try to read last scan results
  let score = 0;
  let hasResults = false;

  try {
    if (fs.existsSync(summaryPath)) {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
      score = summary.score || 0;
      hasResults = true;
      console.log(`  ${c.dim}Last scan score:${c.reset} ${score}/100`);
    }
  } catch (err) {
    // No results found
  }

  if (!hasResults) {
    console.log(`  ${c.yellow}⚠${c.reset} No scan results found.`);
    console.log(`  ${c.dim}Run 'guardrail ship' or 'guardrail scan' first.${c.reset}\n`);
    
    // Generate a "not scanned" badge
    score = 0;
  }

  // Generate badge based on format
  let badge;
  let extension;

  switch (opts.format.toLowerCase()) {
    case "md":
    case "markdown":
      badge = generateMarkdownBadge(score, opts.label);
      extension = "md";
      break;
    case "html":
      badge = generateHTMLBadge(score, opts.label);
      extension = "html";
      break;
    case "svg":
    default:
      badge = generateSVGBadge(score, opts.label, opts.style);
      extension = "svg";
      break;
  }

  // Output
  if (opts.output) {
    const outputPath = opts.output.includes(".")
      ? opts.output
      : `${opts.output}.${extension}`;
    fs.writeFileSync(outputPath, badge);
    console.log(`  ${c.green}✓${c.reset} Badge saved to: ${c.cyan}${outputPath}${c.reset}`);
  } else {
    // Also save to .guardrail directory
    const badgeDir = path.join(projectPath, ".guardrail", "badges");
    if (!fs.existsSync(badgeDir)) {
      fs.mkdirSync(badgeDir, { recursive: true });
    }
    const defaultPath = path.join(badgeDir, `badge.${extension}`);
    fs.writeFileSync(defaultPath, badge);
    console.log(`  ${c.green}✓${c.reset} Badge saved to: ${c.cyan}${defaultPath}${c.reset}`);
  }

  // Show embed instructions
  const status = score >= 80 ? "passing" : score >= 50 ? "warning" : "failing";
  const statusColor = score >= 80 ? c.green : score >= 50 ? c.yellow : c.red;

  console.log(`\n  ${c.bold}Status:${c.reset} ${statusColor}${status.toUpperCase()}${c.reset} (${score}/100)`);

  if (opts.format === "svg") {
    console.log(`\n  ${c.bold}Embed in README.md:${c.reset}`);
    console.log(`  ${c.dim}![guardrail](.guardrail/badges/badge.svg)${c.reset}`);
  } else if (opts.format === "md" || opts.format === "markdown") {
    console.log(`\n  ${c.bold}Add to README.md:${c.reset}`);
    console.log(`  ${c.dim}${badge}${c.reset}`);
  }

  console.log("");

  return 0;
}

module.exports = {
  runBadge: withErrorHandling(runBadge, "Badge generation failed"),
};
