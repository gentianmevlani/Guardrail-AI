/**
 * Documentation Updater
 * 
 * Automatically updates documentation based on codebase changes
 */

const fs = require('fs');
const path = require('path');
const { apiEndpointTracker } = require('./api-endpoint-tracker.js');

class DocumentationUpdater {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.configPath = path.join(projectPath, '.guardrail', 'docs-config.json');
    this.config = this.loadConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Get configuration
   */
  getConfig() {
    return this.config;
  }

  /**
   * Update all documentation
   */
  async updateAll() {
    const updates = [];

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
  async updateReadme() {
    const readmePath = path.join(this.projectPath, 'README.md');
    let content = '';

    if (fs.existsSync(readmePath)) {
      content = fs.readFileSync(readmePath, 'utf8');
    }

    const sections = this.extractSections(content);
    sections['## Features'] = this.generateFeaturesSection();
    sections['## API Endpoints'] = this.generateAPIEndpointsSection();
    sections['## Quick Start'] = this.generateQuickStartSection();
    sections['## Scripts'] = this.generateScriptsSection();

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
  async updateQuickStart() {
    const quickStartPath = path.join(this.projectPath, 'QUICK-START.md');
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
  async updateScripts() {
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
  async updateApiDocs() {
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
  extractSections(content) {
    const sections = {};
    const lines = content.split('\n');
    let currentSection = '';
    let currentContent = [];

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

  rebuildReadme(sections, original) {
    let content = original.split(/^##+\s+/m)[0] || '# Project\n\n';
    
    Object.entries(sections).forEach(([title, sectionContent]) => {
      content += `\n## ${title}\n\n${sectionContent}\n`;
    });

    return content;
  }

  generateFeaturesSection() {
    return [
      '✅ Real-time API endpoint tracking',
      '✅ Automatic documentation updates',
      '✅ Path validation between frontend/backend',
      '✅ Component registry and usage tracking',
      '✅ Auto-generated API clients',
    ].join('\n');
  }

  generateAPIEndpointsSection() {
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

  generateQuickStartSection() {
    return `\`\`\`bash
# Install dependencies
npm install

# Start tracking
npm run start-tracking

# Validate paths
npm run validate-paths
\`\`\``;
  }

  generateScriptsSection() {
    const scripts = this.getAvailableScripts();
    let content = '| Script | Description |\n';
    content += '|-------|-------------|\n';

    scripts.forEach(script => {
      content += `| \`${script.name}\` | ${script.description} |\n`;
    });

    return content;
  }

  generateQuickStartContent() {
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

  getAvailableScripts() {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(this.projectPath, 'package.json'), 'utf8')
      );
      
      return Object.entries(packageJson.scripts || {}).map(([name, script]) => ({
        name,
        description: this.extractScriptDescription(script),
      }));
    } catch {
      return [];
    }
  }

  extractScriptDescription(script) {
    if (script.includes('analyze')) return 'Analyze project structure';
    if (script.includes('polish')) return 'Polish and improve code';
    if (script.includes('validate')) return 'Validate code quality';
    if (script.includes('build')) return 'Build project';
    return 'Run script';
  }

  generateScriptsDocumentation(scripts) {
    let content = '# Available Scripts\n\n';
    content += '| Script | Description |\n';
    content += '|-------|-------------|\n';

    scripts.forEach(script => {
      content += `| \`npm run ${script.name}\` | ${script.description} |\n`;
    });

    return content;
  }

  generateAPIDocumentation(endpoints) {
    let content = '# API Documentation\n\n';
    
    if (endpoints.length === 0) {
      return content + 'No API endpoints registered yet.';
    }

    const byBasePath = new Map();
    endpoints.forEach(endpoint => {
      const basePath = endpoint.fullPath.split('/').slice(0, 3).join('/');
      if (!byBasePath.has(basePath)) {
        byBasePath.set(basePath, []);
      }
      byBasePath.get(basePath).push(endpoint);
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

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch {}

    return {
      updateFrequency: 'weekly',
      updateReadme: true,
      updateQuickStart: true,
      updateScripts: true,
      updateApiDocs: true,
    };
  }

  saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save documentation config:', error);
    }
  }
}

module.exports = { documentationUpdater: new DocumentationUpdater() };

