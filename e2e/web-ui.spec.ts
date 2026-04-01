import { test, expect } from '@playwright/test';

test.describe('Web UI E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the home page', async ({ page }) => {
    await expect(page).toHaveTitle(/guardrail/);
    await expect(page.locator('h1')).toContainText('guardrail');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.click('text=Log In');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('h2')).toContainText('Sign In');
  });

  test('should show validation errors on empty form submission', async ({ page }) => {
    await page.click('text=Log In');
    
    // Try to submit empty form
    await page.click('[data-testid=login-button]');
    
    // Should show validation errors
    await expect(page.locator('text=Email is required')).toBeVisible();
    await expect(page.locator('text=Password is required')).toBeVisible();
  });

  test('should navigate to signup page', async ({ page }) => {
    await page.click('text=Sign Up');
    await expect(page).toHaveURL('/signup');
    await expect(page.locator('h2')).toContainText('Create Account');
  });

  test('should show password requirements', async ({ page }) => {
    await page.click('text=Sign Up');
    
    // Focus on password field
    await page.focus('[data-testid=password-input]');
    
    // Should show password requirements
    await expect(page.locator('text=Password must:')).toBeVisible();
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.click('text=Sign Up');
    
    const passwordInput = page.locator('[data-testid=password-input]');
    const toggleButton = page.locator('[data-testid=toggle-password]');
    
    // Initially password should be hidden
    await expect(passwordInput).toHaveAttribute('type', 'password');
    
    // Click toggle to show password
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    
    // Click again to hide
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('should navigate to features section', async ({ page }) => {
    // Scroll to features
    await page.click('text=Features');
    
    // Should scroll to features section
    const featuresSection = page.locator('[data-testid=features-section]');
    await expect(featuresSection).toBeVisible();
    await expect(featuresSection.locator('h2')).toContainText('Features');
  });

  test('should open mobile menu on small screens', async ({ page }) => {
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Menu should be collapsed initially
    await expect(page.locator('[data-testid=mobile-menu]')).not.toBeVisible();
    
    // Click menu button
    await page.click('[data-testid=menu-button]');
    
    // Menu should be visible
    await expect(page.locator('[data-testid=mobile-menu]')).toBeVisible();
  });

  test('should show error for invalid email format', async ({ page }) => {
    await page.click('text=Log In');
    
    // Enter invalid email
    await page.fill('[data-testid=email-input]', 'invalid-email');
    await page.click('[data-testid=password-input]');
    
    // Should show email validation error
    await expect(page.locator('text=Please enter a valid email')).toBeVisible();
  });
});
