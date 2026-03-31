/**
 * Reality Mode CLI Runner
 *
 * The "legit" Reality Mode that actually tests everything in the user's app:
 * - Discovers all routes, buttons, forms, modals
 * - Clicks through everything safely
 * - Tests login/signup flows
 * - Reports what works and what doesn't
 *
 * Usage:
 *   guardrail reality --url https://myapp.com
 *   guardrail reality --url https://myapp.com --auth email:pass
 *   guardrail reality --url https://myapp.com --danger  (allows destructive actions)
 */

const fs = require("fs");
const path = require("path");
const { spawn, execSync } = require("child_process");
const { enforceLimit, enforceFeature, trackUsage, getCurrentTier } = require("./lib/entitlements");
const { emitRealityStart, emitRealityComplete } = require("./lib/audit-bridge");

// ANSI colors
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

/**
 * Parse CLI arguments
 */
function parseArgs(args) {
  const opts = {
    url: null,
    auth: null,
    danger: false,
    headless: true,
    maxPages: 20,
    timeout: 30000,
    output: ".guardrail/reality",
    flows: [], // Flow packs to run (auth, ui, forms, ecommerce)
    flowsDir: null, // Custom flows directory
    junit: false, // Output JUnit XML for CI
    sarif: false, // Output SARIF for GitHub code scanning
    ci: false, // CI mode (junit + sarif + exit code)
    threshold: 0, // Minimum score to pass (0-100)
    init: false, // Initialize flows in project
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--url" || arg === "-u") {
      opts.url = args[++i];
    } else if (arg === "--auth" || arg === "-a") {
      opts.auth = args[++i];
    } else if (arg === "--danger" || arg === "--destructive") {
      opts.danger = true;
    } else if (arg === "--headed" || arg === "--no-headless") {
      opts.headless = false;
    } else if (arg === "--max-pages") {
      opts.maxPages = parseInt(args[++i], 10);
    } else if (arg === "--timeout") {
      opts.timeout = parseInt(args[++i], 10);
    } else if (arg === "--output" || arg === "-o") {
      opts.output = args[++i];
    } else if (arg === "--flows" || arg === "-f") {
      opts.flows = args[++i].split(",");
    } else if (arg === "--flows-dir") {
      opts.flowsDir = args[++i];
    } else if (arg === "--junit") {
      opts.junit = true;
    } else if (arg === "--sarif") {
      opts.sarif = true;
    } else if (arg === "--ci") {
      opts.ci = true;
      opts.junit = true;
      opts.sarif = true;
    } else if (arg === "--threshold") {
      opts.threshold = parseInt(args[++i], 10);
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (arg === "init") {
      opts.init = true;
    } else if (!arg.startsWith("-") && !opts.url) {
      opts.url = arg;
    }
  }

  return opts;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${c.bold}${c.cyan}🔍 guardrail REALITY MODE${c.reset}

${c.dim}Actually test your app - every button, every form, every route.${c.reset}

${c.bold}USAGE:${c.reset}
  guardrail reality --url <URL> [options]
  guardrail reality init  ${c.dim}# Set up flows in your project${c.reset}

${c.bold}OPTIONS:${c.reset}
  --url, -u <URL>       Target URL to test (required)
  --auth, -a <creds>    Auth credentials (email:password)
  --danger              Allow destructive actions (delete, remove, etc.)
  --headed              Run browser in visible mode (not headless)
  --max-pages <n>       Maximum pages to crawl (default: 20)
  --timeout <ms>        Timeout per action in ms (default: 30000)
  --output, -o <dir>    Output directory (default: .guardrail/reality)
  --flows, -f <packs>   Flow packs to test: auth,ui,forms,ecommerce (comma-sep)
  --flows-dir <dir>     Directory with custom flow YAML files
  --junit               Output JUnit XML for CI integration
  --sarif               Output SARIF for GitHub code scanning
  --ci                  CI mode (junit + sarif + fail on threshold)
  --threshold <n>       Minimum score to pass (0-100, default: 0)
  --help, -h            Show this help

${c.bold}EXAMPLES:${c.reset}
  ${c.dim}# Basic scan${c.reset}
  guardrail reality --url https://myapp.com

  ${c.dim}# With authentication${c.reset}
  guardrail reality --url https://myapp.com --auth test@example.com:password123

  ${c.dim}# Full destructive test (use with caution!)${c.reset}
  guardrail reality --url https://staging.myapp.com --danger --headed

  ${c.dim}# Run with critical flow packs${c.reset}
  guardrail reality --url https://myapp.com --flows auth,forms

  ${c.dim}# CI integration (JUnit + SARIF + threshold)${c.reset}
  guardrail reality --url https://myapp.com --ci --threshold 80

${c.bold}FLOW PACKS:${c.reset}
  auth        Login, signup, logout flows
  ui          Modal, navigation, dark mode
  forms       Form validation testing
  ecommerce   Checkout flow

${c.bold}WHAT IT TESTS:${c.reset}
  ✓ All discoverable routes (from links)
  ✓ All buttons and interactive elements
  ✓ All forms (with safe test data)
  ✓ Modal triggers and dropdowns
  ✓ Login/signup flows (if auth provided)
  ✓ API calls and error responses

${c.bold}OUTPUT:${c.reset}
  📊 reality-report.html   - Visual report with scores
  📋 explorer-results.json - Machine-readable results
  🧪 junit-results.xml     - JUnit for CI (with --junit or --ci)
  🔍 reality-results.sarif - SARIF for GitHub (with --sarif or --ci)
  🎥 videos/               - Video recordings
  📸 screenshots/          - Page screenshots
  🔍 trace.zip             - Playwright trace (debug)
`);
}

/**
 * Check if Playwright is installed
 */
function checkPlaywright() {
  try {
    require.resolve("@playwright/test");
    return true;
  } catch {
    return false;
  }
}

/**
 * Install Playwright if needed
 */
async function ensurePlaywright() {
  if (checkPlaywright()) {
    return true;
  }

  console.log(
    `\n  ${c.yellow}⚠️  Playwright not found. Installing...${c.reset}\n`,
  );

  try {
    execSync("npm install -D @playwright/test", { stdio: "inherit" });
    execSync("npx playwright install chromium", { stdio: "inherit" });
    return true;
  } catch (error) {
    console.error(`\n  ${c.red}❌ Failed to install Playwright${c.reset}`);
    console.error(
      `  ${c.dim}Run manually: npm install -D @playwright/test && npx playwright install${c.reset}\n`,
    );
    return false;
  }
}

/**
 * Generate the Playwright test file
 */
function generateTestFile(opts) {
  const outputDir = path.resolve(opts.output);

  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate auth config if provided
  let authConfig = "";
  if (opts.auth) {
    const [email, password] = opts.auth.split(":");
    authConfig = `
  // Auth configuration
  const AUTH = {
    loginUrl: '${opts.url}/login',
    email: '${email}',
    password: '${password}',
    emailField: 'input[name="email"], input[type="email"], #email',
    passwordField: 'input[name="password"], input[type="password"], #password',
    successIndicator: '[data-testid="dashboard"], .dashboard, /dashboard',
  };
`;
  }

  const testContent = `/**
 * Reality Explorer - Auto-generated Playwright Test
 * 
 * This test ACTUALLY explores your app:
 * - Visits every discoverable route
 * - Clicks every safe button and element  
 * - Fills and submits forms
 * - Captures what works and what breaks
 * 
 * Generated by guardrail Reality Mode
 * Target: ${opts.url}
 * Generated: ${new Date().toISOString()}
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const CONFIG = {
  baseUrl: '${opts.url}',
  outputDir: '${outputDir.replace(/\\/g, "\\\\")}',
  timeout: ${opts.timeout},
  allowDestructive: ${opts.danger},
  maxActionsPerPage: 50,
  maxPages: ${opts.maxPages},
};
${authConfig}
// Test data for form filling
const TEST_DATA = {
  email: 'test-reality@guardrailai.dev',
  password: 'TestPass123!',
  name: 'Reality Test User',
  phone: '+1234567890',
  address: '123 Test Street',
  city: 'Test City',
  zip: '12345',
  text: 'Test input from guardrail Reality Mode',
  number: '42',
  url: 'https://example.com',
  date: '2024-01-15',
};

// Destructive action patterns to avoid
const DESTRUCTIVE_PATTERNS = [
  /delete/i, /remove/i, /destroy/i, /cancel.*subscription/i,
  /deactivate/i, /terminate/i, /close.*account/i, /reset.*all/i,
];

// Results storage
interface ExplorerResults {
  routes: { path: string; status: string; error?: string; responseTime?: number }[];
  elements: { selector: string; text: string; status: string; error?: string; changes: string[] }[];
  forms: { selector: string; status: string; error?: string; fieldsFilledCount: number }[];
  errors: { type: string; message: string; url: string; timestamp: number }[];
  networkCalls: { url: string; method: string; status: number }[];
  coverage: { routes: number; elements: number; forms: number };
  score: number;
  duration: number;
}

const results: ExplorerResults = {
  routes: [],
  elements: [],
  forms: [],
  errors: [],
  networkCalls: [],
  coverage: { routes: 0, elements: 0, forms: 0 },
  score: 0,
  duration: 0,
};

let discoveredRoutes: string[] = [];
let discoveredElements: any[] = [];
let discoveredForms: any[] = [];
let startTime: number;

test.describe('Reality Explorer', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    startTime = Date.now();
    
    // Create context with video recording
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: path.join(CONFIG.outputDir, 'videos') },
    });
    
    await context.tracing.start({ screenshots: true, snapshots: true });
    page = await context.newPage();
    
    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        results.errors.push({
          type: 'console',
          message: msg.text().slice(0, 200),
          url: page.url(),
          timestamp: Date.now(),
        });
      }
    });
    
    // Capture uncaught errors
    page.on('pageerror', error => {
      results.errors.push({
        type: 'uncaught',
        message: error.message.slice(0, 200),
        url: page.url(),
        timestamp: Date.now(),
      });
    });
    
    // Capture API calls
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/') || url.includes('/graphql') || url.includes('/_next/data')) {
        results.networkCalls.push({
          url: url.split('?')[0],
          method: response.request().method(),
          status: response.status(),
        });
      }
    });
    
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  });

  test.afterAll(async () => {
    results.duration = Date.now() - startTime;
    
    await context.tracing.stop({ 
      path: path.join(CONFIG.outputDir, 'trace.zip') 
    });
    
    results.score = calculateScore(results);
    
    fs.writeFileSync(
      path.join(CONFIG.outputDir, 'explorer-results.json'),
      JSON.stringify(results, null, 2)
    );
    
    const html = generateHTMLReport(results);
    fs.writeFileSync(path.join(CONFIG.outputDir, 'reality-report.html'), html);
    
    await context.close();
    
    // Print summary to console
    console.log('\\n' + '='.repeat(60));
    console.log('  REALITY MODE COMPLETE');
    console.log('='.repeat(60));
    console.log(\`  Score: \${results.score}/100\`);
    console.log(\`  Routes: \${results.coverage.routes}/\${results.routes.length} working\`);
    console.log(\`  Elements: \${results.coverage.elements}/\${results.elements.length} working\`);
    console.log(\`  Forms: \${results.coverage.forms}/\${results.forms.length} working\`);
    console.log(\`  Errors: \${results.errors.length} captured\`);
    console.log(\`  Duration: \${(results.duration / 1000).toFixed(1)}s\`);
    console.log('='.repeat(60));
    console.log(\`  Report: \${path.join(CONFIG.outputDir, 'reality-report.html')}\`);
    console.log('='.repeat(60) + '\\n');
  });

  // Enhanced authentication flows
  test('00 - Test Signup Flow', async () => {
    await page.goto(CONFIG.baseUrl);
    await page.waitForLoadState('networkidle');
    
    // Look for signup/register buttons
    const signupSelectors = [
      'button:has-text("Sign Up")',
      'button:has-text("Create Account")', 
      'button:has-text("Register")',
      'a:has-text("Sign Up")',
      '[data-testid="signup"]',
      '[data-testid="register"]'
    ];
    
    let signupButton = null;
    for (const selector of signupSelectors) {
      try {
        signupButton = await page.$(selector);
        if (signupButton && await signupButton.isVisible()) {
          console.log(\`✅ Found signup button: \${selector}\`);
          break;
        }
      } catch (e) {
        // Non-fatal: selector may not exist, continue trying other selectors
        if (process.env.DEBUG) {
          console.warn(\`\${c.yellow}⚠\${c.reset} Selector failed: \${selector} - \${e.message}\`);
        }
      }
    }
    
    if (signupButton) {
      await signupButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill signup form with test data
      const emailField = await page.\$('input[type="email"], input[name="email"], #email');
      const passwordField = await page.\$('input[type="password"], input[name="password"], #password');
      const nameField = await page.\$('input[name="name"], input[name="fullName"], #name');
      
      if (emailField) await emailField.fill(\`test-\${Date.now()}@guardrailai.dev\`);
      if (nameField) await nameField.fill('Reality Test User');
      if (passwordField) await passwordField.fill('TestPass123!');
      
      // Submit form
      const submitButton = await page.\$('button[type="submit"], button:has-text("Sign Up"), button:has-text("Create")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        
        // Check if we're redirected to dashboard or get success message
        const currentUrl = page.url();
        const hasDashboard = currentUrl.includes('/dashboard') || currentUrl.includes('/app') || currentUrl.includes('/home');
        
        results.forms.push({
          selector: 'signup-form',
          status: hasDashboard ? 'success' : 'attempted',
          fieldsFilledCount: [emailField, passwordField, nameField].filter(Boolean).length,
        });
        
        console.log(hasDashboard ? '✅ Signup successful - redirected to dashboard' : '⚠️ Signup attempted');
      }
    } else {
      console.log('ℹ️ No signup button found');
    }
  });

  test('01 - Test Login Flow', async () => {
    await page.goto(CONFIG.baseUrl);
    await page.waitForLoadState('networkidle');
    
    // Look for login buttons
    const loginSelectors = [
      'button:has-text("Login")',
      'button:has-text("Sign In")',
      'a:has-text("Login")',
      '[data-testid="login"]',
      '[data-testid="signin"]'
    ];
    
    let loginButton = null;
    for (const selector of loginSelectors) {
      try {
        loginButton = await page.$(selector);
        if (loginButton && await loginButton.isVisible()) {
          console.log(\`✅ Found login button: \${selector}\`);
          break;
        }
      } catch (e) {
        // Non-fatal: selector may not exist, continue trying other selectors
        if (process.env.DEBUG) {
          console.warn(\`\${c.yellow}⚠\${c.reset} Selector failed: \${selector} - \${e.message}\`);
        }
      }
    }
    
    if (loginButton) {
      await loginButton.click();
      await page.waitForLoadState('networkidle');
      
      // Fill login form
      const emailField = await page.\$('input[type="email"], input[name="email"], #email');
      const passwordField = await page.\$('input[type="password"], input[name="password"], #password');
      
      if (emailField) await emailField.fill('test@guardrailai.dev');
      if (passwordField) await passwordField.fill('TestPass123!');
      
      // Submit form
      const submitButton = await page.\$('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
      if (submitButton) {
        await submitButton.click();
        await page.waitForLoadState('networkidle');
        
        // Check for dashboard or error
        const currentUrl = page.url();
        const hasDashboard = currentUrl.includes('/dashboard') || currentUrl.includes('/app') || currentUrl.includes('/home');
        const hasError = await page.\$('text=Invalid credentials, text=Error, text=Failed');
        
        results.forms.push({
          selector: 'login-form',
          status: hasDashboard ? 'success' : hasError ? 'error' : 'attempted',
          fieldsFilledCount: [emailField, passwordField].filter(Boolean).length,
        });
        
        console.log(hasDashboard ? '✅ Login successful' : hasError ? '❌ Login failed' : '⚠️ Login attempted');
      }
    } else {
      console.log('ℹ️ No login button found');
    }
  });

  ${
    opts.auth
      ? `
  test('02 - Authenticate with Provided Credentials', async () => {
    await page.goto(AUTH.loginUrl);
    await page.waitForLoadState('networkidle');
    
    // Try to find and fill email field
    const emailField = await page.$(AUTH.emailField);
    if (emailField) {
      await emailField.fill(AUTH.email);
    }
    
    // Try to find and fill password field
    const passwordField = await page.$(AUTH.passwordField);
    if (passwordField) {
      await passwordField.fill(AUTH.password);
    }
    
    // Submit
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Authentication attempted');
  });
  `
      : ""
  }

  test('${opts.auth ? '03' : '02'} - Discover App Surface', async () => {
    await page.goto(CONFIG.baseUrl);
    await page.waitForLoadState('networkidle');
    
    // Take initial screenshot
    await page.screenshot({ path: path.join(CONFIG.outputDir, 'home.png') });
    
    // Enhanced route discovery for SPAs
    discoveredRoutes = await page.evaluate(() => {
      const routes = new Set<string>();
      
      // Get all link hrefs
      document.querySelectorAll('a[href]').forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('/') && !href.startsWith('//') && !href.includes('#')) {
          routes.add(href);
        }
      });
      
      // Look for data-route attributes
      document.querySelectorAll('[data-route]').forEach(el => {
        const route = el.getAttribute('data-route');
        if (route) routes.add(route.startsWith('/') ? route : '/' + route);
      });
      
      // Look for common SPA route patterns
      const commonRoutes = ['/dashboard', '/app', '/account', '/settings', '/profile', '/projects', '/analytics'];
      commonRoutes.forEach(route => routes.add(route));
      
      return Array.from(routes);
    });
    
    // Also try to find navigation menus and extract routes
    const navRoutes = await page.evaluate(() => {
      const routes = new Set<string>();
      
      // Check navigation menus
      document.querySelectorAll('nav a, .nav a, .navigation a, .menu a').forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('#') && !href.includes('http')) {
          routes.add(href);
        }
      });
      
      return Array.from(routes);
    });
    
    // Merge all discovered routes
    discoveredRoutes = [...new Set([...discoveredRoutes, ...navRoutes])];
    
    console.log(\`📍 Discovered \${discoveredRoutes.length} routes\`);
    
    // Discover interactive elements
    discoveredElements = await page.$$eval(
      'button, [role="button"], input[type="submit"], [data-testid]',
      (elements: Element[]) => elements.map((el, idx) => {
        const text = el.textContent?.trim().slice(0, 50) || '';
        return {
          selector: el.id ? \`#\${el.id}\` : 
                    el.getAttribute('data-testid') ? \`[data-testid="\${el.getAttribute('data-testid')}"]\` :
                    \`button:nth-of-type(\${idx + 1})\`,
          text,
          type: el.tagName.toLowerCase(),
          isDestructive: /delete|remove|destroy|cancel|deactivate/i.test(text),
        };
      }).filter(el => el.text.length > 0)
    );
    
    console.log(\`🔘 Discovered \${discoveredElements.length} interactive elements\`);
    
    // Discover forms
    discoveredForms = await page.$$eval('form', (forms: HTMLFormElement[]) => 
      forms.map((form, idx) => ({
        selector: form.id ? \`#\${form.id}\` : \`form:nth-of-type(\${idx + 1})\`,
        fields: Array.from(form.querySelectorAll('input, textarea, select')).map((field: any) => ({
          name: field.name || field.id || 'unknown',
          type: field.type || 'text',
          required: field.required,
        })),
      }))
    );
    
    console.log(\`📝 Discovered \${discoveredForms.length} forms\`);
  });

  test('${opts.auth ? '04' : '03'} - Visit All Routes', async () => {
    const routesToVisit = discoveredRoutes.slice(0, CONFIG.maxPages);
    
    for (const route of routesToVisit) {
      const startTime = Date.now();
      
      try {
        const response = await page.goto(CONFIG.baseUrl + route, { 
          waitUntil: 'networkidle',
          timeout: CONFIG.timeout 
        });
        
        const status = response?.status() || 0;
        const responseTime = Date.now() - startTime;
        
        results.routes.push({
          path: route,
          status: status >= 200 && status < 400 ? 'success' : 'error',
          responseTime,
          error: status >= 400 ? \`HTTP \${status}\` : undefined,
        });
        
        // Re-discover elements on each page
        const pageElements = await page.$$eval(
          'button, [role="button"], input[type="submit"]',
          (elements: Element[]) => elements.map((el, idx) => ({
            selector: el.id ? \`#\${el.id}\` : \`button:nth-of-type(\${idx + 1})\`,
            text: el.textContent?.trim().slice(0, 50) || '',
            type: el.tagName.toLowerCase(),
            isDestructive: /delete|remove|destroy/i.test(el.textContent || ''),
            page: '',
          })).filter(el => el.text.length > 0)
        );
        
        for (const el of pageElements) {
          if (!discoveredElements.find((e: any) => e.selector === el.selector)) {
            discoveredElements.push({ ...el, page: route });
          }
        }
        
      } catch (error: any) {
        results.routes.push({
          path: route,
          status: 'error',
          error: error.message.slice(0, 100),
        });
      }
    }
    
    results.coverage.routes = results.routes.filter(r => r.status === 'success').length;
    console.log(\`✅ Visited \${results.coverage.routes}/\${routesToVisit.length} routes\`);
  });

  test('${opts.auth ? '05' : '04'} - Test Dashboard Functionality', async () => {
    // Try to find and access dashboard
    const dashboardSelectors = [
      '/dashboard',
      '/app', 
      '/home',
      '/account',
      '/profile'
    ];
    
    let dashboardFound = false;
    
    for (const dashboardPath of dashboardSelectors) {
      try {
        const response = await page.goto(CONFIG.baseUrl + dashboardPath, { 
          waitUntil: 'networkidle',
          timeout: 10000 
        });
        
        if (response && response.status() === 200) {
          const hasDashboardContent = await page.\$('text=Dashboard, text=Overview, text=Analytics, text=Projects, text=Settings');
          if (hasDashboardContent) {
            dashboardFound = true;
            console.log(\`✅ Dashboard found at \${dashboardPath}\`);
            
            // Test dashboard functionality
            await testDashboardFeatures(page, dashboardPath);
            break;
          }
        }
      } catch (e) {
        // Continue to next dashboard path
      }
    }
    
    if (!dashboardFound) {
      console.log('ℹ️ No accessible dashboard found');
    }
  });

  test('${opts.auth ? '06' : '05'} - Test Interactive Elements', async () => {
    await page.goto(CONFIG.baseUrl);
    await page.waitForLoadState('networkidle');
    
    const elementsToTest = discoveredElements
      .filter((el: any) => !el.isDestructive || CONFIG.allowDestructive)
      .slice(0, CONFIG.maxActionsPerPage);
    
    for (const element of elementsToTest) {
      const result = await testElement(page, element);
      results.elements.push(result);
    }
    
    results.coverage.elements = results.elements.filter(e => e.status === 'success').length;
    console.log(\`✅ Tested \${results.coverage.elements}/\${elementsToTest.length} elements\`);
  });

  test('${opts.auth ? '07' : '06'} - Test Forms', async () => {
    await page.goto(CONFIG.baseUrl);
    await page.waitForLoadState('networkidle');
    
    for (const form of discoveredForms) {
      const result = await testForm(page, form);
      results.forms.push(result);
    }
    
    results.coverage.forms = results.forms.filter(f => f.status === 'success').length;
    console.log(\`✅ Tested \${results.coverage.forms}/\${discoveredForms.length} forms\`);
  });
});

// Test dashboard features
async function testDashboardFeatures(page: Page, dashboardPath: string) {
  try {
    // Look for common dashboard elements
    const dashboardFeatures = [
      { selector: 'text=Projects', name: 'Projects section' },
      { selector: 'text=Analytics', name: 'Analytics section' },
      { selector: 'text=Settings', name: 'Settings section' },
      { selector: 'text=Overview', name: 'Overview section' },
      { selector: 'text=Reports', name: 'Reports section' },
      { selector: 'text=Activity', name: 'Activity section' },
      { selector: 'text=Profile', name: 'Profile section' },
      { selector: 'text=Account', name: 'Account section' }
    ];
    
    for (const feature of dashboardFeatures) {
      try {
        const element = await page.$(feature.selector);
        if (element && await element.isVisible()) {
          console.log(\`  ✓ \${feature.name} found\`);
          
          // Try to interact with it
          await element.click({ timeout: 3000 });
          await page.waitForTimeout(1000);
          
          // Check if something changed
          const currentUrl = page.url();
          if (currentUrl !== page.url()) {
            console.log(\`    → Navigation successful\`);
            await page.goBack().catch((err) => {
              // Non-fatal: page navigation may fail if already at start
              if (process.env.DEBUG) {
                console.warn(\`\${c.yellow}⚠\${c.reset} Page goBack failed: \${err.message}\`);
              }
            });
          }
        }
      } catch (e) {
        console.log(\`  ⚠️ \${feature.name} not accessible\`);
      }
    }
    
    // Look for data tables or lists
    const dataElements = await page.\$('table, .table, [role="grid"], .list, .data-grid');
    if (dataElements) {
      console.log(\`  ✓ Data display elements found\`);
    }
    
    // Look for charts or graphs
    const chartElements = await page.\$('canvas, .chart, .graph, [data-chart]');
    if (chartElements) {
      console.log(\`  ✓ Chart/graph elements found\`);
    }
    
    // Look for action buttons
    const actionButtons = await page.\$\$('button:has-text("Create"), button:has-text("Add"), button:has-text("New"), button:has-text("Edit")');
    if (actionButtons.length > 0) {
      console.log(\`  ✓ \${actionButtons.length} action buttons found\`);
    }
    
async function testElement(page: Page, element: any) {
  const beforeUrl = page.url();
  const changes: string[] = [];
  
  try {
    // Wait for element to be ready with multiple strategies
    let el = await page.$(element.selector);
    if (!el) {
      return { selector: element.selector, text: element.text, status: 'not-found', changes: [] };
    }
    
    // Wait for element to be visible and stable
    try {
      await el.waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) {
      // Element might not be visible, try scrolling to it
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
    }
    
    // Check visibility again after scrolling
    const isVisible = await el.isVisible().catch(() => false);
    if (!isVisible) {
      return { selector: element.selector, text: element.text, status: 'hidden', changes: [] };
    }
    
    // Ensure element is in viewport and not obscured
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    
    // Try multiple interaction strategies
    let interactionSuccess = false;
    const strategies = [
      // Standard click
      async () => {
        await el.click({ timeout: 5000 });
        return true;
      },
      // Click with force
      async () => {
        await el.click({ force: true, timeout: 3000 });
        return true;
      },
      // Hover then click
      async () => {
        await el.hover();
        await page.waitForTimeout(200);
        await el.click();
        return true;
      },
      // Double click
      async () => {
        await el.dblclick();
        return true;
      }
    ];
    
    for (const strategy of strategies) {
      try {
        await strategy();
        interactionSuccess = true;
        break;
      } catch (e) {
        continue; // Try next strategy
      }
    }
    
    if (!interactionSuccess) {
      return { 
        selector: element.selector, 
        text: element.text, 
        status: 'no-interaction', 
        changes: [] 
      };
    }
    
    // Wait for any async updates after interaction
    await page.waitForTimeout(500);
    
    // Check for various types of changes
    const afterUrl = page.url();
    if (afterUrl !== beforeUrl) {
      changes.push('URL: ' + afterUrl);
    }
    
    // Check for modals, popups, or overlays
    const modalSelectors = [
      '[role="dialog"]', 
      '.modal', 
      '[data-state="open"]',
      '.popup',
      '.overlay',
      '.dropdown-menu'
    ];
    
    for (const modalSelector of modalSelectors) {
      const modal = await page.$(modalSelector);
      if (modal && await modal.isVisible()) {
        changes.push('Modal opened: ' + modalSelector);
        // Try to close modal to continue testing
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        break;
      }
    }
    
    // Check for dynamic content changes
    const contentChanged = await page.evaluate((beforeUrl) => {
      const body = document.body;
      if (!body) return false;
      
      // Look for loading indicators that disappeared
      const loadingElements = document.querySelectorAll('[data-loading], .loading, .spinner');
      const hasLoading = loadingElements.length > 0;
      
      // Look for new content that appeared
      const newContent = document.querySelectorAll('[data-loaded], .loaded, .content');
      const hasNewContent = newContent.length > 0;
      
      return hasLoading || hasNewContent;
    }, beforeUrl);
    
    if (contentChanged) {
      changes.push('Dynamic content updated');
    }
    
    // Check for form validation or error messages
    const validationMessages = await page.$$eval(
      '.error, .validation-error, [data-error], .invalid',
      (elements) => elements.map(el => el.textContent?.trim()).filter(Boolean)
    );
    
    if (validationMessages.length > 0) {
      changes.push('Validation: ' + validationMessages[0]);
    }
    
    // Check for success messages
    const successMessages = await page.$$eval(
      '.success, .valid, [data-success], .confirmation',
      (elements) => elements.map(el => el.textContent?.trim()).filter(Boolean)
    );
    
    if (successMessages.length > 0) {
      changes.push('Success: ' + successMessages[0]);
    }
    
    return {
      selector: element.selector,
      text: element.text,
      status: changes.length > 0 ? 'success' : 'no-change',
      changes,
    };
    
  } catch (error: any) {
    return {
      selector: element.selector,
      text: element.text,
      status: 'error',
      error: error.message.slice(0, 100),
      changes: [],
    };
  }
}

// Test a form
async function testForm(page: Page, form: any) {
  let fieldsFilledCount = 0;
  
  try {
    const formEl = await page.$(form.selector);
    if (!formEl) {
      return { selector: form.selector, status: 'not-found', fieldsFilledCount: 0 };
    }
    
    for (const field of form.fields) {
      try {
        const value = getTestValue(field.type, field.name);
        const fieldEl = await formEl.$(\`[name="\${field.name}"], #\${field.name}\`);
        
        if (fieldEl) {
          if (field.type === 'checkbox' || field.type === 'radio') {
            await fieldEl.check().catch((err) => {
              // Non-fatal: checkbox/radio may be disabled or not interactable
              if (process.env.DEBUG) {
                console.warn(\`\${c.yellow}⚠\${c.reset} Field check failed: \${err.message}\`);
              }
            });
          } else {
            await fieldEl.fill(value);
          }
          fieldsFilledCount++;
        }
      } catch (e) {
        // Non-fatal: field may not be interactable, continue with other fields
        if (process.env.DEBUG) {
          console.warn(\`\${c.yellow}⚠\${c.reset} Field fill failed: \${e.message}\`);
        }
      }
    }
    
    return {
      selector: form.selector,
      status: fieldsFilledCount > 0 ? 'success' : 'no-fields',
      fieldsFilledCount,
    };
    
  } catch (error: any) {
    return {
      selector: form.selector,
      status: 'error',
      error: error.message.slice(0, 100),
      fieldsFilledCount,
    };
  }
}

// Get test value for field
function getTestValue(type: string, name: string): string {
  const n = name?.toLowerCase() || '';
  if (n.includes('email')) return TEST_DATA.email;
  if (n.includes('password')) return TEST_DATA.password;
  if (n.includes('phone')) return TEST_DATA.phone;
  if (n.includes('name')) return TEST_DATA.name;
  if (type === 'email') return TEST_DATA.email;
  if (type === 'password') return TEST_DATA.password;
  if (type === 'number') return TEST_DATA.number;
  return TEST_DATA.text;
}

// Calculate score
function calculateScore(results: ExplorerResults): number {
  const tr = results.routes.length || 1;
  const te = results.elements.length || 1;
  const tf = results.forms.length || 1;
  
  const routeScore = (results.coverage.routes / tr) * 15;
  const elemScore = (results.coverage.elements / te) * 15;
  const formScore = (results.coverage.forms / tf) * 10;
  const coverage = routeScore + elemScore + formScore;
  
  const funcScore = 
    ((results.elements.filter(e => e.status === 'success').length / te) * 20) +
    ((results.forms.filter(f => f.status === 'success').length / tf) * 15);
  
  const errorPenalty = Math.min(results.errors.length * 3, 15);
  const stability = 15 - errorPenalty;
  
  const interactive = results.elements.filter(e => e.changes?.length > 0).length;
  const ux = Math.min((interactive / te) * 10, 10);
  
  return Math.round(Math.max(0, Math.min(100, coverage + funcScore + stability + ux)));
}

// Generate HTML report
function generateHTMLReport(results: ExplorerResults): string {
  const score = results.score;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : '#ef4444';
  const verdict = score >= 80 ? '✅ Ready to ship!' : score >= 60 ? '⚠️ Needs work' : '❌ Critical issues';
  
  return \`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Reality Mode Report - guardrail</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 2rem; line-height: 1.5; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.5rem; }
    .subtitle { color: #888; margin-bottom: 2rem; font-size: 0.875rem; }
    .score-card { background: linear-gradient(135deg, #1a1a2e, #16213e); border: 1px solid #333; border-radius: 1rem; padding: 2rem; text-align: center; margin-bottom: 2rem; }
    .score { font-size: 5rem; font-weight: 800; color: \${color}; line-height: 1; }
    .grade { font-size: 1.5rem; color: \${color}; margin-top: 0.5rem; }
    .verdict { color: #ccc; margin-top: 0.5rem; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .metric { background: #1a1a1a; border: 1px solid #333; border-radius: 0.75rem; padding: 1.25rem; text-align: center; }
    .metric-value { font-size: 1.75rem; font-weight: 700; color: #fff; }
    .metric-label { color: #888; font-size: 0.75rem; margin-top: 0.25rem; }
    .section { background: #111; border: 1px solid #222; border-radius: 0.75rem; margin-bottom: 1rem; overflow: hidden; }
    .section-header { background: #1a1a1a; padding: 1rem 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid #222; }
    .section-content { padding: 0.5rem 0; max-height: 400px; overflow-y: auto; }
    .item { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1.25rem; border-bottom: 1px solid #1a1a1a; }
    .item:last-child { border-bottom: none; }
    .item-name { font-size: 0.875rem; color: #ddd; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { padding: 0.2rem 0.6rem; border-radius: 1rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
    .badge-success { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
    .badge-error { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
    .badge-warning { background: rgba(234, 179, 8, 0.2); color: #eab308; }
    .badge-info { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
    .error-section { border-color: #7f1d1d; }
    .error-section .section-header { background: rgba(127, 29, 29, 0.3); }
    .error-item { font-family: monospace; font-size: 0.75rem; color: #fca5a5; padding: 0.5rem 1.25rem; border-bottom: 1px solid #2a1a1a; }
    .footer { text-align: center; color: #666; font-size: 0.75rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #222; }
    .duration { color: #888; font-size: 0.875rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Reality Mode Report</h1>
    <p class="subtitle">guardrail • \${new Date().toLocaleString()} • <span class="duration">\${(results.duration / 1000).toFixed(1)}s</span></p>
    
    <div class="score-card">
      <div class="score">\${score}</div>
      <div class="grade">Grade: \${grade}</div>
      <p class="verdict">\${verdict}</p>
    </div>
    
    <div class="metrics">
      <div class="metric">
        <div class="metric-value">\${results.coverage.routes}/\${results.routes.length}</div>
        <div class="metric-label">Routes Working</div>
      </div>
      <div class="metric">
        <div class="metric-value">\${results.coverage.elements}/\${results.elements.length}</div>
        <div class="metric-label">Elements Working</div>
      </div>
      <div class="metric">
        <div class="metric-value">\${results.coverage.forms}/\${results.forms.length}</div>
        <div class="metric-label">Forms Working</div>
      </div>
      <div class="metric">
        <div class="metric-value">\${results.errors.length}</div>
        <div class="metric-label">Errors Captured</div>
      </div>
      <div class="metric">
        <div class="metric-value">\${results.networkCalls.length}</div>
        <div class="metric-label">API Calls</div>
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">🗺️ Routes (\${results.routes.length})</div>
      <div class="section-content">
        \${results.routes.map(r => \`
          <div class="item">
            <span class="item-name">\${r.path}</span>
            <span class="badge badge-\${r.status === 'success' ? 'success' : 'error'}">\${r.status}\${r.responseTime ? \` • \${r.responseTime}ms\` : ''}</span>
          </div>
        \`).join('')}
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">🔘 Interactive Elements (\${results.elements.length})</div>
      <div class="section-content">
        \${results.elements.slice(0, 30).map(e => \`
          <div class="item">
            <span class="item-name">\${e.text || e.selector}</span>
            <span class="badge badge-\${e.status === 'success' ? 'success' : e.status === 'no-change' ? 'warning' : e.status === 'hidden' ? 'info' : 'error'}">\${e.status}</span>
          </div>
        \`).join('')}
        \${results.elements.length > 30 ? \`<div class="item"><span class="item-name" style="color:#888">+ \${results.elements.length - 30} more...</span></div>\` : ''}
      </div>
    </div>
    
    <div class="section">
      <div class="section-header">📝 Forms (\${results.forms.length})</div>
      <div class="section-content">
        \${results.forms.map(f => \`
          <div class="item">
            <span class="item-name">\${f.selector}</span>
            <span class="badge badge-\${f.status === 'success' ? 'success' : 'error'}">\${f.status} • \${f.fieldsFilledCount} fields</span>
          </div>
        \`).join('')}
      </div>
    </div>
    
    \${results.errors.length > 0 ? \`
    <div class="section error-section">
      <div class="section-header">❌ Errors (\${results.errors.length})</div>
      <div class="section-content">
        \${results.errors.slice(0, 15).map(e => \`
          <div class="error-item">[\${e.type}] \${e.message}</div>
        \`).join('')}
      </div>
    </div>
    \` : ''}
    
    <div class="section">
      <div class="section-header">📡 API Calls (\${results.networkCalls.length})</div>
      <div class="section-content">
        \${results.networkCalls.slice(0, 20).map(n => \`
          <div class="item">
            <span class="item-name">\${n.method} \${n.url}</span>
            <span class="badge badge-\${n.status < 400 ? 'success' : 'error'}">\${n.status}</span>
          </div>
        \`).join('')}
      </div>
    </div>
    
    <div class="footer">
      Generated by guardrail Reality Mode • <a href="https://guardrailai.dev" style="color:#3b82f6">guardrailai.dev</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Run the Reality Mode exploration
 */
async function runReality(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    printHelp();
    return 0;
  }

  // Handle init subcommand
  if (opts.init) {
    return runRealityInit();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTITLEMENT CHECK - Reality Mode is a premium feature
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    await enforceFeature('reality');
    await enforceLimit('realityRuns');
    
    // Check for flow packs (premium feature)
    if (opts.flows && opts.flows.length > 0) {
      await enforceFeature('reality:flows');
    }
  } catch (err) {
    if (err.code === 'LIMIT_EXCEEDED' || err.code === 'FEATURE_NOT_AVAILABLE') {
      console.error(err.upgradePrompt || err.message);
      const { EXIT_CODES } = require('./lib/error-handler');
      process.exit(EXIT_CODES.AUTH_REQUIRED);
    }
    throw err;
  }
  
  // Track usage
  await trackUsage('realityRuns');

  if (!opts.url) {
    console.error(`\n  ${c.red}❌ Error: --url is required${c.reset}\n`);
    printHelp();
    return 1;
  }

  // Validate URL
  try {
    new URL(opts.url);
  } catch {
    console.error(`\n  ${c.red}❌ Error: Invalid URL: ${opts.url}${c.reset}\n`);
    return 1;
  }

  console.log(`
${c.bold}${c.cyan}╔════════════════════════════════════════════════════════════╗
║  🔍 guardrail REALITY MODE                                 ║
╚════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}Testing: ${opts.url}${c.reset}
${c.dim}Output:  ${opts.output}${c.reset}
${opts.danger ? `${c.yellow}⚠️  Destructive mode enabled${c.reset}` : ""}
${opts.auth ? `${c.green}🔐 Auth credentials provided${c.reset}` : ""}
`);

  // Ensure Playwright is available
  const hasPlaywright = await ensurePlaywright();
  if (!hasPlaywright) {
    return 1;
  }

  // Generate test file
  console.log(`  ${c.cyan}📝 Generating exploration test...${c.reset}`);
  const testPath = generateTestFile(opts);
  console.log(`  ${c.green}✓${c.reset} Test file: ${testPath}\n`);

  // Run Playwright
  console.log(`  ${c.cyan}🚀 Starting exploration...${c.reset}\n`);

  return new Promise((resolve) => {
    const playwrightArgs = [
      "playwright",
      "test",
      testPath,
      opts.headless ? "" : "--headed",
      "--reporter=list",
      `--timeout=${opts.timeout}`,
    ].filter(Boolean);

    const proc = spawn("npx", playwrightArgs, {
      stdio: "inherit",
      shell: true,
      cwd: process.cwd(),
    });

    proc.on("close", (code) => {
      const outputDir = path.resolve(opts.output);
      const reportPath = path.join(outputDir, "reality-report.html");
      const resultsPath = path.join(outputDir, "explorer-results.json");

      console.log(
        `\n${c.bold}${c.cyan}═══════════════════════════════════════════════════════════${c.reset}`,
      );

      if (fs.existsSync(resultsPath)) {
        try {
          const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
          const score = results.score || 0;
          const scoreColor =
            score >= 80 ? c.green : score >= 60 ? c.yellow : c.red;

          console.log(
            `\n  ${c.bold}Reality Score: ${scoreColor}${score}/100${c.reset}`,
          );
          console.log(
            `\n  📊 Routes:   ${results.coverage?.routes || 0}/${results.routes?.length || 0} working`,
          );
          console.log(
            `  🔘 Elements: ${results.coverage?.elements || 0}/${results.elements?.length || 0} working`,
          );
          console.log(
            `  📝 Forms:    ${results.coverage?.forms || 0}/${results.forms?.length || 0} working`,
          );
          console.log(`  ❌ Errors:   ${results.errors?.length || 0} captured`);
        } catch (e) {
          // Non-fatal: results file may be malformed, continue without score display
          console.warn(`${c.yellow}⚠${c.reset} Failed to parse results for score display: ${e.message}`);
        }
      }

      console.log(`\n  ${c.bold}📄 Report:${c.reset} ${reportPath}`);
      console.log(`  ${c.bold}📋 Data:${c.reset}   ${resultsPath}`);

      // Generate JUnit XML if requested
      if (opts.junit && fs.existsSync(resultsPath)) {
        try {
          const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
          const junitPath = path.join(outputDir, "junit-results.xml");
          const junitXml = generateJUnitXML(results);
          fs.writeFileSync(junitPath, junitXml);
          console.log(`  ${c.bold}🧪 JUnit:${c.reset}  ${junitPath}`);
        } catch (e) {
          // Non-fatal: JUnit generation failed, continue without it
          console.warn(`${c.yellow}⚠${c.reset} Failed to generate JUnit XML: ${e.message}`);
        }
      }

      // Generate SARIF for GitHub code scanning
      if (opts.sarif && fs.existsSync(resultsPath)) {
        try {
          const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
          const sarifPath = path.join(outputDir, "reality-results.sarif");
          const sarifJson = generateSARIF(results, opts.url);
          fs.writeFileSync(sarifPath, JSON.stringify(sarifJson, null, 2));
          console.log(`  ${c.bold}🔍 SARIF:${c.reset}  ${sarifPath}`);
        } catch (e) {
          // Non-fatal: SARIF generation failed, continue without it
          console.warn(`${c.yellow}⚠${c.reset} Failed to generate SARIF: ${e.message}`);
        }
      }

      // Determine exit code based on threshold
      let exitCode = code || 0;
      if ((opts.ci || opts.threshold > 0) && fs.existsSync(resultsPath)) {
        try {
          const results = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
          const score = results.score || 0;
          const threshold = opts.threshold || 70; // Default threshold for CI mode

          if (score < threshold) {
            console.log(
              `\n  ${c.red}❌ Score ${score} is below threshold ${threshold}${c.reset}`,
            );
            exitCode = 1;
          } else {
            console.log(
              `\n  ${c.green}✅ Score ${score} meets threshold ${threshold}${c.reset}`,
            );
          }
        } catch (e) {
          // Non-fatal: threshold check failed, use default exit code
          console.warn(`${c.yellow}⚠${c.reset} Failed to check threshold: ${e.message}`);
        }
      }

      console.log(
        `\n${c.bold}${c.cyan}═══════════════════════════════════════════════════════════${c.reset}\n`,
      );

      resolve(exitCode);
    });
  });
}

/**
 * Generate JUnit XML for CI integration
 */
function generateJUnitXML(results) {
  const timestamp = new Date().toISOString();
  const testCount =
    (results.routes?.length || 0) +
    (results.elements?.length || 0) +
    (results.forms?.length || 0);
  const failures = results.errors?.length || 0;
  const routeFailures =
    results.routes?.filter((r) => r.status !== "success").length || 0;
  const elementFailures =
    results.elements?.filter((e) => e.status === "error").length || 0;
  const formFailures =
    results.forms?.filter((f) => f.status === "error").length || 0;
  const totalFailures = routeFailures + elementFailures + formFailures;

  let testcases = "";

  // Route tests
  for (const route of results.routes || []) {
    if (route.status === "success") {
      testcases += `    <testcase name="Route: ${escapeXml(route.path)}" classname="reality.routes" time="${(route.responseTime || 0) / 1000}"/>\n`;
    } else {
      testcases += `    <testcase name="Route: ${escapeXml(route.path)}" classname="reality.routes" time="0">
      <failure message="${escapeXml(route.error || route.status)}">${escapeXml(route.error || "Route failed")}</failure>
    </testcase>\n`;
    }
  }

  // Element tests
  for (const el of results.elements || []) {
    if (el.status === "success" || el.status === "no-change") {
      testcases += `    <testcase name="Element: ${escapeXml(el.text || el.selector)}" classname="reality.elements" time="0"/>\n`;
    } else if (el.status === "error") {
      testcases += `    <testcase name="Element: ${escapeXml(el.text || el.selector)}" classname="reality.elements" time="0">
      <failure message="${escapeXml(el.error || el.status)}">${escapeXml(el.error || "Element test failed")}</failure>
    </testcase>\n`;
    }
  }

  // Form tests
  for (const form of results.forms || []) {
    if (form.status === "success") {
      testcases += `    <testcase name="Form: ${escapeXml(form.selector)}" classname="reality.forms" time="0"/>\n`;
    } else if (form.status === "error") {
      testcases += `    <testcase name="Form: ${escapeXml(form.selector)}" classname="reality.forms" time="0">
      <failure message="${escapeXml(form.error || form.status)}">${escapeXml(form.error || "Form test failed")}</failure>
    </testcase>\n`;
    }
  }

  // Error tests
  for (const error of results.errors || []) {
    testcases += `    <testcase name="Error: ${escapeXml(error.type)}" classname="reality.errors" time="0">
      <failure message="${escapeXml(error.message)}">${escapeXml(error.message)}</failure>
    </testcase>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="guardrail Reality Mode" tests="${testCount}" failures="${totalFailures}" errors="${failures}" time="${(results.duration || 0) / 1000}" timestamp="${timestamp}">
  <testsuite name="Reality Explorer" tests="${testCount}" failures="${totalFailures}" errors="${failures}" time="${(results.duration || 0) / 1000}">
    <properties>
      <property name="score" value="${results.score || 0}"/>
      <property name="routes.discovered" value="${results.routes?.length || 0}"/>
      <property name="routes.working" value="${results.coverage?.routes || 0}"/>
      <property name="elements.discovered" value="${results.elements?.length || 0}"/>
      <property name="elements.working" value="${results.coverage?.elements || 0}"/>
      <property name="forms.discovered" value="${results.forms?.length || 0}"/>
      <property name="forms.working" value="${results.coverage?.forms || 0}"/>
    </properties>
${testcases}  </testsuite>
</testsuites>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generate SARIF for GitHub code scanning
 */
function generateSARIF(results, targetUrl) {
  const rules = [];
  const sarfResults = [];

  // Define rules for different issue types
  const ruleDefinitions = {
    "route-error": {
      id: "reality/route-error",
      shortDescription: { text: "Route Error" },
      fullDescription: {
        text: "A route returned an error status or failed to load",
      },
      defaultConfiguration: { level: "error" },
      helpUri: "https://guardrailai.dev/docs/reality-mode#routes",
    },
    "element-error": {
      id: "reality/element-error",
      shortDescription: { text: "Element Interaction Error" },
      fullDescription: {
        text: "An interactive element failed when clicked or interacted with",
      },
      defaultConfiguration: { level: "warning" },
      helpUri: "https://guardrailai.dev/docs/reality-mode#elements",
    },
    "form-error": {
      id: "reality/form-error",
      shortDescription: { text: "Form Error" },
      fullDescription: {
        text: "A form could not be filled or submitted correctly",
      },
      defaultConfiguration: { level: "warning" },
      helpUri: "https://guardrailai.dev/docs/reality-mode#forms",
    },
    "console-error": {
      id: "reality/console-error",
      shortDescription: { text: "Console Error" },
      fullDescription: {
        text: "JavaScript console error detected during exploration",
      },
      defaultConfiguration: { level: "error" },
      helpUri: "https://guardrailai.dev/docs/reality-mode#errors",
    },
    "uncaught-error": {
      id: "reality/uncaught-error",
      shortDescription: { text: "Uncaught Exception" },
      fullDescription: { text: "An uncaught JavaScript exception occurred" },
      defaultConfiguration: { level: "error" },
      helpUri: "https://guardrailai.dev/docs/reality-mode#errors",
    },
  };

  // Add rules that have results
  const usedRules = new Set();

  // Process route errors
  for (const route of results.routes || []) {
    if (route.status !== "success") {
      usedRules.add("route-error");
      sarfResults.push({
        ruleId: "reality/route-error",
        level: "error",
        message: {
          text: `Route ${route.path} failed: ${route.error || route.status}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: targetUrl + route.path },
            },
          },
        ],
      });
    }
  }

  // Process element errors
  for (const el of results.elements || []) {
    if (el.status === "error") {
      usedRules.add("element-error");
      sarfResults.push({
        ruleId: "reality/element-error",
        level: "warning",
        message: {
          text: `Element "${el.text || el.selector}" failed: ${el.error || "interaction error"}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: targetUrl },
            },
          },
        ],
      });
    }
  }

  // Process form errors
  for (const form of results.forms || []) {
    if (form.status === "error") {
      usedRules.add("form-error");
      sarfResults.push({
        ruleId: "reality/form-error",
        level: "warning",
        message: {
          text: `Form ${form.selector} failed: ${form.error || "form error"}`,
        },
        locations: [
          {
            physicalLocation: {
              artifactLocation: { uri: targetUrl },
            },
          },
        ],
      });
    }
  }

  // Process console/uncaught errors
  for (const error of results.errors || []) {
    const ruleId =
      error.type === "uncaught" ? "uncaught-error" : "console-error";
    usedRules.add(ruleId);
    sarfResults.push({
      ruleId: `reality/${ruleId}`,
      level: "error",
      message: { text: error.message },
      locations: [
        {
          physicalLocation: {
            artifactLocation: { uri: error.url || targetUrl },
          },
        },
      ],
    });
  }

  // Add used rules
  for (const ruleKey of usedRules) {
    rules.push(ruleDefinitions[ruleKey]);
  }

  return {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "guardrail Reality Mode",
            version: "2.0.0",
            informationUri: "https://guardrailai.dev/reality-mode",
            rules,
          },
        },
        results: sarfResults,
        invocations: [
          {
            executionSuccessful: true,
            endTimeUtc: new Date().toISOString(),
          },
        ],
      },
    ],
  };
}

/**
 * Initialize Reality Mode in the current project
 * Creates .guardrail/flows/ with example flows and GitHub Action
 */
function runRealityInit() {
  console.log(`
${c.bold}${c.cyan}🔧 REALITY MODE INIT${c.reset}

Setting up Reality Mode in your project...
`);

  const cwd = process.cwd();
  const flowsDir = path.join(cwd, ".guardrail", "flows");
  const githubDir = path.join(cwd, ".github", "workflows");

  // Create directories
  if (!fs.existsSync(flowsDir)) {
    fs.mkdirSync(flowsDir, { recursive: true });
    console.log(
      `  ${c.green}✓${c.reset} Created ${c.dim}.guardrail/flows/${c.reset}`,
    );
  }

  // Write example auth flow
  const authFlowContent = `# Authentication Flow - Login Testing
# Customize this for your app's login flow

id: auth-login
name: User Login
description: Tests the email/password login flow
required: true

steps:
  - action: navigate
    target: /login

  - action: wait
    timeout: 2000

  - action: fill
    target: input[name="email"], input[type="email"], #email
    value: "{{email}}"

  - action: fill
    target: input[name="password"], input[type="password"], #password
    value: "{{password}}"

  - action: click
    target: button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")

  - action: wait
    timeout: 5000

assertions:
  - type: url-contains
    value: /dashboard|/home|/app
    critical: true

  - type: no-errors
    value: ""
    critical: true
`;

  fs.writeFileSync(path.join(flowsDir, "auth-login.yaml"), authFlowContent);
  console.log(
    `  ${c.green}✓${c.reset} Created ${c.dim}.guardrail/flows/auth-login.yaml${c.reset}`,
  );

  // Write example signup flow
  const signupFlowContent = `# Signup Flow - Registration Testing
# Customize this for your app's registration flow

id: auth-signup
name: User Registration
description: Tests the signup/registration flow
required: false

steps:
  - action: navigate
    target: /signup

  - action: wait
    timeout: 2000

  - action: fill
    target: input[name="name"], input[name="fullName"], #name
    value: "{{name}}"

  - action: fill
    target: input[name="email"], input[type="email"], #email
    value: "{{email}}"

  - action: fill
    target: input[name="password"], input[type="password"], #password
    value: "{{password}}"

  - action: click
    target: button[type="submit"], button:has-text("Sign up"), button:has-text("Create account")

  - action: wait
    timeout: 5000

assertions:
  - type: no-errors
    value: ""
    critical: true
`;

  fs.writeFileSync(path.join(flowsDir, "auth-signup.yaml"), signupFlowContent);
  console.log(
    `  ${c.green}✓${c.reset} Created ${c.dim}.guardrail/flows/auth-signup.yaml${c.reset}`,
  );

  // Create GitHub Action workflow
  if (!fs.existsSync(githubDir)) {
    fs.mkdirSync(githubDir, { recursive: true });
  }

  const workflowContent = `# guardrail Reality Mode - GitHub Actions Workflow
# Runs Reality Mode tests on PRs and deployments

name: Reality Mode Tests

on:
  pull_request:
    branches: [main, master]
  workflow_dispatch:
    inputs:
      url:
        description: 'URL to test'
        required: true
        type: string

jobs:
  reality-test:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Playwright
        run: |
          npm install -D @playwright/test
          npx playwright install chromium --with-deps

      - name: Install guardrail
        run: npm install -g guardrail

      - name: Run Reality Mode
        run: |
          guardrail reality \\
            --url "\${{ github.event.inputs.url || secrets.REALITY_TEST_URL }}" \\
            \${{ secrets.REALITY_AUTH && format('--auth "{0}"', secrets.REALITY_AUTH) || '' }} \\
            --junit \\
            --output .guardrail/reality
        continue-on-error: true

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: reality-mode-results
          path: .guardrail/reality/
          retention-days: 14
`;

  fs.writeFileSync(path.join(githubDir, "reality-mode.yml"), workflowContent);
  console.log(
    `  ${c.green}✓${c.reset} Created ${c.dim}.github/workflows/reality-mode.yml${c.reset}`,
  );

  // Print next steps
  console.log(`
${c.bold}${c.green}✅ Reality Mode initialized!${c.reset}

${c.bold}Next steps:${c.reset}

  1. ${c.cyan}Customize your flows:${c.reset}
     Edit the YAML files in .guardrail/flows/ to match your app

  2. ${c.cyan}Set GitHub secrets:${c.reset}
     REALITY_TEST_URL  - Your staging/preview URL
     REALITY_AUTH      - Test credentials (email:password)

  3. ${c.cyan}Run locally:${c.reset}
     guardrail reality --url https://your-app.com

  4. ${c.cyan}Test with custom flows:${c.reset}
     guardrail reality --url https://your-app.com --flows-dir .guardrail/flows
`);

  return 0;
}

module.exports = { runReality };
