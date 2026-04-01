const fs = require("fs");
const path = require("path");
const { DoctorEnhanced } = require("./lib/doctor-enhanced");

async function runDoctor(args) {
  const opts = parseArgs(args);
  
  if (opts.help) {
    printHelp();
    return 0;
  }

  const projectPath = path.resolve(opts.path || process.cwd());
  const doctor = new DoctorEnhanced(projectPath);
  
  return await doctor.diagnose();
}

function parseArgs(args) {
  const opts = {
    path: process.cwd(),
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--path' || arg === '-p') opts.path = args[++i];
    else if (!arg.startsWith('-')) opts.path = path.resolve(arg);
  }

  return opts;
}

function printHelp() {
  console.log(`
🔍 guardrail Doctor

Diagnoses your environment and catches setup issues.

Usage: guardrail doctor [options]

Options:
  --path, -p    Project path (default: current directory)
  --help, -h    Show this help

The doctor checks:
  • Node.js version
  • Package manager (pnpm/npm/yarn)
  • Required binaries (git, playwright)
  • Environment variables
  • File permissions
  • Project structure
  • Build capability
`);
}

// Legacy function for backwards compatibility
function runDoctorLegacy() {
  console.log("\n  🩺 guardrail DOCTOR\n");

  const checks = [];

  // Node version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split(".")[0], 10);
  checks.push({
    name: "Node.js",
    status: nodeMajor >= 18 ? "pass" : "fail",
    message: `${nodeVersion}`,
    fix: nodeMajor < 18 ? "Upgrade to Node.js 18+" : null,
  });

  // Config file
  const configPath = path.join(process.cwd(), ".guardrailrc");
  const hasConfig =
    fs.existsSync(configPath) ||
    fs.existsSync(path.join(process.cwd(), ".guardrailrc"));
  checks.push({
    name: "Config",
    status: hasConfig ? "pass" : "warn",
    message: hasConfig ? "Found" : "Not found",
    fix: !hasConfig ? "Run: guardrail init" : null,
  });

  // Output directory
  const outputDir = path.join(process.cwd(), ".guardrail");
  const hasOutput = fs.existsSync(outputDir);
  checks.push({
    name: "Output Dir",
    status: hasOutput ? "pass" : "info",
    message: hasOutput ? ".guardrail/" : "Will be created on first scan",
  });

  // Package.json
  const pkgPath = path.join(process.cwd(), "package.json");
  const hasPkg = fs.existsSync(pkgPath);
  checks.push({
    name: "package.json",
    status: hasPkg ? "pass" : "warn",
    message: hasPkg ? "Found" : "Not found",
  });

  // TypeScript
  const hasTsConfig = fs.existsSync(path.join(process.cwd(), "tsconfig.json"));
  checks.push({
    name: "TypeScript",
    status: hasTsConfig ? "pass" : "info",
    message: hasTsConfig ? "Enabled" : "JavaScript project",
  });

  // Print results
  let hasIssues = false;
  for (const check of checks) {
    const icon =
      check.status === "pass"
        ? "✅"
        : check.status === "fail"
          ? "❌"
          : check.status === "warn"
            ? "⚠️"
            : "ℹ️";
    console.log(`  ${icon} ${check.name.padEnd(12)} ${check.message}`);
    if (check.fix) {
      console.log(`     Fix: ${check.fix}`);
    }
    if (check.status === "fail") hasIssues = true;
  }

  console.log("");
  if (hasIssues) {
    console.log("  ❌ Issues found. Fix them and run doctor again.\n");
    return 2;
  } else {
    console.log("  ✅ Environment healthy!\n");
    return 0;
  }
}

module.exports = { 
  runDoctor: runDoctor,
  runDoctorLegacy: runDoctorLegacy,
};
