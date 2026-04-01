/**
 * LLM Orchestration System
 * 
 * Interactive workflow builder with chaining, triggers, async tasks.
 * Allows building complex AI workflows from natural language descriptions.
 * 
 * @module llm-orchestrator
 * @example
 * ```typescript
 * const orchestrator = new LLMOrchestrator();
 * const workflow = await orchestrator.createWorkflowFromNL(
 *   'Monitor tweets, classify sentiment, email alerts'
 * );
 * const result = await orchestrator.executeWorkflow(workflow.id);
 * ```
 */

import type { LLMCallInput, ParsedWorkflowDescription, NodeInput, NodeOutput, WorkflowResult } from './types/llm-orchestrator';

export interface LLMNode {
  id: string;
  type: 'llm' | 'transform' | 'condition' | 'trigger' | 'output';
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  model?: string;
  prompt?: string;
  config?: Record<string, unknown>;
  inputs: string[]; // IDs of nodes that feed into this
  outputs: string[]; // IDs of nodes this feeds into
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: LLMNode[];
  triggers: Trigger[];
  variables: Record<string, unknown>;
  metadata: {
    created: string;
    updated: string;
    version: number;
    author: string;
  };
}

export interface Trigger {
  id: string;
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  config: Record<string, unknown>;
  targetNode: string; // Node ID to trigger
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentNode?: string;
  results: Record<string, unknown>;
  errors: Array<{ node: string; error: string }>;
  startedAt: string;
  completedAt?: string;
}

class LLMOrchestrator {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();

  /**
   * Create new workflow from natural language
   */
  async createWorkflowFromNL(description: string): Promise<Workflow> {
    // Parse natural language description
    const parsed = this.parseNLDescription(description);
    
    // Generate workflow structure
    const workflow = this.generateWorkflow(parsed);
    
    // Save workflow
    this.workflows.set(workflow.id, workflow);
    
    return workflow;
  }

  /**
   * Execute workflow
   * 
   * Runs a workflow and executes all nodes in the correct order.
   * 
   * @param workflowId - ID of the workflow to execute
   * @param input - Optional input data for the workflow
   * @returns Workflow execution result
   * 
   * @example
   * ```typescript
   * const execution = await orchestrator.executeWorkflow(workflow.id, {
   *   query: 'latest tweets'
   * });
   * 
   * if (execution.status === 'completed') {
   *   console.log('Workflow completed successfully');
   * }
   * ```
   */
  async executeWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const execution: WorkflowExecution = {
      id: this.generateId(),
      workflowId,
      status: 'running',
      results: {},
      errors: [],
      startedAt: new Date().toISOString(),
      ...input,
    };

    this.executions.set(execution.id, execution);

    // Execute nodes in order
    await this.executeNodes(workflow, execution);

    return execution;
  }

  /**
   * Chain LLM calls
   */
  async chainLLMCalls(
    calls: Array<{
      provider: string;
      model: string;
      prompt: string;
      input?: any;
    }>
  ): Promise<any[]> {
    const results: any[] = [];
    let previousOutput: any = null;

    for (const call of calls) {
      const input = call.input || previousOutput;
      const result = await this.callLLM(call.provider, call.model, call.prompt, input);
      results.push(result);
      previousOutput = result;
    }

    return results;
  }

  /**
   * Handle async tasks
   */
  /**
   * Execute a node asynchronously
   * 
   * @param node - The node to execute
   * @param input - Input data for the node
   * @returns Promise that resolves with the node output
   */
  async executeAsync(node: LLMNode, input: NodeInput): Promise<Promise<NodeOutput>> {
    return new Promise(async (resolve, reject) => {
      try {
        const result = await this.processNode(node, input);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Set trigger
   */
  setTrigger(workflowId: string, trigger: Trigger): void {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    workflow.triggers.push(trigger);
    this.workflows.set(workflowId, workflow);
  }

  // Private methods
  private parseNLDescription(description: string): ParsedWorkflowDescription {
    // Parse natural language to extract:
    // - LLMs to use
    // - Steps/chains
    // - Conditions
    // - Outputs
    
    const parsed: ParsedWorkflowDescription = {
      steps: [],
      llms: [],
      conditions: [],
      outputs: [],
    };

    // Extract LLM mentions
    const llmPattern = /(GPT-4|GPT-3|Claude|Gemini|LLM|model)/gi;
    const llmMatches = description.match(llmPattern);
    if (llmMatches) {
      parsed.llms = [...new Set(llmMatches)];
    }

    // Extract steps (then, after, next)
    const stepPattern = /(?:then|after|next|followed by)\s+([^,\.]+)/gi;
    let stepMatch;
    while ((stepMatch = stepPattern.exec(description)) !== null) {
      parsed.steps.push(stepMatch[1].trim());
    }

    // Extract conditions (if, when, unless)
    const conditionPattern = /(?:if|when|unless)\s+([^,\.]+)/gi;
    let conditionMatch;
    while ((conditionMatch = conditionPattern.exec(description)) !== null) {
      parsed.conditions.push(conditionMatch[1].trim());
    }

    return parsed;
  }

  private generateWorkflow(parsed: any): Workflow {
    const nodes: LLMNode[] = [];
    let nodeId = 0;

    // Create nodes for each step
    for (const step of parsed.steps) {
      nodes.push({
        id: `node-${nodeId++}`,
        type: 'llm',
        provider: this.detectProvider(step),
        model: this.detectModel(step),
        prompt: step,
        inputs: nodeId > 1 ? [`node-${nodeId - 2}`] : [],
        outputs: [],
        config: {},
      });
    }

    // Connect nodes
    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].outputs = [nodes[i + 1].id];
    }

    return {
      id: this.generateId(),
      name: 'Generated Workflow',
      description: 'Auto-generated from natural language',
      nodes,
      triggers: [],
      variables: {},
      metadata: {
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        version: 1,
        author: 'system',
      },
    };
  }

  private async executeNodes(workflow: Workflow, execution: WorkflowExecution): Promise<void> {
    const executed = new Set<string>();
    const queue: string[] = [];

    // Find entry nodes (no inputs)
    const entryNodes = workflow.nodes.filter(n => n.inputs.length === 0);
    queue.push(...entryNodes.map(n => n.id));

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      if (executed.has(nodeId)) continue;

      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      // Check if all inputs are ready
      const inputsReady = node.inputs.every(inputId => executed.has(inputId));
      if (!inputsReady && node.inputs.length > 0) {
        queue.push(nodeId); // Re-queue
        continue;
      }

      try {
        execution.currentNode = nodeId;
        const input = this.getNodeInput(node, execution);
        const result = await this.processNode(node, input);
        
        execution.results[nodeId] = result;
        executed.add(nodeId);

        // Add output nodes to queue
        queue.push(...node.outputs);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        execution.errors.push({ node: nodeId, error: errorMessage });
        execution.status = 'failed';
        return;
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date().toISOString();
  }

  private async processNode(node: LLMNode, input: NodeInput): Promise<NodeOutput> {
    switch (node.type) {
      case 'llm':
        return await this.callLLM(
          node.provider,
          node.model || 'gpt-4',
          node.prompt || '',
          input
        );

      case 'transform':
        return await this.transformData(node, input);

      case 'condition':
        return await this.evaluateCondition(node, input);

      case 'output':
        return input;

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  private async callLLM(provider: string, model: string, prompt: string, input: NodeInput): Promise<NodeOutput> {
    // Simplified - would integrate with actual LLM APIs
    const fullPrompt = `${prompt}\n\nInput: ${JSON.stringify(input)}`;
    
    // Mock response
    return {
      provider,
      model,
      response: `Processed: ${fullPrompt.substring(0, 100)}...`,
      tokens: 150,
    };
  }

  private async transformData(node: LLMNode, input: NodeInput): Promise<NodeOutput> {
    // Apply transformations based on node config
    return input;
  }

  private async evaluateCondition(node: LLMNode, input: NodeInput): Promise<NodeOutput> {
    // Evaluate condition and route accordingly
    return true;
  }

  private getNodeInput(node: LLMNode, execution: WorkflowExecution): any {
    if (node.inputs.length === 0) {
      return execution.results['input'] || {};
    }

    // Combine inputs from previous nodes
    const inputs = node.inputs.map(inputId => execution.results[inputId]);
    return inputs.length === 1 ? inputs[0] : inputs;
  }

  private detectProvider(text: string): 'openai' | 'anthropic' | 'google' | 'custom' {
    if (text.toLowerCase().includes('gpt') || text.toLowerCase().includes('openai')) {
      return 'openai';
    }
    if (text.toLowerCase().includes('claude') || text.toLowerCase().includes('anthropic')) {
      return 'anthropic';
    }
    if (text.toLowerCase().includes('gemini') || text.toLowerCase().includes('google')) {
      return 'google';
    }
    return 'custom';
  }

  private detectModel(text: string): string {
    if (text.includes('GPT-4')) return 'gpt-4-turbo';
    if (text.includes('GPT-3')) return 'gpt-3.5-turbo';
    if (text.includes('Claude')) return 'claude-3-opus';
    if (text.includes('Gemini')) return 'gemini-pro';
    return 'gpt-4-turbo';
  }

  private generateId(): string {
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const llmOrchestrator = new LLMOrchestrator();

