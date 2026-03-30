import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the email/SMS SDKs
vi.mock('@sendgrid/mail', () => ({
  setApiKey: vi.fn(),
  send: vi.fn(),
}));

vi.mock('twilio', () => {
  return vi.fn(() => ({
    messages: {
      create: vi.fn(),
    },
  }));
});

describe('EmailNotificationService', () => {
  describe('SendGrid Provider', () => {
    it('should initialize with valid API key', () => {
      process.env.SENDGRID_API_KEY = 'test-key';
      process.env.SENDGRID_FROM_EMAIL = 'test@example.com';

      const { SendGridProvider } = require('../email-notification-service');
      expect(() => new SendGridProvider()).not.toThrow();
    });

    it('should warn when API key is missing', () => {
      delete process.env.SENDGRID_API_KEY;

      const { SendGridProvider } = require('../email-notification-service');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new SendGridProvider();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('SendGrid API key not configured')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Twilio Provider', () => {
    it('should initialize with valid credentials', () => {
      process.env.TWILIO_ACCOUNT_SID = 'test-sid';
      process.env.TWILIO_AUTH_TOKEN = 'test-token';
      process.env.TWILIO_FROM_NUMBER = '+1234567890';

      const { TwilioProvider } = require('../email-notification-service');
      expect(() => new TwilioProvider()).not.toThrow();
    });

    it('should warn when credentials are missing', () => {
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      const { TwilioProvider } = require('../email-notification-service');
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      new TwilioProvider();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Twilio credentials not configured')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('EmailNotificationService', () => {
    let service: any;

    beforeEach(() => {
      const { EmailNotificationService } = require('../email-notification-service');
      service = new EmailNotificationService();
    });

    it('should have SendGrid and Twilio providers registered', () => {
      expect(service.emailProviders.has('sendgrid')).toBe(true);
      expect(service.smsProviders.has('twilio')).toBe(true);
      expect(service.pushProviders.has('firebase')).toBe(true);
    });

    it('should send email through SendGrid provider', async () => {
      const email = {
        to: 'test@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
      };

      // Mock the send method
      const mockSend = vi.fn().mockResolvedValue([{ statusCode: 202 }]);
      const sgMail = require('@sendgrid/mail');
      sgMail.send = mockSend;

      const result = await service.sendEmail(email);

      expect(result.success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['test@example.com'],
          subject: 'Test Email',
          text: 'This is a test email',
        })
      );
    });

    it('should send SMS through Twilio provider', async () => {
      const sms = {
        to: '+1234567890',
        body: 'Test SMS message',
      };

      // Mock the Twilio client
      const mockCreate = vi.fn().mockResolvedValue({
        sid: 'SM1234567890',
        status: 'sent',
        price: '0.01',
      });

      const twilio = require('twilio');
      const mockClient = twilio();
      mockClient.messages.create = mockCreate;

      const result = await service.sendSMS(sms);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Test SMS message',
          to: '+1234567890',
        })
      );
    });
  });
});