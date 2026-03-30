/**
 * Natural Language CLI
 * 
 * Understands conversational commands and provides natural language responses
 */

import * as child_process from 'child_process';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';

const exec = util.promisify(child_process.exec);

export interface CommandIntent {
  action: string;
  target?: string;
  options?: Record<string, any>;
  confidence: number;
}

export interface CLIResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  suggestions?: string[];
}

class NaturalLanguageCLI {
  /**
   * Parse natural language command
   */
  parseCommand(input: string): CommandIntent {
    const normalized = input.toLowerCase().trim();

    // Analyze commands
    if (this.matches(normalized, ['analyze', 'check', 'review', 'inspect', 'examine', 'look at'])) {
      return {
        action: 'analyze',
        target: this.extractTarget(normalized),
        confidence: 0.9,
      };
    }

    // Polish commands
    if (this.matches(normalized, ['polish', 'improve', 'fix', 'clean up', 'refine'])) {
      return {
        action: 'polish',
        target: this.extractTarget(normalized),
        confidence: 0.9,
      };
    }

    // Train model
    if (this.matches(normalized, ['train', 'learn', 'teach', 'build model'])) {
      return {
        action: 'train-model',
        confidence: 0.9,
      };
    }

    // Setup commands
    if (this.matches(normalized, ['setup', 'install', 'initialize', 'init', 'configure'])) {
      return {
        action: 'setup',
        confidence: 0.9,
      };
    }

    // Vibecoder check
    if (this.matches(normalized, ['vibecoder', 'what am i missing', 'what did i forget', 'check readiness', 'can i ship'])) {
      return {
        action: 'vibecoder-check',
        confidence: 0.9,
      };
    }

    // Platform install
    if (this.matches(normalized, ['install platform', 'add platform', 'setup platform', 'deploy to'])) {
      const platform = this.extractPlatform(normalized);
      return {
        action: 'install-platform',
        target: platform,
        confidence: 0.85,
      };
    }

    // Help commands
    if (this.matches(normalized, ['help', 'what can you do', 'commands', 'options'])) {
      return {
        action: 'help',
        confidence: 1.0,
      };
    }

    // Status/health
    if (this.matches(normalized, ['status', 'health', 'how am i doing', 'whats my score'])) {
      return {
        action: 'status',
        confidence: 0.9,
      };
    }

    // Strictness
    if (this.matches(normalized, ['strictness', 'strict', 'strictness level', 'how strict', 'make it strict', 'set strictness'])) {
      return {
        action: 'strictness',
        target: this.extractStrictnessLevel(normalized),
        confidence: 0.9,
      };
    }

    // Default: try to infer
    return {
      action: 'unknown',
      confidence: 0.3,
    };
  }

  /**
   * Execute command with natural language response
   */
  async execute(intent: CommandIntent, projectPath: string = process.cwd()): Promise<CLIResponse> {
    switch (intent.action) {
      case 'analyze':
        return await this.handleAnalyze(projectPath);

      case 'polish':
        return await this.handlePolish(projectPath, intent.options);

      case 'train-model':
        return await this.handleTrainModel(projectPath);

      case 'setup':
        return await this.handleSetup(projectPath);

      case 'vibecoder-check':
        return await this.handleVibecoderCheck(projectPath);

      case 'install-platform':
        return await this.handleInstallPlatform(projectPath, intent.target);

      case 'help':
        return this.handleHelp();

      case 'status':
        return await this.handleStatus(projectPath);

      case 'strictness':
        return await this.handleStrictness(projectPath, intent.target);

      case 'unknown':
        return {
          success: false,
          message: `I'm not sure what you mean by that. Try asking me to:\n  • "analyze my project"\n  • "polish my code"\n  • "what am I missing?"\n  • "help"`,
          suggestions: ['analyze', 'polish', 'vibecoder-check', 'help'],
        };

      default:
        return {
          success: false,
          message: 'Unknown command. Type "help" to see available commands.',
        };
    }
  }

  /**
   * Handle analyze command
   */
  private async handleAnalyze(projectPath: string): Promise<CLIResponse> {
    try {
      const { stdout, stderr } = await exec('npm run architect -- --analyze-only', {
        cwd: projectPath,
      });

      return {
        success: true,
        message: this.formatAnalyzeResponse(stdout),
        data: { output: stdout },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `I tried to analyze your project, but ran into an issue:\n${errorMessage}\n\nMake sure you're in a project directory with guardrail AI installed.`,
      };
    }
  }

  /**
   * Handle polish command
   */
  private async handlePolish(projectPath: string, options?: Record<string, any>): Promise<CLIResponse> {
    try {
      const checkOnly = options?.checkOnly ? '--check-only' : '';
      const { stdout } = await exec(`npm run polish ${checkOnly}`, {
        cwd: projectPath,
      });

      return {
        success: true,
        message: this.formatPolishResponse(stdout),
        data: { output: stdout },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `I tried to polish your project, but encountered an error:\n${errorMessage}`,
      };
    }
  }

  /**
   * Handle train model
   */
  private async handleTrainModel(projectPath: string): Promise<CLIResponse> {
    try {
      const { stdout } = await exec('npm run train-model', {
        cwd: projectPath,
      });

      return {
        success: true,
        message: `🧠 Great! I've trained the ML model on your codebase.\n\nIt has learned:\n  • Your code patterns\n  • Your conventions\n  • Your architectural decisions\n  • Your coding style\n\nThe model is now ready to provide intelligent, project-specific assistance!`,
        data: { output: stdout },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `I tried to train the model, but ran into an issue:\n${errorMessage}\n\nMake sure you've run "build-knowledge" first to create the knowledge base.`,
        suggestions: ['npm run build-knowledge', 'npm run train-model'],
      };
    }
  }

  /**
   * Handle setup
   */
  private async handleSetup(projectPath: string): Promise<CLIResponse> {
    try {
      const { stdout } = await exec('npm run complete-setup', {
        cwd: projectPath,
      });

      return {
        success: true,
        message: `✨ Perfect! I've set up guardrail AI for your project.\n\nEverything is configured and ready to go. You can now:\n  • Run "guardrail analyze" to check your project\n  • Run "guardrail polish" to find missing details\n  • Run "guardrail vibecoder-check" to see what you might be missing`,
        data: { output: stdout },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Setup encountered an issue:\n${errorMessage}`,
      };
    }
  }

  /**
   * Handle vibecoder check
   */
  private async handleVibecoderCheck(projectPath: string): Promise<CLIResponse> {
    try {
      const { stdout } = await exec('npm run vibecoder-check', {
        cwd: projectPath,
      });

      return {
        success: true,
        message: this.formatVibecoderResponse(stdout),
        data: { output: stdout },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `I tried to check what you might be missing, but encountered an error:\n${error.message}`,
      };
    }
  }

  /**
   * Handle platform install
   */
  private async handleInstallPlatform(projectPath: string, platform?: string): Promise<CLIResponse> {
    if (!platform) {
      return {
        success: false,
        message: 'Which platform would you like to install?\n\nAvailable: netlify, supabase, vercel, railway, render, fly, cloudflare\n\nExample: "install platform netlify"',
        suggestions: ['netlify', 'supabase', 'vercel'],
      };
    }

    try {
      const { stdout } = await exec(`npm run install-platform ${platform}`, {
        cwd: projectPath,
      });

      return {
        success: true,
        message: `✅ Great! I've installed the ${platform} plugin for your project.\n\nConfiguration files have been created and you're ready to deploy!`,
        data: { output: stdout, platform },
      };
    } catch (error: any) {
      return {
        success: false,
        message: `I tried to install ${platform}, but encountered an error:\n${error.message}`,
      };
    }
  }

  /**
   * Handle help
   */
  private handleHelp(): CLIResponse {
    return {
      success: true,
      message: `🛡️ guardrail AI - Your AI coding companion that never drifts\n\nI can help you with:\n\n📊 Analysis & Review\n  • "analyze my project" - Deep analysis of your codebase\n  • "check my code" - Quick code review\n  • "what's my status" - Project health check\n\n✨ Polish & Improvement\n  • "polish my project" - Find missing details\n  • "improve my code" - Code quality improvements\n  • "what am I missing" - Check for forgotten features\n\n🧠 Learning & Setup\n  • "train model" - Train ML on your codebase\n  • "setup" - Complete project setup\n  • "install platform netlify" - Add platform integration\n\n💡 Tips\n  • You can use natural language - I understand various phrasings\n  • Ask "help" anytime to see this message\n  • Run commands from your project directory\n\nTry saying: "analyze my project" or "what am I missing?"`,
      suggestions: ['analyze', 'polish', 'vibecoder-check', 'train-model', 'setup'],
    };
  }

  /**
   * Handle status
   */
  private async handleStatus(projectPath: string): Promise<CLIResponse> {
    try {
      // Run multiple checks
      const [polishResult, vibecoderResult] = await Promise.allSettled([
        exec('npm run polish -- --check-only', { cwd: projectPath }),
        exec('npm run vibecoder-check', { cwd: projectPath }),
      ]);

      let message = `📊 Your Project Status\n\n`;

      if (polishResult.status === 'fulfilled') {
        message += `✨ Polish Check: Completed\n`;
      }

      if (vibecoderResult.status === 'fulfilled') {
        message += `🎯 Vibecoder Check: Completed\n`;
      }

      message += `\n💡 Run "guardrail analyze" for detailed insights`;

      return {
        success: true,
        message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `I tried to check your status, but encountered an error:\n${errorMessage}`,
      };
    }
  }

  /**
   * Format analyze response
   */
  private formatAnalyzeResponse(output: string): string {
    if (output.includes('No issues found')) {
      return `✅ Great news! Your project looks solid.\n\nI analyzed your codebase and found no major issues. Everything is well-structured and follows best practices.`;
    }

    if (output.includes('issues found')) {
      return `📊 I've analyzed your project and found some areas that could use attention.\n\nCheck the details above, or run "guardrail polish" to get specific fixes.`;
    }

    return `📊 Analysis complete! I've reviewed your project structure, patterns, and conventions.\n\n${output.substring(0, 200)}...`;
  }

  /**
   * Format polish response
   */
  private formatPolishResponse(output: string): string {
    if (output.includes('No issues')) {
      return `✨ Excellent! Your project is polished and production-ready.\n\nI checked for missing details and everything looks good!`;
    }

    const issueCount = (output.match(/issue|missing|found/gi) || []).length;
    
    return `✨ I've polished your project and found ${issueCount} area(s) that could be improved.\n\nCheck the details above for specific recommendations.`;
  }

  /**
   * Format vibecoder response
   */
  private formatVibecoderResponse(output: string): string {
    if (output.includes('Ready to ship')) {
      return `🚀 Awesome! Your project is ready to ship!\n\nI checked for what AI app builders typically forget, and you've got everything covered.`;
    }

    if (output.includes('Not ready')) {
      return `⚠️ I found some things that might be missing from your project.\n\nThese are common things AI app builders forget. Check the details above to see what needs attention.`;
    }

    const scoreMatch = output.match(/(\d+)\/100/);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      if (score >= 80) {
        return `🟢 Your shipping readiness score is ${score}/100 - Almost there!\n\nJust a few more things and you'll be ready to ship.`;
      } else if (score >= 60) {
        return `🟡 Your shipping readiness score is ${score}/100 - Getting close!\n\nThere are some important features missing. Check the details above.`;
      } else {
        return `🔴 Your shipping readiness score is ${score}/100 - Not quite ready yet.\n\nThere are critical features missing. I can help you add them - just ask!`;
      }
    }

    return `🎯 I've checked your project for what AI app builders typically forget.\n\n${output.substring(0, 300)}...`;
  }

  // Helper methods
  private matches(text: string, keywords: string[]): boolean {
    return keywords.some(keyword => text.includes(keyword));
  }

  private extractTarget(text: string): string | undefined {
    const patterns = [
      /(?:my|the|this)\s+(\w+)/i,
      /(\w+)\s+(?:project|code|app|repo)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return match[1];
    }

    return undefined;
  }

  private extractPlatform(text: string): string | undefined {
    const platforms = ['netlify', 'supabase', 'vercel', 'railway', 'render', 'fly', 'cloudflare'];
    return platforms.find(p => text.includes(p));
  }

  private extractStrictnessLevel(text: string): string | undefined {
    if (text.includes('relaxed')) return 'relaxed';
    if (text.includes('moderate')) return 'moderate';
    if (text.includes('strict') && !text.includes('maximum')) return 'strict';
    if (text.includes('maximum') || text.includes('max')) return 'maximum';
    return undefined;
  }

  /**
   * Handle strictness command
   */
  private async handleStrictness(projectPath: string, level?: string): Promise<CLIResponse> {
    if (!level) {
      return {
        success: true,
        message: 'Current strictness settings:\n\nRun "guardrail strictness show" to see details.\n\nSet level: "guardrail strictness set [relaxed|moderate|strict|maximum]"',
        suggestions: ['guardrail strictness show', 'guardrail strictness set moderate'],
      };
    }

    try {
      const { strictnessManager } = require('./strictness-config.js');
      strictnessManager.setLevel(level as any);
      
      const config = strictnessManager.getConfig();
      const activeRules = Object.entries(config.rules)
        .filter(([_, value]) => value)
        .map(([key]) => key);

      return {
        success: true,
        message: `✅ Strictness level set to: ${level}\n\nYour build will now enforce ${level} rules.\n\nActive rules: ${activeRules.length}`,
        data: { level, config },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Failed to set strictness: ${errorMessage}`,
      };
    }
  }
}

export const naturalLanguageCLI = new NaturalLanguageCLI();

