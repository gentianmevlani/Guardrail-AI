/**
 * Runner: guardrail apply-template
 *
 * Copies guardrail template files into the target project (components, middleware, etc.).
 */

const path = require("path");

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
};

function loadTemplateApplier() {
  try {
    return require("../../dist/lib/template-applier").templateApplier;
  } catch (err) {
    console.error(
      `${c.dim}Could not load template-applier. Run ${c.cyan}pnpm run build:lib${c.dim} from the repo root.${c.reset}`,
    );
    throw err;
  }
}

function printHelp() {
  console.log(`
${c.cyan}guardrail apply-template${c.reset} — Apply a feature template to your project

${c.bold}USAGE${c.reset}

  guardrail apply-template <type> [projectPath] [options]

${c.bold}ARGUMENTS${c.reset}

  type            Template id (see guardrail list-templates)
  projectPath     Project root (default: current directory)

${c.bold}OPTIONS${c.reset}

  --dry-run       Show what would be created without writing files
  --overwrite     Overwrite files that already exist
  --json          Print result as JSON only
  -h, --help      Show this help

${c.bold}EXAMPLES${c.reset}

  guardrail apply-template error-boundary
  guardrail apply-template loading-state ./apps/web
  guardrail apply-template auth-middleware --dry-run
`);
}

function parseArgs(args) {
  const flags = new Set([
    "--dry-run",
    "--overwrite",
    "--json",
    "-h",
    "--help",
  ]);
  const positional = [];
  for (const a of args) {
    if (flags.has(a) || a.startsWith("-")) continue;
    positional.push(a);
  }
  const templateType = positional[0];
  const projectPath = path.resolve(positional[1] || process.cwd());
  return {
    templateType,
    projectPath,
    dryRun: args.includes("--dry-run"),
    overwrite: args.includes("--overwrite"),
    json: args.includes("--json"),
  };
}

async function runApplyTemplate(args = []) {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }

  const { templateType, projectPath, dryRun, overwrite, json } = parseArgs(args);

  if (!templateType) {
    console.error(
      `${c.red}✗${c.reset} Missing template type. Run ${c.cyan}guardrail list-templates${c.reset} for options.`,
    );
    printHelp();
    return 1;
  }

  let templateApplier;
  try {
    templateApplier = loadTemplateApplier();
  } catch {
    return 1;
  }

  const known = templateApplier.listTemplates().map((t) => t.type);
  if (!known.includes(templateType)) {
    const msg = `Unknown template "${templateType}". Valid: ${known.join(", ")}`;
    if (json) {
      process.stdout.write(
        JSON.stringify({ success: false, error: msg }, null, 2) + "\n",
      );
    } else {
      console.error(`${c.red}✗${c.reset} ${msg}`);
    }
    return 1;
  }

  const result = await templateApplier.apply(templateType, projectPath, {
    dryRun,
    overwrite,
  });

  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return result.success ? 0 : 1;
  }

  if (result.success) {
    console.log(`\n${c.green}✓${c.reset} ${result.message}`);
    console.log(`${c.dim}Target: ${result.targetPath}${c.reset}`);
    if (result.filesCreated.length) {
      console.log(`\n${c.bold}Created:${c.reset}`);
      result.filesCreated.forEach((f) => console.log(`  ${f}`));
    }
    if (result.filesModified.length) {
      console.log(`\n${c.bold}Skipped (exists — use --overwrite):${c.reset}`);
      result.filesModified.forEach((f) => console.log(`  ${f}`));
    }
    const deps = await templateApplier.checkDependencies(
      [templateType],
      projectPath,
    );
    if (deps.missing.length) {
      console.log(
        `\n${c.cyan}Install dependencies:${c.reset} ${templateApplier.generateInstallCommand(deps.missing)}`,
      );
    }
    console.log("");
    return 0;
  }

  console.error(`\n${c.red}✗${c.reset} ${result.message}\n`);
  return 1;
}

module.exports = { runApplyTemplate };
