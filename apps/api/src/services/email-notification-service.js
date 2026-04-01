"use strict";
/**
 * Comprehensive Email & Notifications Service
 * Handles email sending, templates, SMS, push notifications, and user preferences
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailNotificationService = exports.EmailNotificationService = exports.NotificationCategories = void 0;
const enhanced_logger_1 = require("../lib/enhanced-logger");
const enhanced_queue_1 = require("../lib/enhanced-queue");
const enhanced_error_handler_1 = require("../middleware/enhanced-error-handler");
// Notification categories
exports.NotificationCategories = {
    AUTHENTICATION: 'authentication',
    SECURITY: 'security',
    BILLING: 'billing',
    SYSTEM: 'system',
    MARKETING: 'marketing',
    UPDATES: 'updates',
    REMINDERS: 'reminders',
    SOCIAL: 'social',
};
// Email & Notification Service
class EmailNotificationService {
    emailProviders = new Map();
    smsProviders = new Map();
    pushProviders = new Map();
    templates = new Map();
    preferences = new Map();
    constructor() {
        this.setupDefaultProviders();
        this.setupJobProcessors();
    }
    // Setup default providers
    setupDefaultProviders() {
        // Add SendGrid as default email provider
        this.emailProviders.set('sendgrid', new SendGridProvider());
        // Add Twilio as default SMS provider
        this.smsProviders.set('twilio', new TwilioProvider());
        // Add Firebase as default push provider
        this.pushProviders.set('firebase', new FirebaseProvider());
    }
    // Setup job processors
    setupJobProcessors() {
        // Email job processors
        enhanced_queue_1.queueSystem.registerProcessor(enhanced_queue_1.JobTypes.SEND_EMAIL, async (job) => {
            const { email, provider = 'sendgrid' } = job.data;
            return await this.sendEmail(email, provider);
        });
        enhanced_queue_1.queueSystem.registerProcessor(enhanced_queue_1.JobTypes.SEND_BULK_EMAIL, async (job) => {
            const { emails, provider = 'sendgrid' } = job.data;
            return await this.sendBulkEmail(emails, provider);
        });
        // SMS job processors
        enhanced_queue_1.queueSystem.registerProcessor(enhanced_queue_1.JobTypes.SEND_SMS_NOTIFICATION, async (job) => {
            const { sms, provider = 'twilio' } = job.data;
            return await this.sendSMS(sms, provider);
        });
        // Push notification job processors
        enhanced_queue_1.queueSystem.registerProcessor(enhanced_queue_1.JobTypes.SEND_PUSH_NOTIFICATION, async (job) => {
            const { notification, provider = 'firebase' } = job.data;
            return await this.sendPush(notification, provider);
        });
    }
    // Send email
    async sendEmail(email, provider = 'sendgrid') {
        const emailProvider = this.emailProviders.get(provider);
        if (!emailProvider) {
            throw new Error(`Email provider ${provider} not found`);
        }
        try {
            const result = await emailProvider.sendEmail(email);
            enhanced_logger_1.logger.info({
                to: email.to,
                subject: email.subject,
                provider,
                messageId: result.messageId,
                success: result.success,
            }, 'Email sent');
            return result;
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                to: email.to,
                subject: email.subject,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to send email');
            throw new enhanced_error_handler_1.ExternalServiceError('Email', `Failed to send email: ${error}`, error);
        }
    }
    // Send bulk email
    async sendBulkEmail(bulkEmail, provider = 'sendgrid') {
        const emailProvider = this.emailProviders.get(provider);
        if (!emailProvider) {
            throw new Error(`Email provider ${provider} not found`);
        }
        try {
            const result = await emailProvider.sendBulkEmail(bulkEmail);
            enhanced_logger_1.logger.info({
                campaignId: bulkEmail.campaignId,
                totalMessages: bulkEmail.messages.length,
                provider,
                summary: result.summary,
            }, 'Bulk email sent');
            return result;
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                campaignId: bulkEmail.campaignId,
                totalMessages: bulkEmail.messages.length,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to send bulk email');
            throw new enhanced_error_handler_1.ExternalServiceError('Email', `Failed to send bulk email: ${error}`, error);
        }
    }
    // Send SMS
    async sendSMS(sms, provider = 'twilio') {
        const smsProvider = this.smsProviders.get(provider);
        if (!smsProvider) {
            throw new Error(`SMS provider ${provider} not found`);
        }
        try {
            const result = await smsProvider.sendSMS(sms);
            enhanced_logger_1.logger.info({
                to: sms.to,
                provider,
                messageId: result.messageId,
                success: result.success,
            }, 'SMS sent');
            return result;
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                to: sms.to,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to send SMS');
            throw new enhanced_error_handler_1.ExternalServiceError('SMS', `Failed to send SMS: ${error}`, error);
        }
    }
    // Send bulk SMS
    async sendBulkSMS(bulkSMS, provider = 'twilio') {
        const smsProvider = this.smsProviders.get(provider);
        if (!smsProvider) {
            throw new Error(`SMS provider ${provider} not found`);
        }
        try {
            const result = await smsProvider.sendBulkSMS(bulkSMS);
            enhanced_logger_1.logger.info({
                campaignId: bulkSMS.campaignId,
                totalMessages: bulkSMS.messages.length,
                provider,
                summary: result.summary,
            }, 'Bulk SMS sent');
            return result;
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                campaignId: bulkSMS.campaignId,
                totalMessages: bulkSMS.messages.length,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to send bulk SMS');
            throw new enhanced_error_handler_1.ExternalServiceError('SMS', `Failed to send bulk SMS: ${error}`, error);
        }
    }
    // Send push notification
    async sendPush(notification, provider = 'firebase') {
        const pushProvider = this.pushProviders.get(provider);
        if (!pushProvider) {
            throw new Error(`Push provider ${provider} not found`);
        }
        try {
            const result = await pushProvider.sendPush(notification);
            enhanced_logger_1.logger.info({
                to: notification.to,
                title: notification.title,
                provider,
                messageId: result.messageId,
                success: result.success,
            }, 'Push notification sent');
            return result;
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                to: notification.to,
                title: notification.title,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to send push notification');
            throw new enhanced_error_handler_1.ExternalServiceError('Push', `Failed to send push notification: ${error}`, error);
        }
    }
    // Send bulk push notifications
    async sendBulkPush(bulkPush, provider = 'firebase') {
        const pushProvider = this.pushProviders.get(provider);
        if (!pushProvider) {
            throw new Error(`Push provider ${provider} not found`);
        }
        try {
            const result = await pushProvider.sendBulkPush(bulkPush);
            enhanced_logger_1.logger.info({
                campaignId: bulkPush.campaignId,
                totalNotifications: bulkPush.notifications.length,
                provider,
                summary: result.summary,
            }, 'Bulk push notifications sent');
            return result;
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                campaignId: bulkPush.campaignId,
                totalNotifications: bulkPush.notifications.length,
                provider,
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Failed to send bulk push notifications');
            throw new enhanced_error_handler_1.ExternalServiceError('Push', `Failed to send bulk push notifications: ${error}`, error);
        }
    }
    // Send email with template
    async sendEmailWithTemplate(templateId, to, variables, options = {}) {
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
        const email = {
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
    renderTemplate(template, variables) {
        let rendered = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            rendered = rendered.replace(regex, String(value));
        }
        return rendered;
    }
    // Add email template
    addTemplate(template) {
        this.templates.set(template.id, template);
        enhanced_logger_1.logger.info({ templateId: template.id, name: template.name }, 'Email template added');
    }
    // Get user notification preferences
    getUserPreferences(userId) {
        return this.preferences.get(userId) || null;
    }
    // Update user notification preferences
    updateUserPreferences(userId, preferences) {
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
        enhanced_logger_1.logger.info({ userId }, 'User notification preferences updated');
    }
    // Check if user should receive notification
    shouldReceiveNotification(userId, category, type) {
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
    isInQuietHours(userId, type) {
        const preferences = this.preferences.get(userId);
        if (!preferences || !preferences[type].quietHours) {
            return false;
        }
        const quietHours = preferences[type].quietHours;
        const now = new Date();
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        return currentTime >= quietHours.start && currentTime <= quietHours.end;
    }
    // Send notification based on user preferences
    async sendNotification(userId, category, content, options = {}) {
        const results = {};
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
exports.EmailNotificationService = EmailNotificationService;
// Provider implementations (placeholders for actual integrations)
// SendGrid provider
class SendGridProvider {
    name = 'sendgrid';
    sendgridClient;
    fromEmail;
    constructor() {
        const apiKey = process.env.SENDGRID_API_KEY;
        this.fromEmail = process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL || 'noreply@guardrail.io';
        if (!apiKey) {
            enhanced_logger_1.logger.warn('SendGrid API key not configured. Email sending will fail. Set SENDGRID_API_KEY environment variable.');
            return;
        }
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(apiKey);
            this.sendgridClient = sgMail;
            enhanced_logger_1.logger.info({ fromEmail: this.fromEmail }, 'SendGrid provider initialized');
        }
        catch (error) {
            enhanced_logger_1.logger.error({ error: error.message }, 'Failed to initialize SendGrid client. Make sure @sendgrid/mail is installed.');
            throw new Error('SendGrid client initialization failed');
        }
    }
    async sendEmail(email) {
        if (!this.sendgridClient) {
            const error = 'SendGrid API key not configured';
            enhanced_logger_1.logger.error({ to: email.to, subject: email.subject }, error);
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
            enhanced_logger_1.logger.info({
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
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                to: email.to,
                subject: email.subject,
                error: error.message,
                response: error.response?.body
            }, 'SendGrid email send failed');
            return {
                success: false,
                provider: this.name,
                error: error.message || 'Failed to send email',
                metadata: {
                    response: error.response?.body,
                },
            };
        }
    }
    async sendBulkEmail(bulkEmail) {
        if (!this.sendgridClient) {
            const error = 'SendGrid API key not configured';
            enhanced_logger_1.logger.error({ campaignId: bulkEmail.campaignId }, error);
            throw new Error(error);
        }
        const results = [];
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
                }
                else {
                    failed++;
                }
            }
            catch (error) {
                results.push({
                    success: false,
                    provider: this.name,
                    error: error.message,
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
    async validateTemplate(template) {
        // Basic validation - check required fields
        if (!template.id || !template.name || !template.subject || !template.htmlTemplate) {
            return false;
        }
        // Check for required variables in template
        const requiredVars = template.variables.filter(v => v.required && !v.defaultValue);
        const hasAllRequired = requiredVars.length === 0 || requiredVars.every(v => template.htmlTemplate.includes(`{{${v.name}}}`) || template.htmlTemplate.includes(`{{ ${v.name} }}`));
        return hasAllRequired;
    }
}
// Twilio provider
class TwilioProvider {
    name = 'twilio';
    twilioClient;
    fromNumber;
    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        this.fromNumber = process.env.TWILIO_FROM_NUMBER || process.env.SMS_FROM || '+1234567890';
        if (!accountSid || !authToken) {
            enhanced_logger_1.logger.warn('Twilio credentials not configured. SMS sending will fail. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN environment variables.');
            return;
        }
        try {
            const twilio = require('twilio');
            this.twilioClient = twilio(accountSid, authToken);
            enhanced_logger_1.logger.info({ fromNumber: this.fromNumber }, 'Twilio provider initialized');
        }
        catch (error) {
            enhanced_logger_1.logger.error({ error: error.message }, 'Failed to initialize Twilio client. Make sure twilio is installed.');
            throw new Error('Twilio client initialization failed');
        }
    }
    async sendSMS(sms) {
        if (!this.twilioClient) {
            const error = 'Twilio credentials not configured';
            enhanced_logger_1.logger.error({ to: sms.to, body: sms.body.substring(0, 50) }, error);
            throw new Error(error);
        }
        try {
            const message = await this.twilioClient.messages.create({
                body: sms.body,
                from: sms.from || this.fromNumber,
                to: sms.to,
                statusCallback: sms.statusCallback,
            });
            enhanced_logger_1.logger.info({
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
        }
        catch (error) {
            enhanced_logger_1.logger.error({
                error: error.message,
                to: sms.to,
                code: error.code,
                status: error.status
            }, 'Twilio SMS send failed');
            return {
                success: false,
                messageId: null,
                cost: 0,
                error: error.message,
                provider: this.name,
            };
        }
    }
    async sendBulkSMS(bulkSMS) {
        if (!this.twilioClient) {
            const error = 'Twilio credentials not configured';
            enhanced_logger_1.logger.error({ campaignId: bulkSMS.campaignId }, error);
            throw new Error(error);
        }
        const results = [];
        for (const message of bulkSMS.messages) {
            try {
                const result = await this.sendSMS(message);
                results.push(result);
            }
            catch (error) {
                results.push({
                    success: false,
                    messageId: null,
                    cost: 0,
                    error: error.message,
                    provider: this.name,
                });
            }
        }
        const successful = results.filter(r => r.success).length;
        const totalCost = results.reduce((sum, r) => sum + (r.cost || 0), 0);
        enhanced_logger_1.logger.info({
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
class FirebaseProvider {
    name = 'firebase';
    async sendPush(notification) {
        try {
            const firebaseServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
            if (!firebaseServerKey) {
                enhanced_logger_1.logger.warn('Firebase Cloud Messaging server key not configured, skipping push notification');
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
                enhanced_logger_1.logger.error({ error: errorText, status: response.status }, 'Firebase push notification failed');
                return {
                    success: false,
                    error: `FCM API error: ${response.status} ${errorText}`,
                    provider: this.name,
                };
            }
            const result = await response.json();
            if (result.failure > 0) {
                enhanced_logger_1.logger.warn({ result }, 'Firebase push notification partially failed');
            }
            enhanced_logger_1.logger.info({ messageId: result.message_id, success: result.success, failure: result.failure }, 'Firebase push notification sent');
            return {
                success: result.success > 0,
                messageId: result.message_id || `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                provider: this.name,
                metadata: {
                    successCount: result.success,
                    failureCount: result.failure,
                    results: result.results,
                },
            };
        }
        catch (error) {
            enhanced_logger_1.logger.error({ error: error.message }, 'Firebase push notification error');
            return {
                success: false,
                error: error.message || 'Firebase push notification failed',
                provider: this.name,
            };
        }
    }
    async sendBulkPush(bulkPush) {
        try {
            const firebaseServerKey = process.env.FIREBASE_SERVER_KEY || process.env.FCM_SERVER_KEY;
            if (!firebaseServerKey) {
                enhanced_logger_1.logger.warn('Firebase Cloud Messaging server key not configured, skipping bulk push');
                return {
                    success: false,
                    campaignId: bulkPush.campaignId,
                    results: bulkPush.notifications.map(() => ({
                        success: false,
                        error: 'Firebase server key not configured',
                        provider: this.name,
                    })),
                };
            }
            const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send';
            const results = [];
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
                    const result = await response.json();
                    return {
                        success: result.success > 0,
                        messageId: result.message_id || `fb_bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        provider: this.name,
                    };
                }
                catch (error) {
                    return {
                        success: false,
                        error: error.message || 'Firebase push notification failed',
                        provider: this.name,
                    };
                }
            });
            const pushResults = await Promise.all(sendPromises);
            results.push(...pushResults);
            const successCount = results.filter(r => r.success).length;
            enhanced_logger_1.logger.info({ campaignId: bulkPush.campaignId, successCount, total: results.length }, 'Firebase bulk push completed');
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
        }
        catch (error) {
            enhanced_logger_1.logger.error({ error: error.message, campaignId: bulkPush.campaignId }, 'Bulk push notification failed');
            return {
                success: false,
                campaignId: bulkPush.campaignId,
                results: bulkPush.notifications.map(() => ({
                    success: false,
                    error: error.message || 'Bulk push notification failed',
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
exports.emailNotificationService = new EmailNotificationService();
