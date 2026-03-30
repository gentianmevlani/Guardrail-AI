/**
 * Comprehensive Email & Notifications Service
 * Handles email sending, templates, SMS, push notifications, and user preferences
 */

import { logger } from '../lib/enhanced-logger';
import { JobTypes, queueSystem } from '../lib/enhanced-queue';
import { ExternalServiceError } from '../middleware/enhanced-error-handler';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Email provider configuration
export interface EmailProvider {
  name: string;
  sendEmail(email: EmailMessage): Promise<EmailResult>;
  sendBulkEmail(emails: BulkEmailMessage): Promise<BulkEmailResult>;
  validateTemplate(template: EmailTemplate): Promise<boolean>;
}

// SMS provider configuration
export interface SMSProvider {
  name: string;
  sendSMS(sms: SMSMessage): Promise<SMSResult>;
  sendBulkSMS(messages: BulkSMSMessage): Promise<BulkSMSResult>;
}

// Push notification provider configuration
export interface PushProvider {
  name: string;
  sendPush(notification: PushMessage): Promise<PushResult>;
  sendBulkPush(notifications: BulkPushMessage): Promise<BulkPushResult>;
}

// Email message interface
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

// Bulk email message interface
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

// Email attachment interface
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
  contentId?: string;
}

// Email template interface
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

// Template variable interface
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object';
  required: boolean;
  defaultValue?: unknown;
  description?: string;
}

// Email result interface
export interface EmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Bulk email result interface
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

// SMS message interface
export interface SMSMessage {
  to: string;
  from?: string;
  body: string;
  statusCallback?: string;
  metadata?: Record<string, unknown>;
}

// Bulk SMS message interface
export interface BulkSMSMessage {
  messages: Array<{
    to: string;
    body: string;
    metadata?: Record<string, unknown>;
  }>;
  campaignId?: string;
}

// SMS result interface
export interface SMSResult {
  success: boolean;
  messageId?: string | null;
  provider: string;
  error?: string;
  cost?: number;
  metadata?: Record<string, unknown>;
}

// Bulk SMS result interface
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

// Push notification message interface
export interface PushMessage {
  to: string | string[];
  title: string;
  body: string;
  url?: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
  icon?: string;
  image?: string;
  badge?: string;
  sound?: string;
  priority?: 'normal' | 'high';
  ttl?: number;
  metadata?: Record<string, unknown>;
}

// Bulk push notification message interface
export interface BulkPushMessage {
  notifications: Array<{
    to: string | string[];
    title: string;
    body: string;
    data?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    icon?: string;
    url?: string;
    actionUrl?: string;
    priority?: "normal" | "high";
  }>;
  campaignId?: string;
}

// Push notification result interface
export interface PushResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Bulk push notification result interface
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

// User notification preferences
export interface NotificationPreferences {
  userId: string;
  email: {
    enabled: boolean;
    categories: Record<string, boolean>;
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    quietHours?: {
      start: string; // HH:mm
      end: string;   // HH:mm
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

// Notification categories
export const NotificationCategories = {
  AUTHENTICATION: 'authentication',
  SECURITY: 'security',
  BILLING: 'billing',
  SYSTEM: 'system',
  MARKETING: 'marketing',
  UPDATES: 'updates',
  REMINDERS: 'reminders',
  SOCIAL: 'social',
} as const;

// Email & Notification Service
export class EmailNotificationService {
  private emailProviders: Map<string, EmailProvider> = new Map();
  private smsProviders: Map<string, SMSProvider> = new Map();
  private pushProviders: Map<string, PushProvider> = new Map();
  private templates: Map<string, EmailTemplate> = new Map();
  private preferences: Map<string, NotificationPreferences> = new Map();

  constructor() {
    this.setupDefaultProviders();
    this.setupJobProcessors();
  }

  // Setup default providers
  private setupDefaultProviders(): void {
    // Add SendGrid as default email provider
    this.emailProviders.set('sendgrid', new SendGridProvider());
    
    // Add Twilio as default SMS provider
    this.smsProviders.set('twilio', new TwilioProvider());
    
    // Add Firebase as default push provider
    this.pushProviders.set('firebase', new FirebaseProvider());
  }

  // Setup job processors
  private setupJobProcessors(): void {
    // Email job processors
    queueSystem.registerProcessor(JobTypes.SEND_EMAIL, async (job) => {
      const { email, provider = 'sendgrid' } = job.data;
      return await this.sendEmail(email, provider);
    });

    queueSystem.registerProcessor(JobTypes.SEND_BULK_EMAIL, async (job) => {
      const { emails, provider = 'sendgrid' } = job.data;
      return await this.sendBulkEmail(emails, provider);
    });

    // SMS job processors
    queueSystem.registerProcessor(JobTypes.SEND_SMS_NOTIFICATION, async (job) => {
      const { sms, provider = 'twilio' } = job.data;
      return await this.sendSMS(sms, provider);
    });

    // Push notification job processors
    queueSystem.registerProcessor(JobTypes.SEND_PUSH_NOTIFICATION, async (job) => {
      const { notification, provider = 'firebase' } = job.data;
      return await this.sendPush(notification, provider);
    });
  }

  // Send email
  async sendEmail(email: EmailMessage, provider: string = 'sendgrid'): Promise<EmailResult> {
    const emailProvider = this.emailProviders.get(provider);
    if (!emailProvider) {
      throw new Error(`Email provider ${provider} not found`);
    }

    try {
      const result = await emailProvider.sendEmail(email);
      
      (logger as any).info({
        to: email.to,
        subject: email.subject,
        provider,
        messageId: result.messageId,
        success: result.success,
      }, 'Email sent');

      return result;
    } catch (error) {
      (logger as any).error({
        to: email.to,
        subject: email.subject,
        provider,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
      }, 'Failed to send email');

      throw new ExternalServiceError('Email', `Failed to send email: ${error}`, error);
    }
  }

  // Send bulk email
  async sendBulkEmail(bulkEmail: BulkEmailMessage, provider: string = 'sendgrid'): Promise<BulkEmailResult> {
    const emailProvider = this.emailProviders.get(provider);
    if (!emailProvider) {
      throw new Error(`Email provider ${provider} not found`);
    }

    try {
      const result = await emailProvider.sendBulkEmail(bulkEmail);
      
      (logger as any).info({
        campaignId: bulkEmail.campaignId,
        totalMessages: bulkEmail.messages.length,
        provider,
        summary: result.summary,
      }, 'Bulk email sent');

      return result;
    } catch (error) {
      (logger as any).error({
        campaignId: bulkEmail.campaignId,
        totalMessages: bulkEmail.messages.length,
        provider,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
      }, 'Failed to send bulk email');

      throw new ExternalServiceError('Email', `Failed to send bulk email: ${error}`, error);
    }
  }

  // Send SMS
  async sendSMS(sms: SMSMessage, provider: string = 'twilio'): Promise<SMSResult> {
    const smsProvider = this.smsProviders.get(provider);
    if (!smsProvider) {
      throw new Error(`SMS provider ${provider} not found`);
    }

    try {
      const result = await smsProvider.sendSMS(sms);
      
      (logger as any).info({
        to: sms.to,
        provider,
        messageId: result.messageId,
        success: result.success,
      }, 'SMS sent');

      return result;
    } catch (error) {
      (logger as any).error({
        to: sms.to,
        provider,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
      }, 'Failed to send SMS');

      throw new ExternalServiceError('SMS', `Failed to send SMS: ${error}`, error);
    }
  }

  // Send bulk SMS
  async sendBulkSMS(bulkSMS: BulkSMSMessage, provider: string = 'twilio'): Promise<BulkSMSResult> {
    const smsProvider = this.smsProviders.get(provider);
    if (!smsProvider) {
      throw new Error(`SMS provider ${provider} not found`);
    }

    try {
      const result = await smsProvider.sendBulkSMS(bulkSMS);
      
      (logger as any).info({
        campaignId: bulkSMS.campaignId,
        totalMessages: bulkSMS.messages.length,
        provider,
        summary: result.summary,
      }, 'Bulk SMS sent');

      return result;
    } catch (error) {
      (logger as any).error({
        campaignId: bulkSMS.campaignId,
        totalMessages: bulkSMS.messages.length,
        provider,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
      }, 'Failed to send bulk SMS');

      throw new ExternalServiceError('SMS', `Failed to send bulk SMS: ${error}`, error);
    }
  }

  // Send push notification
  async sendPush(notification: PushMessage, provider: string = 'firebase'): Promise<PushResult> {
    const pushProvider = this.pushProviders.get(provider);
    if (!pushProvider) {
      throw new Error(`Push provider ${provider} not found`);
    }

    try {
      const result = await pushProvider.sendPush(notification);
      
      (logger as any).info({
        to: notification.to,
        title: notification.title,
        provider,
        messageId: result.messageId,
        success: result.success,
      }, 'Push notification sent');

      return result;
    } catch (error) {
      (logger as any).error({
        to: notification.to,
        title: notification.title,
        provider,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
      }, 'Failed to send push notification');

      throw new ExternalServiceError('Push', `Failed to send push notification: ${error}`, error);
    }
  }

  // Send bulk push notifications
  async sendBulkPush(bulkPush: BulkPushMessage, provider: string = 'firebase'): Promise<BulkPushResult> {
    const pushProvider = this.pushProviders.get(provider);
    if (!pushProvider) {
      throw new Error(`Push provider ${provider} not found`);
    }

    try {
      const result = await pushProvider.sendBulkPush(bulkPush);
      
      (logger as any).info({
        campaignId: bulkPush.campaignId,
        totalNotifications: bulkPush.notifications.length,
        provider,
        summary: result.summary,
      }, 'Bulk push notifications sent');

      return result;
    } catch (error) {
      (logger as any).error({
        campaignId: bulkPush.campaignId,
        totalNotifications: bulkPush.notifications.length,
        provider,
        error: error instanceof Error ? toErrorMessage(error) : 'Unknown error',
      }, 'Failed to send bulk push notifications');

      throw new ExternalServiceError('Push', `Failed to send bulk push notifications: ${error}`, error);
    }
  }

  // Send email with template
  async sendEmailWithTemplate(
    templateId: string,
    to: string | string[],
    variables: Record<string, unknown>,
    options: {
      provider?: string;
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: EmailAttachment[];
    } = {}
  ): Promise<EmailResult> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    // Validate required variables
    for (const variable of template.variables) {
      if (variable.required && !variables[variable.name] && !variable.defaultValue) {
        throw new Error(`Required template variable ${variable.name} is missing`);
      }
    }

    // Render template
    const subject = this.renderTemplate(template.subject, variables);
    const html = this.renderTemplate(template.htmlTemplate, variables);
    const text = template.textTemplate ? this.renderTemplate(template.textTemplate, variables) : undefined;

    const email: EmailMessage = {
      to,
      subject,
      html,
      text,
      cc: options.cc,
      bcc: options.bcc,
      attachments: options.attachments,
      metadata: { templateId, variables },
    };

    return await this.sendEmail(email, options.provider);
  }

  // Render template with variables
  private renderTemplate(template: string, variables: Record<string, unknown>): string {
    let rendered = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    return rendered;
  }

  // Add email template
  addTemplate(template: EmailTemplate): void {
    this.templates.set(template.id, template);
    (logger as any).info({ templateId: template.id, name: template.name }, 'Email template added');
  }

  // Get user notification preferences
  getUserPreferences(userId: string): NotificationPreferences | null {
    return this.preferences.get(userId) || null;
  }

  // Update user notification preferences
  updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): void {
    const existing = this.preferences.get(userId) || {
      userId,
      email: { enabled: true, categories: {}, frequency: 'immediate' },
      sms: { enabled: true, categories: {} },
      push: { enabled: true, categories: {} },
    };

    const updated = {
      ...existing,
      ...preferences,
      email: { ...existing.email, ...preferences.email },
      sms: { ...existing.sms, ...preferences.sms },
      push: { ...existing.push, ...preferences.push },
    };

    this.preferences.set(userId, updated);
    (logger as any).info({ userId }, 'User notification preferences updated');
  }

  // Check if user should receive notification
  shouldReceiveNotification(
    userId: string,
    category: string,
    type: 'email' | 'sms' | 'push'
  ): boolean {
    const preferences = this.preferences.get(userId);
    if (!preferences) {
      return true; // Default to enabled if no preferences set
    }

    const typePreferences = preferences[type];
    if (!typePreferences.enabled) {
      return false;
    }

    return typePreferences.categories[category] !== false;
  }

  // Check if user is in quiet hours
  isInQuietHours(userId: string, type: 'email' | 'sms' | 'push'): boolean {
    const preferences = this.preferences.get(userId);
    if (!preferences || !preferences[type].quietHours) {
      return false;
    }

    const quietHours = preferences[type].quietHours!;
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    return currentTime >= quietHours.start && currentTime <= quietHours.end;
  }

  // Send notification based on user preferences
  async sendNotification(
    userId: string,
    category: string,
    content: {
      email?: EmailMessage;
      sms?: SMSMessage;
      push?: PushMessage;
    },
    options: {
      respectQuietHours?: boolean;
      fallbackProviders?: Record<string, string>;
    } = {}
  ): Promise<{
    email?: EmailResult;
    sms?: SMSResult;
    push?: PushResult;
  }> {
    const results: any = {};
    const respectQuietHours = options.respectQuietHours ?? true;

    // Email
    if (content.email && this.shouldReceiveNotification(userId, category, 'email')) {
      if (!respectQuietHours || !this.isInQuietHours(userId, 'email')) {
        const provider = options.fallbackProviders?.email || 'sendgrid';
        results.email = await this.sendEmail(content.email, provider);
      }
    }

    // SMS
    if (content.sms && this.shouldReceiveNotification(userId, category, 'sms')) {
      if (!respectQuietHours || !this.isInQuietHours(userId, 'sms')) {
        const provider = options.fallbackProviders?.sms || 'twilio';
        results.sms = await this.sendSMS(content.sms, provider);
      }
    }

    // Push
    if (content.push && this.shouldReceiveNotification(userId, category, 'push')) {
      if (!respectQuietHours || !this.isInQuietHours(userId, 'push')) {
        const provider = options.fallbackProviders?.push || 'firebase';
        results.push = await this.sendPush(content.push, provider);
      }
    }

    return results;
  }
}

// Provider implementations (placeholders for actual integrations)

// SendGrid provider
class SendGridProvider implements EmailProvider {
  name = 'sendgrid';
  private sendgridClient: any;
  private fromEmail: string;

  constructor() {
    const apiKey = process.env.SENDGRID_API_KEY;
    this.fromEmail = process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || 'noreply@guardrail.io';

    if (!apiKey) {
      (logger as any).warn('SendGrid API key not configured. Email sending will fail. Set SENDGRID_API_KEY environment variable.');
      return;
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(apiKey);
      this.sendgridClient = sgMail;
      (logger as any).info({ fromEmail: this.fromEmail }, 'SendGrid provider initialized');
    } catch (error: unknown) {
      (logger as any).error({ error: toErrorMessage(error) }, 'Failed to initialize SendGrid client. Make sure @sendgrid/mail is installed.');
      throw new Error('SendGrid client initialization failed');
    }
  }

  async sendEmail(email: EmailMessage): Promise<EmailResult> {
    if (!this.sendgridClient) {
      const error = 'SendGrid API key not configured';
      (logger as any).error({ to: email.to, subject: email.subject }, error);
      throw new Error(error);
    }

    try {
      const msg = {
        to: Array.isArray(email.to) ? email.to : [email.to],
        from: email.from || this.fromEmail,
        subject: email.subject,
        text: email.text,
        html: email.html,
        cc: email.cc ? (Array.isArray(email.cc) ? email.cc : [email.cc]) : undefined,
        bcc: email.bcc ? (Array.isArray(email.bcc) ? email.bcc : [email.bcc]) : undefined,
        replyTo: email.replyTo,
        attachments: email.attachments?.map(att => ({
          content: typeof att.content === 'string' ? att.content : att.content.toString('base64'),
          filename: att.filename,
          type: att.contentType,
          contentId: att.contentId,
          disposition: 'attachment',
        })),
        headers: email.headers,
        customArgs: email.metadata,
      };

      const [response] = await this.sendgridClient.send(msg);
      
      (logger as any).info({ 
        to: email.to, 
        subject: email.subject, 
        statusCode: response.statusCode,
        messageId: response.headers['x-message-id'] 
      }, 'Email sent via SendGrid');

      return {
        success: true,
        messageId: response.headers['x-message-id'] || `sg_${Date.now()}`,
        provider: this.name,
        metadata: {
          statusCode: response.statusCode,
          headers: response.headers,
        },
      };
    } catch (error: unknown) {
      const err = error as { response?: { body?: unknown } };
      (logger as any).error(
        "SendGrid email send failed",
        {
          to: email.to,
          subject: email.subject,
          error: toErrorMessage(error),
          response: err.response?.body,
        },
      );

      return {
        success: false,
        provider: this.name,
        error: toErrorMessage(error) || "Failed to send email",
        metadata: {
          response: err.response?.body,
        },
      };
    }
  }

  async sendBulkEmail(bulkEmail: BulkEmailMessage): Promise<BulkEmailResult> {
    if (!this.sendgridClient) {
      const error = 'SendGrid API key not configured';
      (logger as any).error({ campaignId: bulkEmail.campaignId }, error);
      throw new Error(error);
    }

    const results: EmailResult[] = [];
    let sent = 0;
    let failed = 0;

    // SendGrid doesn't have a true bulk API, so we send individually
    // In production, consider using SendGrid's Marketing Campaigns API for true bulk
    for (const message of bulkEmail.messages) {
      try {
        const result = await this.sendEmail({
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          metadata: message.metadata,
        });
        results.push(result);
        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error: unknown) {
        results.push({
          success: false,
          provider: this.name,
          error: toErrorMessage(error),
        });
        failed++;
      }
    }

    return {
      success: failed === 0,
      campaignId: bulkEmail.campaignId,
      results,
      summary: {
        total: bulkEmail.messages.length,
        sent,
        failed,
        skipped: 0,
      },
    };
  }

  async validateTemplate(template: EmailTemplate): Promise<boolean> {
    // Basic validation - check required fields
    if (!template.id || !template.name || !template.subject || !template.htmlTemplate) {
      return false;
    }
    
    // Check for required variables in template
    const requiredVars = template.variables.filter(v => v.required && !v.defaultValue);
    const hasAllRequired = requiredVars.length === 0 || requiredVars.every(v => 
      template.htmlTemplate.includes(`{{${v.name}}}`) || template.htmlTemplate.includes(`{{ ${v.name} }}`)
    );
    
    return hasAllRequired;
  }
}

// Twilio provider
class TwilioProvider implements SMSProvider {
  name = 'twilio';
  private twilioClient: any;
  private fromNumber: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.SMS_FROM || '+1234567890';

    if (!accountSid || !authToken) {
      (logger as any).warn('Twilio credentials not configured. SMS sending will fail. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
      return;
    }

    try {
      const twilio = require('twilio');
      this.twilioClient = twilio(accountSid, authToken);
      (logger as any).info({ fromNumber: this.fromNumber }, 'Twilio provider initialized');
    } catch (error: unknown) {
      (logger as any).error({ error: toErrorMessage(error) }, 'Failed to initialize Twilio client. Make sure twilio is installed.');
      throw new Error('Twilio client initialization failed');
    }
  }

  async sendSMS(sms: SMSMessage): Promise<SMSResult> {
    if (!this.twilioClient) {
      const error = 'Twilio credentials not configured';
      (logger as any).error({ to: sms.to, body: sms.body.substring(0, 50) }, error);
      throw new Error(error);
    }

    try {
      const message = await this.twilioClient.messages.create({
        body: sms.body,
        from: sms.from || this.fromNumber,
        to: sms.to,
        statusCallback: sms.statusCallback,
      });

      (logger as any).info({
        to: sms.to,
        messageId: message.sid,
        status: message.status,
        cost: message.price ? parseFloat(message.price) : undefined
      }, 'SMS sent via Twilio');

      return {
        success: true,
        messageId: message.sid,
        cost: message.price ? parseFloat(message.price) : undefined,
        provider: this.name,
      };
    } catch (error: unknown) {
      const err = error as { code?: unknown; status?: unknown };
      (logger as any).error({
        error: toErrorMessage(error),
        to: sms.to,
        code: err.code,
        status: err.status
      }, 'Twilio SMS send failed');

      return {
        success: false,
        messageId: null,
        cost: 0,
        error: toErrorMessage(error),
        provider: this.name,
      };
    }
  }

  async sendBulkSMS(bulkSMS: BulkSMSMessage): Promise<BulkSMSResult> {
    if (!this.twilioClient) {
      const error = 'Twilio credentials not configured';
      (logger as any).error({ campaignId: bulkSMS.campaignId }, error);
      throw new Error(error);
    }

    const results: SMSResult[] = [];

    for (const message of bulkSMS.messages) {
      try {
        const result = await this.sendSMS(message);
        results.push(result);
      } catch (error: unknown) {
        results.push({
          success: false,
          messageId: null,
          cost: 0,
          error: toErrorMessage(error),
          provider: this.name,
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);

    (logger as any).info({
      campaignId: bulkSMS.campaignId,
      total: results.length,
      successful,
      failed: results.length - successful,
      totalCost
    }, 'Bulk SMS campaign completed');

    return {
      success: true,
      campaignId: bulkSMS.campaignId,
      results,
      summary: {
        total: results.length,
        sent: successful,
        failed: results.length - successful,
        skipped: 0,
      },
    };
  }
}

// Firebase provider
class FirebaseProvider implements PushProvider {
  name = 'firebase';

  async sendPush(notification: PushMessage): Promise<PushResult> {
    try {
      const firebaseServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
      
      if (!firebaseServerKey) {
        logger.warn('Firebase Cloud Messaging server key not configured, skipping push notification');
        return {
          success: false,
          error: 'Firebase server key not configured',
          provider: this.name,
        };
      }

      const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
      
      const payload = {
        to: notification.to, // FCM registration token
        notification: {
          title: notification.title,
          body: notification.body || notification.title,
          icon: notification.icon || '/icon-192x192.png',
          click_action: notification.url || notification.actionUrl,
        },
        data: {
          ...notification.data,
          url: notification.url || notification.actionUrl,
          timestamp: new Date().toISOString(),
        },
        priority: notification.priority || 'high',
      };

      const response = await fetch(fcmEndpoint, {
        method: 'POST',
        headers: {
          'Authorization': `key=${firebaseServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("Firebase push notification failed", {
          error: errorText,
          status: response.status,
        });
        return {
          success: false,
          error: `FCM API error: ${response.status} ${errorText}`,
          provider: this.name,
        };
      }

      const result = (await response.json()) as Record<string, unknown>;
      const successCount = typeof result.success === "number" ? result.success : 0;
      const failureCount = typeof result.failure === "number" ? result.failure : 0;

      if (failureCount > 0) {
        logger.warn("Firebase push notification partially failed", {
          result: JSON.stringify(result),
        });
      }

      logger.info("Firebase push notification sent", {
        messageId: result.message_id,
        success: successCount,
        failure: failureCount,
      });

      return {
        success: successCount > 0,
        messageId:
          (typeof result.message_id === "string" ? result.message_id : undefined) ||
          `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        provider: this.name,
        metadata: {
          successCount,
          failureCount,
          results: result.results,
        },
      };
    } catch (error: unknown) {
      logger.error("Firebase push notification error", {
        error: toErrorMessage(error),
      });
      return {
        success: false,
        error: toErrorMessage(error) || 'Firebase push notification failed',
        provider: this.name,
      };
    }
  }

  async sendBulkPush(bulkPush: BulkPushMessage): Promise<BulkPushResult> {
    try {
      const firebaseServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
      
      if (!firebaseServerKey) {
        logger.warn('Firebase Cloud Messaging server key not configured, skipping bulk push');
        const n = bulkPush.notifications.length;
        return {
          success: false,
          campaignId: bulkPush.campaignId,
          results: bulkPush.notifications.map(() => ({
            success: false,
            error: 'Firebase server key not configured',
            provider: this.name,
          })),
          summary: { total: n, sent: 0, failed: n, skipped: 0 },
        };
      }

      const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
      const results: Array<{ success: boolean; messageId?: string; error?: string; provider: string }> = [];

      // Send notifications in parallel (with rate limiting consideration)
      const sendPromises = bulkPush.notifications.map(async (notification) => {
        try {
          const payload = {
            to: notification.to,
            notification: {
              title: notification.title,
              body: notification.body || notification.title,
              icon: notification.icon || '/icon-192x192.png',
              click_action: notification.url || notification.actionUrl,
            },
            data: {
              ...notification.data,
              url: notification.url || notification.actionUrl,
              timestamp: new Date().toISOString(),
            },
            priority: notification.priority || 'high',
          };

          const response = await fetch(fcmEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': `key=${firebaseServerKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorText = await response.text();
            return {
              success: false,
              error: `FCM API error: ${response.status}`,
              provider: this.name,
            };
          }

          const result = (await response.json()) as Record<string, unknown>;
          const ok = typeof result.success === "number" ? result.success : 0;
          return {
            success: ok > 0,
            messageId:
              (typeof result.message_id === "string" ? result.message_id : undefined) ||
              `fb_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            provider: this.name,
          };
        } catch (error: unknown) {
          return {
            success: false,
            error: toErrorMessage(error) || 'Firebase push notification failed',
            provider: this.name,
          };
        }
      });

      const pushResults = await Promise.all(sendPromises);
      results.push(...pushResults);

      const successCount = results.filter(r => r.success).length;
      logger.info("Firebase bulk push completed", {
        campaignId: bulkPush.campaignId,
        successCount,
        total: results.length,
      });

      return {
        success: successCount > 0,
        campaignId: bulkPush.campaignId,
        results,
        summary: {
          total: bulkPush.notifications.length,
          sent: bulkPush.notifications.length,
          failed: 0,
          skipped: 0,
        },
      };
    } catch (error: unknown) {
      logger.error("Bulk push notification failed", {
        error: toErrorMessage(error),
        campaignId: bulkPush.campaignId,
      });
      return {
        success: false,
        campaignId: bulkPush.campaignId,
        results: bulkPush.notifications.map(() => ({
          success: false,
          error: toErrorMessage(error) || 'Bulk push notification failed',
          provider: this.name,
        })),
        summary: {
          total: bulkPush.notifications.length,
          sent: 0,
          failed: bulkPush.notifications.length,
          skipped: 0,
        },
      };
    }
  }
}

// Export singleton
export const emailNotificationService = new EmailNotificationService();
