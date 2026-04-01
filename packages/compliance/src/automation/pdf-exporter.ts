/**
 * PDF Compliance Report Exporter
 * 
 * Generates professional PDF reports for compliance assessments.
 * Uses a text-based approach that can be enhanced with a PDF library.
 */

import * as fs from 'fs';
import * as path from 'path';

interface PDFReportData {
  id: string;
  title: string;
  projectName: string;
  frameworkId: string;
  generatedAt: Date;
  summary: {
    overallScore: number;
    status: string;
    totalControls: number;
    compliantControls: number;
    partialControls: number;
    nonCompliantControls: number;
    highRiskGaps: number;
    mediumRiskGaps: number;
    lowRiskGaps: number;
  };
  sections: Array<{
    title: string;
    content: any;
  }>;
  recommendations: Array<{
    priority: string;
    title: string;
    description: string;
    status: string;
  }>;
}

interface PDFExportOptions {
  outputPath?: string;
  includeHeader?: boolean;
  includeFooter?: boolean;
  includeTableOfContents?: boolean;
  watermark?: string;
  companyName?: string;
  companyLogo?: string;
}

/**
 * PDF Compliance Report Exporter
 * 
 * Generates formatted compliance reports that can be exported as PDF.
 * For production use, integrate with a PDF library like pdfkit or puppeteer.
 */
export class PDFExporter {
  /**
   * Export compliance report to PDF-ready format
   */
  async exportToPDF(
    data: PDFReportData,
    options: PDFExportOptions = {}
  ): Promise<{ content: string; filename: string; path?: string }> {
    const {
      outputPath,
      includeHeader = true,
      includeFooter = true,
      includeTableOfContents = true,
      watermark,
      companyName = 'guardrail AI',
    } = options;

    // Generate PDF content as structured text (HTML-like for rendering)
    const content = this.generatePDFContent(data, {
      includeHeader,
      includeFooter,
      includeTableOfContents,
      watermark,
      companyName,
    });

    const filename = `compliance-report-${data.frameworkId}-${Date.now()}.pdf`;

    // If output path specified, write file
    if (outputPath) {
      const fullPath = path.join(outputPath, filename);
      await this.writeHTMLReport(fullPath.replace('.pdf', '.html'), content);
      
      // For actual PDF generation, you would use:
      // await this.generatePDFFile(fullPath, content);
      
      return { content, filename, path: fullPath };
    }

    return { content, filename };
  }

  /**
   * Generate PDF content as structured HTML
   */
  private generatePDFContent(
    data: PDFReportData,
    options: {
      includeHeader: boolean;
      includeFooter: boolean;
      includeTableOfContents: boolean;
      watermark?: string;
      companyName: string;
    }
  ): string {
    const lines: string[] = [];

    // Document header
    lines.push('<!DOCTYPE html>');
    lines.push('<html lang="en">');
    lines.push('<head>');
    lines.push('  <meta charset="UTF-8">');
    lines.push(`  <title>${data.title}</title>`);
    lines.push('  <style>');
    lines.push(this.getStyles());
    lines.push('  </style>');
    lines.push('</head>');
    lines.push('<body>');

    // Watermark
    if (options.watermark) {
      lines.push(`<div class="watermark">${options.watermark}</div>`);
    }

    // Header
    if (options.includeHeader) {
      lines.push('<header class="report-header">');
      lines.push(`  <div class="company-name">${options.companyName}</div>`);
      lines.push(`  <h1>${data.title}</h1>`);
      lines.push(`  <div class="report-meta">`);
      lines.push(`    <span>Project: ${data.projectName}</span>`);
      lines.push(`    <span>Framework: ${data.frameworkId.toUpperCase()}</span>`);
      lines.push(`    <span>Generated: ${data.generatedAt.toLocaleDateString()}</span>`);
      lines.push(`  </div>`);
      lines.push('</header>');
    }

    // Table of Contents
    if (options.includeTableOfContents) {
      lines.push('<nav class="toc">');
      lines.push('  <h2>Table of Contents</h2>');
      lines.push('  <ol>');
      lines.push('    <li><a href="#executive-summary">Executive Summary</a></li>');
      lines.push('    <li><a href="#compliance-score">Compliance Score</a></li>');
      lines.push('    <li><a href="#control-assessment">Control Assessment</a></li>');
      lines.push('    <li><a href="#gaps-risks">Gaps & Risks</a></li>');
      lines.push('    <li><a href="#recommendations">Recommendations</a></li>');
      lines.push('  </ol>');
      lines.push('</nav>');
    }

    // Executive Summary
    lines.push('<section id="executive-summary" class="section">');
    lines.push('  <h2>1. Executive Summary</h2>');
    lines.push('  <div class="summary-box">');
    lines.push(`    <div class="score-badge ${this.getStatusClass(data.summary.status)}">`);
    lines.push(`      <span class="score">${data.summary.overallScore}%</span>`);
    lines.push(`      <span class="status">${data.summary.status.toUpperCase()}</span>`);
    lines.push('    </div>');
    lines.push('    <p>');
    lines.push(`      This compliance assessment evaluated <strong>${data.summary.totalControls}</strong> controls `);
    lines.push(`      against the <strong>${data.frameworkId.toUpperCase()}</strong> framework requirements.`);
    lines.push('    </p>');
    lines.push('  </div>');
    lines.push('</section>');

    // Compliance Score Breakdown
    lines.push('<section id="compliance-score" class="section">');
    lines.push('  <h2>2. Compliance Score Breakdown</h2>');
    lines.push('  <table class="score-table">');
    lines.push('    <thead>');
    lines.push('      <tr><th>Category</th><th>Count</th><th>Percentage</th></tr>');
    lines.push('    </thead>');
    lines.push('    <tbody>');
    lines.push(`      <tr class="compliant"><td>✅ Compliant</td><td>${data.summary.compliantControls}</td><td>${this.percentage(data.summary.compliantControls, data.summary.totalControls)}%</td></tr>`);
    lines.push(`      <tr class="partial"><td>⚠️ Partial</td><td>${data.summary.partialControls}</td><td>${this.percentage(data.summary.partialControls, data.summary.totalControls)}%</td></tr>`);
    lines.push(`      <tr class="non-compliant"><td>❌ Non-Compliant</td><td>${data.summary.nonCompliantControls}</td><td>${this.percentage(data.summary.nonCompliantControls, data.summary.totalControls)}%</td></tr>`);
    lines.push('    </tbody>');
    lines.push('  </table>');
    lines.push('</section>');

    // Gaps & Risks
    lines.push('<section id="gaps-risks" class="section">');
    lines.push('  <h2>3. Gaps & Risk Assessment</h2>');
    lines.push('  <div class="risk-summary">');
    lines.push(`    <div class="risk-item high"><span class="count">${data.summary.highRiskGaps}</span><span class="label">High Risk</span></div>`);
    lines.push(`    <div class="risk-item medium"><span class="count">${data.summary.mediumRiskGaps}</span><span class="label">Medium Risk</span></div>`);
    lines.push(`    <div class="risk-item low"><span class="count">${data.summary.lowRiskGaps}</span><span class="label">Low Risk</span></div>`);
    lines.push('  </div>');
    lines.push('</section>');

    // Recommendations
    lines.push('<section id="recommendations" class="section">');
    lines.push('  <h2>4. Recommendations</h2>');
    if (data.recommendations.length === 0) {
      lines.push('  <p class="no-items">No critical recommendations at this time.</p>');
    } else {
      lines.push('  <div class="recommendations-list">');
      for (const rec of data.recommendations.slice(0, 10)) {
        lines.push(`    <div class="recommendation ${rec.priority}">`);
        lines.push(`      <div class="rec-header">`);
        lines.push(`        <span class="priority-badge">${rec.priority.toUpperCase()}</span>`);
        lines.push(`        <span class="rec-title">${rec.title}</span>`);
        lines.push(`      </div>`);
        lines.push(`      <p class="rec-description">${rec.description}</p>`);
        lines.push(`      <span class="rec-status">Status: ${rec.status}</span>`);
        lines.push('    </div>');
      }
      if (data.recommendations.length > 10) {
        lines.push(`  <p class="more-items">...and ${data.recommendations.length - 10} more recommendations</p>`);
      }
      lines.push('  </div>');
    }
    lines.push('</section>');

    // Footer
    if (options.includeFooter) {
      lines.push('<footer class="report-footer">');
      lines.push(`  <p>Generated by ${options.companyName} Compliance Engine</p>`);
      lines.push(`  <p>Report ID: ${data.id}</p>`);
      lines.push(`  <p>This report is confidential and intended for authorized personnel only.</p>`);
      lines.push('</footer>');
    }

    lines.push('</body>');
    lines.push('</html>');

    return lines.join('\n');
  }

  /**
   * Get CSS styles for the PDF report
   */
  private getStyles(): string {
    return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-45deg);
      font-size: 100px;
      color: rgba(200, 200, 200, 0.2);
      pointer-events: none;
      z-index: -1;
    }
    .report-header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .company-name { font-size: 14px; color: #666; margin-bottom: 10px; }
    .report-header h1 { font-size: 28px; color: #1e40af; margin-bottom: 15px; }
    .report-meta { display: flex; justify-content: center; gap: 20px; color: #666; font-size: 14px; }
    .toc { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .toc h2 { font-size: 18px; margin-bottom: 10px; }
    .toc ol { padding-left: 20px; }
    .toc li { margin: 5px 0; }
    .toc a { color: #2563eb; text-decoration: none; }
    .section { margin-bottom: 40px; page-break-inside: avoid; }
    .section h2 { font-size: 22px; color: #1e40af; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 20px; }
    .summary-box { display: flex; align-items: center; gap: 30px; }
    .score-badge { 
      text-align: center; 
      padding: 20px 30px; 
      border-radius: 12px; 
      min-width: 120px;
    }
    .score-badge.compliant { background: #dcfce7; color: #166534; }
    .score-badge.partial { background: #fef3c7; color: #92400e; }
    .score-badge.non-compliant { background: #fee2e2; color: #991b1b; }
    .score { display: block; font-size: 36px; font-weight: bold; }
    .status { display: block; font-size: 14px; margin-top: 5px; }
    .score-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .score-table th, .score-table td { padding: 12px; text-align: left; border: 1px solid #e5e7eb; }
    .score-table th { background: #f1f5f9; font-weight: 600; }
    .score-table .compliant td:first-child { color: #166534; }
    .score-table .partial td:first-child { color: #92400e; }
    .score-table .non-compliant td:first-child { color: #991b1b; }
    .risk-summary { display: flex; gap: 20px; margin-top: 15px; }
    .risk-item { 
      flex: 1; 
      text-align: center; 
      padding: 20px; 
      border-radius: 8px; 
    }
    .risk-item.high { background: #fee2e2; color: #991b1b; }
    .risk-item.medium { background: #fef3c7; color: #92400e; }
    .risk-item.low { background: #dbeafe; color: #1e40af; }
    .risk-item .count { display: block; font-size: 32px; font-weight: bold; }
    .risk-item .label { display: block; font-size: 14px; margin-top: 5px; }
    .recommendations-list { display: flex; flex-direction: column; gap: 15px; }
    .recommendation { 
      padding: 15px; 
      border-radius: 8px; 
      border-left: 4px solid; 
      background: #f8fafc;
    }
    .recommendation.critical { border-color: #dc2626; }
    .recommendation.high { border-color: #ea580c; }
    .recommendation.medium { border-color: #ca8a04; }
    .recommendation.low { border-color: #2563eb; }
    .rec-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .priority-badge { 
      font-size: 11px; 
      padding: 2px 8px; 
      border-radius: 4px; 
      background: #e5e7eb; 
      font-weight: 600;
    }
    .recommendation.critical .priority-badge { background: #fee2e2; color: #991b1b; }
    .recommendation.high .priority-badge { background: #ffedd5; color: #9a3412; }
    .recommendation.medium .priority-badge { background: #fef3c7; color: #92400e; }
    .recommendation.low .priority-badge { background: #dbeafe; color: #1e40af; }
    .rec-title { font-weight: 600; }
    .rec-description { color: #666; font-size: 14px; margin-bottom: 8px; }
    .rec-status { font-size: 12px; color: #888; }
    .no-items { color: #666; font-style: italic; }
    .more-items { color: #666; font-size: 14px; margin-top: 10px; }
    .report-footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    .report-footer p { margin: 5px 0; }
    @media print {
      body { padding: 20px; }
      .section { page-break-inside: avoid; }
    }
    `;
  }

  /**
   * Write HTML report to file
   */
  private async writeHTMLReport(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf8');
  }

  /**
   * Get status class for styling
   */
  private getStatusClass(status: string): string {
    if (status === 'compliant') return 'compliant';
    if (status === 'partial') return 'partial';
    return 'non-compliant';
  }

  /**
   * Calculate percentage
   */
  private percentage(value: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  }

  /**
   * Export report as JSON
   */
  async exportToJSON(data: PDFReportData, outputPath?: string): Promise<string> {
    const json = JSON.stringify(data, null, 2);
    
    if (outputPath) {
      const filename = `compliance-report-${data.frameworkId}-${Date.now()}.json`;
      const fullPath = path.join(outputPath, filename);
      await fs.promises.mkdir(outputPath, { recursive: true });
      await fs.promises.writeFile(fullPath, json, 'utf8');
    }
    
    return json;
  }

  /**
   * Export report as CSV
   */
  async exportToCSV(data: PDFReportData, outputPath?: string): Promise<string> {
    const lines: string[] = [];
    
    // Header
    lines.push('Category,Count,Percentage,Status');
    
    // Summary data
    const total = data.summary.totalControls;
    lines.push(`Compliant,${data.summary.compliantControls},${this.percentage(data.summary.compliantControls, total)}%,Pass`);
    lines.push(`Partial,${data.summary.partialControls},${this.percentage(data.summary.partialControls, total)}%,Warning`);
    lines.push(`Non-Compliant,${data.summary.nonCompliantControls},${this.percentage(data.summary.nonCompliantControls, total)}%,Fail`);
    
    lines.push('');
    lines.push('Risk Level,Count');
    lines.push(`High,${data.summary.highRiskGaps}`);
    lines.push(`Medium,${data.summary.mediumRiskGaps}`);
    lines.push(`Low,${data.summary.lowRiskGaps}`);
    
    if (data.recommendations.length > 0) {
      lines.push('');
      lines.push('Priority,Title,Description,Status');
      for (const rec of data.recommendations) {
        lines.push(`${rec.priority},"${rec.title}","${rec.description}",${rec.status}`);
      }
    }
    
    const csv = lines.join('\n');
    
    if (outputPath) {
      const filename = `compliance-report-${data.frameworkId}-${Date.now()}.csv`;
      const fullPath = path.join(outputPath, filename);
      await fs.promises.mkdir(outputPath, { recursive: true });
      await fs.promises.writeFile(fullPath, csv, 'utf8');
    }
    
    return csv;
  }
}

export const pdfExporter = new PDFExporter();
