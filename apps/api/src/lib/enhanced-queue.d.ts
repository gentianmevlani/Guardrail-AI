/**
 * Enhanced Background Jobs & Queue System
 * Provides comprehensive job processing with BullMQ, retries, and monitoring
 */
import { Job, Queue } from 'bullmq';
import { EventEmitter } from 'events';
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
export interface JobProcessor {
    (job: Job): Promise<unknown>;
}
export declare class QueueSystem extends EventEmitter {
    private config;
    private connection;
    private queues;
    private workers;
    private queueEvents;
    private processors;
    private stats;
    private monitoringTimer?;
    constructor(config?: Partial<QueueSystemConfig>);
    createQueue(name: string, options?: Partial<QueueSystemConfig['defaultJobOptions']>): Queue;
    private setupQueueEvents;
    registerProcessor(queueName: string, processor: JobProcessor, concurrency?: number): Promise<void>;
    addJob(queueName: string, jobConfig: JobConfig): Promise<Job>;
    getJobStatus(queueName: string, jobId: string): Promise<JobStatus | null>;
    getQueueStats(queueName: string): Promise<QueueStats | null>;
    getAllQueueStats(): Promise<Record<string, QueueStats>>;
    pauseQueue(queueName: string): Promise<void>;
    resumeQueue(queueName: string): Promise<void>;
    clearQueue(queueName: string): Promise<void>;
    removeJob(queueName: string, jobId: string): Promise<boolean>;
    retryJob(queueName: string, jobId: string): Promise<boolean>;
    scheduleRecurringJob(queueName: string, jobConfig: JobConfig, cronExpression: string): Promise<Job>;
    getJobCounts(queueName: string): Promise<Record<string, number>>;
    startMonitoring(): void;
    stopMonitoring(): void;
    shutdown(): Promise<void>;
    private getJobStatusFromState;
    private updateJobStatus;
    private initializeStats;
}
export declare const JobTypes: {
    readonly SEND_EMAIL: "send-email";
    readonly SEND_BULK_EMAIL: "send-bulk-email";
    readonly PROCESS_FILE_UPLOAD: "process-file-upload";
    readonly GENERATE_THUMBNAILS: "generate-thumbnails";
    readonly CLEANUP_EXPIRED_DATA: "cleanup-expired-data";
    readonly GENERATE_REPORTS: "generate-reports";
    readonly SEND_PUSH_NOTIFICATION: "send-push-notification";
    readonly SEND_SMS_NOTIFICATION: "send-sms-notification";
    readonly DATABASE_BACKUP: "database-backup";
    readonly CACHE_WARMING: "cache-warming";
    readonly SECURITY_AUDIT: "security-audit";
    readonly MALWARE_SCAN: "malware-scan";
    readonly PROCESS_ANALYTICS: "process-analytics";
    readonly UPDATE_METRICS: "update-metrics";
};
export declare function getQueueSystem(): QueueSystem;
export declare const queueSystem: QueueSystem;
//# sourceMappingURL=enhanced-queue.d.ts.map