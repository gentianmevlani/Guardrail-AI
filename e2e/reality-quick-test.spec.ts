const { test, expect } = require('@playwright/test');

test('Reality Mode - Quick Test', async ({ page }) => {
  console.log('🔍 Testing Reality Mode fixes...');
  
  // Test 1: Check if routes work
  const routes = ['/dashboard', '/settings', '/profile', '/app', '/account', '/projects', '/analytics'];
  const results = [];
  
  for (const route of routes) {
    try {
      const response = await page.goto(`https://guardrailai.dev${route}`, { waitUntil: 'networkidle' });
      const status = response.status();
      results.push({ route, status, success: status >= 200 && status < 400 });
      console.log(`${route}: ${status} ${status >= 200 && status < 400 ? '✅' : '❌'}`);
    } catch (error) {
      results.push({ route, status: 'ERROR', success: false });
      console.log(`${route}: ERROR ❌`);
    }
  }
  
  // Test 2: Check interactive elements
  await page.goto('https://guardrailai.dev');
  await page.waitForLoadState('networkidle');
  
  const buttons = await page.$$('button, [role="button"]');
  console.log(`Found ${buttons.length} interactive elements`);
  
  // Test a few buttons
  let workingButtons = 0;
  for (let i = 0; i < Math.min(5, buttons.length); i++) {
    try {
      await buttons[i].scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const isVisible = await buttons[i].isVisible();
      if (isVisible) {
        workingButtons++;
        console.log(`Button ${i + 1}: ✅ Visible and ready`);
      }
    } catch (error) {
      console.log(`Button ${i + 1}: ❌ Error - ${error.message}`);
    }
  }
  
  // Summary
  const workingRoutes = results.filter(r => r.success).length;
  console.log(`\n📊 SUMMARY:`);
  console.log(`Routes: ${workingRoutes}/${routes.length} working`);
  console.log(`Elements: ${workingButtons}/${Math.min(5, buttons.length)} working`);
  
  const score = Math.round(((workingRoutes / routes.length) * 50) + ((workingButtons / 5) * 50));
  console.log(`Reality Score: ${score}/100`);
  
  expect(workingRoutes).toBeGreaterThan(3); // At least half the routes should work
});
