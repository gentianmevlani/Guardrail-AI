/**
 * OpenAI Provider for AI Agent Reality Mode
 * 
 * Uses GPT-4 Vision to analyze pages and make intelligent decisions.
 */

import { AIProvider, PageState, AgentStep, AgentThought, AgentAction } from './types';

const SYSTEM_PROMPT = `You are an AI agent testing a web application. Your goal is to navigate and test the application like a real user would.

You will receive:
1. Current page state (URL, title, visible elements, forms)
2. A screenshot of the page (if vision is enabled)
3. The testing goal you need to achieve
4. History of actions you've already taken

Your job is to:
1. Observe the current state of the page
2. Reason about what you see and what actions would help achieve the goal
3. Plan your next steps
4. Choose the single best next action

IMPORTANT RULES:
- Be methodical and thorough
- If you see a login/signup form, try to fill it with test data
- If you encounter an error, try to recover or report it
- Don't get stuck in loops - if an action doesn't work, try something else
- Prioritize testing critical user flows (auth, main features, forms)
- Look for signs of fake/mock data or broken functionality

Available actions:
- click: Click on an element (provide selector)
- fill: Fill an input field (provide selector and value)
- select: Select an option from dropdown (provide selector and value)
- navigate: Go to a URL
- scroll: Scroll the page (provide direction: up/down)
- wait: Wait for something to load
- hover: Hover over an element
- press: Press a keyboard key (Enter, Escape, Tab, etc.)
- assert: Check if something exists on the page
- screenshot: Take a screenshot for the report

Respond in JSON format:
{
  "observation": "What you see on the current page",
  "reasoning": "Your thought process about what to do next",
  "plan": ["Step 1", "Step 2", "Step 3"],
  "nextAction": {
    "type": "click|fill|select|navigate|scroll|wait|hover|press|assert|screenshot",
    "target": "CSS selector or URL",
    "value": "Value to fill or select (if applicable)",
    "reasoning": "Why you chose this action",
    "confidence": 0.0-1.0
  }
}`;

export class OpenAIProvider implements AIProvider {
  name = 'openai';
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey: string, model: string = 'gpt-4o') {
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async analyzePageState(
    state: PageState,
    goal: string,
    history: AgentStep[]
  ): Promise<AgentThought> {
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Build the user message with page state
    let userContent: any[] = [];

    // Add screenshot if available (vision)
    if (state.screenshot) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/png;base64,${state.screenshot}`,
          detail: 'high'
        }
      });
    }

    // Add text description of the page
    const pageDescription = this.buildPageDescription(state, goal, history);
    userContent.push({
      type: 'text',
      text: pageDescription
    });

    messages.push({
      role: 'user',
      content: userContent
    });

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: 1000,
          temperature: 0.7,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsed = JSON.parse(content);
      return {
        observation: parsed.observation || 'Unable to observe page',
        reasoning: parsed.reasoning || 'No reasoning provided',
        plan: parsed.plan || [],
        nextAction: this.validateAction(parsed.nextAction)
      };
    } catch (error: any) {
      console.error('OpenAI API error:', error.message);
      // Return a safe fallback action
      return {
        observation: 'Error analyzing page',
        reasoning: error.message,
        plan: ['Recover from error'],
        nextAction: {
          type: 'screenshot',
          reasoning: 'Taking screenshot due to analysis error',
          confidence: 0.5
        }
      };
    }
  }

  async generateTestData(fieldType: string, context: string): Promise<string> {
    const testDataMap: Record<string, string> = {
      email: `test-${Date.now()}@guardrail.dev`,
      password: 'TestPass123!@#',
      name: 'Reality Test User',
      firstName: 'Reality',
      lastName: 'Tester',
      phone: '+1 (555) 123-4567',
      address: '123 Test Street',
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
      country: 'United States',
      company: 'guardrail Test Co',
      website: 'https://example.com',
      message: 'This is a test message from guardrail AI Agent.',
      search: 'test query',
      username: `testuser${Date.now()}`,
      cardNumber: '4242424242424242',
      cardExpiry: '12/28',
      cardCvc: '123',
      date: new Date().toISOString().split('T')[0],
      number: '42',
      url: 'https://example.com',
      text: 'Test input from guardrail AI Agent'
    };

    // Try to match field type
    const normalizedType = fieldType.toLowerCase();
    for (const [key, value] of Object.entries(testDataMap)) {
      if (normalizedType.includes(key)) {
        return value;
      }
    }

    // Default to generic text
    return testDataMap.text;
  }

  async summarizeResults(results: any[]): Promise<string> {
    const successCount = results.filter(r => r.status === 'success').length;
    const totalCount = results.length;
    
    const prompt = `Summarize these test results in 2-3 sentences:
    - Total scenarios: ${totalCount}
    - Successful: ${successCount}
    - Failed: ${totalCount - successCount}
    - Key issues found: ${results.flatMap(r => r.errors).slice(0, 5).join(', ') || 'None'}
    
    Be concise and actionable.`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.5
        })
      });

      const data = await response.json();
      return data.choices[0]?.message?.content || 'Unable to generate summary';
    } catch (error) {
      return `Tested ${totalCount} scenarios. ${successCount} passed, ${totalCount - successCount} failed.`;
    }
  }

  private buildPageDescription(state: PageState, goal: string, history: AgentStep[]): string {
    let description = `
GOAL: ${goal}

CURRENT PAGE:
- URL: ${state.url}
- Title: ${state.title}

VISIBLE ELEMENTS (${state.elements.length} total):
`;

    // Group elements by type
    const buttons = state.elements.filter(e => e.type === 'button' && e.isVisible);
    const links = state.elements.filter(e => e.type === 'link' && e.isVisible);
    const inputs = state.elements.filter(e => ['input', 'textarea', 'select'].includes(e.type) && e.isVisible);

    if (buttons.length > 0) {
      description += `\nButtons (${buttons.length}):\n`;
      buttons.slice(0, 15).forEach(b => {
        description += `  - "${b.text}" [${b.selector}]\n`;
      });
    }

    if (links.length > 0) {
      description += `\nLinks (${links.length}):\n`;
      links.slice(0, 10).forEach(l => {
        description += `  - "${l.text}" [${l.selector}]\n`;
      });
    }

    if (inputs.length > 0) {
      description += `\nInput Fields (${inputs.length}):\n`;
      inputs.slice(0, 10).forEach(i => {
        description += `  - ${i.type}: "${i.placeholder || i.text || 'unnamed'}" [${i.selector}]\n`;
      });
    }

    // Add forms
    if (state.forms.length > 0) {
      description += `\nForms (${state.forms.length}):\n`;
      state.forms.forEach(f => {
        description += `  - Form with ${f.fields.length} fields\n`;
        f.fields.forEach(field => {
          description += `    - ${field.type}: ${field.label || field.name} ${field.required ? '(required)' : ''}\n`;
        });
      });
    }

    // Add errors
    if (state.errors.length > 0) {
      description += `\nERRORS DETECTED:\n`;
      state.errors.forEach(e => {
        description += `  - ${e}\n`;
      });
    }

    // Add history
    if (history.length > 0) {
      description += `\nPREVIOUS ACTIONS (last 5):\n`;
      history.slice(-5).forEach((step, i) => {
        const status = step.success ? '✓' : '✗';
        description += `  ${i + 1}. ${status} ${step.action.type}: ${step.action.target || ''} ${step.action.value || ''}\n`;
        if (!step.success && step.error) {
          description += `     Error: ${step.error}\n`;
        }
      });
    }

    description += `\nWhat should be the next action to achieve the goal?`;

    return description;
  }

  private validateAction(action: any): AgentAction {
    const validTypes = ['click', 'fill', 'select', 'navigate', 'scroll', 'wait', 'hover', 'press', 'assert', 'screenshot'];
    
    if (!action || !validTypes.includes(action.type)) {
      return {
        type: 'screenshot',
        reasoning: 'Invalid action received, taking screenshot',
        confidence: 0.3
      };
    }

    return {
      type: action.type,
      target: action.target,
      value: action.value,
      reasoning: action.reasoning || 'No reasoning provided',
      confidence: typeof action.confidence === 'number' ? action.confidence : 0.5
    };
  }
}
