/**
 * AI Agent Types for Reality Mode
 * 
 * Defines the interfaces for AI-powered autonomous testing.
 */

export interface AIAgentConfig {
  /** OpenAI API key or anthropic key */
  apiKey: string;
  /** Model to use (gpt-4-vision-preview, claude-3-opus, etc.) */
  model: string;
  /** Base URL for the app to test */
  baseUrl: string;
  /** Maximum number of actions the agent can take */
  maxActions: number;
  /** Timeout per action in ms */
  actionTimeout: number;
  /** Whether to use vision (screenshot analysis) */
  useVision: boolean;
  /** Natural language goal for the agent */
  goal: string;
  /** Optional test scenarios to run */
  scenarios?: TestScenario[];
  /** Output directory for screenshots and reports */
  outputDir: string;
  /** Headless mode */
  headless: boolean;
  /** Viewport size */
  viewport: { width: number; height: number };
}

export interface TestScenario {
  name: string;
  description: string;
  goal: string;
  startUrl?: string;
  expectedOutcome?: string;
  maxActions?: number;
}

export interface PageState {
  url: string;
  title: string;
  screenshot?: string; // base64
  html?: string;
  elements: PageElement[];
  forms: FormInfo[];
  errors: string[];
  networkCalls: NetworkCall[];
}

export interface PageElement {
  id: string;
  selector: string;
  type: 'button' | 'link' | 'input' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'other';
  text: string;
  placeholder?: string;
  isVisible: boolean;
  isEnabled: boolean;
  ariaLabel?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface FormInfo {
  selector: string;
  fields: FormField[];
  submitButton?: string;
}

export interface FormField {
  name: string;
  type: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  value?: string;
}

export interface NetworkCall {
  url: string;
  method: string;
  status?: number;
  requestBody?: any;
  responseBody?: any;
  timestamp: number;
}

export interface AgentAction {
  type: 'click' | 'fill' | 'select' | 'navigate' | 'scroll' | 'wait' | 'screenshot' | 'assert' | 'hover' | 'press';
  target?: string;
  value?: string;
  reasoning: string;
  confidence: number;
}

export interface AgentStep {
  stepNumber: number;
  action: AgentAction;
  beforeState: PageState;
  afterState?: PageState;
  success: boolean;
  error?: string;
  duration: number;
  screenshot?: string;
}

export interface AgentThought {
  observation: string;
  reasoning: string;
  plan: string[];
  nextAction: AgentAction;
}

export interface ScenarioResult {
  scenario: TestScenario;
  status: 'success' | 'partial' | 'failed';
  steps: AgentStep[];
  totalActions: number;
  successfulActions: number;
  errors: string[];
  duration: number;
  finalState: PageState;
  aiSummary: string;
}

export interface AIAgentResult {
  config: AIAgentConfig;
  scenarios: ScenarioResult[];
  overallScore: number;
  grade: string;
  summary: {
    totalScenarios: number;
    successfulScenarios: number;
    partialScenarios: number;
    failedScenarios: number;
    totalActions: number;
    successfulActions: number;
  };
  recommendations: string[];
  duration: number;
  timestamp: string;
}

export interface AIProvider {
  name: string;
  analyzePageState(state: PageState, goal: string, history: AgentStep[]): Promise<AgentThought>;
  generateTestData(fieldType: string, context: string): Promise<string>;
  summarizeResults(results: ScenarioResult[]): Promise<string>;
}
