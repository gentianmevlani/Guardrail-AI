/**
 * Enhanced Reality Mode Runner
 * 
 * Automatically detects project type and runs appropriate test flows.
 */

import type { Page, Browser, BrowserContext } from '@playwright/test';
import { detectProjectType, DetectionResult, ProjectType } from './project-detector';
import { 
  getApplicableFlows, 
  interpolateTestData, 
  DEFAULT_TEST_DATA, 
  TestFlow, 
  TestStep,
  TestData,
  FIELD_PATTERNS
} from './test-flows';

export interface EnhancedRealityConfig {
  url: string;
  auth?: { email: string; password: string };
  testData?: Partial<TestData>;
  headless?: boolean;
  timeout?: number;
  maxPages?: number;
  viewport?: { width: number; height: number };
  mobileTest?: boolean;
  skipFlows?: string[];
  onlyFlows?: string[];
  outputDir?: string;
}

export interface FlowResult {
  flowName: string;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  stepsCompleted: number;
  totalSteps: number;
  errors: string[];
  screenshots: string[];
  duration: number;
}

export interface EnhancedRealityResult {
  url: string;
  projectType: ProjectType;
  detection: DetectionResult;
  flowResults: FlowResult[];
  overallScore: number;
  grade: string;
  summary: {
    totalFlows: number;
    successfulFlows: number;
    partialFlows: number;
    failedFlows: number;
    skippedFlows: number;
  };
  recommendations: string[];
  duration: number;
  timestamp: string;
}

/**
 * Run enhanced Reality Mode tests
 */
export async function runEnhancedReality(
  browser: Browser,
  config: EnhancedRealityConfig
): Promise<EnhancedRealityResult> {
  const startTime = Date.now();
  const testData = { ...DEFAULT_TEST_DATA, ...config.testData };
  
  // Create browser context
  const context = await browser.newContext({
    viewport: config.viewport || { width: 1280, height: 720 },
    recordVideo: config.outputDir ? { dir: `${config.outputDir}/videos` } : undefined
  });
  
  const page = await context.newPage();
  
  // Navigate to URL and detect project type
  await page.goto(config.url, { waitUntil: 'networkidle' });
  const detection = await detectProjectType(page);
  
  console.log(`\n🔍 Detected Project Type: ${detection.primaryType}`);
  console.log(`   Confidence: ${(detection.signatures[0]?.confidence * 100 || 0).toFixed(0)}%`);
  console.log(`   Features: ${Object.entries(detection.features).filter(([k, v]) => v === true).map(([k]) => k).join(', ')}`);
  
  // Get applicable flows
  let flows = getApplicableFlows(detection.primaryType, detection.features);
  
  // Filter flows if specified
  if (config.onlyFlows?.length) {
    flows = flows.filter(f => config.onlyFlows!.includes(f.name.toLowerCase()));
  }
  if (config.skipFlows?.length) {
    flows = flows.filter(f => !config.skipFlows!.includes(f.name.toLowerCase()));
  }
  
  console.log(`\n📋 Running ${flows.length} test flows:`);
  flows.forEach(f => console.log(`   - ${f.name}: ${f.description}`));
  
  // Run each flow
  const flowResults: FlowResult[] = [];
  
  for (const flow of flows) {
    const result = await runFlow(page, flow, testData, config);
    flowResults.push(result);
    
    const statusIcon = result.status === 'success' ? '✅' : 
                       result.status === 'partial' ? '⚠️' : 
                       result.status === 'failed' ? '❌' : '⏭️';
    console.log(`   ${statusIcon} ${flow.name}: ${result.stepsCompleted}/${result.totalSteps} steps (${result.status})`);
  }
  
  // Run mobile test if requested
  if (config.mobileTest) {
    await context.close();
    const mobileContext = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();
    
    const mobileFlow: TestFlow = {
      name: 'Mobile Responsiveness',
      description: 'Test mobile viewport',
      projectTypes: [detection.primaryType],
      steps: [
        { action: 'navigate', target: config.url },
        { action: 'wait', timeout: 2000 },
        { action: 'screenshot', description: 'Mobile home' },
        { action: 'click', target: '.hamburger, .menu-toggle, [aria-label*="menu"]', optional: true },
        { action: 'screenshot', description: 'Mobile menu' }
      ]
    };
    
    const mobileResult = await runFlow(mobilePage, mobileFlow, testData, config);
    flowResults.push(mobileResult);
    
    await mobileContext.close();
  } else {
    await context.close();
  }
  
  // Calculate overall score
  const summary = {
    totalFlows: flowResults.length,
    successfulFlows: flowResults.filter(r => r.status === 'success').length,
    partialFlows: flowResults.filter(r => r.status === 'partial').length,
    failedFlows: flowResults.filter(r => r.status === 'failed').length,
    skippedFlows: flowResults.filter(r => r.status === 'skipped').length
  };
  
  const overallScore = calculateScore(flowResults, summary);
  const grade = getGrade(overallScore);
  const recommendations = generateRecommendations(detection, flowResults);
  
  return {
    url: config.url,
    projectType: detection.primaryType,
    detection,
    flowResults,
    overallScore,
    grade,
    summary,
    recommendations,
    duration: Date.now() - startTime,
    timestamp: new Date().toISOString()
  };
}

/**
 * Run a single test flow
 */
async function runFlow(
  page: Page,
  flow: TestFlow,
  testData: TestData,
  config: EnhancedRealityConfig
): Promise<FlowResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const screenshots: string[] = [];
  let stepsCompleted = 0;
  
  for (const step of flow.steps) {
    try {
      await executeStep(page, step, testData, config);
      stepsCompleted++;
    } catch (error: any) {
      if (!step.optional) {
        errors.push(`Step "${step.description || step.action}": ${error.message}`);
      }
      // Continue with optional steps
      if (!step.optional) break;
    }
  }
  
  const successRate = stepsCompleted / flow.steps.length;
  let status: FlowResult['status'];
  
  if (successRate === 1) status = 'success';
  else if (successRate >= 0.5) status = 'partial';
  else if (stepsCompleted === 0) status = 'skipped';
  else status = 'failed';
  
  return {
    flowName: flow.name,
    status,
    stepsCompleted,
    totalSteps: flow.steps.length,
    errors,
    screenshots,
    duration: Date.now() - startTime
  };
}

/**
 * Execute a single test step
 */
async function executeStep(
  page: Page,
  step: TestStep,
  testData: TestData,
  config: EnhancedRealityConfig
): Promise<void> {
  const timeout = step.timeout || config.timeout || 10000;
  
  switch (step.action) {
    case 'navigate':
      const url = step.target?.startsWith('http') ? step.target : `${config.url}${step.target}`;
      await page.goto(url, { waitUntil: 'networkidle', timeout });
      break;
      
    case 'click':
      if (step.target) {
        const selectors = step.target.split(', ');
        let clicked = false;
        for (const selector of selectors) {
          try {
            const element = await page.$(selector.trim());
            if (element && await element.isVisible()) {
              await element.scrollIntoViewIfNeeded();
              await element.click({ timeout: 5000 });
              clicked = true;
              break;
            }
          } catch (e) {
            // Element not found or not clickable - try next selector
          }
        }
        if (!clicked && !step.optional) {
          throw new Error(`Could not click any of: ${step.target}`);
        }
      }
      break;
      
    case 'fill':
      if (step.target && step.value) {
        const value = interpolateTestData(step.value, testData);
        const selectors = step.target.split(', ');
        let filled = false;
        for (const selector of selectors) {
          try {
            const element = await page.$(selector.trim());
            if (element && await element.isVisible()) {
              await element.fill(value);
              filled = true;
              break;
            }
          } catch (e) {
            // Element not found or not fillable - try next selector
          }
        }
        if (!filled && !step.optional) {
          throw new Error(`Could not fill any of: ${step.target}`);
        }
      }
      break;
      
    case 'wait':
      await page.waitForTimeout(step.timeout || 1000);
      break;
      
    case 'assert':
      if (step.target) {
        const selectors = step.target.split(', ');
        let found = false;
        for (const selector of selectors) {
          try {
            const element = await page.$(selector.trim());
            if (element) {
              found = true;
              break;
            }
          } catch (e) {
            // Element not found - try next selector
          }
        }
        if (!found && !step.optional) {
          throw new Error(`Assertion failed: ${step.target}`);
        }
      }
      break;
      
    case 'screenshot':
      if (config.outputDir) {
        const filename = `${config.outputDir}/screenshots/${step.description?.replace(/\s+/g, '-') || Date.now()}.png`;
        await page.screenshot({ path: filename });
      }
      break;
      
    case 'scroll':
      const scrollAmount = parseInt(step.value || '500');
      await page.evaluate((amount: number) => window.scrollBy(0, amount), scrollAmount);
      break;
      
    case 'hover':
      if (step.target) {
        const element = await page.$(step.target);
        if (element) await element.hover();
      }
      break;
      
    case 'select':
      if (step.target && step.value) {
        await page.selectOption(step.target, step.value);
      }
      break;
      
    case 'upload':
      // File upload would require actual file path
      break;
  }
}

/**
 * Smart form filling - automatically detect and fill form fields
 */
export async function smartFillForm(page: Page, testData: TestData): Promise<number> {
  let fieldsFilled = 0;
  
  for (const [fieldType, patterns] of Object.entries(FIELD_PATTERNS)) {
    for (const selector of patterns.selectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          const value = typeof patterns.testValue === 'string' && patterns.testValue in testData
            ? (testData as any)[patterns.testValue]
            : patterns.testValue;
          
          await element.fill(String(value));
          fieldsFilled++;
          break;
        }
      } catch (e) {
        // Field not found - continue with other field types
      }
    }
  }
  
  return fieldsFilled;
}

/**
 * Calculate overall score from flow results
 */
function calculateScore(results: FlowResult[], summary: any): number {
  if (results.length === 0) return 0;
  
  let score = 0;
  
  // Flow completion score (60 points)
  const flowScore = (summary.successfulFlows * 60 + summary.partialFlows * 30) / summary.totalFlows;
  score += flowScore;
  
  // Step completion score (30 points)
  const totalSteps = results.reduce((acc, r) => acc + r.totalSteps, 0);
  const completedSteps = results.reduce((acc, r) => acc + r.stepsCompleted, 0);
  const stepScore = totalSteps > 0 ? (completedSteps / totalSteps) * 30 : 0;
  score += stepScore;
  
  // Error penalty (up to -10 points)
  const totalErrors = results.reduce((acc, r) => acc + r.errors.length, 0);
  const errorPenalty = Math.min(totalErrors * 2, 10);
  score -= errorPenalty;
  
  // Bonus for no failures (10 points)
  if (summary.failedFlows === 0) score += 10;
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Get letter grade from score
 */
function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Generate recommendations based on results
 */
function generateRecommendations(detection: DetectionResult, results: FlowResult[]): string[] {
  const recommendations: string[] = [];
  
  // Check for missing features
  if (!detection.features.hasAuth) {
    recommendations.push('Consider adding authentication to protect user data');
  }
  
  if (detection.primaryType === 'ecommerce' && !detection.features.hasPayments) {
    recommendations.push('E-commerce site detected but no payment integration found');
  }
  
  if (!detection.features.hasSearch && ['ecommerce', 'blog', 'marketplace'].includes(detection.primaryType)) {
    recommendations.push('Consider adding search functionality for better user experience');
  }
  
  // Check for failed flows
  const failedFlows = results.filter(r => r.status === 'failed');
  for (const flow of failedFlows) {
    recommendations.push(`Fix ${flow.flowName} flow: ${flow.errors[0] || 'Unknown error'}`);
  }
  
  // Check for partial flows
  const partialFlows = results.filter(r => r.status === 'partial');
  for (const flow of partialFlows) {
    recommendations.push(`Improve ${flow.flowName} flow: Only ${flow.stepsCompleted}/${flow.totalSteps} steps completed`);
  }
  
  return recommendations;
}

export { detectProjectType, getApplicableFlows };
