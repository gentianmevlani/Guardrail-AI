/**
 * BullMQ processor: scan jobs
 */

import { Job } from "bullmq";
import { logger } from "../../lib/enhanced-logger";
import type { ScanJobData, ScanJobResult } from "../../lib/queue";
import { realtimeEventsService } from "../../services/realtime-events";
import { ScanService } from "../scan-service";
import {
  scheduleScanRetry,
  shouldRetryScan,
  storeFindings,
  updateScanResults,
  updateScanStatus,
} from "./scan-db";

const scanService = new ScanService();

export async function processScanJob(
  job: Job<ScanJobData>,
): Promise<ScanJobResult> {
  const { data } = job;
  const { scanId, userId, requestId } = data;
  const childLogger = logger.child({ scanId, userId, requestId });
  childLogger.info("Starting scan job processing");

  let tenantId: string | undefined;
  try {
    const { prisma } = await import("@guardrail/database");
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true, tenantId: true },
    });
    tenantId = user?.organizationId || user?.tenantId || undefined;
  } catch (error: unknown) {
    childLogger.warn("Failed to fetch tenant ID, continuing without tenant scoping", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    realtimeEventsService.emitStatus(scanId, userId, "queued", tenantId);
    await updateScanStatus(scanId, "running", 10);
    realtimeEventsService.emitStatus(scanId, userId, "running", tenantId);
    realtimeEventsService.emitProgress(scanId, userId, 10);
    realtimeEventsService.emitLog(scanId, userId, "Starting scan...", tenantId);

    const result = await scanService.runScan({
      scanId: data.scanId,
      repositoryUrl: data.repositoryUrl,
      localPath: data.localPath,
      branch: data.branch,
      userId: data.userId,
      enableLLM: data.enableLLM,
      llmConfig: data.llmConfig,
      onProgress: async (progress, message) => {
        await updateScanStatus(scanId, "running", progress);
        realtimeEventsService.emitProgress(scanId, userId, progress);
        if (message) {
          realtimeEventsService.emitLog(scanId, userId, message, tenantId);
        }
        childLogger.debug("Scan progress", { progress, message, tenantId });
      },
    });

    if (result.success && result.findings) {
      let findingsCount = 0;
      for (const finding of result.findings) {
        findingsCount++;
        const f = finding as Record<string, unknown>;
        realtimeEventsService.emitFinding(
          scanId,
          userId,
          {
            id: (f.id as string) || `finding-${findingsCount}`,
            type: finding.type,
            severity: finding.severity,
            file: finding.file,
            line: finding.line,
            message: finding.message,
          },
          findingsCount,
          tenantId,
        );
      }
      await storeFindings(scanId, result.findings);

      if (process.env.ENABLE_FINDING_DEDUPLICATION !== "false") {
        try {
          const { deduplicateFindingsForScan } = await import(
            "../../services/finding-deduplication"
          );
          const dedupResult = await deduplicateFindingsForScan(scanId);
          childLogger.info("Findings deduplicated", {
            scanId,
            total: dedupResult.totalFindings,
            unique: dedupResult.uniqueFindings,
            removed: dedupResult.duplicatesRemoved,
          });
        } catch (dedupError: unknown) {
          childLogger.warn("Deduplication failed, continuing", {
            error:
              dedupError instanceof Error
                ? dedupError.message
                : String(dedupError),
          });
        }
      }

      await updateScanResults(scanId, result);

      if (process.env.ENABLE_CRITICAL_ALERTS !== "false") {
        try {
          const { checkAndAlertCriticalFindings } = await import(
            "../../services/critical-finding-alerts"
          );
          await checkAndAlertCriticalFindings(scanId);
        } catch (alertError: unknown) {
          childLogger.warn("Critical alert check failed, continuing", {
            error:
              alertError instanceof Error
                ? alertError.message
                : String(alertError),
          });
        }
      }

      realtimeEventsService.emitProgress(scanId, userId, 100);
      realtimeEventsService.emitLog(
        scanId,
        userId,
        `Scan completed: ${result.verdict} (score: ${result.score})`,
        tenantId,
      );
      realtimeEventsService.emitStatus(scanId, userId, "complete", tenantId);

      const { cacheService } = await import("../../services/cache-service");
      await cacheService.invalidate(`findings:scan:${scanId}:*`);
      await cacheService.invalidate(`findings:user:${userId}:*`);
    } else {
      const shouldRetry = await shouldRetryScan(scanId, result.error);

      if (shouldRetry) {
        childLogger.info("Scheduling scan retry", {
          scanId,
          retryCount: shouldRetry.retryCount,
        });
        await scheduleScanRetry(scanId, userId, shouldRetry.retryCount);
        realtimeEventsService.emitLog(
          scanId,
          userId,
          `Scan failed, will retry (attempt ${shouldRetry.retryCount + 1})`,
          tenantId,
        );
        realtimeEventsService.emitStatus(scanId, userId, "queued", tenantId);
      } else {
        await updateScanStatus(scanId, "failed", 0, result.error);
        realtimeEventsService.emitLog(
          scanId,
          userId,
          `Scan failed: ${result.error || "Unknown error"}`,
          tenantId,
        );
        realtimeEventsService.emitStatus(
          scanId,
          userId,
          "error",
          tenantId,
          result.error,
        );
      }
    }

    childLogger.info("Scan job processing completed", {
      success: result.success,
      verdict: result.verdict,
      score: result.score,
    });
    return result;
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    childLogger.error("Scan job processing failed", {
      error: error instanceof Error ? error.message : String(error),
      tenantId,
    });
    await updateScanStatus(scanId, "failed", 0, errorMessage);
    realtimeEventsService.emitLog(
      scanId,
      userId,
      `Scan error: ${errorMessage}`,
      tenantId,
    );
    realtimeEventsService.emitStatus(
      scanId,
      userId,
      "error",
      tenantId,
      errorMessage,
    );
    return {
      success: false,
      scanId,
      error: errorMessage,
      errorDetails: {
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
