/**
 * Ship Decision Notification Service
 *
 * Automatically notifies users when ship decisions change:
 * - Email notifications
 * - Webhook notifications
 * - Slack/Teams integrations
 * - Real-time UI updates
 */
export interface ShipDecisionChange {
    runId: string;
    userId: string;
    projectPath: string;
    previousVerdict: "SHIP" | "NO_SHIP" | "REVIEW" | null;
    currentVerdict: "SHIP" | "NO_SHIP" | "REVIEW";
    score: number;
    confidence: number;
    blockers: Array<{
        id: string;
        severity: string;
        message: string;
    }>;
    timestamp: string;
}
export declare class ShipNotificationService {
    private emailService;
    private webhookService;
    constructor();
    /**
     * Notify about ship decision change
     */
    notifyDecisionChange(change: ShipDecisionChange): Promise<void>;
    /**
     * Send email notification
     */
    private sendEmailNotification;
    /**
     * Send webhook notifications
     */
    private sendWebhookNotifications;
    /**
     * Send real-time UI update
     */
    private sendRealtimeUpdate;
    /**
     * Get user details
     */
    private getUser;
    /**
     * Get user notification preferences
     */
    private getUserPreferences;
    /**
     * Get webhook subscriptions for user
     */
    private getWebhookSubscriptions;
}
export declare const shipNotificationService: ShipNotificationService;
//# sourceMappingURL=ship-notification-service.d.ts.map