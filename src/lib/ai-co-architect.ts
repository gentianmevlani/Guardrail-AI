/**
 * AI Co-Architect
 * 
 * Conversational AI app designer - users can design entire AI apps from scratch
 */

import { llmOrchestrator } from './llm-orchestrator';
import { Workflow } from './llm-orchestrator';

export interface AppDesign {
  name: string;
  description: string;
  useCase: string;
  workflow: Workflow;
  requirements: string[];
  techStack: string[];
  deployment: string;
}

class AICoArchitect {
  /**
   * Design AI app from conversation
   */
  async designFromConversation(description: string): Promise<AppDesign> {
    // Parse user requirements
    const requirements = this.extractRequirements(description);
    
    // Determine use case
    const useCase = this.determineUseCase(description);
    
    // Generate workflow
    const workflow = await llmOrchestrator.createWorkflowFromNL(description);
    
    // Suggest tech stack
    const techStack = this.suggestTechStack(workflow, useCase);
    
    // Determine deployment
    const deployment = this.suggestDeployment(workflow);
    
    return {
      name: this.generateAppName(description),
      description,
      useCase,
      workflow,
      requirements,
      techStack,
      deployment,
    };
  }

  /**
   * Example: "I want a workflow that monitors tweets, classifies sentiment, and emails me alerts if negative mentions spike."
   */
  async designMonitoringApp(description: string): Promise<AppDesign> {
    const design = await this.designFromConversation(description);
    
    // Enhance workflow for monitoring use case
    design.workflow = await this.enhanceMonitoringWorkflow(design.workflow);
    
    return design;
  }

  /**
   * Scaffold code for designed app
   */
  async scaffoldCode(design: AppDesign, language: string = 'typescript'): Promise<string> {
    const templates = {
      typescript: this.generateTypeScriptScaffold,
      javascript: this.generateJavaScriptScaffold,
      python: this.generatePythonScaffold,
      rust: this.generateRustScaffold,
    };

    const generator = templates[language as keyof typeof templates] || templates.typescript;
    return generator(design);
  }

  // Private methods
  private extractRequirements(description: string): string[] {
    const requirements: string[] = [];
    
    // Extract action verbs
    const actions = description.match(/(monitor|classify|send|alert|analyze|process|generate)/gi);
    if (actions) {
      requirements.push(...actions.map(a => a.toLowerCase()));
    }

    // Extract data sources
    const sources = description.match(/(tweets|emails|api|database|files)/gi);
    if (sources) {
      requirements.push(...sources.map(s => s.toLowerCase()));
    }

    // Extract outputs
    const outputs = description.match(/(email|notification|alert|report|dashboard)/gi);
    if (outputs) {
      requirements.push(...outputs.map(o => o.toLowerCase()));
    }

    return [...new Set(requirements)];
  }

  private determineUseCase(description: string): string {
    if (description.includes('monitor') || description.includes('alert')) {
      return 'monitoring';
    }
    if (description.includes('chatbot') || description.includes('conversation')) {
      return 'chatbot';
    }
    if (description.includes('content') || description.includes('generate')) {
      return 'content-generation';
    }
    if (description.includes('analyze') || description.includes('analytics')) {
      return 'analytics';
    }
    if (description.includes('code') || description.includes('assistant')) {
      return 'code-assistant';
    }
    return 'general';
  }

  private suggestTechStack(workflow: Workflow, useCase: string): string[] {
    const stack: string[] = [];

    // Base stack
    stack.push('Node.js', 'TypeScript');

    // Based on use case
    if (useCase === 'monitoring') {
      stack.push('Cron', 'Email Service', 'Database');
    }
    if (useCase === 'chatbot') {
      stack.push('WebSocket', 'Express', 'Database');
    }
    if (useCase === 'content-generation') {
      stack.push('File System', 'Templates');
    }

    // Based on workflow nodes
    if (workflow.nodes.some(n => n.type === 'trigger')) {
      stack.push('Webhook Handler');
    }

    return stack;
  }

  private suggestDeployment(workflow: Workflow): string {
    if (workflow.triggers.some(t => t.type === 'schedule')) {
      return 'Serverless (Vercel/Netlify Functions)';
    }
    if (workflow.nodes.length > 10) {
      return 'Container (Docker)';
    }
    return 'Serverless';
  }

  private generateAppName(description: string): string {
    // Extract key words and create name
    const words = description.split(/\s+/).filter(w => w.length > 4);
    if (words.length > 0) {
      return words[0].charAt(0).toUpperCase() + words[0].slice(1) + 'App';
    }
    return 'AIGeneratedApp';
  }

  private async enhanceMonitoringWorkflow(workflow: Workflow): Promise<Workflow> {
    // Add monitoring-specific nodes
    workflow.nodes.push({
      id: 'monitor-node',
      type: 'trigger',
      provider: 'custom',
      inputs: [],
      outputs: ['sentiment-node'],
      config: { interval: '5 minutes' },
    });

    workflow.nodes.push({
      id: 'sentiment-node',
      type: 'llm',
      provider: 'openai',
      model: 'gpt-4',
      prompt: 'Classify sentiment of the following text as positive, negative, or neutral:',
      inputs: ['monitor-node'],
      outputs: ['alert-node'],
    });

    workflow.nodes.push({
      id: 'alert-node',
      type: 'output',
      provider: 'custom',
      inputs: ['sentiment-node'],
      outputs: [],
      config: { type: 'email' },
    });

    return workflow;
  }

  private generateTypeScriptScaffold(design: AppDesign): string {
    return `/**
 * ${design.name}
 * 
 * ${design.description}
 * 
 * Generated by guardrail AI Co-Architect
 */

import { LLMOrchestrator } from '@guardrail-ai/orchestrator';

const orchestrator = new LLMOrchestrator();

// Workflow: ${design.workflow.name}
async function runWorkflow() {
  const execution = await orchestrator.executeWorkflow('${design.workflow.id}');
  return execution.results;
}

// Main entry point
async function main() {
  try {
    const results = await runWorkflow();
    console.log('Workflow completed:', results);
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

main();
`;
  }

  private generateJavaScriptScaffold(design: AppDesign): string {
    return `/**
 * ${design.name}
 * 
 * ${design.description}
 */

const { LLMOrchestrator } = require('@guardrail-ai/orchestrator');

const orchestrator = new LLMOrchestrator();

async function runWorkflow() {
  const execution = await orchestrator.executeWorkflow('${design.workflow.id}');
  return execution.results;
}

async function main() {
  try {
    const results = await runWorkflow();
    console.log('Workflow completed:', results);
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

main();
`;
  }

  private generatePythonScaffold(design: AppDesign): string {
    return `"""
${design.name}

${design.description}
"""

from Guardrail_orchestrator import LLMOrchestrator

orchestrator = LLMOrchestrator()

async def run_workflow():
    execution = await orchestrator.execute_workflow('${design.workflow.id}')
    return execution.results

async def main():
    try:
        results = await run_workflow()
        print('Workflow completed:', results)
    except Exception as error:
        print('Workflow failed:', error)

if __name__ == '__main__':
    main()
`;
  }

  private generateRustScaffold(design: AppDesign): string {
    return `// ${design.name}
// ${design.description}

use Guardrail_orchestrator::LLMOrchestrator;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let orchestrator = LLMOrchestrator::new();
    let execution = orchestrator.execute_workflow("${design.workflow.id}").await?;
    
    println!("Workflow completed: {:?}", execution.results);
    Ok(())
}
`;
  }
}

export const aiCoArchitect = new AICoArchitect();

