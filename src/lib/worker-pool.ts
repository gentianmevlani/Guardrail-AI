/**
 * Worker Pool
 * 
 * Manages worker threads for parallel processing of massive repositories
 */

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as os from 'os';

export interface WorkerTask {
  id: string;
  data: unknown;
  priority?: number;
}

export interface WorkerResult {
  taskId: string;
  success: boolean;
  result?: unknown;
  error?: Error;
}

export interface WorkerPoolOptions {
  maxWorkers?: number;
  workerScript?: string;
  timeout?: number;
  retries?: number;
}

class WorkerPool extends EventEmitter {
  private workers: Worker[] = [];
  private queue: WorkerTask[] = [];
  private activeTasks: Map<string, Worker> = new Map();
  private maxWorkers: number;
  private workerScript: string;
  private timeout: number;
  private retries: number;

  constructor(options: WorkerPoolOptions = {}) {
    super();
    this.maxWorkers = options.maxWorkers || Math.min(8, os.cpus().length);
    this.workerScript = options.workerScript || path.join(__dirname, 'worker.js');
    this.timeout = options.timeout || 300000; // 5 minutes
    this.retries = options.retries || 2;
  }

  /**
   * Initialize worker pool
   */
  async initialize(): Promise<void> {
    for (let i = 0; i < this.maxWorkers; i++) {
      await this.createWorker();
    }
  }

  /**
   * Execute task
   */
  async execute(task: WorkerTask): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.queue.push(task);
      this.queue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

      // Process queue
      this.processQueue();

      // Wait for result
      const handler = (result: WorkerResult) => {
        if (result.taskId === task.id) {
          this.removeListener('task-complete', handler);
          if (result.success) {
            resolve(result.result);
          } else {
            reject(result.error);
          }
        }
      };

      this.on('task-complete', handler);

      // Timeout
      setTimeout(() => {
        this.removeListener('task-complete', handler);
        reject(new Error(`Task ${task.id} timed out`));
      }, this.timeout);
    });
  }

  /**
   * Execute batch of tasks
   */
  async executeBatch(tasks: WorkerTask[]): Promise<WorkerResult[]> {
    const results = await Promise.allSettled(
      tasks.map(task => this.execute(task))
    );

    return results.map((result, i) => ({
      taskId: tasks[i].id,
      success: result.status === 'fulfilled',
      result: result.status === 'fulfilled' ? result.value : undefined,
      error: result.status === 'rejected' ? result.reason : undefined,
    }));
  }

  /**
   * Process queue
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.activeTasks.size < this.maxWorkers) {
      const task = this.queue.shift();
      if (!task) break;

      const worker = this.getAvailableWorker();
      if (worker) {
        this.runTask(worker, task);
      }
    }
  }

  /**
   * Run task on worker
   */
  private async runTask(worker: Worker, task: WorkerTask): Promise<void> {
    this.activeTasks.set(task.id, worker);

    worker.postMessage({
      taskId: task.id,
      data: task.data,
    });

    const messageHandler = (result: WorkerResult) => {
      if (result.taskId === task.id) {
        worker.removeListener('message', messageHandler);
        this.activeTasks.delete(task.id);
        this.emit('task-complete', result);
        this.processQueue(); // Process next task
      }
    };

    worker.on('message', messageHandler);

    worker.on('error', (error) => {
      worker.removeListener('message', messageHandler);
      this.activeTasks.delete(task.id);
      this.emit('task-complete', {
        taskId: task.id,
        success: false,
        error,
      });
      this.processQueue();
    });
  }

  /**
   * Get available worker
   */
  private getAvailableWorker(): Worker | null {
    for (const worker of this.workers) {
      if (!Array.from(this.activeTasks.values()).includes(worker)) {
        return worker;
      }
    }
    return null;
  }

  /**
   * Create worker
   */
  private async createWorker(): Promise<Worker> {
    const worker = new Worker(this.workerScript);

    worker.on('error', (error) => {
      this.emit('worker-error', error);
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        this.emit('worker-exit', code);
        // Recreate worker
        this.createWorker();
      }
    });

    this.workers.push(worker);
    return worker;
  }

  /**
   * Shutdown worker pool
   */
  async shutdown(): Promise<void> {
    // Wait for active tasks
    while (this.activeTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Terminate all workers
    await Promise.all(this.workers.map(worker => worker.terminate()));
    this.workers = [];
    this.queue = [];
    this.activeTasks.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    totalWorkers: number;
    activeTasks: number;
    queuedTasks: number;
  } {
    return {
      totalWorkers: this.workers.length,
      activeTasks: this.activeTasks.size,
      queuedTasks: this.queue.length,
    };
  }
}

export const workerPool = new WorkerPool();

