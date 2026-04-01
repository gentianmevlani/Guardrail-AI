/**
 * Enhanced Background Jobs & Queue System
 * Provides comprehensive job processing with BullMQ, retries, and monitoring
 */

import { Job, Queue, QueueEvents, Worker } from 'bullmq';
import { EventEmitter } from 'events';
import Redis from 'ioredis';
import { ExternalServiceError } from '../middleware/enhanced-error-handler';
import { logger } from './enhanced-logger';

// Job configuration
export interface JobConfig {
  name: string;
  data: any;
  opts?: {
    delay?: number;
    priority?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
    repeat?: {
      every?: number;
      cron?: string;
    };
  };
}

// Job status interface
export interface JobStatus {
  id: string;
  name: string;
  data: any;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress: number;
  createdAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  attempts: number;
  error?: string;
  result?: unknown;
}

// Queue statistics
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  total: number;
  processingRate: number;
  errorRate: number;
  avgProcessingTime: number;
}

// Queue configuration
export interface QueueSystemConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    maxRetriesPerRequest: number;
  };
  defaultJobOptions: {
    removeOnComplete: number;
    removeOnFail: number;
    attempts: number;
    backoff: {
      type: 'exponential';
      delay: number;
    };
  };
  concurrency: {
    default: number;
    max: number;
  };
  monitoring: {
    enabled: boolean;
    interval: number;
  };
}

// Default configuration
const defaultConfig: QueueSystemConfig = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '1'),
    maxRetriesPerRequest: 3,
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
  concurrency: {
    default: 5,
    max: 20,
  },
  monitoring: {
    enabled: true,
    interval: 30000, // 30 seconds
  },
};

// Job processor interface
export interface JobProcessor {
  (job: Job): Promise<unknown>;
}

// Queue system class
export class QueueSystem extends EventEmitter {
  private config: QueueSystemConfig;
  private connection: Redis;
  private queues: Map<string, Queue> = new Map();
  private workers: Map<string, Worker> = new Map();
  private queueEvents: Map<string, QueueEvents> = new Map();
  private processors: Map<string, JobProcessor> = new Map();
  private stats: Map<string, QueueStats> = new Map();
  private monitoringTimer?: NodeJS.Timeout;

  constructor(config: Partial<QueueSystemConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.connection = new Redis(this.config.redis);
  }

  // Create a new queue
  createQueue(name: string, options: Partial<QueueSystemConfig['defaultJobOptions']> = {}): Queue {
    if (this.queues.has(name)) {
      return this.queues.get(name)!;
    }

    const queue = new Queue(name, {
      connection: this.connection,
      defaultJobOptions: { ...this.config.defaultJobOptions, ...options },
    });

    this.queues.set(name, queue);
    this.setupQueueEvents(name, queue);
    this.stats.set(name, this.initializeStats());

    (logger as any).info({ queueName: name }, 'Queue created');
    return queue;
  }

  // Setup queue events for monitoring
  private setupQueueEvents(name: string, queue: Queue): void {
    const queueEvents = new QueueEvents(name, { connection: this.connection });
    this.queueEvents.set(name, queueEvents);

    queueEvents.on('waiting', ({ jobId }) => {
      this.updateJobStatus(name, jobId, 'waiting');
      this.emit('job:waiting', { queue: name, jobId });
    });

    queueEvents.on('active', ({ jobId }) => {
      this.updateJobStatus(name, jobId, 'active');
      this.emit('job:active', { queue: name, jobId });
    });

    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      this.updateJobStatus(name, jobId, 'completed', { result: returnvalue });
      this.emit('job:completed', { queue: name, jobId, result: returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.updateJobStatus(name, jobId, 'failed', { error: failedReason });
      this.emit('job:failed', { queue: name, jobId, error: failedReason });
    });

    queueEvents.on('delayed', ({ jobId }) => {
      this.updateJobStatus(name, jobId, 'delayed');
      this.emit('job:delayed', { queue: name, jobId });
    });
  }

  // Register a job processor
  async registerProcessor(queueName: string, processor: JobProcessor, concurrency: number = this.config.concurrency.default): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Close existing worker if exists
    const existingWorker = this.workers.get(queueName);
    if (existingWorker) {
      await existingWorker.close();
    }

    const worker = new Worker(queueName, processor, {
      connection: this.connection,
      concurrency,
    });

    this.workers.set(queueName, worker);
    this.processors.set(queueName, processor);

    // Worker events
    worker.on('completed', (job) => {
      (logger as any).debug({ jobId: job.id, queue: queueName }, 'Job completed');
    });

    worker.on('failed', (job, err) => {
      (logger as any).error({ jobId: job?.id, queue: queueName, error: err.message }, 'Job failed');
    });

    worker.on('error', (err) => {
      (logger as any).error({ queue: queueName, error: err.message }, 'Worker error');
    });

    (logger as any).info({ queueName, concurrency }, 'Job processor registered');
  }

  // Add a job to the queue
  async addJob(queueName: string, jobConfig: JobConfig): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      const job = await queue.add(jobConfig.name, jobConfig.data, jobConfig.opts);
      (logger as any).info({ queueName, jobId: job.id, jobName: jobConfig.name }, 'Job added to queue');
      return job;
    } catch (error) {
      (logger as any).error({ queueName, error }, 'Failed to add job to queue');
      throw new ExternalServiceError('Queue', `Failed to add job: ${error}`, error);
    }
  }

  // Get job status
  async getJobStatus(queueName: string, jobId: string): Promise<JobStatus | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        return null;
      }

      return {
        id: job.id!,
        name: job.name,
        data: job.data,
        status: this.getJobStatusFromState(job),
        progress: typeof job.progress === 'number' ? job.progress : 0,
        createdAt: new Date(job.timestamp!),
        processedAt: job.processedOn ? new Date(job.processedOn) : undefined,
        completedAt: job.finishedOn ? new Date(job.finishedOn) : undefined,
        failedAt: (job as any).failedOn ? new Date((job as any).failedOn) : undefined,
        attempts: job.attemptsMade || 0,
        error: job.failedReason,
        result: job.returnvalue,
      };
    } catch (error) {
      (logger as any).error({ queueName, jobId, error }, 'Failed to get job status');
      return null;
    }
  }

  // Get queue statistics
  async getQueueStats(queueName: string): Promise<QueueStats | null> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaiting(),
        queue.getActive(),
        queue.getCompleted(),
        queue.getFailed(),
        queue.getDelayed(),
      ]);

      const total = waiting.length + active.length + completed.length + failed.length + delayed.length;
      const processingRate = active.length > 0 ? 1 : 0;
      const errorRate = total > 0 ? failed.length / total : 0;

      const stats: QueueStats = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        paused: 0, // Bull queues don't have paused state in the same way
        total,
        processingRate,
        errorRate,
        avgProcessingTime: 0, // Would need to calculate from job history
      };

      this.stats.set(queueName, stats);
      return stats;
    } catch (error) {
      (logger as any).error({ queueName, error }, 'Failed to get queue stats');
      return null;
    }
  }

  // Get all queue statistics
  async getAllQueueStats(): Promise<Record<string, QueueStats>> {
    const allStats: Record<string, QueueStats> = {};
    
    for (const queueName of Array.from(this.queues.keys())) {
      const stats = await this.getQueueStats(queueName);
      if (stats) {
        allStats[queueName] = stats;
      }
    }
    
    return allStats;
  }

  // Pause a queue
  async pauseQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.pause();
    (logger as any).info({ queueName }, 'Queue paused');
  }

  // Resume a queue
  async resumeQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.resume();
    (logger as any).info({ queueName }, 'Queue resumed');
  }

  // Clear a queue
  async clearQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    await queue.drain();
    (logger as any).info({ queueName }, 'Queue cleared');
  }

  // Remove a job
  async removeJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();
      (logger as any).info({ queueName, jobId }, 'Job removed');
      return true;
    } catch (error) {
      (logger as any).error({ queueName, jobId, error }, 'Failed to remove job');
      return false;
    }
  }

  // Retry a failed job
  async retryJob(queueName: string, jobId: string): Promise<boolean> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      return false;
    }

    try {
      const job = await queue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.retry();
      (logger as any).info({ queueName, jobId }, 'Job retried');
      return true;
    } catch (error) {
      (logger as any).error({ queueName, jobId, error }, 'Failed to retry job');
      return false;
    }
  }

  // Schedule a recurring job
  async scheduleRecurringJob(queueName: string, jobConfig: JobConfig, cronExpression: string): Promise<Job> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const opts = {
      ...jobConfig.opts,
      repeat: { cron: cronExpression } as any,
    };

    const job = await queue.add(jobConfig.name, jobConfig.data, opts);
    (logger as any).info({ queueName, jobId: job.id, cron: cronExpression }, 'Recurring job scheduled');
    return job;
  }

  // Get job counts by status
  async getJobCounts(queueName: string): Promise<Record<string, number>> {
    const stats = await this.getQueueStats(queueName);
    if (!stats) {
      return {};
    }

    return {
      waiting: stats.waiting,
      active: stats.active,
      completed: stats.completed,
      failed: stats.failed,
      delayed: stats.delayed,
      paused: stats.paused,
    };
  }

  // Start monitoring
  startMonitoring(): void {
    if (this.monitoringTimer) {
      return;
    }

    this.monitoringTimer = setInterval(async () => {
      try {
        const allStats = await this.getAllQueueStats();
        this.emit('stats:update', allStats);
        
        // Log warnings for high error rates
        for (const [queueName, stats] of Object.entries(allStats)) {
          if (stats.errorRate > 0.1) { // 10% error rate
            (logger as any).warn({ queueName, errorRate: stats.errorRate }, 'High queue error rate');
          }
          
          if (stats.active > this.config.concurrency.max) {
            (logger as any).warn({ queueName, activeJobs: stats.active }, 'High queue concurrency');
          }
        }
      } catch (error) {
        (logger as any).error({ error }, 'Queue monitoring error');
      }
    }, this.config.monitoring.interval);

    logger.info('Queue monitoring started');
  }

  // Stop monitoring
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    logger.info('Queue monitoring stopped');
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Shutting down queue system...');

    this.stopMonitoring();

    // Close all workers
    const workerClosePromises = Array.from(this.workers.values()).map(worker => worker.close());
    await Promise.all(workerClosePromises);

    // Close all queue events
    const queueEventsClosePromises = Array.from(this.queueEvents.values()).map(events => events.close());
    await Promise.all(queueEventsClosePromises);

    // Close all queues
    const queueClosePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(queueClosePromises);

    // Close Redis connection
    await this.connection.quit();

    logger.info('Queue system shutdown complete');
  }

  // Helper methods
  private getJobStatusFromState(job: Job): JobStatus['status'] {
    if (job.finishedOn && !job.failedReason) return 'completed';
    if (job.failedReason) return 'failed';
    if (job.processedOn && !job.finishedOn) return 'active';
    if (job.delay) return 'delayed';
    return 'waiting';
  }

  private updateJobStatus(queueName: string, jobId: string, status: JobStatus['status'], data?: Partial<JobStatus>): void {
    // This would typically update a database or cache
    // For now, just emit an event
    this.emit('job:status:update', { queueName, jobId, status, ...data });
  }

  private initializeStats(): QueueStats {
    return {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      paused: 0,
      total: 0,
      processingRate: 0,
      errorRate: 0,
      avgProcessingTime: 0,
    };
  }
}

// Predefined job types
export const JobTypes = {
  // Email jobs
  SEND_EMAIL: 'send-email',
  SEND_BULK_EMAIL: 'send-bulk-email',
  
  // File processing jobs
  PROCESS_FILE_UPLOAD: 'process-file-upload',
  GENERATE_THUMBNAILS: 'generate-thumbnails',
  
  // Data processing jobs
  CLEANUP_EXPIRED_DATA: 'cleanup-expired-data',
  GENERATE_REPORTS: 'generate-reports',
  
  // Notification jobs
  SEND_PUSH_NOTIFICATION: 'send-push-notification',
  SEND_SMS_NOTIFICATION: 'send-sms-notification',
  
  // Maintenance jobs
  DATABASE_BACKUP: 'database-backup',
  CACHE_WARMING: 'cache-warming',
  
  // Security jobs
  SECURITY_AUDIT: 'security-audit',
  MALWARE_SCAN: 'malware-scan',
  
  // Analytics jobs
  PROCESS_ANALYTICS: 'process-analytics',
  UPDATE_METRICS: 'update-metrics',
} as const;

// Queue system singleton
let queueSystemInstance: QueueSystem;

export function getQueueSystem(): QueueSystem {
  if (!queueSystemInstance) {
    queueSystemInstance = new QueueSystem();
    queueSystemInstance.startMonitoring();
  }
  return queueSystemInstance;
}

// Export default queue system
export const queueSystem = getQueueSystem();
