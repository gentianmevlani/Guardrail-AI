/**
 * Enhanced Reality Mode Test
 * 
 * Tests the new project detection and specialized flow capabilities.
 */

import { test, expect, Page } from '@playwright/test';

// Project type detection patterns
const PROJECT_PATTERNS = {
  saas: ['dashboard', 'subscription', 'billing', 'workspace', 'team'],
  ecommerce: ['cart', 'checkout', 'product', 'add to cart', 'shop'],
  blog: ['article', 'post', 'blog', 'author', 'comments'],
  portfolio: ['portfolio', 'projects', 'about me', 'contact'],
  social: ['feed', 'follow', 'like', 'share', 'profile'],
  booking: ['book', 'schedule', 'appointment', 'calendar'],
};

// Auth detection patterns
const AUTH_PATTERNS = {
  email: ['input[type="email"]', 'input[name="email"]'],
  oauth: ['button:has-text("Google")', 'button:has-text("GitHub")'],
  password: ['input[type="password"]'],
};

// Feature detection
async function detectFeatures(page: Page) {
  const features = {
    hasAuth: false,
    hasSearch: false,
    hasCart: false,
    hasDashboard: false,
    hasPayments: false,
    buttonCount: 0,
    formCount: 0,
    linkCount: 0,
  };

  // Check for auth
  for (const selector of AUTH_PATTERNS.email) {
    const el = await page.$(selector);
    if (el) { features.hasAuth = true; break; }
  }

  // Check for search
  const searchEl = await page.$('input[type="search"], input[placeholder*="search"]');
  features.hasSearch = !!searchEl;

  // Check for cart
  const cartEl = await page.$('.cart, #cart, [data-testid*="cart"]');
  features.hasCart = !!cartEl;

  // Check for dashboard
  const dashEl = await page.$('.dashboard, #dashboard, [data-testid*="dashboard"]');
  features.hasDashboard = !!dashEl;

  // Count elements
  features.buttonCount = await page.$$eval('button, [role="button"]', els => els.length);
  features.formCount = await page.$$eval('form', els => els.length);
  features.linkCount = await page.$$eval('a[href]', els => els.length);

  return features;
}

// Detect project type from page content
async function detectProjectType(page: Page): Promise<string> {
  const pageText = await page.evaluate(() => document.body.innerText.toLowerCase());
  
  let bestMatch = 'unknown';
  let bestScore = 0;

  for (const [type, keywords] of Object.entries(PROJECT_PATTERNS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (pageText.includes(keyword)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = type;
    }
  }

  return bestMatch;
}

test.describe('Enhanced Reality Mode', () => {
  test('Project Detection - guardrail Website', async ({ page }) => {
    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    const projectType = await detectProjectType(page);
    const features = await detectFeatures(page);

    console.log('\n📊 PROJECT ANALYSIS');
    console.log('='.repeat(50));
    console.log(`Project Type: ${projectType}`);
    console.log(`Has Auth: ${features.hasAuth}`);
    console.log(`Has Search: ${features.hasSearch}`);
    console.log(`Has Cart: ${features.hasCart}`);
    console.log(`Has Dashboard: ${features.hasDashboard}`);
    console.log(`Buttons: ${features.buttonCount}`);
    console.log(`Forms: ${features.formCount}`);
    console.log(`Links: ${features.linkCount}`);
    console.log('='.repeat(50));

    expect(features.buttonCount).toBeGreaterThan(10);
  });

  test('Authentication Flow Detection', async ({ page }) => {
    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    // Look for login/signup buttons
    const loginButton = await page.$('button:has-text("Login"), button:has-text("Sign In")');
    const signupButton = await page.$('button:has-text("Sign Up"), button:has-text("Get Started")');

    console.log('\n🔐 AUTH DETECTION');
    console.log('='.repeat(50));
    console.log(`Login Button: ${loginButton ? '✅ Found' : '❌ Not found'}`);
    console.log(`Signup Button: ${signupButton ? '✅ Found' : '❌ Not found'}`);

    if (signupButton) {
      await signupButton.click();
      await page.waitForTimeout(2000);

      // Check for auth form
      const emailField = await page.$('input[type="email"]');
      const passwordField = await page.$('input[type="password"]');
      const oauthButtons = await page.$$('button:has-text("Google"), button:has-text("GitHub")');

      console.log(`Email Field: ${emailField ? '✅ Found' : '❌ Not found'}`);
      console.log(`Password Field: ${passwordField ? '✅ Found' : '❌ Not found'}`);
      console.log(`OAuth Options: ${oauthButtons.length} providers`);
    }
    console.log('='.repeat(50));

    expect(loginButton || signupButton).toBeTruthy();
  });

  test('Interactive Elements Testing', async ({ page }) => {
    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    const buttons = await page.$$('button:visible');
    let workingButtons = 0;
    let testedButtons = 0;
    const maxTest = 10;

    console.log('\n🔘 INTERACTIVE ELEMENTS');
    console.log('='.repeat(50));
    console.log(`Total visible buttons: ${buttons.length}`);

    for (let i = 0; i < Math.min(buttons.length, maxTest); i++) {
      try {
        const button = buttons[i];
        const text = await button.textContent();
        const isVisible = await button.isVisible();
        
        if (isVisible && text && text.trim().length > 0) {
          testedButtons++;
          
          // Try to scroll to and interact with button
          await button.scrollIntoViewIfNeeded();
          const isEnabled = await button.isEnabled();
          
          if (isEnabled) {
            workingButtons++;
            console.log(`  ✅ "${text.trim().slice(0, 30)}": Ready`);
          } else {
            console.log(`  ⚠️ "${text.trim().slice(0, 30)}": Disabled`);
          }
        }
      } catch (e) {
        // Skip problematic buttons
      }
    }

    console.log(`\nResult: ${workingButtons}/${testedButtons} buttons working`);
    console.log('='.repeat(50));

    expect(workingButtons).toBeGreaterThan(0);
  });

  test('Navigation Flow Testing', async ({ page }) => {
    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    const navLinks = ['CLI', 'MCP', 'Pricing'];
    const results: { link: string; success: boolean }[] = [];

    console.log('\n🗺️ NAVIGATION TESTING');
    console.log('='.repeat(50));

    for (const linkText of navLinks) {
      try {
        const link = await page.$(`button:has-text("${linkText}"), a:has-text("${linkText}")`);
        if (link) {
          await link.click();
          await page.waitForTimeout(1000);
          results.push({ link: linkText, success: true });
          console.log(`  ✅ ${linkText}: Clicked successfully`);
        } else {
          results.push({ link: linkText, success: false });
          console.log(`  ❌ ${linkText}: Not found`);
        }
      } catch (e) {
        results.push({ link: linkText, success: false });
        console.log(`  ❌ ${linkText}: Error`);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\nResult: ${successCount}/${navLinks.length} navigation links working`);
    console.log('='.repeat(50));

    expect(successCount).toBeGreaterThan(0);
  });

  test('Form Detection and Smart Filling', async ({ page }) => {
    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    // Click signup to get to a form
    const signupButton = await page.$('button:has-text("Sign Up"), button:has-text("Get Started")');
    if (signupButton) {
      await signupButton.click();
      await page.waitForTimeout(2000);
    }

    // Detect form fields
    const fields = {
      email: await page.$('input[type="email"]'),
      password: await page.$('input[type="password"]'),
      name: await page.$('input[name*="name"]'),
      phone: await page.$('input[type="tel"]'),
    };

    console.log('\n📝 FORM DETECTION');
    console.log('='.repeat(50));

    let fieldsFilled = 0;
    const testData = {
      email: 'test-reality@guardrail.dev',
      password: 'TestPass123!',
      name: 'Reality Test User',
      phone: '+1 555 123 4567',
    };

    for (const [fieldName, element] of Object.entries(fields)) {
      if (element) {
        try {
          await element.fill(testData[fieldName as keyof typeof testData]);
          fieldsFilled++;
          console.log(`  ✅ ${fieldName}: Filled`);
        } catch (e) {
          console.log(`  ⚠️ ${fieldName}: Found but couldn't fill`);
        }
      } else {
        console.log(`  ❌ ${fieldName}: Not found`);
      }
    }

    console.log(`\nResult: ${fieldsFilled}/${Object.keys(fields).length} fields filled`);
    console.log('='.repeat(50));
  });

  test('Mobile Responsiveness Check', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    console.log('\n📱 MOBILE RESPONSIVENESS');
    console.log('='.repeat(50));

    // Check for mobile menu
    const mobileMenu = await page.$('.hamburger, .menu-toggle, button[aria-label*="menu"], [data-testid="mobile-menu"]');
    console.log(`Mobile Menu: ${mobileMenu ? '✅ Found' : '❌ Not found'}`);

    // Check viewport meta
    const viewportMeta = await page.$('meta[name="viewport"]');
    console.log(`Viewport Meta: ${viewportMeta ? '✅ Present' : '❌ Missing'}`);

    // Check for horizontal scroll (bad on mobile)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`No Horizontal Scroll: ${!hasHorizontalScroll ? '✅ Good' : '❌ Has overflow'}`);

    // Check touch targets (buttons should be at least 44x44)
    const smallButtons = await page.$$eval('button', buttons => {
      return buttons.filter(b => {
        const rect = b.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      }).length;
    });
    console.log(`Touch Targets: ${smallButtons === 0 ? '✅ All adequate' : `⚠️ ${smallButtons} too small`}`);

    console.log('='.repeat(50));

    await context.close();
  });

  test('Accessibility Quick Check', async ({ page }) => {
    await page.goto('https://guardrail.dev');
    await page.waitForLoadState('networkidle');

    console.log('\n♿ ACCESSIBILITY CHECK');
    console.log('='.repeat(50));

    // Check for landmarks
    const hasNav = await page.$('nav, [role="navigation"]');
    const hasMain = await page.$('main, [role="main"]');
    const hasFooter = await page.$('footer, [role="contentinfo"]');

    console.log(`Navigation Landmark: ${hasNav ? '✅' : '❌'}`);
    console.log(`Main Landmark: ${hasMain ? '✅' : '❌'}`);
    console.log(`Footer Landmark: ${hasFooter ? '✅' : '❌'}`);

    // Check heading structure
    const h1Count = await page.$$eval('h1', els => els.length);
    console.log(`H1 Tags: ${h1Count === 1 ? '✅ Single H1' : h1Count === 0 ? '❌ No H1' : `⚠️ ${h1Count} H1s`}`);

    // Check images for alt text
    const imagesWithoutAlt = await page.$$eval('img:not([alt])', imgs => imgs.length);
    console.log(`Images with Alt: ${imagesWithoutAlt === 0 ? '✅ All have alt' : `⚠️ ${imagesWithoutAlt} missing alt`}`);

    // Check for skip link
    const skipLink = await page.$('a[href="#main"], a[href="#content"], .skip-link');
    console.log(`Skip Link: ${skipLink ? '✅' : '⚠️ Consider adding'}`);

    // Check color contrast (basic check for text visibility)
    const hasLowContrastText = await page.evaluate(() => {
      const elements = document.querySelectorAll('p, span, a, button, h1, h2, h3');
      let lowContrast = 0;
      elements.forEach(el => {
        const style = window.getComputedStyle(el);
        const color = style.color;
        const bg = style.backgroundColor;
        // Very basic check - just ensure text isn't invisible
        if (color === bg) lowContrast++;
      });
      return lowContrast;
    });
    console.log(`Color Contrast: ${hasLowContrastText === 0 ? '✅ Looks good' : `⚠️ ${hasLowContrastText} potential issues`}`);

    console.log('='.repeat(50));
  });
});
