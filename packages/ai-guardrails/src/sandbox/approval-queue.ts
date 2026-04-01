import { EventEmitter } from 'events';
import { ActionAttempt, ActionDecision } from '@guardrail/core';

/**
 * Human-in-the-Loop (HITL) Approval Queue
 *
 * When the action interceptor flags an action as requiresApproval,
 * the action is queued here for human review instead of being silently blocked.
 *
 * Flow:
 * 1. ActionInterceptor detects HIGH/CRITICAL risk → sets requiresApproval = true
 * 2. Action is enqueued here with a deadline
 * 3. Human reviews via CLI prompt, dashboard, or API
 * 4. approve() or deny() resolves the pending action
 * 5. If deadline expires, the action is auto-denied (fail-safe)
 *
 * Integration points:
 * - CLI: `guardrail approve <id>` / `guardrail deny <id>`
 * - Web dashboard: POST /api/v1/approvals/:id/approve
 * - VS Code extension: notification with approve/deny buttons
 */

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'expired';

export interface ApprovalRequest {
  id: string;
  action: ActionAttempt;
  decision: ActionDecision;
  status: ApprovalStatus;
  createdAt: number;
  deadlineMs: number;
  resolvedAt: number | null;
  resolvedBy: string | null;
  reviewNotes: string | null;
}

export interface ApprovalQueueConfig {
  /** Default deadline for pending approvals in ms (default: 5 minutes) */
  defaultDeadlineMs: number;
  /** Max items in the queue before oldest expired items are pruned */
  maxQueueSize: number;
  /** Whether to auto-deny on deadline expiry (default: true — fail-safe) */
  autoDenyOnExpiry: boolean;
  /** Risk levels that require approval */
  requireApprovalForRiskLevels: Array<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>;
}

const DEFAULT_CONFIG: ApprovalQueueConfig = {
  defaultDeadlineMs: 300_000, // 5 minutes
  maxQueueSize: 100,
  autoDenyOnExpiry: true,
  requireApprovalForRiskLevels: ['HIGH', 'CRITICAL'],
};

export class ApprovalQueue extends EventEmitter {
  private queue: Map<string, ApprovalRequest> = new Map();
  private pendingResolvers: Map<string, {
    resolve: (decision: 'approved' | 'denied') => void;
    timer: ReturnType<typeof setTimeout>;
  }> = new Map();
  private config: ApprovalQueueConfig;

  constructor(config: Partial<ApprovalQueueConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if a given decision requires human approval.
   */
  needsApproval(decision: ActionDecision): boolean {
    return (
      decision.requiresApproval ||
      this.config.requireApprovalForRiskLevels.includes(decision.riskLevel)
    );
  }

  /**
   * Enqueue an action for human review.
   * Returns a promise that resolves when the human approves or denies.
   */
  async enqueue(
    action: ActionAttempt,
    decision: ActionDecision,
    deadlineMs?: number,
  ): Promise<'approved' | 'denied'> {
    const id = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const deadline = deadlineMs ?? this.config.defaultDeadlineMs;

    const request: ApprovalRequest = {
      id,
      action,
      decision,
      status: 'pending',
      createdAt: Date.now(),
      deadlineMs: deadline,
      resolvedAt: null,
      resolvedBy: null,
      reviewNotes: null,
    };

    this.queue.set(id, request);
    this.pruneExpired();

    this.emit('enqueued', request);

    return new Promise<'approved' | 'denied'>((resolve) => {
      const timer = setTimeout(() => {
        if (request.status === 'pending') {
          request.status = 'expired';
          request.resolvedAt = Date.now();
          this.pendingResolvers.delete(id);
          this.emit('expired', request);

          if (this.config.autoDenyOnExpiry) {
            resolve('denied');
          }
        }
      }, deadline);

      this.pendingResolvers.set(id, { resolve, timer });
    });
  }

  /**
   * Approve a pending action.
   */
  approve(id: string, reviewedBy: string, notes?: string): boolean {
    return this.resolve(id, 'approved', reviewedBy, notes);
  }

  /**
   * Deny a pending action.
   */
  deny(id: string, reviewedBy: string, notes?: string): boolean {
    return this.resolve(id, 'denied', reviewedBy, notes);
  }

  /**
   * Get all pending approvals.
   */
  getPending(): ApprovalRequest[] {
    return Array.from(this.queue.values()).filter((r) => r.status === 'pending');
  }

  /**
   * Get a single approval request by ID.
   */
  get(id: string): ApprovalRequest | undefined {
    return this.queue.get(id);
  }

  /**
   * Get full queue history (pending + resolved).
   */
  getAll(): ApprovalRequest[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get queue statistics.
   */
  getStats(): {
    pending: number;
    approved: number;
    denied: number;
    expired: number;
    total: number;
    avgResponseTimeMs: number | null;
  } {
    const all = Array.from(this.queue.values());
    const resolved = all.filter((r) => r.resolvedAt && r.status !== 'expired');
    const avgResponseTimeMs = resolved.length > 0
      ? resolved.reduce((sum, r) => sum + (r.resolvedAt! - r.createdAt), 0) / resolved.length
      : null;

    return {
      pending: all.filter((r) => r.status === 'pending').length,
      approved: all.filter((r) => r.status === 'approved').length,
      denied: all.filter((r) => r.status === 'denied').length,
      expired: all.filter((r) => r.status === 'expired').length,
      total: all.length,
      avgResponseTimeMs,
    };
  }

  // ─── Internal ──────────────────────────────────────────────

  private resolve(
    id: string,
    status: 'approved' | 'denied',
    reviewedBy: string,
    notes?: string,
  ): boolean {
    const request = this.queue.get(id);
    if (!request || request.status !== 'pending') return false;

    request.status = status;
    request.resolvedAt = Date.now();
    request.resolvedBy = reviewedBy;
    request.reviewNotes = notes ?? null;

    const pending = this.pendingResolvers.get(id);
    if (pending) {
      clearTimeout(pending.timer);
      pending.resolve(status);
      this.pendingResolvers.delete(id);
    }

    this.emit(status, request);
    return true;
  }

  private pruneExpired(): void {
    if (this.queue.size <= this.config.maxQueueSize) return;

    // Remove oldest expired/resolved entries
    const entries = Array.from(this.queue.entries())
      .filter(([, r]) => r.status !== 'pending')
      .sort((a, b) => a[1].createdAt - b[1].createdAt);

    const toRemove = entries.slice(0, this.queue.size - this.config.maxQueueSize);
    for (const [id] of toRemove) {
      this.queue.delete(id);
    }
  }
}

// Global singleton
export const approvalQueue = new ApprovalQueue();
