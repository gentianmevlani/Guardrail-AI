/**
 * Project Health Badge Generator
 * 
 * Generates dynamic SVG badges showing project health metrics
 * for use in README files and dashboards.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface BadgeConfig {
  label: string;
  value: string | number;
  color?: string;
  style?: 'flat' | 'flat-square' | 'plastic' | 'for-the-badge';
  logo?: string;
  logoColor?: string;
}

export interface HealthBadges {
  vibeScore: string;
  securityScore: string;
  polishScore: string;
  complianceStatus: string;
  combined: string;
}

interface ScoreThresholds {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  excellent: 90,
  good: 70,
  fair: 50,
  poor: 0,
};

class HealthBadgeGenerator {
  /**
   * Generate all health badges for a project
   */
  generateBadges(scores: {
    vibe: number;
    security: number;
    polish: number;
    compliance?: 'compliant' | 'partial' | 'non-compliant';
  }): HealthBadges {
    return {
      vibeScore: this.generateScoreBadge('Vibe Score', scores.vibe),
      securityScore: this.generateScoreBadge('Security', scores.security, '🛡️'),
      polishScore: this.generateScoreBadge('Polish', scores.polish, '✨'),
      complianceStatus: this.generateStatusBadge('Compliance', scores.compliance || 'partial'),
      combined: this.generateCombinedBadge(scores),
    };
  }

  /**
   * Generate a score-based badge SVG
   */
  generateScoreBadge(
    label: string,
    score: number,
    icon?: string,
    thresholds: ScoreThresholds = DEFAULT_THRESHOLDS
  ): string {
    const color = this.getScoreColor(score, thresholds);
    const grade = this.getGrade(score);
    const displayValue = `${score}% (${grade})`;

    return this.createSVGBadge({
      label: icon ? `${icon} ${label}` : label,
      value: displayValue,
      color,
      style: 'flat',
    });
  }

  /**
   * Generate a status-based badge
   */
  generateStatusBadge(
    label: string,
    status: 'compliant' | 'partial' | 'non-compliant' | 'pass' | 'fail' | 'warning'
  ): string {
    const statusConfig: Record<string, { color: string; text: string }> = {
      'compliant': { color: '#4ade80', text: 'Compliant' },
      'partial': { color: '#fbbf24', text: 'Partial' },
      'non-compliant': { color: '#f87171', text: 'Non-Compliant' },
      'pass': { color: '#4ade80', text: 'Pass' },
      'fail': { color: '#f87171', text: 'Fail' },
      'warning': { color: '#fbbf24', text: 'Warning' },
    };

    const config = statusConfig[status] || statusConfig['partial'];

    return this.createSVGBadge({
      label,
      value: config.text,
      color: config.color,
      style: 'flat',
    });
  }

  /**
   * Generate a combined health badge
   */
  generateCombinedBadge(scores: {
    vibe: number;
    security: number;
    polish: number;
  }): string {
    const overall = Math.round((scores.vibe + scores.security + scores.polish) / 3);
    const grade = this.getGrade(overall);
    const color = this.getScoreColor(overall);

    return this.createSVGBadge({
      label: '🏥 Project Health',
      value: `${grade} (${overall}%)`,
      color,
      style: 'for-the-badge',
    });
  }

  /**
   * Create SVG badge markup
   */
  private createSVGBadge(config: BadgeConfig): string {
    const {
      label,
      value,
      color = '#4ade80',
      style = 'flat',
    } = config;

    const labelWidth = this.estimateTextWidth(label) + 10;
    const valueWidth = this.estimateTextWidth(String(value)) + 10;
    const totalWidth = labelWidth + valueWidth;
    const height = style === 'for-the-badge' ? 28 : 20;
    const fontSize = style === 'for-the-badge' ? 11 : 11;
    const labelBg = '#555';

    if (style === 'for-the-badge') {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <linearGradient id="smooth" x2="0" y2="100%">
    <stop offset="0" stop-color="#fff" stop-opacity=".7"/>
    <stop offset=".1" stop-color="#aaa" stop-opacity=".1"/>
    <stop offset=".9" stop-color="#000" stop-opacity=".3"/>
    <stop offset="1" stop-color="#000" stop-opacity=".5"/>
  </linearGradient>
  <rect rx="4" width="${totalWidth}" height="${height}" fill="${labelBg}"/>
  <rect rx="4" x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${color}"/>
  <rect rx="4" width="${totalWidth}" height="${height}" fill="url(#smooth)"/>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="${fontSize}" font-weight="bold" text-transform="uppercase">
    <text x="${labelWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(label)}</text>
    <text x="${labelWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(String(value))}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(String(value))}</text>
  </g>
</svg>`;
    }

    // Flat style (default)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}">
  <linearGradient id="smooth" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="round">
    <rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#round)">
    <rect width="${labelWidth}" height="${height}" fill="${labelBg}"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="${height}" fill="${color}"/>
    <rect width="${totalWidth}" height="${height}" fill="url(#smooth)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="${fontSize}">
    <text x="${labelWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(label)}</text>
    <text x="${labelWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(label)}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 4}" fill="#010101" fill-opacity=".3">${this.escapeHtml(String(value))}</text>
    <text x="${labelWidth + valueWidth / 2}" y="${height / 2 + 3}">${this.escapeHtml(String(value))}</text>
  </g>
</svg>`;
  }

  /**
   * Generate markdown for README
   */
  generateReadmeMarkdown(badges: HealthBadges, baseUrl?: string): string {
    const lines: string[] = [
      '## 🏥 Project Health',
      '',
      '<!-- guardrail Health Badges - Auto-generated -->',
      '',
    ];

    if (baseUrl) {
      lines.push(`![Project Health](${baseUrl}/badges/health.svg)`);
      lines.push(`![Vibe Score](${baseUrl}/badges/vibe.svg)`);
      lines.push(`![Security](${baseUrl}/badges/security.svg)`);
      lines.push(`![Polish](${baseUrl}/badges/polish.svg)`);
    } else {
      // Inline SVG data URLs
      lines.push(`![Project Health](data:image/svg+xml;base64,${this.toBase64(badges.combined)})`);
      lines.push(`![Vibe Score](data:image/svg+xml;base64,${this.toBase64(badges.vibeScore)})`);
    }

    lines.push('');
    lines.push('<!-- End guardrail Health Badges -->');

    return lines.join('\n');
  }

  /**
   * Save badges to files
   */
  async saveBadges(
    badges: HealthBadges,
    outputDir: string
  ): Promise<string[]> {
    const savedFiles: string[] = [];

    await fs.promises.mkdir(outputDir, { recursive: true });

    const badgeFiles: Array<[keyof HealthBadges, string]> = [
      ['vibeScore', 'vibe.svg'],
      ['securityScore', 'security.svg'],
      ['polishScore', 'polish.svg'],
      ['complianceStatus', 'compliance.svg'],
      ['combined', 'health.svg'],
    ];

    for (const [key, filename] of badgeFiles) {
      const filePath = path.join(outputDir, filename);
      await fs.promises.writeFile(filePath, badges[key], 'utf8');
      savedFiles.push(filePath);
    }

    return savedFiles;
  }

  /**
   * Get color based on score
   */
  private getScoreColor(score: number, thresholds: ScoreThresholds = DEFAULT_THRESHOLDS): string {
    if (score >= thresholds.excellent) return '#4ade80'; // Green
    if (score >= thresholds.good) return '#60a5fa'; // Blue
    if (score >= thresholds.fair) return '#fbbf24'; // Yellow
    return '#f87171'; // Red
  }

  /**
   * Get letter grade from score
   */
  private getGrade(score: number): string {
    if (score >= 97) return 'S+';
    if (score >= 93) return 'S';
    if (score >= 90) return 'A+';
    if (score >= 87) return 'A';
    if (score >= 83) return 'A-';
    if (score >= 80) return 'B+';
    if (score >= 77) return 'B';
    if (score >= 73) return 'B-';
    if (score >= 70) return 'C+';
    if (score >= 67) return 'C';
    if (score >= 63) return 'C-';
    if (score >= 60) return 'D+';
    if (score >= 57) return 'D';
    if (score >= 53) return 'D-';
    return 'F';
  }

  /**
   * Estimate text width for SVG
   */
  private estimateTextWidth(text: string): number {
    // Rough estimate: ~7px per character for 11px font
    return text.length * 7;
  }

  /**
   * Escape HTML entities
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Convert SVG to base64
   */
  private toBase64(svg: string): string {
    return Buffer.from(svg).toString('base64');
  }
}

export const healthBadgeGenerator = new HealthBadgeGenerator();
