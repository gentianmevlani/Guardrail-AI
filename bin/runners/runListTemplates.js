/**
 * Runner: guardrail list-templates
 *
 * Lists available feature templates (error boundary, loading state, etc.)
 * for use with guardrail apply-template.
 */

const c = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
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
${c.cyan}guardrail list-templates${c.reset} — Available feature templates

${c.bold}USAGE${c.reset}

  guardrail list-templates [options]

${c.bold}OPTIONS${c.reset}

  --json          Output as JSON (default for scripts)
  -h, --help      Show this help

${c.bold}EXAMPLES${c.reset}

  guardrail list-templates
  guardrail list-templates --json
`);
}

async function runListTemplates(args = []) {
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return 0;
  }

  const json = args.includes("--json");

  let templateApplier;
  try {
    templateApplier = loadTemplateApplier();
  } catch {
    return 1;
  }

  const list = templateApplier.listTemplates();
  const payload = list.map(({ type, config }) => ({
    type,
    description: config.description,
    category: config.category,
    target: config.target,
    dependencies: config.dependencies || [],
  }));

  if (json) {
    process.stdout.write(JSON.stringify({ templates: payload }, null, 2) + "\n");
    return 0;
  }

  console.log(`\n${c.cyan}${c.bold}Feature templates${c.reset}\n`);
  for (const row of payload) {
    console.log(`  ${c.bold}${row.type}${c.reset} ${c.dim}(${row.category})${c.reset}`);
    console.log(`    ${row.description}`);
    console.log(`    → ${row.target}`);
    if (row.dependencies.length) {
      console.log(`    deps: ${row.dependencies.join(", ")}`);
    }
    console.log("");
  }
  console.log(`${c.dim}Apply with: guardrail apply-template <type> [path]${c.reset}\n`);
  return 0;
}

module.exports = { runListTemplates };
