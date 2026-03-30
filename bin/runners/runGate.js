const { runScan } = require("./runScan");
const { checkEntitlement, getApiKey } = require("./lib/auth");
const { withErrorHandling, createUserError } = require("./lib/error-handler");
const { 
  printBanner,
  printCommandHeader,
  colors: c,
  printError,
  printSuccess
} = require("./cli-utils");

// Use shared exit codes from error-handler
const { EXIT_CODES } = require('./lib/error-handler');

/**
 * Upload SARIF report to guardrail API
 * @param {string} sarifPath - Path to SARIF file
 * @param {string} apiKey - API key for authentication
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function uploadSarifReport(sarifPath, apiKey) {
  const fs = require("fs");
  
  // Read SARIF file if it exists
  let sarifContent;
  try {
    if (fs.existsSync(sarifPath)) {
      sarifContent = fs.readFileSync(sarifPath, "utf8");
    } else {
      // Generate SARIF from latest scan results
      const scanResultsPath = "guardrail-scan-results.json";
      if (!fs.existsSync(scanResultsPath)) {
        return { success: false, error: "No scan results found to upload" };
      }
      const scanResults = JSON.parse(fs.readFileSync(scanResultsPath, "utf8"));
      sarifContent = convertToSarif(scanResults);
    }
  } catch (err) {
    return { success: false, error: `Failed to read results: ${err.message}` };
  }

  const apiUrl = process.env.GUARDRAIL_API_URL || "https://api.guardrail.dev";
  
  try {
    const res = await fetch(`${apiUrl}/v1/scans/sarif`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sarif: JSON.parse(sarifContent),
        repository: process.env.GITHUB_REPOSITORY || "unknown",
        ref: process.env.GITHUB_REF || "unknown",
        sha: process.env.GITHUB_SHA || "unknown",
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `API error ${res.status}: ${errorText}` };
    }

    const result = await res.json();
    return { success: true, uploadId: result.id };
  } catch (err) {
    if (err.name === "AbortError") {
      return { success: false, error: "Upload timed out after 30 seconds" };
    }
    return { success: false, error: `Upload failed: ${err.message}` };
  }
}

/**
 * Convert scan results to SARIF format
 */
function convertToSarif(scanResults) {
  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "guardrail",
          version: scanResults.version || "1.0.0",
          informationUri: "https://guardrail.dev",
          rules: [],
        },
      },
      results: [],
    }],
  };

  // Convert findings to SARIF results
  const findings = scanResults.findings || scanResults.issues || [];
  const ruleMap = new Map();

  for (const finding of findings) {
    const ruleId = finding.ruleId || finding.type || "unknown";
    
    if (!ruleMap.has(ruleId)) {
      ruleMap.set(ruleId, {
        id: ruleId,
        name: finding.name || ruleId,
        shortDescription: { text: finding.message || finding.name || ruleId },
        defaultConfiguration: {
          level: finding.severity === "critical" ? "error" : 
                 finding.severity === "high" ? "error" :
                 finding.severity === "medium" ? "warning" : "note",
        },
      });
    }

    sarif.runs[0].results.push({
      ruleId,
      level: finding.severity === "critical" ? "error" : 
             finding.severity === "high" ? "error" :
             finding.severity === "medium" ? "warning" : "note",
      message: { text: finding.message || finding.name || "Security finding" },
      locations: finding.file ? [{
        physicalLocation: {
          artifactLocation: { uri: finding.file },
          region: finding.line ? { startLine: finding.line } : undefined,
        },
      }] : [],
    });
  }

  sarif.runs[0].tool.driver.rules = Array.from(ruleMap.values());
  return JSON.stringify(sarif, null, 2);
}

async function runGate(args) {
  const isJsonOutput = args.includes("--json");
  
  if (!isJsonOutput) {
    printBanner();
    printCommandHeader("GATE", "CI/CD Deployment Protection");
  }
  
  // Parse arguments
  const shouldUpload = args.includes("--sarif-upload");
  const sarifPath = args.find((a, i) => args[i - 1] === "--sarif-file") || "guardrail.sarif";

  // Check for upload entitlement early
  if (shouldUpload) {
    const { key } = getApiKey();
    if (!key) {
      if (isJsonOutput) {
        console.log(JSON.stringify({
          schemaVersion: "1.0.0",
          success: false,
          error: "Authentication required for SARIF upload",
          code: "AUTH_REQUIRED",
          exitCode: EXIT_CODES.AUTH_REQUIRED,
          nextSteps: [
            'Run "guardrail login" to authenticate',
            "Get your API key at https://guardrail.dev/settings/keys",
          ],
        }));
      } else {
        printError("Authentication Required", "SARIF upload requires an API key");
        console.error(`  ${c.dim}Run "guardrail login" or set GUARDRAIL_API_KEY.${c.reset}\n`);
      }
      process.exit(EXIT_CODES.AUTH_FAILURE);
    }

    const ent = await checkEntitlement("integrations:github");
    if (!ent.allowed) {
      if (isJsonOutput) {
        console.log(JSON.stringify({
          schemaVersion: "1.0.0",
          success: false,
          error: ent.reason,
          code: "FEATURE_NOT_AVAILABLE",
          exitCode: EXIT_CODES.AUTH_REQUIRED,
          nextSteps: [
            'Run "guardrail login" to authenticate',
            "Get your API key at https://guardrail.dev/settings/keys",
            "Upgrade at https://guardrail.dev/pricing",
          ],
        }));
      } else {
        printError("Upload Skipped", ent.reason);
        console.error(`  ${c.dim}SARIF upload is a premium feature. Upgrade at https://guardrail.dev/pricing${c.reset}\n`);
      }
      process.exit(EXIT_CODES.AUTH_FAILURE);
    }
    
    if (!isJsonOutput) {
      console.log(`  ${c.cyan}📤 SARIF Upload enabled${c.yellow} (Premium)${c.reset}...`);
    }
  }

  // Run scan with CI profile
  const scanArgs = ["--profile=ci", ...(args || []).filter(a => a && !a.includes("sarif"))];
  const exitCode = await runScan(scanArgs);

  // Display gate result
  if (!isJsonOutput) {
    if (exitCode !== 0) {
      console.log(`\n${c.bgRed}${c.white}  🚫 GATE FAILED - Build blocked  ${c.reset}\n`);
      console.log(`${c.yellow}Fix the issues above before merging.${c.reset}\n`);
    } else {
      console.log(`\n${c.bgGreen}${c.black}  ✅ GATE PASSED  ${c.reset}\n`);
    }
  }

  // Perform real upload if requested
  if (shouldUpload) {
    const { key } = getApiKey();
    
    if (!isJsonOutput) {
      console.log(`  ${c.dim}☁️  Uploading SARIF report to guardrail Dashboard...${c.reset}`);
    }
    
    const uploadResult = await uploadSarifReport(sarifPath, key);
    
    if (uploadResult.success) {
      if (!isJsonOutput) {
        console.log(`  ${c.green}✅ Upload complete.${c.reset}`);
        if (uploadResult.uploadId) {
          console.log(`  ${c.dim}Report ID: ${uploadResult.uploadId}${c.reset}`);
        }
      }
    } else {
      if (!isJsonOutput) {
        console.log(`  ${c.red}❌ Upload failed: ${uploadResult.error}${c.reset}`);
        console.log(`  ${c.dim}Gate result is still valid. Upload can be retried.${c.reset}`);
      }
      // Don't change exit code for upload failure - gate result is what matters
    }
  }

  // Final JSON output for CI systems (standardized schema)
  if (isJsonOutput) {
    const { createJsonOutput, formatGateResults } = require("../../packages/cli/src/runtime/json-output");
    const { ExitCode } = require("../../packages/cli/src/runtime/exit-codes");
    
    const jsonOutput = createJsonOutput(
      'gate',
      exitCode === 0,
      exitCode === 0 ? ExitCode.SUCCESS : ExitCode.POLICY_FAIL,
      formatGateResults(exitCode, exitCode === 0 ? "pass" : "fail")
    );
    
    // Ensure JSON output includes schema version for consistency
    const standardizedOutput = {
      schemaVersion: "1.0.0",
      ...jsonOutput,
    };
    console.log(JSON.stringify(standardizedOutput, null, 2));
  }

  // Use standardized exit codes
  const { EXIT_CODES } = require('./lib/error-handler');
  const standardizedExitCode = exitCode === 0 ? EXIT_CODES.SUCCESS : EXIT_CODES.POLICY_FAIL;
  process.exit(standardizedExitCode);
}

// Export with error handling wrapper
module.exports = {
  runGate: withErrorHandling(runGate, "Gate failed"),
};
