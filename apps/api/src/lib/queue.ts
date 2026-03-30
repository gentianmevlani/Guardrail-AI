/**
 * Job Queue Configuration
 * 
 * BullMQ-based job queue system for durable scan execution
 */

import { Queue, QueueEvents, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

export interface QueueConfig {
  concurrency: number;
  retryAttempts: number;
  retryBackoff: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  stalledInterval: number;
  maxStalledCount: number;
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  concurrency: 3,
  retryAttempts: 3,
  retryBackoff: {
    type: 'exponential',
    delay: 2000, // Start with 2s, then 4s, 8s
  },
  stalledInterval: 30000, // 30 seconds
  maxStalledCount: 3,
};

// ============================================================================
// QUEUE TYPES
// ============================================================================

export interface ScanJobData {
  scanId: string;
  userId: string;
  /** Present for BullMQ recurring scheduled-scan jobs */
  type?: 'scheduled' | string;
  scheduleId?: string;
  repositoryId?: string;
  repositoryUrl?: string;
  localPath?: string;
  branch: string;
  enableLLM?: boolean;
  llmConfig?: {
    provider: 'openai' | 'anthropic';
    apiKey: string;
  };
  requestId?: string; // For correlation
}

export interface ScanJobResult {
  success: boolean;
  scanId: string;
  verdict?: string;
  score?: number;
  metrics?: {
    filesScanned: number;
    linesScanned: number;
    issuesFound: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
  };
  findings?: Array<{
    type: string;
    severity: string;
    category: string;
    file: string;
    line: number;
    column?: number;
    endLine?: number;
    endColumn?: number;
    title: string;
    message: string;
    codeSnippet?: string;
    suggestion?: string;
    confidence: number;
    ruleId?: string;
    metadata?: Record<string, unknown>;
  }>;
  error?: string;
  errorDetails?: Record<string, unknown>;
}

export const JOB_NAMES = {
  SCAN: 'scan-execution',
} as const;

export const QUEUE_NAMES = {
  SCAN: 'scans',
} as const;

// ============================================================================
// QUEUE SETUP
// ============================================================================

let redisConnection: Redis;
let scanQueue: Queue<ScanJobData>;
let scanWorker: Worker<ScanJobData, ScanJobResult>;
let scanQueueEvents: QueueEvents;

/**
 * Initialize Redis connection and queues
 */
export async function initializeQueues(config: Partial<QueueConfig> = {}): Promise<void> {
  const queueConfig = { ...DEFAULT_QUEUE_CONFIG, ...config };

  // Initialize Redis connection
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  // Handle Redis connection errors
  redisConnection.on('error', (error) => {
    logger.error({ error }, 'Redis connection error');
  });

  redisConnection.on('connect', () => {
    logger.info('Redis connected successfully');
  });

  await redisConnection.ping();

  // Initialize scan queue
  scanQueue = new Queue(QUEUE_NAMES.SCAN, {
    connection: redisConnection,
    defaultJobOptions: {
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 50, // Keep last 50 failed jobs
      attempts: queueConfig.retryAttempts,
      backoff: queueConfig.retryBackoff,
    },
  });

  // Initialize queue events for monitoring
  scanQueueEvents = new QueueEvents(QUEUE_NAMES.SCAN, {
    connection: redisConnection,
  });

  // Set up event listeners
  scanQueueEvents.on('completed', ({ jobId, returnvalue }: any) => {
    logger.info({ jobId, scanId: returnvalue?.scanId }, 'Scan job completed');
  });

  scanQueueEvents.on('failed', ({ jobId, failedReason }) => {
    logger.error({ jobId, error: failedReason }, 'Scan job failed');
  });

  scanQueueEvents.on('stalled', ({ jobId }) => {
    logger.warn({ jobId }, 'Scan job stalled');
  });

  logger.info('Job queues initialized successfully');
}

/**
 * Initialize the scan worker
 */
export async function initializeWorker(
  processor: (job: any) => Promise<ScanJobResult>,
  config: Partial<QueueConfig> = {}
): Promise<void> {
  const queueConfig = { ...DEFAULT_QUEUE_CONFIG, ...config };

  if (!redisConnection) {
    throw new Error('Redis connection not initialized. Call initializeQueues() first.');
  }

  scanWorker = new Worker<ScanJobData, ScanJobResult>(
    QUEUE_NAMES.SCAN,
    processor,
    {
      connection: redisConnection,
      concurrency: queueConfig.concurrency,
      stalledInterval: queueConfig.stalledInterval,
      maxStalledCount: queueConfig.maxStalledCount,
    }
  );

  // Worker event listeners
  scanWorker.on('completed', (job) => {
    logger.info({ jobId: job.id, scanId: job.data.scanId }, 'Worker completed job');
  });

  scanWorker.on('failed', (job, error) => {
    logger.error({ 
      jobId: job?.id, 
      scanId: job?.data.scanId, 
      error: error.message 
    }, 'Worker failed job');
  });

  scanWorker.on('error', (error) => {
    logger.error({ error }, 'Worker error');
  });

  logger.info('Scan worker initialized successfully');
}

/**
 * Add a scan job to the queue with duplicate prevention
 * 
 * SECURITY: Prevents duplicate scans by checking for existing active/queued jobs
 */
export async function enqueueScan(
  data: ScanJobData,
  options?: { delay?: number; priority?: number; skipDuplicateCheck?: boolean }
): Promise<string> {
  if (!scanQueue) {
    throw new Error('Scan queue not initialized. Call initializeQueues() first.');
  }

  // Check for duplicate scan (same scanId already queued or running)
  if (!options?.skipDuplicateCheck) {
    const existingJob = await scanQueue.getJob(data.scanId);
    if (existingJob) {
      const isActive = await existingJob.isActive();
      const isWaiting = await existingJob.isWaiting();
      
      if (isActive || isWaiting) {
        logger.info({ 
          scanId: data.scanId, 
          jobId: existingJob.id,
          status: isActive ? 'active' : 'waiting',
          requestId: data.requestId 
        }, 'Duplicate scan prevented - job already queued/running');
        
        // Return existing job ID instead of creating duplicate
        return existingJob.id!;
      }
    }
  }

  const job = await scanQueue.add(
    JOB_NAMES.SCAN,
    data,
    {
      // Use scanId as jobId for easier tracking and duplicate prevention
      jobId: data.scanId,
      delay: options?.delay,
      priority: options?.priority,
      // Note: requestId stored in data for correlation
      // Remove duplicate jobs older than 1 hour if they exist
      removeOnComplete: { age: 3600 }, // 1 hour
      removeOnFail: { age: 86400 }, // 24 hours
    }
  );

  logger.info({ 
    jobId: job.id, 
    scanId: data.scanId, 
    userId: data.userId,
    requestId: data.requestId 
  }, 'Scan job enqueued');

  return job.id!;
}

/** Returns the scan queue after {@link initializeQueues}, or null if not initialized. */
export function getScanQueue(): Queue<ScanJobData> | null {
  return scanQueue ?? null;
}

/**
 * Get job status and progress
 */
export async function getJobStatus(jobId: string): Promise<{
  id: string;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'stalled';
  progress?: number;
  data?: ScanJobData;
  result?: ScanJobResult;
  error?: string;
}> {
  if (!scanQueue) {
    throw new Error('Scan queue not initialized');
  }

  const job = await scanQueue.getJob(jobId);
  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const [active, completed, failed] = await Promise.all([
    job.isActive(),
    job.isCompleted(),
    job.isFailed(),
  ]);
  const status = active
    ? 'active'
    : completed
      ? 'completed'
      : failed
        ? 'failed'
        : 'waiting'; // isStalled removed in newer BullMQ versions

  return {
    id: job.id!,
    status,
    progress: typeof job.progress === 'number' ? job.progress : 0,
    data: job.data,
    result: job.returnvalue,
    error: job.failedReason,
  };
}

/**
 * Cancel a queued or running job
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  if (!scanQueue) {
    throw new Error('Scan queue not initialized');
  }

  try {
    const job = await scanQueue.getJob(jobId);
    if (!job) {
      return false;
    }

    // Only cancel if job is waiting or active
    if ((await job.isActive()) || (await job.isWaiting())) {
      await job.remove();
      logger.info({ jobId }, 'Job cancelled');
      return true;
    }

    return false;
  } catch (error) {
    logger.error({ jobId, error }, 'Failed to cancel job');
    return false;
  }
}

/**
 * Get queue metrics
 */
export async function getQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  if (!scanQueue) {
    throw new Error('Scan queue not initialized');
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    scanQueue.getWaiting(),
    scanQueue.getActive(),
    scanQueue.getCompleted(),
    scanQueue.getFailed(),
    scanQueue.getDelayed(),
  ]);

  return {
    waiting: waiting.length,
    active: active.length,
    completed: completed.length,
    failed: failed.length,
    delayed: delayed.length,
  };
}

/**
 * Graceful shutdown
 */
export async function shutdownQueues(): Promise<void> {
  logger.info('Shutting down job queues...');

  const shutdownPromises: Promise<void>[] = [];

  if (scanWorker) {
    shutdownPromises.push(scanWorker.close());
  }

  if (scanQueueEvents) {
    shutdownPromises.push(scanQueueEvents.close());
  }

  if (scanQueue) {
    shutdownPromises.push(scanQueue.close());
  }

  if (redisConnection) {
    await redisConnection.disconnect();
  }

  await Promise.all(shutdownPromises);
  logger.info('Job queues shut down successfully');
}

/**
 * Health check for queue system
 */
export async function healthCheck(): Promise<{
  status: 'healthy' | 'unhealthy';
  redis: boolean;
  queue: boolean;
  worker: boolean;
  metrics?: unknown;
}> {
  try {
    const redisConnected = redisConnection?.status === 'ready';
    const queueExists = !!scanQueue;
    const workerRunning = !!scanWorker && !(scanWorker as any).closing;

    const isHealthy = redisConnected && queueExists && workerRunning;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      redis: redisConnected,
      queue: queueExists,
      worker: workerRunning,
      metrics: isHealthy ? await getQueueMetrics() : undefined,
    };
  } catch (error) {
    logger.error({ error }, 'Queue health check failed');
    return {
      status: 'unhealthy',
      redis: false,
      queue: false,
      worker: false,
    };
  }
}
