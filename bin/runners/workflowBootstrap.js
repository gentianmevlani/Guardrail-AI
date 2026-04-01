/**
 * Loads workflow version history from disk when dist is built (CLI process cwd = project).
 */

async function bootstrapWorkflowPersistence() {
  let bootstrap;
  try {
    ({ bootstrapWorkflowPersistence: bootstrap } = require("../../dist/lib/workflow-persistence-bootstrap"));
  } catch {
    return;
  }
  const raw = process.env.GUARDRAIL_PROJECT_ROOT?.trim();
  await bootstrap(raw || undefined);
}

module.exports = { bootstrapWorkflowPersistence };
