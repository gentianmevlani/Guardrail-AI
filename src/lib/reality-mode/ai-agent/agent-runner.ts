/**
 * AI Agent Runner for Reality Mode
 * 
 * Orchestrates the AI agent to autonomously test web applications.
 */

import type { Page, Browser, BrowserContext } from '@playwright/test';
import {
  AIAgentConfig,
  AIAgentResult,
  AIProvider,
  PageState,
  PageElement,
  FormInfo,
  AgentStep,
  AgentAction,
  TestScenario,
  ScenarioResult,
  NetworkCall
} from './types';
import { OpenAIProvider } from './openai-provider';

/**
 * Extract current page state for AI analysis
 */
async function extractPageState(page: Page, takeScreenshot: boolean = true): Promise<PageState> {
  const url = page.url();
  const title = await page.title();
  
  // Take screenshot if requested
  let screenshot: string | undefined;
  if (takeScreenshot) {
    const buffer = await page.screenshot({ type: 'png' });
    screenshot = buffer.toString('base64');
  }

  // Extract visible elements
  const elements: PageElement[] = await page.evaluate(() => {
    const results: any[] = [];
    let idCounter = 0;

    const getSelector = (el: Element): string => {
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.split(' ').filter(c => c.length > 0).slice(0, 2).join('.');
        if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
      }
      return el.tagName.toLowerCase();
    };

    const isVisible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && 
             style.visibility !== 'hidden' && 
             style.display !== 'none' &&
             style.opacity !== '0';
    };

    // Buttons
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(el => {
      if (isVisible(el)) {
        results.push({
          id: `el-${idCounter++}`,
          selector: getSelector(el),
          type: 'button',
          text: (el.textContent || '').trim().slice(0, 50),
          isVisible: true,
          isEnabled: !(el as HTMLButtonElement).disabled,
          ariaLabel: el.getAttribute('aria-label'),
          boundingBox: el.getBoundingClientRect()
        });
      }
    });

    // Links
    document.querySelectorAll('a[href]').forEach(el => {
      if (isVisible(el)) {
        results.push({
          id: `el-${idCounter++}`,
          selector: getSelector(el),
          type: 'link',
          text: (el.textContent || '').trim().slice(0, 50),
          isVisible: true,
          isEnabled: true,
          ariaLabel: el.getAttribute('aria-label'),
          boundingBox: el.getBoundingClientRect()
        });
      }
    });

    // Inputs
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (isVisible(el)) {
        const input = el as HTMLInputElement;
        results.push({
          id: `el-${idCounter++}`,
          selector: getSelector(el),
          type: input.tagName.toLowerCase() === 'select' ? 'select' : 
                input.type === 'checkbox' ? 'checkbox' :
                input.type === 'radio' ? 'radio' : 'input',
          text: input.value || '',
          placeholder: input.placeholder,
          isVisible: true,
          isEnabled: !input.disabled,
          ariaLabel: el.getAttribute('aria-label'),
          boundingBox: el.getBoundingClientRect()
        });
      }
    });

    return results;
  });

  // Extract forms
  const forms: FormInfo[] = await page.evaluate(() => {
    const results: any[] = [];
    
    document.querySelectorAll('form').forEach((form, idx) => {
      const fields: any[] = [];
      
      form.querySelectorAll('input, textarea, select').forEach(field => {
        const input = field as HTMLInputElement;
        const label = form.querySelector(`label[for="${input.id}"]`);
        
        fields.push({
          name: input.name || input.id || `field-${fields.length}`,
          type: input.type || 'text',
          label: label?.textContent?.trim(),
          placeholder: input.placeholder,
          required: input.required,
          value: input.value
        });
      });

      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      
      results.push({
        selector: form.id ? `#${form.id}` : `form:nth-of-type(${idx + 1})`,
        fields,
        submitButton: submitBtn ? (submitBtn.id ? `#${submitBtn.id}` : 'button[type="submit"]') : undefined
      });
    });

    return results;
  });

  // Capture console errors
  const errors: string[] = [];

  return {
    url,
    title,
    screenshot,
    elements,
    forms,
    errors,
    networkCalls: []
  };
}

/**
 * Execute a single action on the page
 */
async function executeAction(
  page: Page,
  action: AgentAction,
  provider: AIProvider
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'click':
        if (!action.target) throw new Error('No target specified for click');
        await page.click(action.target, { timeout: 5000 });
        await page.waitForLoadState('networkidle').catch(() => {});
        break;

      case 'fill':
        if (!action.target) throw new Error('No target specified for fill');
        const value = action.value || await provider.generateTestData('text', action.target);
        await page.fill(action.target, value, { timeout: 5000 });
        break;

      case 'select':
        if (!action.target || !action.value) throw new Error('No target or value for select');
        await page.selectOption(action.target, action.value, { timeout: 5000 });
        break;

      case 'navigate':
        if (!action.target) throw new Error('No URL specified for navigate');
        await page.goto(action.target, { waitUntil: 'networkidle', timeout: 30000 });
        break;

      case 'scroll':
        const direction = action.value === 'up' ? -500 : 500;
        await page.evaluate((d) => window.scrollBy(0, d), direction);
        await page.waitForTimeout(500);
        break;

      case 'wait':
        const waitTime = parseInt(action.value || '2000');
        await page.waitForTimeout(Math.min(waitTime, 10000));
        break;

      case 'hover':
        if (!action.target) throw new Error('No target specified for hover');
        await page.hover(action.target, { timeout: 5000 });
        break;

      case 'press':
        if (!action.value) throw new Error('No key specified for press');
        await page.keyboard.press(action.value);
        break;

      case 'assert':
        if (!action.target) throw new Error('No target specified for assert');
        const element = await page.$(action.target);
        if (!element) throw new Error(`Element not found: ${action.target}`);
        break;

      case 'screenshot':
        // Screenshot is handled separately
        break;

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Run a single test scenario with the AI agent
 */
async function runScenario(
  page: Page,
  scenario: TestScenario,
  provider: AIProvider,
  config: AIAgentConfig
): Promise<ScenarioResult> {
  const startTime = Date.now();
  const steps: AgentStep[] = [];
  const errors: string[] = [];
  const maxActions = scenario.maxActions || config.maxActions;

  console.log(`\n🤖 Starting scenario: ${scenario.name}`);
  console.log(`   Goal: ${scenario.goal}`);

  // Navigate to start URL if specified
  if (scenario.startUrl) {
    await page.goto(scenario.startUrl, { waitUntil: 'networkidle' });
  }

  let actionCount = 0;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  while (actionCount < maxActions && consecutiveFailures < maxConsecutiveFailures) {
    actionCount++;

    // Extract current page state
    const beforeState = await extractPageState(page, config.useVision);

    // Ask AI for next action
    console.log(`   Step ${actionCount}: Analyzing page...`);
    const thought = await provider.analyzePageState(beforeState, scenario.goal, steps);

    console.log(`   → Action: ${thought.nextAction.type} ${thought.nextAction.target || ''}`);
    console.log(`   → Reasoning: ${thought.reasoning.slice(0, 100)}...`);

    // Execute the action
    const stepStart = Date.now();
    const result = await executeAction(page, thought.nextAction, provider);

    // Wait for page to settle
    await page.waitForTimeout(1000);

    // Get after state
    const afterState = await extractPageState(page, false);

    // Record the step
    const step: AgentStep = {
      stepNumber: actionCount,
      action: thought.nextAction,
      beforeState,
      afterState,
      success: result.success,
      error: result.error,
      duration: Date.now() - stepStart
    };
    steps.push(step);

    if (result.success) {
      console.log(`   ✅ Success`);
      consecutiveFailures = 0;
    } else {
      console.log(`   ❌ Failed: ${result.error}`);
      errors.push(`Step ${actionCount}: ${result.error}`);
      consecutiveFailures++;
    }

    // Check if goal might be achieved (simple heuristics)
    if (scenario.expectedOutcome) {
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.toLowerCase().includes(scenario.expectedOutcome.toLowerCase())) {
        console.log(`   🎯 Expected outcome detected!`);
        break;
      }
    }

    // Check for obvious success indicators
    const currentUrl = page.url();
    if (scenario.goal.toLowerCase().includes('login') && 
        (currentUrl.includes('/dashboard') || currentUrl.includes('/home'))) {
      console.log(`   🎯 Login success detected!`);
      break;
    }
  }

  // Determine scenario status
  const successfulSteps = steps.filter(s => s.success).length;
  const successRate = steps.length > 0 ? successfulSteps / steps.length : 0;
  
  let status: 'success' | 'partial' | 'failed';
  if (successRate >= 0.8 && consecutiveFailures < maxConsecutiveFailures) {
    status = 'success';
  } else if (successRate >= 0.5) {
    status = 'partial';
  } else {
    status = 'failed';
  }

  const finalState = await extractPageState(page, true);

  // Generate AI summary
  const aiSummary = await provider.summarizeResults([{
    scenario,
    status,
    steps,
    totalActions: actionCount,
    successfulActions: successfulSteps,
    errors,
    duration: Date.now() - startTime,
    finalState,
    aiSummary: ''
  }]);

  console.log(`   📊 Result: ${status} (${successfulSteps}/${steps.length} steps)`);

  return {
    scenario,
    status,
    steps,
    totalActions: actionCount,
    successfulActions: successfulSteps,
    errors,
    duration: Date.now() - startTime,
    finalState,
    aiSummary
  };
}

/**
 * Main AI Agent Runner
 */
export async function runAIAgent(
  browser: Browser,
  config: AIAgentConfig
): Promise<AIAgentResult> {
  const startTime = Date.now();
  
  // Initialize AI provider
  const provider = new OpenAIProvider(config.apiKey, config.model);

  // Create browser context
  const context = await browser.newContext({
    viewport: config.viewport,
    recordVideo: { dir: `${config.outputDir}/videos` }
  });

  const page = await context.newPage();

  // Set up network monitoring
  const networkCalls: NetworkCall[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/') || url.includes('/graphql')) {
      networkCalls.push({
        url,
        method: response.request().method(),
        status: response.status(),
        timestamp: Date.now()
      });
    }
  });

  // Set up console error capture
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate to base URL
  await page.goto(config.baseUrl, { waitUntil: 'networkidle' });

  // Determine scenarios to run
  let scenarios = config.scenarios || [];
  
  // If no scenarios provided, create default ones based on the goal
  if (scenarios.length === 0) {
    scenarios = [
      {
        name: 'Main Goal',
        description: config.goal,
        goal: config.goal,
        maxActions: config.maxActions
      }
    ];
  }

  // Run each scenario
  const scenarioResults: ScenarioResult[] = [];
  
  for (const scenario of scenarios) {
    const result = await runScenario(page, scenario, provider, config);
    scenarioResults.push(result);
  }

  await context.close();

  // Calculate overall results
  const summary = {
    totalScenarios: scenarioResults.length,
    successfulScenarios: scenarioResults.filter(r => r.status === 'success').length,
    partialScenarios: scenarioResults.filter(r => r.status === 'partial').length,
    failedScenarios: scenarioResults.filter(r => r.status === 'failed').length,
    totalActions: scenarioResults.reduce((acc, r) => acc + r.totalActions, 0),
    successfulActions: scenarioResults.reduce((acc, r) => acc + r.successfulActions, 0)
  };

  const overallScore = calculateScore(summary);
  const grade = getGrade(overallScore);
  const recommendations = generateRecommendations(scenarioResults);

  return {
    config,
    scenarios: scenarioResults,
    overallScore,
    grade,
    summary,
    recommendations,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString()
  };
}

function calculateScore(summary: any): number {
  const scenarioScore = (summary.successfulScenarios * 50 + summary.partialScenarios * 25) / summary.totalScenarios;
  const actionScore = summary.totalActions > 0 
    ? (summary.successfulActions / summary.totalActions) * 50 
    : 0;
  return Math.round(scenarioScore + actionScore);
}

function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function generateRecommendations(results: ScenarioResult[]): string[] {
  const recommendations: string[] = [];
  
  for (const result of results) {
    if (result.status === 'failed') {
      recommendations.push(`Fix "${result.scenario.name}": ${result.errors[0] || 'Multiple failures'}`);
    }
    if (result.status === 'partial') {
      recommendations.push(`Improve "${result.scenario.name}": Only ${result.successfulActions}/${result.totalActions} actions succeeded`);
    }
  }

  return recommendations;
}

export { extractPageState, executeAction };
