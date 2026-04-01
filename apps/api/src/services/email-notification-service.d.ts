/**
 * Comprehensive Email & Notifications Service
 * Handles email sending, templates, SMS, push notifications, and user preferences
 */
export interface EmailProvider {
    name: string;
    sendEmail(email: EmailMessage): Promise<EmailResult>;
    sendBulkEmail(emails: BulkEmailMessage): Promise<BulkEmailResult>;
    validateTemplate(template: EmailTemplate): Promise<boolean>;
}
export interface SMSProvider {
    name: string;
    sendSMS(sms: SMSMessage): Promise<SMSResult>;
    sendBulkSMS(messages: BulkSMSMessage): Promise<BulkSMSResult>;
}
export interface PushProvider {
    name: string;
    sendPush(notification: PushMessage): Promise<PushResult>;
    sendBulkPush(notifications: BulkPushMessage): Promise<BulkPushResult>;
}
export interface EmailMessage {
    to: string | string[];
    cc?: string | string[];
    bcc?: string | string[];
    subject: string;
    html?: string;
    text?: string;
    from?: string;
    replyTo?: string;
    attachments?: EmailAttachment[];
    headers?: Record<string, string>;
    metadata?: Record<string, unknown>;
}
export interface BulkEmailMessage {
    messages: Array<{
        to: string | string[];
        subject: string;
        html?: string;
        text?: string;
        metadata?: Record<string, unknown>;
    }>;
    campaignId?: string;
}
export interface EmailAttachment {
    filename: string;
    content: Buffer | string;
    contentType: string;
    contentId?: string;
}
export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    htmlTemplate: string;
    textTemplate?: string;
    variables: TemplateVariable[];
    category: string;
    isActive: boolean;
}
export interface TemplateVariable {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date' | 'object';
    required: boolean;
    defaultValue?: unknown;
    description?: string;
}
export interface EmailResult {
    success: boolean;
    messageId?: string;
    provider: string;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface BulkEmailResult {
    success: boolean;
    campaignId?: string;
    results: EmailResult[];
    summary: {
        total: number;
        sent: number;
        failed: number;
        skipped: number;
    };
}
export interface SMSMessage {
    to: string;
    from?: string;
    body: string;
    metadata?: Record<string, unknown>;
}
export interface BulkSMSMessage {
    messages: Array<{
        to: string;
        body: string;
        metadata?: Record<string, unknown>;
    }>;
    campaignId?: string;
}
export interface SMSResult {
    success: boolean;
    messageId?: string;
    provider: string;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface BulkSMSResult {
    success: boolean;
    campaignId?: string;
    results: SMSResult[];
    summary: {
        total: number;
        sent: number;
        failed: number;
        skipped: number;
    };
}
export interface PushMessage {
    to: string | string[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
    icon?: string;
    image?: string;
    badge?: string;
    sound?: string;
    priority?: 'normal' | 'high';
    ttl?: number;
    metadata?: Record<string, unknown>;
}
export interface BulkPushMessage {
    notifications: Array<{
        to: string | string[];
        title: string;
        body: string;
        data?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    }>;
    campaignId?: string;
}
export interface PushResult {
    success: boolean;
    messageId?: string;
    provider: string;
    error?: string;
    metadata?: Record<string, unknown>;
}
export interface BulkPushResult {
    success: boolean;
    campaignId?: string;
    results: PushResult[];
    summary: {
        total: number;
        sent: number;
        failed: number;
        skipped: number;
    };
}
export interface NotificationPreferences {
    userId: string;
    email: {
        enabled: boolean;
        categories: Record<string, boolean>;
        frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
        quietHours?: {
            start: string;
            end: string;
        };
    };
    sms: {
        enabled: boolean;
        categories: Record<string, boolean>;
        quietHours?: {
            start: string;
            end: string;
        };
    };
    push: {
        enabled: boolean;
        categories: Record<string, boolean>;
        quietHours?: {
            start: string;
            end: string;
        };
    };
}
export declare const NotificationCategories: {
    readonly AUTHENTICATION: "authentication";
    readonly SECURITY: "security";
    readonly BILLING: "billing";
    readonly SYSTEM: "system";
    readonly MARKETING: "marketing";
    readonly UPDATES: "updates";
    readonly REMINDERS: "reminders";
    readonly SOCIAL: "social";
};
export declare class EmailNotificationService {
    private emailProviders;
    private smsProviders;
    private pushProviders;
    private templates;
    private preferences;
    constructor();
    private setupDefaultProviders;
    private setupJobProcessors;
    sendEmail(email: EmailMessage, provider?: string): Promise<EmailResult>;
    sendBulkEmail(bulkEmail: BulkEmailMessage, provider?: string): Promise<BulkEmailResult>;
    sendSMS(sms: SMSMessage, provider?: string): Promise<SMSResult>;
    sendBulkSMS(bulkSMS: BulkSMSMessage, provider?: string): Promise<BulkSMSResult>;
    sendPush(notification: PushMessage, provider?: string): Promise<PushResult>;
    sendBulkPush(bulkPush: BulkPushMessage, provider?: string): Promise<BulkPushResult>;
    sendEmailWithTemplate(templateId: string, to: string | string[], variables: Record<string, unknown>, options?: {
        provider?: string;
        cc?: string | string[];
        bcc?: string | string[];
        attachments?: EmailAttachment[];
    }): Promise<EmailResult>;
    private renderTemplate;
    addTemplate(template: EmailTemplate): void;
    getUserPreferences(userId: string): NotificationPreferences | null;
    updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): void;
    shouldReceiveNotification(userId: string, category: string, type: 'email' | 'sms' | 'push'): boolean;
    isInQuietHours(userId: string, type: 'email' | 'sms' | 'push'): boolean;
    sendNotification(userId: string, category: string, content: {
        email?: EmailMessage;
        sms?: SMSMessage;
        push?: PushMessage;
    }, options?: {
        respectQuietHours?: boolean;
        fallbackProviders?: Record<string, string>;
    }): Promise<{
        email?: EmailResult;
        sms?: SMSResult;
        push?: PushResult;
    }>;
}
export declare const emailNotificationService: EmailNotificationService;
//# sourceMappingURL=email-notification-service.d.ts.map