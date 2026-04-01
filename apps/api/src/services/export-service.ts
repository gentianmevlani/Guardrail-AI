/**
 * Export Service
 * 
 * Handles exporting data in various formats:
 * - CSV: Spreadsheet-compatible format
 * - JSON: Raw data format
 * - PDF: Human-readable reports (using PDFKit or Puppeteer)
 */

import { prisma } from '@guardrail/database';
import { logger } from '../logger';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  projectId?: string;
  limit?: number;
  /** Inline payload for PDF / HTML report generation */
  data?: unknown;
  recordCount?: number;
}

export interface ExportResult {
  data: string;
  filename: string;
  mimeType: string;
  recordCount: number;
}

// CSV Helpers
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCsv(headers: string[], rows: unknown[][]): string {
  const headerRow = headers.map(escapeCsvValue).join(',');
  const dataRows = rows.map(row => row.map(escapeCsvValue).join(','));
  return [headerRow, ...dataRows].join('\n');
}

class ExportService {
  /**
   * Export runs with findings
   */
  async exportRuns(options: ExportOptions): Promise<ExportResult> {
    const where: any = {};
    
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.projectId) {
      where.projectId = options.projectId;
    }
    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) where.createdAt.gte = options.dateFrom;
      if (options.dateTo) where.createdAt.lte = options.dateTo;
    }

    const runs = await prisma.run.findMany({
      where,
      include: {
        findings: {
          select: {
            id: true,
            severity: true,
            type: true,
            message: true,
            file: true,
            line: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: options.limit || 1000,
    });

    if (options.format === 'csv') {
      const headers = [
        'Run ID',
        'Status',
        'Mode',
        'Created At',
        'Completed At',
        'Duration (s)',
        'Finding Count',
        'Critical',
        'High',
        'Medium',
        'Low',
      ];

      const rows = runs.map((run: (typeof runs)[number]) => {
        const duration = run.completedAt && run.createdAt 
          ? Math.round((new Date(run.completedAt).getTime() - new Date(run.createdAt).getTime()) / 1000)
          : '';
        const criticalCount = run.findings.filter((f: (typeof run.findings)[number]) => f.severity === 'critical').length;
        const highCount = run.findings.filter((f: (typeof run.findings)[number]) => f.severity === 'high').length;
        const mediumCount = run.findings.filter((f: (typeof run.findings)[number]) => f.severity === 'medium').length;
        const lowCount = run.findings.filter((f: (typeof run.findings)[number]) => f.severity === 'low').length;

        return [
          run.id,
          run.status,
          run.mode,
          run.createdAt.toISOString(),
          run.completedAt?.toISOString() || '',
          duration,
          run.findings.length,
          criticalCount,
          highCount,
          mediumCount,
          lowCount,
        ];
      });

      return {
        data: arrayToCsv(headers, rows),
        filename: `runs-export-${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
        recordCount: runs.length,
      };
    }

    // JSON format
    return {
      data: JSON.stringify(runs, null, 2),
      filename: `runs-export-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      recordCount: runs.length,
    };
  }

  /**
   * Export findings
   */
  async exportFindings(options: ExportOptions & { runId?: string }): Promise<ExportResult> {
    const where: any = {};
    
    if (options.userId) {
      where.scan = { userId: options.userId };
    }
    if ((options as any).runId) {
      where.scanId = (options as any).runId;
    }
    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) where.createdAt.gte = options.dateFrom;
      if (options.dateTo) where.createdAt.lte = options.dateTo;
    }

    const findings = await prisma.finding.findMany({
      where,
      include: {
        scan: {
          select: {
            id: true,
            mode: true,
            status: true,
          },
        },
      },
      orderBy: [
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
      take: options.limit || 5000,
    });

    if (options.format === 'csv') {
      const headers = [
        'Finding ID',
        'Run ID',
        'Severity',
        'Type',
        'File',
        'Line',
        'Message',
        'Created At',
      ];

      const rows = findings.map((f: (typeof findings)[number]) => [
        f.id,
        f.scanId,
        f.severity,
        f.type,
        f.file || '',
        f.line || '',
        f.message,
        f.createdAt.toISOString(),
      ]);

      return {
        data: arrayToCsv(headers, rows),
        filename: `findings-export-${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
        recordCount: findings.length,
      };
    }

    return {
      data: JSON.stringify(findings, null, 2),
      filename: `findings-export-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      recordCount: findings.length,
    };
  }

  /**
   * Export security events / audit logs
   */
  async exportAuditLogs(options: ExportOptions): Promise<ExportResult> {
    const where: any = {};
    
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.dateFrom || options.dateTo) {
      where.timestamp = {};
      if (options.dateFrom) where.timestamp.gte = options.dateFrom;
      if (options.dateTo) where.timestamp.lte = options.dateTo;
    }

    const events = await prisma.securityEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options.limit || 5000,
      select: {
        id: true,
        eventType: true,
        severity: true,
        userId: true,
        orgId: true,
        ip: true,
        userAgent: true,
        route: true,
        method: true,
        timestamp: true,
        payload: true,
      },
    });

    if (options.format === 'csv') {
      const headers = [
        'Event ID',
        'Timestamp',
        'Event Type',
        'Severity',
        'User ID',
        'Org ID',
        'IP Address',
        'Route',
        'Method',
        'User Agent',
      ];

      const rows = events.map((e: (typeof events)[number]) => [
        e.id,
        e.timestamp.toISOString(),
        e.eventType,
        e.severity || '',
        e.userId || '',
        e.orgId || '',
        e.ip || '',
        e.route || '',
        e.method || '',
        e.userAgent || '',
      ]);

      return {
        data: arrayToCsv(headers, rows),
        filename: `audit-logs-export-${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
        recordCount: events.length,
      };
    }

    return {
      data: JSON.stringify(events, null, 2),
      filename: `audit-logs-export-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      recordCount: events.length,
    };
  }

  /**
   * Export billing history
   */
  async exportBillingHistory(options: ExportOptions): Promise<ExportResult> {
    const where: any = {};
    
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) where.createdAt.gte = options.dateFrom;
      if (options.dateTo) where.createdAt.lte = options.dateTo;
    }

    const events = await prisma.billingEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 1000,
      select: {
        id: true,
        eventType: true,
        subscriptionId: true,
        userId: true,
        previousState: true,
        newState: true,
        createdAt: true,
      },
    });

    if (options.format === 'csv') {
      const headers = [
        'Event ID',
        'Timestamp',
        'Event Type',
        'Subscription ID',
        'User ID',
        'Previous Tier',
        'New Tier',
      ];

      const rows = events.map((e: (typeof events)[number]) => [
        e.id,
        e.createdAt.toISOString(),
        e.eventType,
        e.subscriptionId || '',
        e.userId || '',
        (e.previousState as { tier?: string })?.tier || '',
        (e.newState as { tier?: string })?.tier || '',
      ]);

      return {
        data: arrayToCsv(headers, rows),
        filename: `billing-history-export-${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
        recordCount: events.length,
      };
    }

    return {
      data: JSON.stringify(events, null, 2),
      filename: `billing-history-export-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      recordCount: events.length,
    };
  }

  /**
   * Export usage records
   */
  async exportUsageRecords(options: ExportOptions): Promise<ExportResult> {
    const where: any = {};
    
    if (options.userId) {
      where.userId = options.userId;
    }
    if (options.dateFrom || options.dateTo) {
      where.createdAt = {};
      if (options.dateFrom) where.createdAt.gte = options.dateFrom;
      if (options.dateTo) where.createdAt.lte = options.dateTo;
    }

    const records = await prisma.usageRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 5000,
      select: {
        id: true,
        userId: true,
        usageType: true,
        quantity: true,
        reportedToStripe: true,
        stripeUsageRecordId: true,
        createdAt: true,
      },
    });

    if (options.format === 'csv') {
      const headers = [
        'Record ID',
        'Timestamp',
        'User ID',
        'Usage Type',
        'Quantity',
        'Reported to Stripe',
        'Stripe Usage Record ID',
      ];

      const rows = records.map((r: (typeof records)[number]) => [
        r.id,
        r.createdAt.toISOString(),
        r.userId,
        r.usageType,
        r.quantity,
        r.reportedToStripe ? 'Yes' : 'No',
        r.stripeUsageRecordId || '',
      ]);

      return {
        data: arrayToCsv(headers, rows),
        filename: `usage-records-export-${new Date().toISOString().split('T')[0]}.csv`,
        mimeType: 'text/csv',
        recordCount: records.length,
      };
    }

    return {
      data: JSON.stringify(records, null, 2),
      filename: `usage-records-export-${new Date().toISOString().split('T')[0]}.json`,
      mimeType: 'application/json',
      recordCount: records.length,
    };
  }

  /**
   * Generate PDF report using PDFKit or HTML-to-PDF conversion
   */
  async generatePdfReport(options: ExportOptions & { reportType: string }): Promise<ExportResult> {
    try {
      // Try PDFKit first (lightweight, good for structured reports)
      try {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {});

        // Add title
        doc.fontSize(20).text('guardrail Security Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Report Type: ${options.reportType}`, { align: 'left' });
        doc.text(`Generated: ${new Date().toLocaleString()}`, { align: 'left' });
        doc.moveDown();

        // Add report data
        if (options.data) {
          const data = typeof options.data === 'string' ? JSON.parse(options.data) : options.data;
          doc.fontSize(14).text('Report Data', { underline: true });
          doc.moveDown();
          doc.fontSize(10);
          
          // Format data as text (handle arrays and objects)
          if (Array.isArray(data)) {
            data.forEach((item: any, index: number) => {
              doc.text(`${index + 1}. ${JSON.stringify(item, null, 2)}`, { indent: 20 });
              doc.moveDown(0.5);
            });
          } else if (typeof data === 'object') {
            Object.entries(data).forEach(([key, value]) => {
              doc.text(`${key}: ${JSON.stringify(value)}`, { indent: 20 });
              doc.moveDown(0.5);
            });
          } else {
            doc.text(String(data), { indent: 20 });
          }
        }

        // Add footer
        doc.fontSize(8).text(
          `Generated by guardrail AI - ${new Date().toISOString()}`,
          { align: 'center' }
        );

        doc.end();

        // Wait for PDF to be generated
        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('PDF generation timeout'));
          }, 30000);

          doc.on('end', () => {
            clearTimeout(timeout);
            resolve(Buffer.concat(chunks));
          });

          doc.on('error', (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        logger.info({ size: pdfBuffer.length }, 'PDF generated with PDFKit');

        return {
          data: pdfBuffer.toString('base64'),
          filename: `report-${new Date().toISOString().split('T')[0]}.pdf`,
          mimeType: 'application/pdf',
          recordCount: options.recordCount || 0,
        };
      } catch (pdfkitError: any) {
        // PDFKit not available, try Puppeteer
        logger.debug({ error: pdfkitError.message }, 'PDFKit not available, trying Puppeteer');
      }

      // Try Puppeteer for HTML-to-PDF (better for complex layouts)
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: true });
        const page = await browser.newPage();

        // Generate HTML content
        const htmlContent = this.generateReportHtml(options);

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
          printBackground: true,
        });

        await browser.close();

        logger.info({ size: pdfBuffer.length }, 'PDF generated with Puppeteer');

        return {
          data: pdfBuffer.toString('base64'),
          filename: `report-${new Date().toISOString().split('T')[0]}.pdf`,
          mimeType: 'application/pdf',
          recordCount: options.recordCount || 0,
        };
      } catch (puppeteerError: any) {
        // Neither library available, return JSON fallback
        logger.warn({ error: puppeteerError.message }, 'PDF libraries not available, returning JSON fallback');
        
        const data = {
          message: 'PDF generation requires PDFKit or Puppeteer. Install with: npm install pdfkit or npm install puppeteer',
          reportType: options.reportType,
          generatedAt: new Date().toISOString(),
          format: 'json',
          data: options.data,
        };

        return {
          data: JSON.stringify(data, null, 2),
          filename: `report-${new Date().toISOString().split('T')[0]}.json`,
          mimeType: 'application/json',
          recordCount: 0,
        };
      }
    } catch (error: unknown) {
      logger.error({ error: toErrorMessage(error) }, 'PDF generation failed');
      throw error;
    }
  }

  // Generate HTML content for Puppeteer PDF conversion
  private generateReportHtml(options: ExportOptions & { reportType: string }): string {
    const data = typeof options.data === 'string' ? JSON.parse(options.data) : options.data;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 10px; }
            h2 { color: #666; margin-top: 30px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #4CAF50; color: white; }
            tr:nth-child(even) { background-color: #f2f2f2; }
            .footer { margin-top: 40px; text-align: center; color: #999; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>guardrail Security Report</h1>
          <p><strong>Report Type:</strong> ${options.reportType}</p>
          <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
          <h2>Report Data</h2>
          <pre>${JSON.stringify(data, null, 2)}</pre>
          <div class="footer">
            Generated by guardrail AI - ${new Date().toISOString()}
          </div>
        </body>
      </html>
    `;
  }
}

export const exportService = new ExportService();
