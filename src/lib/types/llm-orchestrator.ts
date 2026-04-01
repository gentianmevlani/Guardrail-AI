/**
 * LLM Orchestrator Type Definitions
 */

export interface LLMCallInput {
  provider: 'openai' | 'anthropic' | 'google' | 'custom';
  model: string;
  prompt: string;
  input?: unknown;
}

export interface ParsedWorkflowDescription {
  steps: Array<{
    type: string;
    description: string;
    llm?: string;
  }>;
  llms: Array<{
    provider: string;
    model: string;
    purpose: string;
  }>;
  conditions: Array<{
    condition: string;
    ifTrue: string;
    ifFalse: string;
  }>;
  outputs: Array<{
    type: string;
    format: string;
  }>;
}

export type NodeInput = unknown;
export type NodeOutput = unknown;
export type WorkflowResult = unknown;


