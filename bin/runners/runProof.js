const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");
const http = require("http");
const https = require("https");
const { checkEntitlement } = require("./lib/auth");

function parseArgs(args) {
  const out = {
    mode: args[0],
    url: "http://localhost:3000",
    output: ".guardrail/ship/reality-mode",
    auth: true,
    headless: true,
  };

  for (let i = 1; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--url=")) out.url = a.split("=")[1];
    if (a === "--url") out.url = args[++i];
    if (a.startsWith("--output=")) out.output = a.split("=")[1];
    if (a === "--output") out.output = args[++i];
    if (a === "--no-auth") out.auth = false;
    if (a === "--headed") out.headless = false;
  }
  return out;
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, (res) => {
      resolve(true);
      req.destroy();
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

function getDevCommand(projectRoot) {
  try {
    const pkgPath = path.join(projectRoot, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const scripts = pkg.scripts || {};
      const devScript = scripts.dev ? "dev" : scripts.start ? "start" : null;

      if (!devScript) return "npm run dev";

      // Detect package manager
      if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml")))
        return `pnpm ${devScript}`;
      if (fs.existsSync(path.join(projectRoot, "yarn.lock")))
        return `yarn ${devScript}`;
      if (fs.existsSync(path.join(projectRoot, "bun.lockb")))
        return `bun ${devScript}`;

      return `npm run ${devScript}`;
    }
  } catch (e) {
    // Non-fatal: package.json may not exist or be malformed, use default
    if (process.env.DEBUG) {
      console.warn(`⚠ Failed to detect dev script from package.json: ${e.message}`);
    }
  }
  return "npm run dev";
}

async function runProof(args) {
  const opts = parseArgs(args);
  const mode = opts.mode;

  if (!mode || mode === "--help") {
    console.log(
      `
guardrail proof <mode> [options]

Modes:
  mocks     Static mock/demo leakage detection
  reality   Runtime verification (Playwright + network truth)

Options (reality):
  --url <url>       Target URL (default: http://localhost:3000)
  --output <dir>    Artifacts directory
  --no-auth         Skip runtime auth checks
  --headed          Run browser in headed mode (visible)
`.trim(),
    );
    return;
  }

  if (mode === "mocks") {
    try {
      const {
        auditMockBlocker,
      } = require("../../scripts/audit-mock-blocker.js");
      const results = await auditMockBlocker(process.cwd());

      if (results.issues.length > 0) {
        console.log(
          `\n  🚫 Found ${results.issues.length} mock/test artifacts in production code.\n`,
        );
        return 1;
      } else {
        console.log("\n  ✅ No mock artifacts found.\n");
        return 0;
      }
    } catch (e) {
      console.error("Failed to run mock proof:", e.message);
      return 1;
    }
  }

  if (mode === "reality") {
    // Check entitlement for premium feature
    const ent = await checkEntitlement("proof:reality");
    if (!ent.allowed) {
      console.error(`\n  🚫 Access Denied: ${ent.reason}`);
      console.error(
        '  This is a premium feature. Run "guardrail login" or upgrade your plan.\n',
      );
      return 2;
    }

    console.log("\n  🎬 guardrail REALITY MODE\n");
    console.log(`  Target: ${opts.url}`);

    // 0. Pre-flight Check
    console.log("  📡 Checking connectivity...");
    const isReachable = await checkUrl(opts.url);
    if (!isReachable) {
      console.error(`\n  ❌ Error: Could not connect to ${opts.url}`);

      if (opts.url.includes("localhost") || opts.url.includes("127.0.0.1")) {
        const devCmd = getDevCommand(process.cwd());
        console.error("  💡 Hint: Your app doesn't seem to be running.");
        console.error(`     Try starting it in another terminal:\n`);
        console.error(`     ${devCmd}\n`);
      }
      return 1;
    }
    console.log("  ✅ Target is online");

    console.log(`  Output: ${opts.output}\n`);

    const projectRoot = process.cwd();
    const realityCli = path.join(__dirname, "../../src/bin/reality-check.ts");

    // 1. Generate Test Spec
    console.log("  📝 Generating flight plan...");
    try {
      // Use npx tsx to run the TS CLI helper
      execSync(
        `npx tsx "${realityCli}" generate --url "${opts.url}" --output "${opts.output}" ${opts.auth ? "--auth" : ""}`,
        {
          stdio: "inherit",
          cwd: projectRoot,
        },
      );
    } catch (e) {
      console.error("  ❌ Failed to generate test spec:", e.message);
      return 1;
    }

    // 2. Run Playwright Test
    console.log("\n  🚀 Launching Reality Scanner...");
    let testFailed = false;
    try {
      const specPath = path.join(opts.output, "reality-mode.spec.ts");
      // Ensure playwright is installed or use npx
      // We force junit reporter to avoid noise, but user might want seeing it
      // actually we want the results for the report
      execSync(
        `npx playwright test "${specPath}" --reporter=line ${opts.headless ? "" : "--headed"}`,
        {
          stdio: "inherit",
          cwd: projectRoot,
          env: { ...process.env, CI: "1" }, // Force CI mode to avoid opening html report automatically
        },
      );
    } catch (e) {
      // Playwright throws if tests fail, which is expected if we find fake data
      testFailed = true;
      console.log("\n  ⚠️  Issues detected during scan.");
    }

    // 3. Generate Report
    console.log("\n  📊 Analyzing flight data...");
    try {
      const resultJson = path.join(opts.output, "reality-mode-result.json");
      const reportHtml = path.join(opts.output, "reality-mode-report.html");

      if (fs.existsSync(resultJson)) {
        try {
          execSync(
            `npx tsx "${realityCli}" report "${resultJson}" --output "${reportHtml}"`,
            {
              stdio: "inherit",
              cwd: projectRoot,
            },
          );
          console.log(`\n  ✅ Reality Check Complete.`);
          console.log(`  📄 Report: ${reportHtml}\n`);
        } catch (reportErr) {
          // The report tool exits with 1 if verdict is fake (NO-GO).
          // This is expected for failures, so we return 1 without logging a generic "Failed" error.
          return 1;
        }
      } else {
        console.error("  ❌ No result data found. Did the test run?");
        return 1;
      }
    } catch (e) {
      console.error("  ❌ Failed during analysis phase:", e.message);
      return 1;
    }

    return testFailed ? 1 : 0;
  }

  throw new Error(`Unknown proof mode: ${mode}`);
}

module.exports = { runProof };
