/**
 * One-call bootstrap for workflow version persistence (`.guardrail/workflow-versions.json`).
 * Invoke from CLI entry and/or API startup so in-memory history survives process restarts.
 *
 * **API:** Set `GUARDRAIL_PROJECT_ROOT` when `process.cwd()` is not the repo root (e.g. container workdir).
 * **CLI:** `bin/runners/workflowBootstrap.js` passes the same env when set.
 */

import * as path from "path";
import { workflowVersioning } from "./workflow-versioning";

/** Resolve project root: `GUARDRAIL_PROJECT_ROOT` or `process.cwd()`. */
export function resolveWorkflowProjectRoot(
  override?: string,
): string {
  const raw =
    (override ?? process.env.GUARDRAIL_PROJECT_ROOT ?? "").trim() ||
    process.cwd();
  return path.resolve(raw);
}

export async function bootstrapWorkflowPersistence(
  projectRoot: string = resolveWorkflowProjectRoot(),
): Promise<void> {
  const root = path.resolve(projectRoot);
  workflowVersioning.setPersistenceRoot(root);
  await workflowVersioning.hydrateFromDisk(root);
}
