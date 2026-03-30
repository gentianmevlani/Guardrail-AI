/**
 * Scan Worker Process
 *
 * Dedicated worker process for handling scan jobs from the queue.
 * Implementation is split under `src/worker/`.
 */

export { processScanJob } from "./worker/jobs/process-scan-job";
export { processScheduledScan } from "./worker/jobs/process-scheduled-scan";

import { logger } from "./lib/enhanced-logger";
import { startWorker } from "./worker/bootstrap";

if (require.main === module) {
  startWorker().catch((error: unknown) => {
    logger.error("Worker startup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  });
}
