import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should allow user to sign up', async ({ page }) => {
    // Navigate to sign up page
    await page.click('text=Sign Up');
    await expect(page).toHaveURL('/signup');

    // Fill out sign up form
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'Password123!');
    await page.fill('[data-testid=confirm-password-input]', 'Password123!');
    await page.fill('[data-testid=name-input]', 'Test User');

    // Submit form
    await page.click('[data-testid=signup-button]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('text=Welcome, Test User')).toBeVisible();
  });

  test('should allow user to log in', async ({ page }) => {
    // Navigate to login page
    await page.click('text=Log In');
    await expect(page).toHaveURL('/login');

    // Fill out login form
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'Password123!');

    // Submit form
    await page.click('[data-testid=login-button]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid=dashboard-title]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.click('text=Log In');

    // Fill out with invalid credentials
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'wrongpassword');

    // Submit form
    await page.click('[data-testid=login-button]');

    // Should show error message
    await expect(page.locator('[data-testid=error-message]')).toBeVisible();
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('should allow user to log out', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'Password123!');
    await page.click('[data-testid=login-button]');
    await expect(page).toHaveURL('/dashboard');

    // Log out
    await page.click('[data-testid=user-menu]');
    await page.click('[data-testid=logout-button]');

    // Should redirect to home
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=Log In')).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    await page.click('text=Sign Up');
    
    // Enter invalid email
    await page.fill('[data-testid=email-input]', 'not-an-email');
    await page.fill('[data-testid=password-input]', 'Password123!');
    await page.click('[data-testid=signup-button]');

    // Should show validation error
    await expect(page.locator('[data-testid=email-error]')).toBeVisible();
  });

  test('should validate password strength', async ({ page }) => {
    await page.click('text=Sign Up');
    
    // Enter weak password
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'weak');
    await page.click('[data-testid=signup-button]');

    // Should show password requirements
    await expect(page.locator('[data-testid=password-requirements]')).toBeVisible();
  });
});
