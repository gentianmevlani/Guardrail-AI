/**
 * Documentation Updater
 * 
 * Automatically updates documentation based on codebase changes
 */

import * as fs from 'fs';
import * as path from 'path';
import { apiEndpointTracker } from './api-endpoint-tracker';
import { componentRegistry } from './component-registry';

export interface DocumentationConfig {
  updateFrequency: 'never' | 'daily' | 'weekly' | 'on-change' | 'manual';
  updateReadme: boolean;
  updateQuickStart: boolean;
  updateScripts: boolean;
  updateApiDocs: boolean;
  lastUpdated?: string;
}

export interface DocumentationUpdate {
  file: string;
  changes: Array<{
    type: 'added' | 'updated' | 'removed';
    section: string;
    content: string;
  }>;
  timestamp: string;
}

class DocumentationUpdater {
  private config: DocumentationConfig;
  private configPath: string;
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, '.guardrail', 'docs-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<DocumentationConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Get configuration
   */
  getConfig(): DocumentationConfig {
    return this.config;
  }

  /**
   * Update all documentation
   */
  async updateAll(): Promise<DocumentationUpdate[]> {
    const updates: DocumentationUpdate[] = [];

    if (this.config.updateReadme) {
      updates.push(await this.updateReadme());
    }

    if (this.config.updateQuickStart) {
      updates.push(await this.updateQuickStart());
    }

    if (this.config.updateScripts) {
      updates.push(await this.updateScripts());
    }

    if (this.config.updateApiDocs) {
      updates.push(await this.updateApiDocs());
    }

    this.config.lastUpdated = new Date().toISOString();
    this.saveConfig();

    return updates;
  }

  /**
   * Update README.md
   */
  private async updateReadme(): Promise<DocumentationUpdate> {
    const readmePath = path.join(this.projectPath, 'README.md');
    let content = '';

    if (fs.existsSync(readmePath)) {
      content = fs.readFileSync(readmePath, 'utf8');
    }

    // Extract existing sections
    const sections = this.extractSections(content);

    // Update sections
    sections['## Features'] = this.generateFeaturesSection();
    sections['## API Endpoints'] = this.generateAPIEndpointsSection();
    sections['## Quick Start'] = this.generateQuickStartSection();
    sections['## Scripts'] = this.generateScriptsSection();

    // Rebuild README
    const newContent = this.rebuildReadme(sections, content);

    fs.writeFileSync(readmePath, newContent);

    return {
      file: 'README.md',
      changes: [
        { type: 'updated', section: 'Features', content: 'Updated feature list' },
        { type: 'updated', section: 'API Endpoints', content: 'Updated API endpoints' },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update QUICK-START.md
   */
  private async updateQuickStart(): Promise<DocumentationUpdate> {
    const quickStartPath = path.join(this.projectPath, 'QUICK-START.md');
    let content = '';

    if (fs.existsSync(quickStartPath)) {
      content = fs.readFileSync(quickStartPath, 'utf8');
    }

    // Generate quick start content
    const newContent = this.generateQuickStartContent();

    fs.writeFileSync(quickStartPath, newContent);

    return {
      file: 'QUICK-START.md',
      changes: [
        { type: 'updated', section: 'All', content: 'Updated quick start guide' },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update scripts documentation
   */
  private async updateScripts(): Promise<DocumentationUpdate> {
    const scriptsPath = path.join(this.projectPath, 'SCRIPTS.md');
    
    const scripts = this.getAvailableScripts();
    const content = this.generateScriptsDocumentation(scripts);

    fs.writeFileSync(scriptsPath, content);

    return {
      file: 'SCRIPTS.md',
      changes: [
        { type: 'updated', section: 'All', content: 'Updated scripts documentation' },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update API documentation
   */
  private async updateApiDocs(): Promise<DocumentationUpdate> {
    const apiDocsPath = path.join(this.projectPath, 'API-DOCS.md');
    
    const endpoints = apiEndpointTracker.getEndpoints();
    const content = this.generateAPIDocumentation(endpoints);

    fs.writeFileSync(apiDocsPath, content);

    return {
      file: 'API-DOCS.md',
      changes: [
        { type: 'updated', section: 'All', content: 'Updated API documentation' },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  // Helper methods
  private extractSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.match(/^##+\s+/)) {
        if (currentSection) {
          sections[currentSection] = currentContent.join('\n');
        }
        currentSection = line.replace(/^##+\s+/, '').trim();
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentSection) {
      sections[currentSection] = currentContent.join('\n');
    }

    return sections;
  }

  private rebuildReadme(sections: Record<string, string>, original: string): string {
    let content = original.split(/^##+\s+/m)[0] || '# Project\n\n';
    
    Object.entries(sections).forEach(([title, sectionContent]) => {
      content += `\n## ${title}\n\n${sectionContent}\n`;
    });

    return content;
  }

  private generateFeaturesSection(): string {
    const features = [
      '✅ Real-time API endpoint tracking',
      '✅ Automatic documentation updates',
      '✅ Path validation between frontend/backend',
      '✅ Component registry and usage tracking',
      '✅ Auto-generated API clients',
    ];

    return features.join('\n');
  }

  private generateAPIEndpointsSection(): string {
    const endpoints = apiEndpointTracker.getEndpoints();
    
    if (endpoints.length === 0) {
      return 'No API endpoints registered yet.';
    }

    let content = '| Method | Path | Description |\n';
    content += '|--------|------|-------------|\n';

    endpoints.forEach(endpoint => {
      content += `| ${endpoint.method} | ${endpoint.fullPath} | ${endpoint.description || 'N/A'} |\n`;
    });

    return content;
  }

  private generateQuickStartSection(): string {
    return `\`\`\`bash
# Install dependencies
npm install

# Start tracking
npm run start-tracking

# Validate paths
npm run validate-paths
\`\`\``;
  }

  private generateScriptsSection(): string {
    const scripts = this.getAvailableScripts();
    let content = '| Script | Description |\n';
    content += '|-------|-------------|\n';

    scripts.forEach(script => {
      content += `| \`${script.name}\` | ${script.description} |\n`;
    });

    return content;
  }

  private generateQuickStartContent(): string {
    return `# Quick Start Guide

## Installation

\`\`\`bash
npm install
\`\`\`

## Getting Started

1. Start tracking: \`npm run start-tracking\`
2. Validate paths: \`npm run validate-paths\`
3. Generate API client: \`npm run generate-api-client\`

## Next Steps

- Configure documentation updates in the dashboard
- Set up strictness levels
- Connect integrations
`;
  }

  private getAvailableScripts(): Array<{ name: string; description: string }> {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.projectPath, 'package.json'), 'utf8')
      );
      
      return Object.entries(packageJson.scripts || {}).map(([name, script]) => ({
        name,
        description: this.extractScriptDescription(script as string),
      }));
    } catch {
      return [];
    }
  }

  private extractScriptDescription(script: string): string {
    // Try to extract description from script comments or file
    if (script.includes('analyze')) return 'Analyze project structure';
    if (script.includes('polish')) return 'Polish and improve code';
    if (script.includes('validate')) return 'Validate code quality';
    if (script.includes('build')) return 'Build project';
    return 'Run script';
  }

  private generateScriptsDocumentation(scripts: Array<{ name: string; description: string }>): string {
    let content = '# Available Scripts\n\n';
    content += '| Script | Description |\n';
    content += '|-------|-------------|\n';

    scripts.forEach(script => {
      content += `| \`npm run ${script.name}\` | ${script.description} |\n`;
    });

    return content;
  }

  private generateAPIDocumentation(endpoints: any[]): string {
    let content = '# API Documentation\n\n';
    
    if (endpoints.length === 0) {
      return content + 'No API endpoints registered yet.';
    }

    const byBasePath = new Map<string, Array<Record<string, unknown>>>();
    endpoints.forEach(endpoint => {
      const basePath = endpoint.fullPath.split('/').slice(0, 3).join('/');
      if (!byBasePath.has(basePath)) {
        byBasePath.set(basePath, []);
      }
      byBasePath.get(basePath)!.push(endpoint);
    });

    byBasePath.forEach((endpoints, basePath) => {
      content += `## ${basePath}\n\n`;
      endpoints.forEach(endpoint => {
        content += `### ${endpoint.method} ${endpoint.path}\n\n`;
        if (endpoint.description) {
          content += `${endpoint.description}\n\n`;
        }
        if (endpoint.params && endpoint.params.length > 0) {
          content += `**Parameters:** ${endpoint.params.join(', ')}\n\n`;
        }
        content += `\n`;
      });
    });

    return content;
  }

  private loadConfig(): DocumentationConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (error) {
      // Failed to update documentation - continue with other operations
    }

    return {
      updateFrequency: 'weekly',
      updateReadme: true,
      updateQuickStart: true,
      updateScripts: true,
      updateApiDocs: true,
    };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save documentation config:', error);
    }
  }
}

export const documentationUpdater = new DocumentationUpdater();

