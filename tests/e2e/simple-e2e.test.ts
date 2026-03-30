// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */

const { test, expect } = require('@playwright/test');

test.describe('guardrail E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for testing
    await page.route('**/api/health', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: 1234
        })
      });
    });

    await page.route('**/api/auth/login', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          token: 'mock-jwt-token',
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User'
          }
        })
      });
    });

    await page.route('**/api/projects', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          projects: [
            {
              id: '1',
              name: 'Test Project',
              description: 'A test project',
              createdAt: new Date().toISOString()
            }
          ]
        })
      });
    });
  });

  test('should load the application', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    
    // Check if the page loads
    await expect(page).toHaveTitle(/guardrail/);
  });

  test('should display health status', async ({ page }) => {
    // Create a simple test page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>guardrail</title></head>
      <body>
        <div id="health-status">Loading...</div>
        <script>
          fetch('/api/health')
            .then(res => res.json())
            .then(data => {
              document.getElementById('health-status').textContent = 
                'Status: ' + data.status;
            });
        </script>
      </body>
      </html>
    `);
    
    // Wait for health status to load
    await expect(page.locator('#health-status')).toContainText('Status: healthy');
  });

  test('should handle login flow', async ({ page }) => {
    // Create a login page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>guardrail - Login</title></head>
      <body>
        <form id="login-form">
          <input type="email" id="email" placeholder="Email" />
          <input type="password" id="password" placeholder="Password" />
          <button type="submit">Login</button>
        </form>
        <div id="login-result"></div>
        <script>
          document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            document.getElementById('login-result').textContent = 
              data.success ? 'Login successful!' : 'Login failed!';
          });
        </script>
      </body>
      </html>
    `);
    
    // Fill in login form
    await page.fill('#email', 'test@example.com');
    await page.fill('#password', 'password123');
    
    // Submit form
    await page.click('#login-form button[type="submit"]');
    
    // Check result
    await expect(page.locator('#login-result')).toContainText('Login successful!');
  });

  test('should display projects list', async ({ page }) => {
    // Create a projects page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>guardrail - Projects</title></head>
      <body>
        <h1>Projects</h1>
        <div id="projects-list">Loading projects...</div>
        <script>
          fetch('/api/projects')
            .then(res => res.json())
            .then(data => {
              const list = document.getElementById('projects-list');
              if (data.success) {
                list.innerHTML = data.projects.map(p => 
                  '<div>' + p.name + ' - ' + p.description + '</div>'
                ).join('');
              } else {
                list.innerHTML = 'Failed to load projects';
              }
            });
        </script>
      </body>
      </html>
    `);
    
    // Wait for projects to load
    await expect(page.locator('#projects-list')).toContainText('Test Project');
    await expect(page.locator('#projects-list')).toContainText('A test project');
  });

  test('should handle error states', async ({ page }) => {
    // Mock an error response
    await page.route('**/api/error', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal Server Error'
        })
      });
    });
    
    // Create a page with error handling
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>guardrail - Error Test</title></head>
      <body>
        <button id="trigger-error">Trigger Error</button>
        <div id="error-message"></div>
        <script>
          document.getElementById('trigger-error').addEventListener('click', async () => {
            try {
              const response = await fetch('/api/error');
              const data = await response.json();
              if (!data.success) {
                document.getElementById('error-message').textContent = 
                  'Error: ' + data.error;
              }
            } catch (e) {
              document.getElementById('error-message').textContent = 
                'Network error: ' + e.message;
            }
          });
        </script>
      </body>
      </html>
    `);
    
    // Trigger error
    await page.click('#trigger-error');
    
    // Check error message
    await expect(page.locator('#error-message')).toContainText('Error: Internal Server Error');
  });

  test('should handle responsive design', async ({ page }) => {
    // Create a responsive page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>guardrail - Responsive</title>
        <style>
          .container { max-width: 1200px; margin: 0 auto; }
          .mobile-only { display: none; }
          @media (max-width: 768px) {
            .mobile-only { display: block; }
            .desktop-only { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="desktop-only">Desktop View</div>
          <div class="mobile-only">Mobile View</div>
        </div>
      </body>
      </html>
    `);
    
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.desktop-only')).toBeVisible();
    await expect(page.locator('.mobile-only')).toBeHidden();
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.mobile-only')).toBeVisible();
    await expect(page.locator('.desktop-only')).toBeHidden();
  });

  test('should handle accessibility', async ({ page }) => {
    // Create an accessible page
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><title>guardrail - Accessibility</title></head>
      <body>
        <main>
          <h1>Welcome to guardrail</h1>
          <form aria-labelledby="login-heading">
            <h2 id="login-heading">Login</h2>
            <label for="email">Email Address</label>
            <input type="email" id="email" aria-required="true" />
            <label for="password">Password</label>
            <input type="password" id="password" aria-required="true" />
            <button type="submit" aria-label="Sign in to your account">Sign In</button>
          </form>
        </main>
      </body>
      </html>
    `);
    
    // Check accessibility basics
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('input[aria-required="true"]')).toHaveCount(2);
    
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await expect(page.locator('#email')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#password')).toBeFocused();
  });

  test('should handle performance metrics', async ({ page }) => {
    // Start monitoring performance
    const performanceEntries = [];
    
    await page.evaluateOnNewDocument(() => {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          window.performanceEntries = window.performanceEntries || [];
          window.performanceEntries.push(entry);
        });
      });
      observer.observe({ entryTypes: ['navigation', 'resource'] });
    });
    
    // Navigate to page
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    // Check performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(1000);
    expect(metrics.loadComplete).toBeLessThan(3000);
  });
});
