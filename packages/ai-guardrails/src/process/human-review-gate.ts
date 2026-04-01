import { EventEmitter } from 'events';
import {
  HumanReviewRequest,
  HumanReviewResponse,
  ReviewDecision,
} from '@guardrail/core';

/**
 * Human Review Gate — Process Guardrail
 *
 * Human-in-the-loop approval system. Routes high-risk actions,
 * outputs, and decisions to human reviewers. Supports assignment,
 * expiration, escalation, and decision tracking.
 */
export class HumanReviewGate extends EventEmitter {
  private pendingReviews: Map<string, HumanReviewRequest> = new Map();
  private completedReviews: Map<string, HumanReviewResponse> = new Map();
  private reviewCallbacks: Map<string, (response: HumanReviewResponse) => void> = new Map();
  private defaultTimeoutMs: number;
  private autoRejectOnExpiry: boolean;

  constructor(options?: {
    defaultTimeoutMs?: number;
    autoRejectOnExpiry?: boolean;
  }) {
    super();
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 300_000; // 5 minutes
    this.autoRejectOnExpiry = options?.autoRejectOnExpiry ?? true;
  }

  /**
   * Submit an action/output/decision for human review
   * Returns a promise that resolves when a human makes a decision
   */
  async requestReview(
    request: Omit<HumanReviewRequest, 'id' | 'createdAt' | 'status'>
  ): Promise<HumanReviewResponse> {
    const id = this.generateId();
    const now = new Date();

    const fullRequest: HumanReviewRequest = {
      ...request,
      id,
      createdAt: now,
      expiresAt: request.expiresAt ?? new Date(now.getTime() + this.defaultTimeoutMs),
      status: 'pending',
    };

    this.pendingReviews.set(id, fullRequest);
    this.emit('review-requested', fullRequest);

    return new Promise<HumanReviewResponse>((resolve, reject) => {
      // Set up callback for when review is completed
      this.reviewCallbacks.set(id, resolve);

      // Set up expiration timer
      const timeoutMs = fullRequest.expiresAt
        ? fullRequest.expiresAt.getTime() - now.getTime()
        : this.defaultTimeoutMs;

      setTimeout(() => {
        if (this.pendingReviews.has(id)) {
          this.pendingReviews.get(id)!.status = 'expired';
          this.emit('review-expired', fullRequest);

          if (this.autoRejectOnExpiry) {
            const expiredResponse: HumanReviewResponse = {
              requestId: id,
              decision: 'reject',
              reviewerId: 'system',
              reasoning: 'Review expired without decision — auto-rejected',
              timestamp: new Date(),
            };
            this.completeReview(id, expiredResponse);
            resolve(expiredResponse);
          } else {
            reject(new Error(`Review ${id} expired without decision`));
          }

          this.reviewCallbacks.delete(id);
        }
      }, timeoutMs);
    });
  }

  /**
   * Submit a review decision (called by human reviewer)
   */
  submitDecision(
    requestId: string,
    decision: ReviewDecision,
    reviewerId: string,
    reasoning: string,
    modifications?: unknown
  ): HumanReviewResponse {
    const request = this.pendingReviews.get(requestId);
    if (!request) {
      throw new Error(`Review request ${requestId} not found or already completed`);
    }

    const response: HumanReviewResponse = {
      requestId,
      decision,
      reviewerId,
      reasoning,
      modifications,
      timestamp: new Date(),
    };

    this.completeReview(requestId, response);

    // Resolve the waiting promise
    const callback = this.reviewCallbacks.get(requestId);
    if (callback) {
      callback(response);
      this.reviewCallbacks.delete(requestId);
    }

    return response;
  }

  /**
   * Check if a review is required based on risk level
   */
  requiresReview(
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    requiredForLevel: 'HIGH' | 'CRITICAL' = 'HIGH'
  ): boolean {
    const riskHierarchy = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    const riskIndex = riskHierarchy.indexOf(riskLevel);
    const requiredIndex = riskHierarchy.indexOf(requiredForLevel);
    return riskIndex >= requiredIndex;
  }

  /**
   * Get all pending reviews
   */
  getPendingReviews(): HumanReviewRequest[] {
    return Array.from(this.pendingReviews.values()).filter(
      (r) => r.status === 'pending' || r.status === 'in_review'
    );
  }

  /**
   * Get pending reviews for a specific reviewer
   */
  getReviewsForReviewer(reviewerId: string): HumanReviewRequest[] {
    return this.getPendingReviews().filter((r) => r.assignedTo === reviewerId);
  }

  /**
   * Assign a review to a specific reviewer
   */
  assignReview(requestId: string, reviewerId: string): void {
    const request = this.pendingReviews.get(requestId);
    if (request) {
      request.assignedTo = reviewerId;
      request.status = 'in_review';
      this.emit('review-assigned', request, reviewerId);
    }
  }

  /**
   * Get review history
   */
  getCompletedReviews(): HumanReviewResponse[] {
    return Array.from(this.completedReviews.values());
  }

  /**
   * Get review statistics
   */
  getStats(): {
    pending: number;
    completed: number;
    expired: number;
    averageResponseTimeMs: number;
    approvalRate: number;
  } {
    const completed = Array.from(this.completedReviews.values());
    const approved = completed.filter((r) => r.decision === 'approve');
    const allRequests = Array.from(this.pendingReviews.values());
    const expired = allRequests.filter((r) => r.status === 'expired');

    const responseTimes = completed
      .map((r) => {
        const request = allRequests.find((req) => req.id === r.requestId);
        if (!request) return 0;
        return r.timestamp.getTime() - request.createdAt.getTime();
      })
      .filter((t) => t > 0);

    return {
      pending: this.getPendingReviews().length,
      completed: completed.length,
      expired: expired.length,
      averageResponseTimeMs: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0,
      approvalRate: completed.length > 0 ? approved.length / completed.length : 0,
    };
  }

  private completeReview(requestId: string, response: HumanReviewResponse): void {
    const request = this.pendingReviews.get(requestId);
    if (request) {
      request.status = 'decided';
    }
    this.completedReviews.set(requestId, response);
    this.emit('review-completed', response);
  }

  private generateId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const humanReviewGate = new HumanReviewGate();
