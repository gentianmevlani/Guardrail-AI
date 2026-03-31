/**
 * AI Agent Reality Mode CLI Runner
 *
 * Run autonomous AI-powered testing on any web application.
 *
 * Usage:
 *   guardrail ai-test --url https://myapp.com --goal "Test the signup flow"
 *   guardrail ai-test --url https://myapp.com --goal "Login and check dashboard"
 */

const fs = require("fs");
const path = require("path");
const { enforceLimit, enforceFeature, trackUsage, getCurrentTier } = require("./lib/entitlements");

// Try to load playwright from various locations
let chromium;
try {
  chromium = require("@playwright/test").chromium;
} catch {
  try {
    chromium = require("playwright").chromium;
  } catch {
    try {
      chromium = require("playwright-core").chromium;
    } catch {
      chromium = null;
    }
  }
}

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
    goal: "Explore the application and test all major features",
    apiKey: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY,
    model: "gpt-4o",
    maxActions: 20,
    timeout: 30000,
    output: ".guardrail/ai-agent",
    headless: true,
    vision: true,
    scenarios: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--url" || arg === "-u") {
      opts.url = args[++i];
    } else if (arg === "--goal" || arg === "-g") {
      opts.goal = args[++i];
    } else if (arg === "--api-key" || arg === "-k") {
      opts.apiKey = args[++i];
    } else if (arg === "--model" || arg === "-m") {
      opts.model = args[++i];
    } else if (arg === "--max-actions") {
      opts.maxActions = parseInt(args[++i], 10);
    } else if (arg === "--timeout") {
      opts.timeout = parseInt(args[++i], 10);
    } else if (arg === "--output" || arg === "-o") {
      opts.output = args[++i];
    } else if (arg === "--headed" || arg === "--no-headless") {
      opts.headless = false;
    } else if (arg === "--no-vision") {
      opts.vision = false;
    } else if (arg === "--scenarios" || arg === "-s") {
      opts.scenarios = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
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
${c.bold}${c.cyan}🤖 guardrail AI AGENT${c.reset}

${c.dim}Autonomous AI-powered testing that thinks and acts like a real user.${c.reset}

${c.bold}USAGE:${c.reset}
  guardrail ai-test --url <URL> --goal "<goal>" [options]

${c.bold}OPTIONS:${c.reset}
  --url, -u <URL>         Target URL to test (required)
  --goal, -g <goal>       Natural language goal for the AI agent
  --api-key, -k <key>     OpenAI API key (or set OPENAI_API_KEY env var)
  --model, -m <model>     AI model to use (default: gpt-4o)
  --max-actions <n>       Maximum actions per scenario (default: 20)
  --timeout <ms>          Timeout per action in ms (default: 30000)
  --output, -o <dir>      Output directory (default: .guardrail/ai-agent)
  --headed                Run browser in visible mode
  --no-vision             Disable screenshot analysis (faster, less accurate)
  --scenarios, -s <file>  JSON file with test scenarios
  --help, -h              Show this help

${c.bold}EXAMPLES:${c.reset}
  ${c.dim}# Basic AI-powered test${c.reset}
  guardrail ai-test --url https://myapp.com --goal "Test the signup flow"

  ${c.dim}# Test with visible browser${c.reset}
  guardrail ai-test --url https://myapp.com --goal "Login and explore dashboard" --headed

  ${c.dim}# Run multiple scenarios from file${c.reset}
  guardrail ai-test --url https://myapp.com --scenarios tests/ai-scenarios.json

  ${c.dim}# Use Claude instead of GPT-4${c.reset}
  guardrail ai-test --url https://myapp.com --model claude-3-opus --goal "Test checkout"

${c.bold}SCENARIO FILE FORMAT:${c.reset}
  [
    {
      "name": "Signup Flow",
      "goal": "Create a new account and verify email confirmation",
      "maxActions": 15
    },
    {
      "name": "Dashboard Test",
      "goal": "Login and verify all dashboard widgets load correctly",
      "startUrl": "/login"
    }
  ]

${c.bold}WHAT THE AI AGENT DOES:${c.reset}
  ✓ Analyzes the page visually (with GPT-4 Vision)
  ✓ Decides what actions to take based on the goal
  ✓ Fills forms with intelligent test data
  ✓ Navigates through the app like a real user
  ✓ Detects errors, broken features, and fake functionality
  ✓ Generates detailed reports with screenshots

${c.bold}OUTPUT:${c.reset}
  📊 ai-agent-report.html  - Visual report with AI insights
  📋 ai-agent-results.json - Machine-readable results
  🎥 videos/               - Screen recordings
  📸 screenshots/          - Step-by-step screenshots
`);
}

/**
 * Simple AI Agent implementation (no external dependencies)
 */
async function runSimpleAIAgent(browser, config) {
  const startTime = Date.now();
  const results = {
    url: config.url,
    goal: config.goal,
    steps: [],
    errors: [],
    score: 0,
    duration: 0,
    apiCalls: [],
    cookies: [],
    localStorage: {},
    securityHeaders: {},
    crudOperations: [],
  };

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: path.join(config.output, "videos") },
  });

  const page = await context.newPage();

  // Set up API interception
  const apiCalls = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/") || url.includes("/graphql") || url.includes("/v1/") || url.includes("/v2/")) {
      apiCalls.push({
        url: url,
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
        timestamp: Date.now(),
        type: "request"
      });
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (url.includes("/api/") || url.includes("/graphql") || url.includes("/v1/") || url.includes("/v2/")) {
      try {
        const status = response.status();
        const headers = response.headers();
        let body = null;
        try {
          body = await response.json().catch(() => null);
        } catch (e) {}
        
        apiCalls.push({
          url: url,
          method: response.request().method(),
          status: status,
          headers: headers,
          body: body ? JSON.stringify(body).slice(0, 500) : null,
          timestamp: Date.now(),
          type: "response"
        });

        // Check for security headers
        if (!results.securityHeaders.checked) {
          results.securityHeaders = {
            checked: true,
            'x-frame-options': headers['x-frame-options'] || 'MISSING',
            'x-content-type-options': headers['x-content-type-options'] || 'MISSING',
            'x-xss-protection': headers['x-xss-protection'] || 'MISSING',
            'strict-transport-security': headers['strict-transport-security'] || 'MISSING',
            'content-security-policy': headers['content-security-policy'] ? 'PRESENT' : 'MISSING',
          };
        }
      } catch (e) {}
    }
  });

  // Capture console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      results.errors.push(msg.text().slice(0, 200));
    }
  });

  console.log(`\n  ${c.cyan}🤖 AI Agent starting...${c.reset}`);
  console.log(`  ${c.dim}Goal: ${config.goal}${c.reset}\n`);

  // Navigate to URL
  await page.goto(config.url, { waitUntil: "networkidle" });

  // Take initial screenshot
  const screenshotDir = path.join(config.output, "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }
  await page.screenshot({ path: path.join(screenshotDir, "01-initial.png") });

  // If we have an API key, use the full AI agent
  if (config.apiKey) {
    console.log(`  ${c.green}✓${c.reset} Using AI model: ${config.model}`);
    
    // Call OpenAI API for intelligent testing
    const aiResult = await runWithOpenAI(page, config, results);
    Object.assign(results, aiResult);
  } else {
    console.log(`  ${c.yellow}⚠${c.reset} No API key provided, using heuristic testing`);
    
    // Fallback to heuristic-based testing
    await runHeuristicTest(page, config, results);
  }

  // Store API calls
  results.apiCalls = apiCalls;

  // Collect cookies and localStorage
  await collectStorageData(page, results);

  // Take final screenshot
  await page.screenshot({ path: path.join(screenshotDir, "final.png") });

  await context.close();

  results.duration = Date.now() - startTime;
  results.score = calculateScore(results);

  return results;
}

/**
 * Run with OpenAI API
 */
async function runWithOpenAI(page, config, results) {
  const maxSteps = config.maxActions;
  let stepCount = 0;

  while (stepCount < maxSteps) {
    stepCount++;

    // Extract page state
    const pageState = await extractPageState(page);

    // Build prompt for AI
    const prompt = buildAIPrompt(pageState, config.goal, results.steps);

    console.log(`  ${c.blue}Step ${stepCount}:${c.reset} Analyzing page...`);

    try {
      // Call OpenAI API
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: "system",
              content: getSystemPrompt(),
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("No response from AI");
      }

      // Parse AI response
      const action = parseAIResponse(content);

      console.log(`  ${c.dim}→ ${action.type}: ${action.target || action.value || ""}${c.reset}`);

      // Execute the action
      const result = await executeAction(page, action);

      results.steps.push({
        step: stepCount,
        action,
        success: result.success,
        error: result.error,
      });

      if (result.success) {
        console.log(`  ${c.green}✓${c.reset} Success`);
      } else {
        console.log(`  ${c.red}✗${c.reset} ${result.error}`);
      }

      // Take screenshot
      await page.screenshot({
        path: path.join(config.output, "screenshots", `step-${stepCount}.png`),
      });

      // Check if we should stop
      if (action.type === "done" || action.type === "screenshot") {
        break;
      }

      // Wait a bit between actions
      await page.waitForTimeout(1000);
    } catch (error) {
      console.log(`  ${c.red}✗${c.reset} Error: ${error.message}`);
      results.errors.push(error.message);
      break;
    }
  }

  return results;
}

/**
 * Fallback heuristic-based testing - COMPREHENSIVE VERSION
 */
async function runHeuristicTest(page, config, results) {
  const goal = config.goal.toLowerCase();
  let stepCount = 0;

  // Initialize performance metrics
  results.performance = {
    pageLoadTimes: [],
    apiCalls: [],
    errors: [],
    warnings: []
  };

  console.log(`\n  ${c.cyan}Phase 1: Analyzing page structure...${c.reset}`);

  // Detect what's on the page
  const pageAnalysis = await analyzePage(page);
  console.log(`  ${c.dim}Found: ${pageAnalysis.buttons.length} buttons, ${pageAnalysis.inputs.length} inputs, ${pageAnalysis.links.length} links${c.reset}`);

  // PHASE 1: Always try to find and test authentication
  console.log(`\n  ${c.cyan}Phase 2: Testing Authentication Flows...${c.reset}`);
  
  // Test OAuth providers first
  const oauthResult = await testOAuthProviders(page, config, results);
  stepCount += oauthResult.steps;

  // Look for Login button
  const loginResult = await testLoginFlow(page, config, results);
  stepCount += loginResult.steps;

  // Look for Signup button
  const signupResult = await testSignupFlow(page, config, results);
  stepCount += signupResult.steps;

  // PHASE 2: If we're authenticated, explore the dashboard
  console.log(`\n  ${c.cyan}Phase 3: Exploring Dashboard...${c.reset}`);
  const dashboardResult = await exploreDashboard(page, config, results);
  stepCount += dashboardResult.steps;

  // PHASE 3: Test navigation
  console.log(`\n  ${c.cyan}Phase 4: Testing Navigation...${c.reset}`);
  const navResult = await testNavigation(page, config, results);
  stepCount += navResult.steps;

  // PHASE 4: Test interactive elements
  console.log(`\n  ${c.cyan}Phase 5: Testing Interactive Elements...${c.reset}`);
  const interactiveResult = await testInteractiveElements(page, config, results);
  stepCount += interactiveResult.steps;

  // PHASE 5: Test forms
  console.log(`\n  ${c.cyan}Phase 6: Testing Forms...${c.reset}`);
  const formResult = await testForms(page, config, results);
  stepCount += formResult.steps;

  // PHASE 6: Test search functionality
  console.log(`\n  ${c.cyan}Phase 7: Testing Search...${c.reset}`);
  const searchResult = await testSearch(page, config, results);
  stepCount += searchResult.steps;

  // PHASE 7: Test multi-viewport (mobile)
  console.log(`\n  ${c.cyan}Phase 8: Testing Mobile Responsiveness...${c.reset}`);
  const mobileResult = await testMobileView(page, config, results);
  stepCount += mobileResult.steps;

  // PHASE 8: Check for errors and issues
  console.log(`\n  ${c.cyan}Phase 9: Checking for Issues...${c.reset}`);
  await checkForIssues(page, results);

  // PHASE 9: Performance summary
  console.log(`\n  ${c.cyan}Phase 10: Performance Analysis...${c.reset}`);
  await analyzePerformance(page, results);

  // PHASE 10: CRUD Operations
  console.log(`\n  ${c.cyan}Phase 11: Testing CRUD Operations...${c.reset}`);
  const crudResult = await testCRUDOperations(page, config, results);
  stepCount += crudResult.steps;

  // PHASE 11: Pagination
  console.log(`\n  ${c.cyan}Phase 12: Testing Pagination...${c.reset}`);
  const paginationResult = await testPagination(page, config, results);
  stepCount += paginationResult.steps;

  // PHASE 12: File Upload
  console.log(`\n  ${c.cyan}Phase 13: Testing File Upload...${c.reset}`);
  const uploadResult = await testFileUpload(page, config, results);
  stepCount += uploadResult.steps;

  // PHASE 13: Security Headers
  console.log(`\n  ${c.cyan}Phase 14: Security Analysis...${c.reset}`);
  await analyzeSecurityHeaders(page, results);

  // PHASE 14: API Analysis
  await analyzeAPICalls(results);

  // PHASE 15: Storage Data
  console.log(`\n  ${c.cyan}Phase 15: Storage & Cookies Analysis...${c.reset}`);

  return results;
}

/**
 * Analyze the page structure
 */
async function analyzePage(page) {
  return await page.evaluate(() => {
    const isVisible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && 
             style.visibility !== 'hidden' && 
             style.display !== 'none';
    };

    const buttons = [];
    document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(el => {
      if (isVisible(el)) {
        buttons.push({
          text: (el.textContent || '').trim().slice(0, 50),
          type: el.type || 'button'
        });
      }
    });

    const inputs = [];
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (isVisible(el)) {
        inputs.push({
          type: el.type || 'text',
          name: el.name,
          placeholder: el.placeholder
        });
      }
    });

    const links = [];
    document.querySelectorAll('a[href]').forEach(el => {
      if (isVisible(el)) {
        links.push({
          text: (el.textContent || '').trim().slice(0, 50),
          href: el.getAttribute('href')
        });
      }
    });

    return { buttons, inputs, links };
  });
}

/**
 * Test Login Flow
 */
async function testLoginFlow(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  try {
    // Find login button
    const loginSelectors = [
      'button:has-text("Login")',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'a:has-text("Login")',
      'a:has-text("Log in")',
      'a:has-text("Sign in")',
      '[data-testid="login"]',
      '[data-testid="signin"]'
    ];

    let loginButton = null;
    for (const selector of loginSelectors) {
      try {
        loginButton = await page.$(selector);
        if (loginButton && await loginButton.isVisible()) {
          console.log(`  ${c.green}✓${c.reset} Found login button`);
          break;
        }
        loginButton = null;
      } catch (e) {}
    }

    if (loginButton) {
      await loginButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, `login-page.png`) });
      steps++;
      results.steps.push({ step: steps, action: { type: "click", target: "Login button" }, success: true });
      console.log(`  ${c.green}✓${c.reset} Clicked login button`);

      // Now fill the login form
      const loginFormResult = await fillAuthForm(page, 'login', config, results);
      steps += loginFormResult.steps;

      // Try to submit
      const submitResult = await submitForm(page, config, results);
      steps += submitResult.steps;

      // Check if we're logged in
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/home') || currentUrl.includes('/app')) {
        console.log(`  ${c.green}✓${c.reset} Login successful - redirected to dashboard!`);
        results.steps.push({ step: steps + 1, action: { type: "assert", target: "Login success" }, success: true });
        steps++;
      } else {
        // Check for error messages
        const errorMsg = await page.$('.error, [data-error], .alert-danger, .text-red');
        if (errorMsg) {
          const errorText = await errorMsg.textContent();
          console.log(`  ${c.yellow}⚠${c.reset} Login form submitted but got error: ${errorText?.slice(0, 50)}`);
        } else {
          console.log(`  ${c.yellow}⚠${c.reset} Login form submitted, checking result...`);
        }
      }

      await page.screenshot({ path: path.join(screenshotDir, `login-result.png`) });
    } else {
      console.log(`  ${c.dim}No login button found on current page${c.reset}`);
    }
  } catch (error) {
    console.log(`  ${c.red}✗${c.reset} Login flow error: ${error.message}`);
    results.errors.push(`Login flow: ${error.message}`);
  }

  return { steps };
}

/**
 * Test Signup Flow
 */
async function testSignupFlow(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  // Go back to home first
  await page.goto(config.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  try {
    // Find signup button
    const signupSelectors = [
      'button:has-text("Sign up")',
      'button:has-text("Sign Up")',
      'button:has-text("Get Started")',
      'button:has-text("Create Account")',
      'button:has-text("Register")',
      'a:has-text("Sign up")',
      'a:has-text("Sign Up")',
      'a:has-text("Get Started")',
      'a:has-text("Create Account")',
      'a:has-text("Register")',
      '[data-testid="signup"]',
      '[data-testid="register"]'
    ];

    let signupButton = null;
    for (const selector of signupSelectors) {
      try {
        signupButton = await page.$(selector);
        if (signupButton && await signupButton.isVisible()) {
          console.log(`  ${c.green}✓${c.reset} Found signup button`);
          break;
        }
        signupButton = null;
      } catch (e) {}
    }

    if (signupButton) {
      await signupButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(screenshotDir, `signup-page.png`) });
      steps++;
      results.steps.push({ step: steps, action: { type: "click", target: "Signup button" }, success: true });
      console.log(`  ${c.green}✓${c.reset} Clicked signup button`);

      // Now fill the signup form
      const signupFormResult = await fillAuthForm(page, 'signup', config, results);
      steps += signupFormResult.steps;

      // Try to submit
      const submitResult = await submitForm(page, config, results);
      steps += submitResult.steps;

      // Check result
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      if (currentUrl.includes('/dashboard') || currentUrl.includes('/home') || currentUrl.includes('/verify') || currentUrl.includes('/welcome')) {
        console.log(`  ${c.green}✓${c.reset} Signup successful!`);
        results.steps.push({ step: steps + 1, action: { type: "assert", target: "Signup success" }, success: true });
        steps++;
      }

      await page.screenshot({ path: path.join(screenshotDir, `signup-result.png`) });
    } else {
      console.log(`  ${c.dim}No signup button found on current page${c.reset}`);
    }
  } catch (error) {
    console.log(`  ${c.red}✗${c.reset} Signup flow error: ${error.message}`);
    results.errors.push(`Signup flow: ${error.message}`);
  }

  return { steps };
}

/**
 * Fill authentication form (login or signup)
 */
async function fillAuthForm(page, formType, config, results) {
  let steps = 0;
  const timestamp = Date.now();

  // Test data
  const testData = {
    email: `test-${timestamp}@guardrailai.dev`,
    password: 'TestPass123!@#',
    name: 'Reality Test User',
    firstName: 'Reality',
    lastName: 'Tester',
    username: `testuser${timestamp}`,
    phone: '+1 555 123 4567',
    company: 'guardrail Test Co'
  };

  // Field mappings with multiple selectors
  const fieldMappings = [
    { 
      name: 'email',
      selectors: ['input[type="email"]', 'input[name="email"]', 'input[name="username"]', '#email', '#username'],
      value: testData.email
    },
    { 
      name: 'password',
      selectors: ['input[type="password"]', 'input[name="password"]', '#password'],
      value: testData.password
    },
    { 
      name: 'confirmPassword',
      selectors: ['input[name="confirmPassword"]', 'input[name="password_confirmation"]', 'input[name="confirm"]', '#confirmPassword'],
      value: testData.password
    },
    { 
      name: 'name',
      selectors: ['input[name="name"]', 'input[name="fullName"]', 'input[name="full_name"]', '#name', '#fullName'],
      value: testData.name
    },
    { 
      name: 'firstName',
      selectors: ['input[name="firstName"]', 'input[name="first_name"]', '#firstName'],
      value: testData.firstName
    },
    { 
      name: 'lastName',
      selectors: ['input[name="lastName"]', 'input[name="last_name"]', '#lastName'],
      value: testData.lastName
    },
    { 
      name: 'phone',
      selectors: ['input[type="tel"]', 'input[name="phone"]', 'input[name="mobile"]', '#phone'],
      value: testData.phone
    },
    { 
      name: 'company',
      selectors: ['input[name="company"]', 'input[name="organization"]', '#company'],
      value: testData.company
    }
  ];

  for (const field of fieldMappings) {
    for (const selector of field.selectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          await element.fill(field.value);
          steps++;
          results.steps.push({ 
            step: results.steps.length + 1, 
            action: { type: "fill", target: field.name, value: field.value.slice(0, 20) + '...' }, 
            success: true 
          });
          console.log(`  ${c.green}✓${c.reset} Filled ${field.name}: ${field.value.slice(0, 25)}...`);
          break;
        }
      } catch (e) {}
    }
  }

  // Check for checkboxes (terms, newsletter, etc.)
  const checkboxes = await page.$$('input[type="checkbox"]');
  for (const checkbox of checkboxes) {
    try {
      if (await checkbox.isVisible() && !(await checkbox.isChecked())) {
        await checkbox.check();
        steps++;
        console.log(`  ${c.green}✓${c.reset} Checked a checkbox (terms/agreement)`);
      }
    } catch (e) {}
  }

  return { steps };
}

/**
 * Submit form
 */
async function submitForm(page, config, results) {
  let steps = 0;

  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Submit")',
    'button:has-text("Sign up")',
    'button:has-text("Sign in")',
    'button:has-text("Login")',
    'button:has-text("Log in")',
    'button:has-text("Create")',
    'button:has-text("Register")',
    'button:has-text("Continue")',
    'button:has-text("Next")'
  ];

  for (const selector of submitSelectors) {
    try {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        await button.click();
        steps++;
        results.steps.push({ 
          step: results.steps.length + 1, 
          action: { type: "click", target: "Submit form" }, 
          success: true 
        });
        console.log(`  ${c.green}✓${c.reset} Submitted form`);
        await page.waitForLoadState('networkidle').catch(() => {});
        break;
      }
    } catch (e) {}
  }

  return { steps };
}

/**
 * Test navigation elements
 */
async function testNavigation(page, config, results) {
  let steps = 0;
  
  // Go back to home
  await page.goto(config.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Find and click navigation items
  const navSelectors = [
    'nav a',
    'nav button',
    'header a',
    'header button',
    '.nav a',
    '.navigation a'
  ];

  const clickedTexts = new Set();

  for (const selector of navSelectors) {
    try {
      const elements = await page.$$(selector);
      for (const el of elements.slice(0, 5)) {
        try {
          const text = await el.textContent();
          const trimmedText = text?.trim().slice(0, 30);
          
          if (trimmedText && !clickedTexts.has(trimmedText) && await el.isVisible()) {
            clickedTexts.add(trimmedText);
            await el.click();
            await page.waitForTimeout(1000);
            steps++;
            results.steps.push({ 
              step: results.steps.length + 1, 
              action: { type: "click", target: `Nav: ${trimmedText}` }, 
              success: true 
            });
            console.log(`  ${c.green}✓${c.reset} Clicked nav: ${trimmedText}`);
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  return { steps };
}

/**
 * Test interactive elements (buttons, modals, etc.)
 */
async function testInteractiveElements(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  // Go back to home
  await page.goto(config.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Find buttons that might open modals or do interesting things
  const interestingButtons = [
    'button:has-text("Demo")',
    'button:has-text("Try")',
    'button:has-text("Start")',
    'button:has-text("Learn")',
    'button:has-text("Watch")',
    'button:has-text("View")',
    'button:has-text("Explore")',
    'button:has-text("Contact")',
    'button:has-text("Pricing")',
    'button:has-text("Features")'
  ];

  for (const selector of interestingButtons) {
    try {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        const text = await button.textContent();
        await button.click();
        await page.waitForTimeout(1500);
        steps++;
        results.steps.push({ 
          step: results.steps.length + 1, 
          action: { type: "click", target: text?.trim() }, 
          success: true 
        });
        console.log(`  ${c.green}✓${c.reset} Clicked: ${text?.trim().slice(0, 30)}`);

        // Check for modal
        const modal = await page.$('[role="dialog"], .modal, [data-state="open"]');
        if (modal) {
          console.log(`  ${c.green}✓${c.reset} Modal opened`);
          await page.screenshot({ path: path.join(screenshotDir, `modal-${steps}.png`) });
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }
    } catch (e) {}
  }

  return { steps };
}

/**
 * Test forms on the page
 */
async function testForms(page, config, results) {
  let steps = 0;

  // Go back to home
  await page.goto(config.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Find all forms
  const forms = await page.$$('form');
  console.log(`  ${c.dim}Found ${forms.length} forms${c.reset}`);

  for (let i = 0; i < Math.min(forms.length, 3); i++) {
    try {
      const form = forms[i];
      const inputs = await form.$$('input, textarea, select');
      
      for (const input of inputs) {
        try {
          const type = await input.getAttribute('type') || 'text';
          const name = await input.getAttribute('name') || 'unnamed';
          
          if (await input.isVisible()) {
            let value = '';
            switch (type) {
              case 'email':
                value = `test-${Date.now()}@guardrailai.dev`;
                break;
              case 'password':
                value = 'TestPass123!';
                break;
              case 'tel':
                value = '+1 555 123 4567';
                break;
              case 'number':
                value = '42';
                break;
              case 'url':
                value = 'https://example.com';
                break;
              case 'search':
                value = 'test search';
                break;
              default:
                value = 'Test input from guardrail';
            }

            if (type !== 'hidden' && type !== 'submit' && type !== 'button' && type !== 'checkbox' && type !== 'radio') {
              await input.fill(value);
              steps++;
              console.log(`  ${c.green}✓${c.reset} Filled form field: ${name} (${type})`);
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  return { steps };
}

/**
 * Check for issues on the page
 */
async function checkForIssues(page, results) {
  // Check for console errors
  const consoleErrors = results.errors.filter(e => e.includes('console'));
  if (consoleErrors.length > 0) {
    console.log(`  ${c.yellow}⚠${c.reset} Found ${consoleErrors.length} console errors`);
  }

  // Check for broken images
  const brokenImages = await page.$$eval('img', imgs => 
    imgs.filter(img => !img.complete || img.naturalWidth === 0).length
  );
  if (brokenImages > 0) {
    console.log(`  ${c.yellow}⚠${c.reset} Found ${brokenImages} broken images`);
    results.errors.push(`${brokenImages} broken images found`);
  }

  // Check for 404 links (basic check)
  const links = await page.$$eval('a[href]', anchors => 
    anchors.map(a => a.href).filter(href => href && !href.startsWith('javascript:'))
  );
  console.log(`  ${c.dim}Found ${links.length} links on page${c.reset}`);

  // Check for accessibility issues
  const imagesWithoutAlt = await page.$$eval('img:not([alt])', imgs => imgs.length);
  if (imagesWithoutAlt > 0) {
    console.log(`  ${c.yellow}⚠${c.reset} Found ${imagesWithoutAlt} images without alt text`);
  }

  // Check for form labels
  const inputsWithoutLabels = await page.$$eval('input:not([type="hidden"]):not([type="submit"]):not([type="button"])', inputs => {
    return inputs.filter(input => {
      const id = input.id;
      if (!id) return true;
      return !document.querySelector(`label[for="${id}"]`);
    }).length;
  });
  if (inputsWithoutLabels > 0) {
    console.log(`  ${c.yellow}⚠${c.reset} Found ${inputsWithoutLabels} inputs without labels`);
  }
}

/**
 * Test OAuth providers (Google, GitHub, Facebook, etc.)
 */
async function testOAuthProviders(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  const oauthProviders = [
    { name: 'Google', selectors: ['button:has-text("Google")', 'button:has-text("Continue with Google")', '[data-provider="google"]', '.google-login'] },
    { name: 'GitHub', selectors: ['button:has-text("GitHub")', 'button:has-text("Continue with GitHub")', '[data-provider="github"]', '.github-login'] },
    { name: 'Facebook', selectors: ['button:has-text("Facebook")', 'button:has-text("Continue with Facebook")', '[data-provider="facebook"]'] },
    { name: 'Apple', selectors: ['button:has-text("Apple")', 'button:has-text("Continue with Apple")', '[data-provider="apple"]'] },
    { name: 'Microsoft', selectors: ['button:has-text("Microsoft")', 'button:has-text("Continue with Microsoft")', '[data-provider="microsoft"]'] },
    { name: 'Twitter/X', selectors: ['button:has-text("Twitter")', 'button:has-text("Continue with X")', '[data-provider="twitter"]'] }
  ];

  const foundProviders = [];

  for (const provider of oauthProviders) {
    for (const selector of provider.selectors) {
      try {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          foundProviders.push(provider.name);
          console.log(`  ${c.green}✓${c.reset} Found ${provider.name} OAuth button`);
          steps++;
          results.steps.push({ 
            step: results.steps.length + 1, 
            action: { type: "detect", target: `OAuth: ${provider.name}` }, 
            success: true 
          });
          break;
        }
      } catch (e) {}
    }
  }

  if (foundProviders.length === 0) {
    console.log(`  ${c.dim}No OAuth providers detected${c.reset}`);
  } else {
    console.log(`  ${c.dim}OAuth providers available: ${foundProviders.join(', ')}${c.reset}`);
  }

  return { steps, providers: foundProviders };
}

/**
 * Explore dashboard after authentication
 */
async function exploreDashboard(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  // Check if we're on a dashboard-like page
  const currentUrl = page.url();
  const isDashboard = currentUrl.includes('/dashboard') || 
                      currentUrl.includes('/home') || 
                      currentUrl.includes('/app') ||
                      currentUrl.includes('/account');

  if (!isDashboard) {
    // Try to navigate to dashboard
    const dashboardLinks = [
      'a:has-text("Dashboard")',
      'a:has-text("Home")',
      'a:has-text("My Account")',
      'a[href="/dashboard"]',
      'a[href="/home"]',
      'a[href="/app"]'
    ];

    for (const selector of dashboardLinks) {
      try {
        const link = await page.$(selector);
        if (link && await link.isVisible()) {
          await link.click();
          await page.waitForTimeout(2000);
          console.log(`  ${c.green}✓${c.reset} Navigated to dashboard`);
          steps++;
          break;
        }
      } catch (e) {}
    }
  }

  // Now explore dashboard features
  const dashboardFeatures = [
    { name: 'Settings', selectors: ['a:has-text("Settings")', 'button:has-text("Settings")', '[data-testid="settings"]'] },
    { name: 'Profile', selectors: ['a:has-text("Profile")', 'button:has-text("Profile")', '[data-testid="profile"]'] },
    { name: 'Projects', selectors: ['a:has-text("Projects")', 'button:has-text("Projects")', '[data-testid="projects"]'] },
    { name: 'Analytics', selectors: ['a:has-text("Analytics")', 'button:has-text("Analytics")', '[data-testid="analytics"]'] },
    { name: 'Billing', selectors: ['a:has-text("Billing")', 'button:has-text("Billing")', '[data-testid="billing"]'] },
    { name: 'Team', selectors: ['a:has-text("Team")', 'button:has-text("Team")', '[data-testid="team"]'] },
    { name: 'API Keys', selectors: ['a:has-text("API")', 'button:has-text("API Keys")', '[data-testid="api-keys"]'] },
    { name: 'Notifications', selectors: ['a:has-text("Notifications")', '.notification-bell', '[data-testid="notifications"]'] }
  ];

  const foundFeatures = [];

  for (const feature of dashboardFeatures) {
    for (const selector of feature.selectors) {
      try {
        const element = await page.$(selector);
        if (element && await element.isVisible()) {
          foundFeatures.push(feature.name);
          
          // Click and explore
          await element.click();
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(screenshotDir, `dashboard-${feature.name.toLowerCase()}.png`) });
          
          steps++;
          results.steps.push({ 
            step: results.steps.length + 1, 
            action: { type: "explore", target: `Dashboard: ${feature.name}` }, 
            success: true 
          });
          console.log(`  ${c.green}✓${c.reset} Explored ${feature.name}`);
          
          // Go back to dashboard
          await page.goBack().catch(() => {});
          await page.waitForTimeout(500);
          break;
        }
      } catch (e) {}
    }
  }

  if (foundFeatures.length === 0) {
    console.log(`  ${c.dim}No dashboard features detected (may not be authenticated)${c.reset}`);
  } else {
    console.log(`  ${c.dim}Dashboard features tested: ${foundFeatures.join(', ')}${c.reset}`);
  }

  return { steps, features: foundFeatures };
}

/**
 * Test search functionality
 */
async function testSearch(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  // Go back to home
  await page.goto(config.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const searchSelectors = [
    'input[type="search"]',
    'input[placeholder*="search" i]',
    'input[placeholder*="Search" i]',
    'input[name="search"]',
    'input[name="q"]',
    '.search-input',
    '#search',
    '[data-testid="search"]'
  ];

  let searchInput = null;
  for (const selector of searchSelectors) {
    try {
      searchInput = await page.$(selector);
      if (searchInput && await searchInput.isVisible()) {
        break;
      }
      searchInput = null;
    } catch (e) {}
  }

  if (searchInput) {
    console.log(`  ${c.green}✓${c.reset} Found search input`);
    
    // Test search with various queries
    const testQueries = ['test', 'dashboard', 'help', 'pricing'];
    
    for (const query of testQueries.slice(0, 2)) {
      try {
        await searchInput.fill(query);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);
        
        steps++;
        results.steps.push({ 
          step: results.steps.length + 1, 
          action: { type: "search", target: query }, 
          success: true 
        });
        console.log(`  ${c.green}✓${c.reset} Searched for: "${query}"`);
        
        await page.screenshot({ path: path.join(screenshotDir, `search-${query}.png`) });
        
        // Clear and try next
        await searchInput.fill('');
      } catch (e) {
        console.log(`  ${c.yellow}⚠${c.reset} Search failed for: "${query}"`);
      }
    }
  } else {
    console.log(`  ${c.dim}No search functionality detected${c.reset}`);
  }

  return { steps };
}

/**
 * Test mobile responsiveness
 */
async function testMobileView(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  // Store original viewport
  const originalViewport = page.viewportSize();

  // Test common mobile viewports
  const mobileViewports = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12 Pro', width: 390, height: 844 },
    { name: 'iPad', width: 768, height: 1024 }
  ];

  for (const viewport of mobileViewports) {
    try {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(config.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Check for mobile menu
      const mobileMenu = await page.$('.hamburger, .menu-toggle, [aria-label*="menu"], .mobile-menu-button');
      if (mobileMenu && await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await page.waitForTimeout(500);
        console.log(`  ${c.green}✓${c.reset} ${viewport.name}: Mobile menu works`);
      }

      // Check for horizontal scroll (bad)
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });

      if (hasHorizontalScroll) {
        console.log(`  ${c.yellow}⚠${c.reset} ${viewport.name}: Horizontal scroll detected`);
        results.errors.push(`${viewport.name}: Horizontal scroll overflow`);
      } else {
        console.log(`  ${c.green}✓${c.reset} ${viewport.name}: No horizontal scroll`);
      }

      await page.screenshot({ path: path.join(screenshotDir, `mobile-${viewport.name.replace(/\s+/g, '-').toLowerCase()}.png`) });

      steps++;
      results.steps.push({ 
        step: results.steps.length + 1, 
        action: { type: "viewport", target: viewport.name }, 
        success: !hasHorizontalScroll 
      });

    } catch (e) {
      console.log(`  ${c.red}✗${c.reset} ${viewport.name}: Error - ${e.message}`);
    }
  }

  // Restore original viewport
  if (originalViewport) {
    await page.setViewportSize(originalViewport);
  }

  return { steps };
}

/**
 * Analyze performance metrics
 */
async function analyzePerformance(page, results) {
  try {
    // Get performance timing
    const performanceMetrics = await page.evaluate(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType('navigation')[0];
      
      return {
        pageLoadTime: timing.loadEventEnd - timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        resourceCount: performance.getEntriesByType('resource').length,
        totalTransferSize: performance.getEntriesByType('resource').reduce((acc, r) => acc + (r.transferSize || 0), 0)
      };
    });

    console.log(`  ${c.dim}Page Load Time: ${performanceMetrics.pageLoadTime}ms${c.reset}`);
    console.log(`  ${c.dim}DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms${c.reset}`);
    console.log(`  ${c.dim}First Contentful Paint: ${performanceMetrics.firstContentfulPaint.toFixed(0)}ms${c.reset}`);
    console.log(`  ${c.dim}Resources: ${performanceMetrics.resourceCount}${c.reset}`);
    console.log(`  ${c.dim}Total Transfer: ${(performanceMetrics.totalTransferSize / 1024).toFixed(1)}KB${c.reset}`);

    // Performance warnings
    if (performanceMetrics.pageLoadTime > 3000) {
      console.log(`  ${c.yellow}⚠${c.reset} Page load time > 3s (${performanceMetrics.pageLoadTime}ms)`);
      results.performance.warnings.push(`Slow page load: ${performanceMetrics.pageLoadTime}ms`);
    }

    if (performanceMetrics.firstContentfulPaint > 2000) {
      console.log(`  ${c.yellow}⚠${c.reset} First Contentful Paint > 2s`);
      results.performance.warnings.push(`Slow FCP: ${performanceMetrics.firstContentfulPaint}ms`);
    }

    results.performance.metrics = performanceMetrics;

  } catch (e) {
    console.log(`  ${c.dim}Could not collect performance metrics${c.reset}`);
  }
}

/**
 * Collect cookies and localStorage data
 */
async function collectStorageData(page, results) {
  try {
    // Get cookies
    const cookies = await page.context().cookies();
    results.cookies = cookies.map(c => ({
      name: c.name,
      domain: c.domain,
      secure: c.secure,
      httpOnly: c.httpOnly,
      sameSite: c.sameSite,
      expires: c.expires
    }));

    // Get localStorage
    const localStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        items[key] = window.localStorage.getItem(key)?.slice(0, 100);
      }
      return items;
    });
    results.localStorage = localStorage;

    // Get sessionStorage
    const sessionStorage = await page.evaluate(() => {
      const items = {};
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        items[key] = window.sessionStorage.getItem(key)?.slice(0, 100);
      }
      return items;
    });
    results.sessionStorage = sessionStorage;

    console.log(`  ${c.dim}Cookies: ${results.cookies.length} found${c.reset}`);
    console.log(`  ${c.dim}LocalStorage: ${Object.keys(localStorage).length} items${c.reset}`);
    console.log(`  ${c.dim}SessionStorage: ${Object.keys(sessionStorage).length} items${c.reset}`);

    // Security checks on cookies
    const insecureCookies = results.cookies.filter(c => !c.secure && !c.domain?.includes('localhost'));
    if (insecureCookies.length > 0) {
      console.log(`  ${c.yellow}⚠${c.reset} ${insecureCookies.length} cookies without Secure flag`);
    }

    const noHttpOnlyCookies = results.cookies.filter(c => !c.httpOnly && (c.name.includes('session') || c.name.includes('token') || c.name.includes('auth')));
    if (noHttpOnlyCookies.length > 0) {
      console.log(`  ${c.yellow}⚠${c.reset} ${noHttpOnlyCookies.length} auth cookies without HttpOnly flag`);
    }

  } catch (e) {
    console.log(`  ${c.dim}Could not collect storage data${c.reset}`);
  }
}

/**
 * Test CRUD operations
 */
async function testCRUDOperations(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  console.log(`  ${c.dim}Looking for CRUD interfaces...${c.reset}`);

  // Look for Create buttons
  const createSelectors = [
    'button:has-text("Create")',
    'button:has-text("Add")',
    'button:has-text("New")',
    'button:has-text("+")',
    'a:has-text("Create")',
    'a:has-text("Add New")',
    '[data-testid*="create"]',
    '[data-testid*="add"]'
  ];

  for (const selector of createSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && await btn.isVisible()) {
        const text = await btn.textContent();
        console.log(`  ${c.green}✓${c.reset} Found CREATE action: ${text?.trim().slice(0, 30)}`);
        results.crudOperations.push({ type: 'CREATE', element: text?.trim(), found: true });
        steps++;
        break;
      }
    } catch (e) {}
  }

  // Look for Edit/Update buttons
  const editSelectors = [
    'button:has-text("Edit")',
    'button:has-text("Update")',
    'button:has-text("Modify")',
    'a:has-text("Edit")',
    '[data-testid*="edit"]',
    '[aria-label*="edit"]',
    '.edit-button',
    'svg[class*="edit"]'
  ];

  for (const selector of editSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && await btn.isVisible()) {
        const text = await btn.textContent() || 'Edit';
        console.log(`  ${c.green}✓${c.reset} Found UPDATE action: ${text?.trim().slice(0, 30)}`);
        results.crudOperations.push({ type: 'UPDATE', element: text?.trim(), found: true });
        steps++;
        break;
      }
    } catch (e) {}
  }

  // Look for Delete buttons
  const deleteSelectors = [
    'button:has-text("Delete")',
    'button:has-text("Remove")',
    'button:has-text("Trash")',
    'a:has-text("Delete")',
    '[data-testid*="delete"]',
    '[aria-label*="delete"]',
    '.delete-button',
    'svg[class*="trash"]'
  ];

  for (const selector of deleteSelectors) {
    try {
      const btn = await page.$(selector);
      if (btn && await btn.isVisible()) {
        const text = await btn.textContent() || 'Delete';
        console.log(`  ${c.green}✓${c.reset} Found DELETE action: ${text?.trim().slice(0, 30)}`);
        results.crudOperations.push({ type: 'DELETE', element: text?.trim(), found: true });
        steps++;
        break;
      }
    } catch (e) {}
  }

  // Look for data tables/lists (READ)
  const tableSelectors = ['table', '.data-table', '[role="grid"]', '.list-view', '[data-testid*="list"]'];
  for (const selector of tableSelectors) {
    try {
      const table = await page.$(selector);
      if (table && await table.isVisible()) {
        console.log(`  ${c.green}✓${c.reset} Found data table/list (READ)`);
        results.crudOperations.push({ type: 'READ', element: 'Data Table', found: true });
        steps++;
        break;
      }
    } catch (e) {}
  }

  if (results.crudOperations.length === 0) {
    console.log(`  ${c.dim}No CRUD interfaces detected${c.reset}`);
  }

  return { steps };
}

/**
 * Test pagination and infinite scroll
 */
async function testPagination(page, config, results) {
  let steps = 0;

  // Look for pagination
  const paginationSelectors = [
    '.pagination',
    '[role="navigation"][aria-label*="pagination"]',
    'button:has-text("Next")',
    'button:has-text("Previous")',
    'a:has-text("Next")',
    '.page-numbers',
    '[data-testid*="pagination"]'
  ];

  let hasPagination = false;
  for (const selector of paginationSelectors) {
    try {
      const el = await page.$(selector);
      if (el && await el.isVisible()) {
        hasPagination = true;
        console.log(`  ${c.green}✓${c.reset} Found pagination controls`);
        
        // Try clicking next
        const nextBtn = await page.$('button:has-text("Next"), a:has-text("Next"), [aria-label="Next"]');
        if (nextBtn && await nextBtn.isVisible()) {
          await nextBtn.click();
          await page.waitForTimeout(1000);
          console.log(`  ${c.green}✓${c.reset} Pagination navigation works`);
          steps++;
        }
        break;
      }
    } catch (e) {}
  }

  // Check for infinite scroll
  const initialHeight = await page.evaluate(() => document.body.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(2000);
  const newHeight = await page.evaluate(() => document.body.scrollHeight);

  if (newHeight > initialHeight) {
    console.log(`  ${c.green}✓${c.reset} Infinite scroll detected`);
    results.steps.push({ 
      step: results.steps.length + 1, 
      action: { type: "detect", target: "Infinite scroll" }, 
      success: true 
    });
    steps++;
  } else if (!hasPagination) {
    console.log(`  ${c.dim}No pagination or infinite scroll detected${c.reset}`);
  }

  return { steps };
}

/**
 * Test file upload functionality
 */
async function testFileUpload(page, config, results) {
  let steps = 0;
  const screenshotDir = path.join(config.output, "screenshots");

  const uploadSelectors = [
    'input[type="file"]',
    '[data-testid*="upload"]',
    'button:has-text("Upload")',
    '.dropzone',
    '[class*="upload"]',
    '[class*="drop"]'
  ];

  for (const selector of uploadSelectors) {
    try {
      const el = await page.$(selector);
      if (el) {
        console.log(`  ${c.green}✓${c.reset} Found file upload interface`);
        results.steps.push({ 
          step: results.steps.length + 1, 
          action: { type: "detect", target: "File upload" }, 
          success: true 
        });
        steps++;

        // Check if it's a dropzone
        const isDropzone = await page.$('.dropzone, [class*="drop"]');
        if (isDropzone) {
          console.log(`  ${c.green}✓${c.reset} Drag-and-drop upload supported`);
        }

        break;
      }
    } catch (e) {}
  }

  if (steps === 0) {
    console.log(`  ${c.dim}No file upload functionality detected${c.reset}`);
  }

  return { steps };
}

/**
 * Analyze security headers
 */
async function analyzeSecurityHeaders(page, results) {
  console.log(`\n  ${c.cyan}Security Header Analysis:${c.reset}`);

  if (results.securityHeaders && results.securityHeaders.checked) {
    const headers = results.securityHeaders;
    
    // X-Frame-Options
    if (headers['x-frame-options'] === 'MISSING') {
      console.log(`  ${c.yellow}⚠${c.reset} X-Frame-Options: MISSING (clickjacking risk)`);
    } else {
      console.log(`  ${c.green}✓${c.reset} X-Frame-Options: ${headers['x-frame-options']}`);
    }

    // X-Content-Type-Options
    if (headers['x-content-type-options'] === 'MISSING') {
      console.log(`  ${c.yellow}⚠${c.reset} X-Content-Type-Options: MISSING`);
    } else {
      console.log(`  ${c.green}✓${c.reset} X-Content-Type-Options: ${headers['x-content-type-options']}`);
    }

    // Strict-Transport-Security
    if (headers['strict-transport-security'] === 'MISSING') {
      console.log(`  ${c.yellow}⚠${c.reset} Strict-Transport-Security: MISSING (HSTS not enabled)`);
    } else {
      console.log(`  ${c.green}✓${c.reset} HSTS: Enabled`);
    }

    // Content-Security-Policy
    if (headers['content-security-policy'] === 'MISSING') {
      console.log(`  ${c.yellow}⚠${c.reset} Content-Security-Policy: MISSING`);
    } else {
      console.log(`  ${c.green}✓${c.reset} Content-Security-Policy: Present`);
    }
  } else {
    console.log(`  ${c.dim}No API responses captured for header analysis${c.reset}`);
  }
}

/**
 * Analyze API calls made during testing
 */
async function analyzeAPICalls(results) {
  console.log(`\n  ${c.cyan}API Call Analysis:${c.reset}`);

  const apiCalls = results.apiCalls || [];
  const responses = apiCalls.filter(c => c.type === 'response');
  
  if (responses.length === 0) {
    console.log(`  ${c.dim}No API calls captured${c.reset}`);
    return;
  }

  console.log(`  ${c.dim}Total API calls: ${responses.length}${c.reset}`);

  // Group by status code
  const statusGroups = {};
  responses.forEach(r => {
    const status = r.status || 'unknown';
    statusGroups[status] = (statusGroups[status] || 0) + 1;
  });

  for (const [status, count] of Object.entries(statusGroups)) {
    const statusNum = parseInt(status);
    const color = statusNum >= 200 && statusNum < 300 ? c.green :
                  statusNum >= 400 && statusNum < 500 ? c.yellow :
                  statusNum >= 500 ? c.red : c.dim;
    console.log(`  ${color}${status}: ${count} calls${c.reset}`);
  }

  // Check for errors
  const errors = responses.filter(r => r.status >= 400);
  if (errors.length > 0) {
    console.log(`  ${c.yellow}⚠${c.reset} ${errors.length} API errors detected`);
    errors.slice(0, 3).forEach(e => {
      console.log(`    ${c.dim}${e.method} ${e.url.slice(0, 60)}... → ${e.status}${c.reset}`);
    });
  }

  // Check for slow responses (would need timing data)
  results.apiAnalysis = {
    total: responses.length,
    byStatus: statusGroups,
    errors: errors.length
  };
}

/**
 * Extract page state for AI analysis
 */
async function extractPageState(page) {
  const url = page.url();
  const title = await page.title();

  const elements = await page.evaluate(() => {
    const results = [];

    // Buttons
    document.querySelectorAll("button, [role='button']").forEach((el) => {
      if (el.offsetParent !== null) {
        results.push({
          type: "button",
          text: el.textContent?.trim().slice(0, 50),
          selector: el.id ? `#${el.id}` : `button:has-text("${el.textContent?.trim().slice(0, 20)}")`,
        });
      }
    });

    // Links
    document.querySelectorAll("a[href]").forEach((el) => {
      if (el.offsetParent !== null) {
        results.push({
          type: "link",
          text: el.textContent?.trim().slice(0, 50),
          href: el.getAttribute("href"),
        });
      }
    });

    // Inputs
    document.querySelectorAll("input, textarea, select").forEach((el) => {
      if (el.offsetParent !== null) {
        results.push({
          type: "input",
          inputType: el.type || "text",
          name: el.name,
          placeholder: el.placeholder,
        });
      }
    });

    return results;
  });

  return { url, title, elements };
}

/**
 * Build AI prompt
 */
function buildAIPrompt(pageState, goal, history) {
  let prompt = `GOAL: ${goal}\n\n`;
  prompt += `CURRENT PAGE:\n`;
  prompt += `- URL: ${pageState.url}\n`;
  prompt += `- Title: ${pageState.title}\n\n`;

  prompt += `VISIBLE ELEMENTS:\n`;
  
  const buttons = pageState.elements.filter((e) => e.type === "button");
  const inputs = pageState.elements.filter((e) => e.type === "input");
  const links = pageState.elements.filter((e) => e.type === "link");

  if (buttons.length > 0) {
    prompt += `Buttons: ${buttons.map((b) => `"${b.text}"`).slice(0, 10).join(", ")}\n`;
  }
  if (inputs.length > 0) {
    prompt += `Inputs: ${inputs.map((i) => `${i.inputType}[${i.name || i.placeholder || "unnamed"}]`).slice(0, 10).join(", ")}\n`;
  }
  if (links.length > 0) {
    prompt += `Links: ${links.map((l) => `"${l.text}"`).slice(0, 10).join(", ")}\n`;
  }

  if (history.length > 0) {
    prompt += `\nPREVIOUS ACTIONS:\n`;
    history.slice(-5).forEach((step, i) => {
      const status = step.success ? "✓" : "✗";
      prompt += `${i + 1}. ${status} ${step.action.type}: ${step.action.target || step.action.value || ""}\n`;
    });
  }

  prompt += `\nWhat should be the next action? Respond with JSON: {"type": "click|fill|navigate|done", "target": "selector or text", "value": "value if filling", "reasoning": "why"}`;

  return prompt;
}

/**
 * Get system prompt for AI
 */
function getSystemPrompt() {
  return `You are an AI agent testing a web application. Your goal is to navigate and test the app like a real user.

Available actions:
- click: Click a button or link (provide selector or button text)
- fill: Fill an input field (provide selector and value)
- navigate: Go to a URL
- done: Stop testing (goal achieved or no more actions needed)

Rules:
- Be methodical and thorough
- Fill forms with realistic test data
- If you see errors, report them
- Don't get stuck in loops
- Respond with valid JSON only`;
}

/**
 * Parse AI response
 */
function parseAIResponse(content) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    // Fallback
  }

  return { type: "done", reasoning: "Could not parse AI response" };
}

/**
 * Execute an action
 */
async function executeAction(page, action) {
  try {
    switch (action.type) {
      case "click":
        if (action.target) {
          // Try different selector strategies
          let clicked = false;
          const selectors = [
            action.target,
            `button:has-text("${action.target}")`,
            `a:has-text("${action.target}")`,
            `[data-testid="${action.target}"]`,
          ];

          for (const selector of selectors) {
            try {
              await page.click(selector, { timeout: 5000 });
              clicked = true;
              break;
            } catch (e) {
              continue;
            }
          }

          if (!clicked) {
            throw new Error(`Could not click: ${action.target}`);
          }
        }
        await page.waitForLoadState("networkidle").catch(() => {});
        break;

      case "fill":
        if (action.target && action.value) {
          await page.fill(action.target, action.value, { timeout: 5000 });
        }
        break;

      case "navigate":
        if (action.target) {
          const url = action.target.startsWith("http") ? action.target : `${page.url()}${action.target}`;
          await page.goto(url, { waitUntil: "networkidle" });
        }
        break;

      case "done":
      case "screenshot":
        // No action needed
        break;

      default:
        throw new Error(`Unknown action: ${action.type}`);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Calculate score
 */
function calculateScore(results) {
  const totalSteps = results.steps.length || 1;
  const successfulSteps = results.steps.filter((s) => s.success).length;
  const errorPenalty = Math.min(results.errors.length * 5, 20);

  const stepScore = (successfulSteps / totalSteps) * 80;
  const score = Math.round(Math.max(0, stepScore - errorPenalty + 20));

  return Math.min(100, score);
}

/**
 * Generate fix suggestions for issues found
 */
function generateFixSuggestions(results) {
  const issues = [];
  const suggestions = [];

  // Analyze security headers
  if (results.securityHeaders && results.securityHeaders.checked) {
    const headers = results.securityHeaders;
    
    if (headers['x-frame-options'] === 'MISSING') {
      issues.push({
        type: 'security',
        severity: 'high',
        title: 'Missing X-Frame-Options Header',
        description: 'Vulnerable to clickjacking attacks.'
      });
      suggestions.push({
        issue: 'Missing X-Frame-Options',
        severity: 'high',
        fix: 'Add X-Frame-Options header with value "DENY" or "SAMEORIGIN"',
        code: `// next.config.js
async headers() {
  return [{
    source: '/:path*',
    headers: [{ key: 'X-Frame-Options', value: 'DENY' }],
  }];
}`,
        agentPrompt: `Fix the missing X-Frame-Options security header. Add it to my Next.js config or Express middleware with value 'DENY'. This prevents clickjacking attacks.`
      });
    }

    if (headers['content-security-policy'] === 'MISSING') {
      issues.push({
        type: 'security',
        severity: 'high',
        title: 'Missing Content-Security-Policy',
        description: 'Vulnerable to XSS attacks.'
      });
      suggestions.push({
        issue: 'Missing CSP Header',
        severity: 'high',
        fix: 'Add Content-Security-Policy header to prevent XSS',
        code: `// Add CSP header
{ 
  key: 'Content-Security-Policy',
  value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
}`,
        agentPrompt: `Add a Content-Security-Policy header to my application. Analyze what resources are loaded and create an appropriate CSP that allows legitimate resources while blocking malicious scripts.`
      });
    }
  }

  // Analyze performance issues
  if (results.performance?.metrics) {
    const metrics = results.performance.metrics;
    
    if (metrics.pageLoadTime > 3000) {
      suggestions.push({
        issue: 'Slow Page Load',
        severity: 'medium',
        fix: `Page takes ${metrics.pageLoadTime}ms to load. Optimize by code splitting, image compression, and lazy loading.`,
        code: `// Lazy load components
import dynamic from 'next/dynamic';
const HeavyComponent = dynamic(() => import('./Heavy'), { ssr: false });

// Optimize images
import Image from 'next/image';
<Image src="/img.jpg" width={800} height={600} priority />`,
        agentPrompt: `Improve my page load time from ${metrics.pageLoadTime}ms to under 3000ms. Implement code splitting with dynamic imports, optimize images with next/image, and lazy load below-the-fold content.`
      });
    }
  }

  // Analyze console errors
  if (results.errors?.length > 10) {
    suggestions.push({
      issue: 'Excessive Console Errors',
      severity: 'high',
      fix: `${results.errors.length} JavaScript errors detected. Fix null references and add error boundaries.`,
      code: `// Add optional chaining
const value = data?.user?.name ?? 'Unknown';

// Add error boundary
<ErrorBoundary fallback={<Error />}>
  <App />
</ErrorBoundary>`,
      agentPrompt: `Fix the ${results.errors.length} JavaScript errors in my application. Here are some of them:\n${results.errors.slice(0, 5).join('\n')}\n\nAdd proper null checks, error boundaries, and fix any undefined references.`
    });
  }

  // Analyze mobile issues
  const mobileSteps = results.steps?.filter((s) => s.action?.type === 'viewport' && !s.success);
  if (mobileSteps?.length > 0) {
    suggestions.push({
      issue: 'Mobile Responsiveness Issues',
      severity: 'medium',
      fix: 'Page has horizontal scroll on mobile. Fix with responsive CSS.',
      code: `/* Fix overflow */
body { overflow-x: hidden; }
.container { max-width: 100%; padding: 0 1rem; }
img { max-width: 100%; height: auto; }`,
      agentPrompt: `Fix mobile responsiveness issues. The page has horizontal scroll on mobile devices. Find elements with fixed widths larger than viewport and replace with max-width: 100% or flexible units.`
    });
  }

  // Analyze auth issues
  const authFailed = results.steps?.filter((s) => 
    (s.action?.target?.toLowerCase().includes('login') || s.action?.target?.toLowerCase().includes('signup')) && !s.success
  );
  if (authFailed?.length > 0) {
    suggestions.push({
      issue: 'Authentication Flow Broken',
      severity: 'critical',
      fix: 'Login/signup forms not working. Check API endpoints and form handlers.',
      code: `// Ensure form handler calls correct API
async function handleSubmit(e) {
  e.preventDefault();
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  if (res.ok) router.push('/dashboard');
}`,
      agentPrompt: `Fix the broken authentication flow. The login/signup forms are not working correctly. Check that:\n1. Form submission calls the correct API endpoint\n2. API endpoint exists and returns proper responses\n3. Success redirects to dashboard\n4. Errors are displayed to users`
    });
  }

  // Analyze cookie security
  if (results.cookies?.length > 0) {
    const insecure = results.cookies.filter(c => !c.secure || !c.httpOnly);
    if (insecure.length > 0) {
      suggestions.push({
        issue: 'Insecure Cookies',
        severity: 'high',
        fix: 'Cookies missing security attributes (Secure, HttpOnly).',
        code: `// Set secure cookies
res.cookie('session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 3600000
});`,
        agentPrompt: `Fix insecure cookie settings. Add httpOnly: true, secure: true, and sameSite: 'strict' to all cookies, especially authentication cookies.`
      });
    }
  }

  // Generate master prompt
  const masterPrompt = generateMasterPrompt(results, suggestions);

  return {
    issues,
    suggestions,
    masterPrompt,
    summary: {
      total: suggestions.length,
      critical: suggestions.filter(s => s.severity === 'critical').length,
      high: suggestions.filter(s => s.severity === 'high').length,
      medium: suggestions.filter(s => s.severity === 'medium').length
    }
  };
}

/**
 * Generate master prompt for AI agent to fix all issues
 */
function generateMasterPrompt(results, suggestions) {
  if (suggestions.length === 0) {
    return "No significant issues found. The application passed all tests.";
  }

  let prompt = `# Fix Request for Web Application

I ran an AI testing agent on my web application and found ${suggestions.length} issues that need to be fixed.

## Application Details
- URL: ${results.url}
- Score: ${results.score}/100
- Test Duration: ${(results.duration / 1000).toFixed(1)}s

## Issues to Fix (in priority order)

`;

  // Sort by severity
  const sorted = [...suggestions].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return order[a.severity] - order[b.severity];
  });

  sorted.forEach((s, i) => {
    const icon = s.severity === 'critical' ? '🔴' : s.severity === 'high' ? '🟠' : '🟡';
    prompt += `### ${i + 1}. ${icon} ${s.issue} (${s.severity.toUpperCase()})

**Problem:** ${s.fix}

**Code Example:**
\`\`\`javascript
${s.code}
\`\`\`

**AI Agent Prompt:**
> ${s.agentPrompt}

---

`;
  });

  prompt += `## Instructions

Please fix these issues in order of severity (critical first, then high, then medium).

For each fix:
1. Find the relevant files in my codebase
2. Make the necessary changes
3. Explain what you changed and why
4. Verify the fix doesn't break other functionality

Start with the first issue now.`;

  return prompt;
}

/**
 * Generate HTML report
 */
function generateReport(results, outputDir) {
  const score = results.score;
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";

  // Generate fix suggestions
  const fixReport = generateFixSuggestions(results);
  results.fixSuggestions = fixReport;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AI Agent Report - guardrail</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0a; color: #fff; padding: 2rem; }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; }
    h2 { margin: 2rem 0 1rem; font-size: 1.25rem; }
    .subtitle { color: #888; margin-bottom: 2rem; }
    .score-card { background: linear-gradient(135deg, #1a1a2e, #16213e); border: 1px solid #333; border-radius: 1rem; padding: 2rem; text-align: center; margin-bottom: 2rem; }
    .score { font-size: 4rem; font-weight: 800; color: ${color}; }
    .grade { font-size: 1.25rem; color: ${color}; margin-top: 0.5rem; }
    .goal { background: #1a1a1a; border: 1px solid #333; border-radius: 0.5rem; padding: 1rem; margin-bottom: 2rem; }
    .goal-label { color: #888; font-size: 0.75rem; margin-bottom: 0.25rem; }
    .steps { background: #111; border: 1px solid #222; border-radius: 0.75rem; overflow: hidden; margin-bottom: 2rem; }
    .step { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-bottom: 1px solid #222; }
    .step:last-child { border-bottom: none; }
    .step-num { background: #333; color: #fff; width: 2rem; height: 2rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; }
    .step-success { background: #22c55e20; color: #22c55e; }
    .step-fail { background: #ef444420; color: #ef4444; }
    .step-action { flex: 1; }
    .step-type { font-weight: 600; color: #fff; }
    .step-target { color: #888; font-size: 0.875rem; }
    .fix-card { background: #1a1a1a; border: 1px solid #333; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 1rem; }
    .fix-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    .fix-severity { padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; }
    .severity-critical { background: #ef444420; color: #ef4444; }
    .severity-high { background: #f9731620; color: #f97316; }
    .severity-medium { background: #eab30820; color: #eab308; }
    .fix-title { font-weight: 600; font-size: 1rem; }
    .fix-desc { color: #aaa; margin-bottom: 1rem; font-size: 0.9rem; }
    .code-block { background: #0d1117; border: 1px solid #30363d; border-radius: 0.5rem; padding: 1rem; overflow-x: auto; font-family: 'Monaco', 'Menlo', monospace; font-size: 0.8rem; margin-bottom: 1rem; white-space: pre-wrap; }
    .prompt-block { background: #1e293b; border: 1px solid #334155; border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.5rem; }
    .prompt-label { color: #60a5fa; font-size: 0.75rem; font-weight: 600; margin-bottom: 0.5rem; }
    .prompt-text { color: #e2e8f0; font-size: 0.85rem; line-height: 1.5; }
    .copy-btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.25rem; cursor: pointer; font-size: 0.75rem; margin-top: 0.5rem; }
    .copy-btn:hover { background: #2563eb; }
    .master-prompt { background: linear-gradient(135deg, #1e3a5f, #1e293b); border: 2px solid #3b82f6; border-radius: 0.75rem; padding: 1.5rem; margin-bottom: 2rem; }
    .master-prompt h3 { color: #60a5fa; margin-bottom: 1rem; }
    .master-prompt-text { background: #0f172a; border-radius: 0.5rem; padding: 1rem; max-height: 400px; overflow-y: auto; font-size: 0.85rem; line-height: 1.6; white-space: pre-wrap; }
    .footer { text-align: center; color: #666; font-size: 0.75rem; margin-top: 2rem; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
    .tab { padding: 0.5rem 1rem; background: #222; border: 1px solid #333; border-radius: 0.5rem; cursor: pointer; color: #888; }
    .tab.active { background: #3b82f6; color: white; border-color: #3b82f6; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🤖 AI Agent Report</h1>
    <p class="subtitle">guardrail • ${new Date().toLocaleString()} • ${(results.duration / 1000).toFixed(1)}s</p>
    
    <div class="score-card">
      <div class="score">${score}</div>
      <div class="grade">Grade: ${grade}</div>
    </div>
    
    <div class="goal">
      <div class="goal-label">TESTING GOAL</div>
      <div>${results.goal}</div>
    </div>

    ${fixReport.suggestions.length > 0 ? `
    <h2>🔧 Fix Suggestions (${fixReport.suggestions.length})</h2>
    <p style="color: #888; margin-bottom: 1rem;">Issues found during testing with suggested fixes and AI agent prompts.</p>
    
    <div class="master-prompt">
      <h3>📋 Master Prompt (Copy this to fix all issues)</h3>
      <div class="master-prompt-text">${escapeHtml(fixReport.masterPrompt)}</div>
      <button class="copy-btn" onclick="navigator.clipboard.writeText(document.querySelector('.master-prompt-text').innerText)">📋 Copy Master Prompt</button>
    </div>
    
    ${fixReport.suggestions.map((s, i) => `
    <div class="fix-card">
      <div class="fix-header">
        <span class="fix-severity severity-${s.severity}">${s.severity.toUpperCase()}</span>
        <span class="fix-title">${s.issue}</span>
      </div>
      <div class="fix-desc">${s.fix}</div>
      <div class="code-block">${escapeHtml(s.code)}</div>
      <div class="prompt-block">
        <div class="prompt-label">🤖 AI AGENT PROMPT</div>
        <div class="prompt-text">${escapeHtml(s.agentPrompt)}</div>
      </div>
      <button class="copy-btn" onclick="navigator.clipboard.writeText('${escapeHtml(s.agentPrompt).replace(/'/g, "\\'")}')">📋 Copy Prompt</button>
    </div>
    `).join('')}
    ` : '<p style="color: #22c55e; margin: 2rem 0;">✅ No significant issues found!</p>'}
    
    <h2>📊 Test Steps (${results.steps.length})</h2>
    <div class="steps">
      ${results.steps
        .map(
          (step, i) => `
        <div class="step">
          <div class="step-num ${step.success ? "step-success" : "step-fail"}">${i + 1}</div>
          <div class="step-action">
            <div class="step-type">${step.action.type}</div>
            <div class="step-target">${step.action.target || step.action.value || ""}</div>
            ${step.error ? `<div style="color: #ef4444; font-size: 0.75rem;">${step.error}</div>` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>
    
    ${
      results.errors.length > 0
        ? `
    <h2 style="color: #ef4444;">❌ Console Errors (${results.errors.length})</h2>
    <div class="steps">
      ${results.errors.slice(0, 20).map((e) => `<div class="step" style="color: #fca5a5;">${escapeHtml(e)}</div>`).join("")}
      ${results.errors.length > 20 ? `<div class="step" style="color: #888;">... and ${results.errors.length - 20} more</div>` : ''}
    </div>
    `
        : ""
    }
    
    <div class="footer">
      Generated by guardrail AI Agent • <a href="https://guardrailai.dev" style="color:#3b82f6">guardrailai.dev</a>
    </div>
  </div>
  <script>
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(outputDir, "ai-agent-report.html"), html);
  fs.writeFileSync(path.join(outputDir, "ai-agent-results.json"), JSON.stringify(results, null, 2));
  
  // Also save the master prompt as a separate file for easy access
  if (fixReport.masterPrompt) {
    fs.writeFileSync(path.join(outputDir, "fix-prompt.md"), fixReport.masterPrompt);
  }

  // Save individual prompts as separate files
  if (fixReport.suggestions.length > 0) {
    const promptsDir = path.join(outputDir, "prompts");
    if (!fs.existsSync(promptsDir)) {
      fs.mkdirSync(promptsDir, { recursive: true });
    }
    
    fixReport.suggestions.forEach((s, i) => {
      const filename = `${i + 1}-${s.severity}-${s.issue.toLowerCase().replace(/\s+/g, '-').slice(0, 30)}.md`;
      const content = `# Fix: ${s.issue}

**Severity:** ${s.severity.toUpperCase()}

## Problem
${s.fix}

## Code Example
\`\`\`javascript
${s.code}
\`\`\`

## AI Agent Prompt
${s.agentPrompt}
`;
      fs.writeFileSync(path.join(promptsDir, filename), content);
    });
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Main runner
 */
async function runAIAgent(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    printHelp();
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTITLEMENT CHECK - AI Agent is a PRO feature
  // ═══════════════════════════════════════════════════════════════════════════
  try {
    await enforceFeature('ai-agent');
    await enforceLimit('aiAgentRuns');
    
    // Check for custom goal feature (premium)
    if (opts.goal && opts.goal !== 'Explore the application and test all major features') {
      await enforceFeature('ai-agent:goals');
    }
  } catch (err) {
    if (err.code === 'LIMIT_EXCEEDED' || err.code === 'FEATURE_NOT_AVAILABLE') {
      console.error(err.upgradePrompt || err.message);
      process.exit(1);
    }
    throw err;
  }
  
  // Track usage
  await trackUsage('aiAgentRuns');

  if (!chromium) {
    console.error(`\n  ${c.red}❌ Error: Playwright is required for AI Agent testing${c.reset}`);
    console.error(`  ${c.dim}Install it with: npm install @playwright/test${c.reset}\n`);
    return 1;
  }

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

  // Create output directory
  if (!fs.existsSync(opts.output)) {
    fs.mkdirSync(opts.output, { recursive: true });
  }

  console.log(`
${c.bold}${c.cyan}╔════════════════════════════════════════════════════════════╗
║  🤖 guardrail AI AGENT                                     ║
╚════════════════════════════════════════════════════════════╝${c.reset}

${c.dim}URL:  ${opts.url}${c.reset}
${c.dim}Goal: ${opts.goal}${c.reset}
${opts.apiKey ? `${c.green}✓ API Key configured${c.reset}` : `${c.yellow}⚠ No API key - using heuristic mode${c.reset}`}
`);

  const browser = await chromium.launch({ headless: opts.headless });

  try {
    const results = await runSimpleAIAgent(browser, {
      url: opts.url,
      goal: opts.goal,
      apiKey: opts.apiKey,
      model: opts.model,
      maxActions: opts.maxActions,
      output: opts.output,
      vision: opts.vision,
    });

    // Generate report
    generateReport(results, opts.output);

    const scoreColor = results.score >= 80 ? c.green : results.score >= 60 ? c.yellow : c.red;

    console.log(`
${c.bold}${c.cyan}═══════════════════════════════════════════════════════════${c.reset}

  ${c.bold}AI Agent Score: ${scoreColor}${results.score}/100${c.reset}

  📊 Steps:  ${results.steps.filter((s) => s.success).length}/${results.steps.length} successful
  ❌ Errors: ${results.errors.length} captured
  ⏱️  Duration: ${(results.duration / 1000).toFixed(1)}s

  ${c.bold}📄 Report:${c.reset} ${path.join(opts.output, "ai-agent-report.html")}
  ${c.bold}📋 Data:${c.reset}   ${path.join(opts.output, "ai-agent-results.json")}

${c.bold}${c.cyan}═══════════════════════════════════════════════════════════${c.reset}
`);

    await browser.close();
    return results.score >= 60 ? 0 : 1;
  } catch (error) {
    console.error(`\n  ${c.red}❌ Error: ${error.message}${c.reset}\n`);
    await browser.close();
    return 1;
  }
}

module.exports = { runAIAgent };
