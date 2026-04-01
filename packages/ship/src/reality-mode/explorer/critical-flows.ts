/**
 * Critical Flows - Pre-built flow templates for common app patterns
 *
 * These are "known good" test sequences that Reality Mode can run
 * against any app that follows standard patterns (login forms, signup, etc.)
 */

import type { CriticalFlow, FlowStep, FlowAssertion } from "./types";

/**
 * Standard authentication flow - tries common login patterns
 */
export const AUTH_LOGIN_FLOW: CriticalFlow = {
  id: "auth-login",
  name: "Authentication - Login",
  description: "Tests standard email/password login flow",
  steps: [
    { action: "navigate", target: "/login" },
    { action: "wait", timeout: 2000 },
    {
      action: "fill",
      target: 'input[name="email"], input[type="email"], #email',
      value: "{{email}}",
    },
    {
      action: "fill",
      target: 'input[name="password"], input[type="password"], #password',
      value: "{{password}}",
    },
    {
      action: "click",
      target:
        'button[type="submit"], input[type="submit"], button:has-text("Log in"), button:has-text("Sign in")',
    },
    { action: "wait", timeout: 5000 },
  ],
  assertions: [
    { type: "url-contains", value: "/dashboard|/home|/app", critical: true },
    { type: "no-errors", value: "", critical: true },
    {
      type: "element-hidden",
      value: 'input[type="password"]',
      critical: false,
    },
  ],
  required: true,
};

/**
 * Standard signup/registration flow
 */
export const AUTH_SIGNUP_FLOW: CriticalFlow = {
  id: "auth-signup",
  name: "Authentication - Signup",
  description: "Tests standard email/password registration flow",
  steps: [
    { action: "navigate", target: "/signup|/register|/sign-up" },
    { action: "wait", timeout: 2000 },
    {
      action: "fill",
      target: 'input[name="name"], input[name="fullName"], #name',
      value: "{{name}}",
    },
    {
      action: "fill",
      target: 'input[name="email"], input[type="email"], #email',
      value: "{{email}}",
    },
    {
      action: "fill",
      target: 'input[name="password"], input[type="password"], #password',
      value: "{{password}}",
    },
    {
      action: "fill",
      target:
        'input[name="confirmPassword"], input[name="password_confirmation"]',
      value: "{{password}}",
    },
    {
      action: "click",
      target:
        'button[type="submit"], button:has-text("Sign up"), button:has-text("Create account")',
    },
    { action: "wait", timeout: 5000 },
  ],
  assertions: [
    { type: "no-errors", value: "", critical: true },
    {
      type: "url-contains",
      value: "/verify|/confirm|/dashboard|/welcome",
      critical: false,
    },
  ],
  required: false,
};

/**
 * Logout flow
 */
export const AUTH_LOGOUT_FLOW: CriticalFlow = {
  id: "auth-logout",
  name: "Authentication - Logout",
  description: "Tests logout functionality",
  steps: [
    {
      action: "click",
      target:
        '[data-testid="logout"], button:has-text("Log out"), button:has-text("Sign out"), a:has-text("Logout")',
    },
    { action: "wait", timeout: 3000 },
  ],
  assertions: [
    { type: "url-contains", value: "/login|/|/home", critical: true },
    { type: "no-errors", value: "", critical: true },
  ],
  required: false,
};

/**
 * Profile update flow
 */
export const PROFILE_UPDATE_FLOW: CriticalFlow = {
  id: "profile-update",
  name: "Profile - Update",
  description: "Tests profile/settings update flow",
  steps: [
    { action: "navigate", target: "/settings|/profile|/account" },
    { action: "wait", timeout: 2000 },
    {
      action: "fill",
      target: 'input[name="name"], input[name="displayName"], #name',
      value: "{{name}} Updated",
    },
    {
      action: "click",
      target:
        'button[type="submit"], button:has-text("Save"), button:has-text("Update")',
    },
    { action: "wait", timeout: 3000 },
  ],
  assertions: [
    { type: "no-errors", value: "", critical: true },
    {
      type: "element-visible",
      value: '[data-testid="success"], .toast, .notification',
      critical: false,
    },
  ],
  required: false,
};

/**
 * Search functionality flow
 */
export const SEARCH_FLOW: CriticalFlow = {
  id: "search",
  name: "Search",
  description: "Tests search functionality",
  steps: [
    {
      action: "click",
      target:
        '[data-testid="search"], button[aria-label="Search"], input[type="search"], .search-input',
    },
    {
      action: "fill",
      target:
        'input[type="search"], input[name="search"], input[name="q"], .search-input',
      value: "test query",
    },
    {
      action: "click",
      target: 'button[type="submit"], button:has-text("Search")',
    },
    { action: "wait", timeout: 3000 },
  ],
  assertions: [
    { type: "no-errors", value: "", critical: true },
    {
      type: "element-visible",
      value: '[data-testid="results"], .results, .search-results',
      critical: false,
    },
  ],
  required: false,
};

/**
 * Modal interaction flow
 */
export const MODAL_FLOW: CriticalFlow = {
  id: "modal-interaction",
  name: "Modal - Open/Close",
  description: "Tests modal dialog functionality",
  steps: [
    {
      action: "click",
      target:
        '[data-modal-trigger], button[aria-haspopup="dialog"], [data-testid*="modal"]',
    },
    { action: "wait", timeout: 1000 },
    {
      action: "assert",
      target: '[role="dialog"], .modal, [data-state="open"]',
    },
    {
      action: "click",
      target:
        '[data-testid="close"], button[aria-label="Close"], .modal-close, button:has-text("Cancel")',
    },
    { action: "wait", timeout: 500 },
  ],
  assertions: [
    { type: "element-hidden", value: '[role="dialog"]', critical: true },
    { type: "no-errors", value: "", critical: true },
  ],
  required: false,
};

/**
 * Navigation flow - tests main nav links
 */
export const NAVIGATION_FLOW: CriticalFlow = {
  id: "navigation",
  name: "Navigation",
  description: "Tests main navigation links",
  steps: [
    { action: "click", target: "nav a:first-of-type, header a:first-of-type" },
    { action: "wait", timeout: 2000 },
    { action: "navigate", target: "/" },
    {
      action: "click",
      target: "nav a:nth-of-type(2), header a:nth-of-type(2)",
    },
    { action: "wait", timeout: 2000 },
  ],
  assertions: [{ type: "no-errors", value: "", critical: true }],
  required: false,
};

/**
 * Form validation flow - tests that validation works
 */
export const FORM_VALIDATION_FLOW: CriticalFlow = {
  id: "form-validation",
  name: "Form Validation",
  description: "Tests that form validation prevents bad submissions",
  steps: [
    { action: "navigate", target: "/contact|/signup|/register" },
    { action: "wait", timeout: 2000 },
    // Submit empty form
    { action: "click", target: 'button[type="submit"]' },
    { action: "wait", timeout: 1000 },
  ],
  assertions: [
    // Should show validation errors, not submit
    {
      type: "element-visible",
      value: '.error, [data-error], [aria-invalid="true"], .invalid-feedback',
      critical: true,
    },
    { type: "no-errors", value: "", critical: false },
  ],
  required: false,
};

/**
 * Dark mode toggle flow
 */
export const DARK_MODE_FLOW: CriticalFlow = {
  id: "dark-mode",
  name: "Dark Mode Toggle",
  description: "Tests dark/light mode switching",
  steps: [
    {
      action: "click",
      target:
        '[data-testid="theme-toggle"], button[aria-label*="theme"], button[aria-label*="dark"], .theme-toggle',
    },
    { action: "wait", timeout: 500 },
  ],
  assertions: [{ type: "no-errors", value: "", critical: true }],
  required: false,
};

/**
 * Checkout flow (e-commerce)
 */
export const CHECKOUT_FLOW: CriticalFlow = {
  id: "checkout",
  name: "E-commerce - Checkout",
  description: "Tests basic checkout flow",
  steps: [
    { action: "navigate", target: "/cart|/checkout" },
    { action: "wait", timeout: 2000 },
    {
      action: "click",
      target:
        'button:has-text("Checkout"), button:has-text("Continue"), a:has-text("Checkout")',
    },
    { action: "wait", timeout: 3000 },
  ],
  assertions: [
    { type: "no-errors", value: "", critical: true },
    { type: "url-contains", value: "/checkout|/payment", critical: false },
  ],
  required: false,
};

/**
 * All available flow packs
 */
export const FLOW_PACKS = {
  auth: [AUTH_LOGIN_FLOW, AUTH_SIGNUP_FLOW, AUTH_LOGOUT_FLOW],
  profile: [PROFILE_UPDATE_FLOW],
  search: [SEARCH_FLOW],
  ui: [MODAL_FLOW, NAVIGATION_FLOW, DARK_MODE_FLOW],
  forms: [FORM_VALIDATION_FLOW],
  ecommerce: [CHECKOUT_FLOW],
};

/**
 * Get all critical flows
 */
export function getAllFlows(): CriticalFlow[] {
  return Object.values(FLOW_PACKS).flat();
}

/**
 * Get flows by pack name
 */
export function getFlowPack(packName: keyof typeof FLOW_PACKS): CriticalFlow[] {
  return FLOW_PACKS[packName] || [];
}

/**
 * Generate Playwright code for a critical flow
 */
export function generateFlowTest(
  flow: CriticalFlow,
  testData: Record<string, string>,
): string {
  const steps = flow.steps
    .map((step, idx) => {
      let code = "";

      // Replace template variables
      const target = step.target?.replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => testData[key] || "",
      );
      const value = step.value?.replace(
        /\{\{(\w+)\}\}/g,
        (_, key) => testData[key] || "",
      );

      switch (step.action) {
        case "navigate":
          // Handle multiple possible paths (pipe-separated)
          if (target?.includes("|")) {
            const paths = target.split("|");
            code = `
    // Step ${idx + 1}: Navigate to ${flow.name} page
    let navigated = false;
    for (const path of ${JSON.stringify(paths)}) {
      try {
        const response = await page.goto(CONFIG.baseUrl + path);
        if (response?.status() < 400) { navigated = true; break; }
      } catch (error) {
        // Failed to process flow - continue with other flows
      }
    }
    if (!navigated) { flowResult.failedAt = 'Navigation failed'; return; }`;
          } else {
            code = `
    // Step ${idx + 1}: Navigate
    await page.goto(CONFIG.baseUrl + '${target}');`;
          }
          break;

        case "fill":
          // Handle multiple possible selectors
          if (target?.includes(",")) {
            code = `
    // Step ${idx + 1}: Fill field
    const field${idx} = await page.$('${target}');
    if (field${idx}) await field${idx}.fill('${value}');`;
          } else {
            code = `
    // Step ${idx + 1}: Fill
    await page.fill('${target}', '${value}').catch(() => {});`;
          }
          break;

        case "click":
          if (target?.includes(",") || target?.includes("|")) {
            const selectors = target.split(/[,|]/).map((s) => s.trim());
            code = `
    // Step ${idx + 1}: Click
    for (const sel of ${JSON.stringify(selectors)}) {
      const el = await page.$(sel);
      if (el && await el.isVisible()) { await el.click(); break; }
    }`;
          } else {
            code = `
    // Step ${idx + 1}: Click
    await page.click('${target}').catch(() => {});`;
          }
          break;

        case "wait":
          code = `
    // Step ${idx + 1}: Wait
    await page.waitForTimeout(${step.timeout || 1000});
    await page.waitForLoadState('networkidle').catch(() => {});`;
          break;

        case "assert":
          code = `
    // Step ${idx + 1}: Assert element exists
    const exists${idx} = await page.$('${target}');
    if (!exists${idx}) { flowResult.failedAt = 'Assertion failed: ${target}'; }`;
          break;
      }

      return code;
    })
    .join("\n");

  const assertions = flow.assertions
    .map((assertion, idx) => {
      switch (assertion.type) {
        case "url-contains":
          const patterns = assertion.value
            .split("|")
            .map((p) => `page.url().includes('${p}')`)
            .join(" || ");
          return `
    // Assertion: URL contains ${assertion.value}
    if (!(${patterns})) {
      flowResult.assertionsFailed.push('URL should contain ${assertion.value}');
      ${assertion.critical ? "flowResult.success = false;" : ""}
    }`;
        case "element-visible":
          return `
    // Assertion: Element visible
    const visible${idx} = await page.$('${assertion.value}');
    if (!visible${idx} || !(await visible${idx}.isVisible())) {
      flowResult.assertionsFailed.push('Element should be visible: ${assertion.value}');
      ${assertion.critical ? "flowResult.success = false;" : ""}
    }`;
        case "element-hidden":
          return `
    // Assertion: Element hidden
    const hidden${idx} = await page.$('${assertion.value}');
    if (hidden${idx} && await hidden${idx}.isVisible()) {
      flowResult.assertionsFailed.push('Element should be hidden: ${assertion.value}');
      ${assertion.critical ? "flowResult.success = false;" : ""}
    }`;
        case "no-errors":
          return `
    // Assertion: No errors
    // (errors are captured globally)`;
        default:
          return "";
      }
    })
    .join("\n");

  return `
  test('Flow: ${flow.name}', async () => {
    const flowResult = {
      id: '${flow.id}',
      name: '${flow.name}',
      success: true,
      stepsCompleted: 0,
      failedAt: null as string | null,
      assertionsFailed: [] as string[],
      duration: 0,
    };
    
    const startTime = Date.now();
    
    try {
      ${steps}
      
      flowResult.stepsCompleted = ${flow.steps.length};
      
      ${assertions}
      
    } catch (error: any) {
      flowResult.success = false;
      flowResult.failedAt = error.message;
    }
    
    flowResult.duration = Date.now() - startTime;
    results.flows.push(flowResult);
    
    console.log(flowResult.success ? 
      '✅ Flow passed: ${flow.name}' : 
      '❌ Flow failed: ${flow.name} - ' + (flowResult.failedAt || flowResult.assertionsFailed.join(', '))
    );
  });
`;
}
