/**
 * Email Utility
 * 
 * Essential email sending that AI agents often miss
 * Handles verification, password reset, notifications
 */

import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    this.transporter = nodemailer.createTransport(smtpConfig);
    return this.transporter;
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!process.env.SMTP_HOST) {
      console.warn('SMTP not configured, email not sent:', options);
      return;
    }

    const transporter = this.getTransporter();

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@example.com',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    });
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
    
    await this.sendEmail({
      to: email,
      subject: 'Verify your email address',
      html: `
        <h1>Verify your email</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    
    await this.sendEmail({
      to: email,
      subject: 'Reset your password',
      html: `
        <h1>Reset your password</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Welcome!',
      html: `
        <h1>Welcome, ${name}!</h1>
        <p>Thank you for joining us!</p>
      `,
    });
  }
}

export const emailService = new EmailService();

