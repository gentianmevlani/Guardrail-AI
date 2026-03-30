/**
 * Auto-Setup System
 * 
 * Conversational setup that auto-detects and integrates everything
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface SetupContext {
  ide?: 'vscode' | 'cursor' | 'windsurf' | 'unknown';
  hasMCP?: boolean;
  hasGit?: boolean;
  projectType?: 'nextjs' | 'react' | 'vite' | 'vue' | 'nuxt' | 'svelte' | 'angular' | 'remix' | 'express' | 'fastify' | 'nest' | 'node' | 'django' | 'flask' | 'fastapi' | 'python' | 'unknown';
  needsIntegration?: boolean;
}

export interface SetupResult {
  success: boolean;
  steps: Array<{
    step: string;
    status: 'completed' | 'skipped' | 'failed';
    message: string;
  }>;
  nextSteps: string[];
}

class AutoSetup {
  /**
   * Conversational setup - just talk to it
   */
  async setupFromConversation(projectPath: string = process.cwd()): Promise<SetupResult> {
    console.log('\n🤖 Hi! I\'m guardrail AI. Let me set everything up for you!\n');
    
    const steps: SetupResult['steps'] = [];
    
    // Step 1: Detect environment
    console.log('🔍 Step 1: Detecting your setup...');
    const context = await this.detectEnvironment(projectPath);
    steps.push({
      step: 'Detect Environment',
      status: 'completed',
      message: `Found: ${context.ide || 'Unknown IDE'}, ${context.projectType || 'Unknown project'}`,
    });
    
    // Step 2: Auto-integrate IDE
    if (context.ide && context.ide !== 'unknown') {
      console.log(`\n🔌 Step 2: Setting up ${context.ide}...`);
      const ideResult = await this.autoIntegrateIDE(context.ide, projectPath);
      steps.push({
        step: `Setup ${context.ide}`,
        status: ideResult ? 'completed' : 'failed',
        message: ideResult ? 'IDE integration complete!' : 'Could not auto-setup IDE',
      });
    }
    
    // Step 3: Setup MCP (if needed)
    if (context.needsIntegration) {
      console.log('\n🔗 Step 3: Setting up MCP integration...');
      const mcpResult = await this.autoSetupMCP(projectPath);
      steps.push({
        step: 'Setup MCP',
        status: mcpResult ? 'completed' : 'failed',
        message: mcpResult ? 'MCP integration complete!' : 'MCP setup skipped',
      });
    }
    
    // Step 4: Setup guardrails
    console.log('\n🛡️ Step 4: Setting up guardrails...');
    const guardrailsResult = await this.autoSetupGuardrails(projectPath);
    steps.push({
      step: 'Setup Guardrails',
      status: guardrailsResult ? 'completed' : 'failed',
      message: guardrailsResult ? 'Guardrails configured!' : 'Guardrails setup failed',
    });
    
    // Step 5: Build context
    console.log('\n🧠 Step 5: Building codebase context...');
    const contextResult = await this.autoBuildContext(projectPath);
    steps.push({
      step: 'Build Context',
      status: contextResult ? 'completed' : 'skipped',
      message: contextResult ? 'Context built successfully!' : 'Context build skipped',
    });
    
    console.log('\n✅ Setup complete! You\'re all set!\n');
    
    return {
      success: steps.every(s => s.status !== 'failed'),
      steps,
      nextSteps: this.generateNextSteps(context),
    };
  }

  /**
   * Detect environment automatically
   */
  private async detectEnvironment(projectPath: string): Promise<SetupContext> {
    const context: SetupContext = {};
    
    // Detect IDE
    context.ide = await this.detectIDE();
    
    // Detect project type
    context.projectType = await this.detectProjectType(projectPath);
    
    // Check for MCP
    context.hasMCP = await this.checkMCP(projectPath);
    
    // Check for Git
    context.hasGit = await this.checkGit(projectPath);
    
    // Determine if integration needed
    context.needsIntegration = !context.hasMCP || context.ide === 'unknown';
    
    return context;
  }

  /**
   * Detect which IDE is being used
   */
  private async detectIDE(): Promise<SetupContext['ide']> {
    // Check for Cursor
    if (process.env.CURSOR === '1' || process.env.CURSOR_APP) {
      return 'cursor';
    }
    
    // Check for VS Code
    if (process.env.VSCODE === '1' || process.env.VSCODE_INJECTION) {
      return 'vscode';
    }
    
    // Check for Windsurf
    if (process.env.WINDSURF === '1') {
      return 'windsurf';
    }
    
    // Check config files
    const projectPath = process.cwd();
    if (await this.pathExists(path.join(projectPath, '.cursor'))) {
      return 'cursor';
    }
    if (await this.pathExists(path.join(projectPath, '.vscode'))) {
      return 'vscode';
    }
    
    return 'unknown';
  }

  /**
   * Detect project type
   */
  private async detectProjectType(projectPath: string): Promise<SetupContext['projectType']> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (await this.pathExists(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        // Full-stack frameworks (check first as they include frontend)
        if (deps.next) return 'nextjs';
        if (deps.nuxt || deps['@nuxt/core']) return 'nuxt';
        if (deps['@remix-run/node'] || deps['@remix-run/react']) return 'remix';
        
        // Backend frameworks
        if (deps['@nestjs/core']) return 'nest';
        if (deps.fastify) return 'fastify';
        if (deps.express) return 'express';
        
        // Frontend frameworks
        if (deps['@angular/core']) return 'angular';
        if (deps.svelte || deps['svelte-kit']) return 'svelte';
        if (deps.vue) {
          // Check if it's using Vite (common with Vue)
          if (deps.vite || await this.pathExists(path.join(projectPath, 'vite.config.ts')) || 
              await this.pathExists(path.join(projectPath, 'vite.config.js'))) {
            return 'vue'; // Vue with Vite
          }
          return 'vue';
        }
        
        // React-based projects
        if (deps.react || deps['react-dom']) {
          // Check for Vite
          if (deps.vite || deps['@vitejs/plugin-react'] || 
              await this.pathExists(path.join(projectPath, 'vite.config.ts')) ||
              await this.pathExists(path.join(projectPath, 'vite.config.js'))) {
            return 'vite';
          }
          // Check for other React build tools
          if (deps.webpack || await this.pathExists(path.join(projectPath, 'webpack.config.js'))) {
            return 'react';
          }
          return 'react';
        }
        
        // Node.js projects
        if (deps['@types/node'] || await this.pathExists(path.join(projectPath, 'tsconfig.json'))) {
          return 'node';
        }
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }
    
    // Python frameworks
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    if (await this.pathExists(requirementsPath)) {
      try {
        const requirements = await fs.promises.readFile(requirementsPath, 'utf8');
        if (requirements.includes('django')) return 'django';
        if (requirements.includes('fastapi')) return 'fastapi';
        if (requirements.includes('flask')) return 'flask';
        return 'python';
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }
    
    // Check for manage.py (Django)
    if (await this.pathExists(path.join(projectPath, 'manage.py'))) {
      return 'django';
    }
    
    return 'unknown';
  }

  /**
   * Check if MCP is already set up
   */
  private async checkMCP(projectPath: string): Promise<boolean> {
    // Check for MCP config files
    const mcpConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');
    const mcpConfigPath2 = path.join(os.homedir(), '.config', 'cursor', 'mcp.json');
    
    return await this.pathExists(mcpConfigPath) || await this.pathExists(mcpConfigPath2);
  }

  /**
   * Check if Git is initialized
   */
  private async checkGit(projectPath: string): Promise<boolean> {
    return await this.pathExists(path.join(projectPath, '.git'));
  }

  /**
   * Auto-integrate with IDE
   */
  private async autoIntegrateIDE(ide: 'vscode' | 'cursor' | 'windsurf', projectPath: string): Promise<boolean> {
    try {
      switch (ide) {
        case 'cursor':
          return await this.setupCursor(projectPath);
        case 'vscode':
          return await this.setupVSCode(projectPath);
        case 'windsurf':
          return await this.setupWindsurf(projectPath);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to setup ${ide}:`, error);
      return false;
    }
  }

  /**
   * Setup Cursor integration
   */
  private async setupCursor(projectPath: string): Promise<boolean> {
    // Create .cursorrules if it doesn't exist
    const cursorRulesPath = path.join(projectPath, '.cursorrules');
    if (!(await this.pathExists(cursorRulesPath))) {
      const rulesContent = `# guardrail AI - Auto-Generated Rules

This file was automatically created by guardrail AI to help your AI assistant understand your project better.

## How It Works

guardrail AI has scanned your codebase and created context files that help AI assistants:
- Understand your project structure
- Follow your coding conventions
- Use correct patterns and templates
- Avoid common mistakes

## What's Included

- Project architecture and structure
- API endpoints and data models
- Code patterns and conventions
- Best practices for your stack

## Updating

Run \`guardrail context\` to update these rules when your codebase changes.

---

For more information, visit: https://guardrail.dev
`;
      await fs.promises.writeFile(cursorRulesPath, rulesContent);
    }

    // Setup MCP for Cursor
    await this.setupMCPForCursor(projectPath);
    
    return true;
  }

  /**
   * Setup VS Code integration
   */
  private async setupVSCode(projectPath: string): Promise<boolean> {
    const vscodeDir = path.join(projectPath, '.vscode');
    await fs.promises.mkdir(vscodeDir, { recursive: true });
    
    // Create settings.json
    const settingsPath = path.join(vscodeDir, 'settings.json');
    let settings: Record<string, unknown> = {};
    
    if (await this.pathExists(settingsPath)) {
      try {
        settings = JSON.parse(await fs.promises.readFile(settingsPath, 'utf8'));
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }
    
    settings['files.associations'] = {
      ...settings['files.associations'],
      '.cursorrules': 'markdown',
    };
    
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    
    return true;
  }

  /**
   * Setup Windsurf integration
   */
  private async setupWindsurf(projectPath: string): Promise<boolean> {
    // Similar to Cursor
    return await this.setupCursor(projectPath);
  }

  /**
   * Auto-setup MCP
   */
  private async autoSetupMCP(projectPath: string): Promise<boolean> {
    const ide = await this.detectIDE();
    
    if (ide === 'cursor') {
      return await this.setupMCPForCursor(projectPath);
    }
    
    // For other IDEs, provide instructions
    return false;
  }

  /**
   * Setup MCP for Cursor
   */
  private async setupMCPForCursor(projectPath: string): Promise<boolean> {
    try {
      const mcpConfigPath = path.join(os.homedir(), '.cursor', 'mcp.json');
      const mcpConfigDir = path.dirname(mcpConfigPath);
      
      await fs.promises.mkdir(mcpConfigDir, { recursive: true });
      
      let mcpConfig: Record<string, unknown> = {};
      if (await this.pathExists(mcpConfigPath)) {
        try {
          mcpConfig = JSON.parse(await fs.promises.readFile(mcpConfigPath, 'utf8'));
        } catch (error) {
        // Failed to process - continue with other operations
      }
      }
      
      if (!mcpConfig.mcpServers) {
        mcpConfig.mcpServers = {};
      }
      
      // Add guardrail AI MCP server
      mcpConfig.mcpServers['guardrail-ai'] = {
        command: 'node',
        args: [path.join(projectPath, 'node_modules', '@guardrail-ai', 'core', 'mcp-server', 'index.js')],
        env: {
          PROJECT_PATH: projectPath,
        },
      };
      
      await fs.promises.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2));
      
      console.log('   ✅ MCP configured! Restart Cursor to activate.');
      return true;
    } catch (error) {
      console.log('   ⚠️  Could not auto-configure MCP. Manual setup may be needed.');
      return false;
    }
  }

  /**
   * Auto-setup guardrails
   */
  private async autoSetupGuardrails(projectPath: string): Promise<boolean> {
    try {
      // Run guardrails setup
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run complete-setup', { cwd: projectPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Auto-build context
   */
  private async autoBuildContext(projectPath: string): Promise<boolean> {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      await execAsync('npm run build-context', { cwd: projectPath });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate next steps
   */
  private generateNextSteps(context: SetupContext): string[] {
    const steps: string[] = [];
    
    if (context.ide === 'cursor') {
      steps.push('Restart Cursor to activate MCP integration');
      steps.push('Start chatting with your AI assistant - it now has full project context!');
    } else if (context.ide === 'vscode') {
      steps.push('Install guardrail AI extension (if available)');
      steps.push('Open .cursorrules file to see your project context');
    } else {
      steps.push('Run "guardrail context" to build your project context');
      steps.push('Use "guardrail help" to see all available commands');
    }
    
    steps.push('Try: "guardrail analyze my project" to get started');
    steps.push('Visit https://guardrail.dev/docs for more help');
    
    return steps;
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const autoSetup = new AutoSetup();

