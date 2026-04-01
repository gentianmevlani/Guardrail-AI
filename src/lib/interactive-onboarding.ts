/**
 * Interactive Onboarding
 * 
 * Guides new users through setup in a friendly, conversational way
 */

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  explanation: string; // Why this step matters
  action: () => Promise<boolean>;
  optional?: boolean;
}

export interface OnboardingFlow {
  steps: OnboardingStep[];
  currentStep: number;
  completed: Set<string>;
}

class InteractiveOnboarding {
  /**
   * Start onboarding flow
   */
  async startOnboarding(projectPath: string = process.cwd()): Promise<void> {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🎓 Welcome to guardrail AI!                         ║
║                                                              ║
║  Let me guide you through setup - it's super easy!          ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

    const flow: OnboardingFlow = {
      steps: this.createSteps(projectPath),
      currentStep: 0,
      completed: new Set(),
    };

    for (let i = 0; i < flow.steps.length; i++) {
      flow.currentStep = i;
      const step = flow.steps[i];

      console.log(`\n📌 Step ${i + 1}/${flow.steps.length}: ${step.title}\n`);
      console.log(`${step.description}\n`);
      
      if (step.explanation) {
        console.log(`💡 Why this matters: ${step.explanation}\n`);
      }

      if (step.optional) {
        const answer = await this.askYesNo('This step is optional. Skip it? (y/n): ');
        if (answer) {
          console.log('   ⏭️  Skipped\n');
          continue;
        }
      }

      try {
        const result = await step.action();
        if (result) {
          flow.completed.add(step.id);
          console.log(`   ✅ ${step.title} - Complete!\n`);
        } else {
          console.log(`   ⚠️  ${step.title} - Had some issues, but continuing...\n`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.log(`   ❌ ${step.title} - Failed: ${errorMessage}\n`);
        if (!step.optional) {
          const continueAnyway = await this.askYesNo('Continue anyway? (y/n): ');
          if (!continueAnyway) {
            console.log('\n👋 Setup cancelled. You can run "guardrail setup" again anytime!\n');
            return;
          }
        }
      }

      // Small delay for readability
      await this.sleep(500);
    }

    console.log('\n🎉 Congratulations! You\'re all set up!\n');
    console.log('💡 What\'s next?\n');
    console.log('   • Try: "guardrail analyze my project"');
    console.log('   • Try: "guardrail what am I missing?"');
    console.log('   • Try: "guardrail help" for all commands');
    console.log('   • Your AI assistant now has full project context!\n');
  }

  /**
   * Create onboarding steps
   */
  private createSteps(projectPath: string): OnboardingStep[] {
    return [
      {
        id: 'detect',
        title: 'Detecting Your Setup',
        description: 'I\'m checking what IDE you\'re using and what kind of project this is.',
        explanation: 'This helps me set things up exactly right for your environment.',
        action: async () => {
          const { autoSetup } = require('./auto-setup');
          const context = await autoSetup['detectEnvironment'](projectPath);
          console.log(`   Found: ${context.ide || 'Unknown'} IDE, ${context.projectType || 'Unknown'} project`);
          return true;
        },
      },
      {
        id: 'ide',
        title: 'Setting Up Your IDE',
        description: 'I\'m configuring your IDE (Cursor/VS Code/etc.) to work with guardrail AI.',
        explanation: 'This lets your AI assistant understand your project automatically.',
        action: async () => {
          const { autoSetup } = require('./auto-setup');
          const context = await autoSetup['detectEnvironment'](projectPath);
          if (context.ide && context.ide !== 'unknown') {
            return await autoSetup['autoIntegrateIDE'](context.ide, projectPath);
          }
          return true;
        },
      },
      {
        id: 'mcp',
        title: 'Setting Up MCP (Don\'t worry, I\'ll explain!)',
        description: 'MCP stands for "Model Context Protocol" - it\'s how your AI assistant gets project context.',
        explanation: 'Think of it as giving your AI assistant a map of your project. You don\'t need to understand it - I\'ll handle everything!',
        action: async () => {
          const { autoSetup } = require('./auto-setup');
          return await autoSetup['autoSetupMCP'](projectPath);
        },
        optional: true,
      },
      {
        id: 'guardrails',
        title: 'Setting Up Guardrails',
        description: 'Guardrails help keep your AI assistant on track and prevent mistakes.',
        explanation: 'Like training wheels for AI - they ensure code quality and prevent common errors.',
        action: async () => {
          const { autoSetup } = require('./auto-setup');
          return await autoSetup['autoSetupGuardrails'](projectPath);
        },
      },
      {
        id: 'context',
        title: 'Building Project Context',
        description: 'I\'m scanning your codebase to understand your project structure, patterns, and conventions.',
        explanation: 'This helps your AI assistant write code that matches your style and follows your patterns.',
        action: async () => {
          const { autoSetup } = require('./auto-setup');
          return await autoSetup['autoBuildContext'](projectPath);
        },
      },
    ];
  }

  /**
   * Ask yes/no question
   */
  private async askYesNo(prompt: string): Promise<boolean> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const interactiveOnboarding = new InteractiveOnboarding();

