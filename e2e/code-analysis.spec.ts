import { test, expect } from '@playwright/test';

test.describe('Code Analysis', () => {
  test.beforeEach(async ({ page }) => {
    // Log in before each test
    await page.goto('/login');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'Password123!');
    await page.click('[data-testid=login-button]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should analyze code from text input', async ({ page }) => {
    // Navigate to code analysis page
    await page.click('[data-testid=analyze-code-nav]');
    await expect(page).toHaveURL('/analyze');

    // Enter code to analyze
    const codeSample = `
      function calculateTotal(items) {
        let total = 0;
        for (let i = 0; i < items.length; i++) {
          total += items[i].price;
        }
        return total;
      }
    `;
    
    await page.fill('[data-testid=code-input]', codeSample);
    await page.selectOption('[data-testid=language-select]', 'javascript');

    // Run analysis
    await page.click('[data-testid=analyze-button]');

    // Wait for results
    await expect(page.locator('[data-testid=analysis-results]')).toBeVisible();
    
    // Check for analysis sections
    await expect(page.locator('[data-testid=security-analysis]')).toBeVisible();
    await expect(page.locator('[data-testid=quality-analysis]')).toBeVisible();
    await expect(page.locator('[data-testid=performance-analysis]')).toBeVisible();
  });

  test('should upload and analyze file', async ({ page }) => {
    await page.goto('/analyze');

    // Upload a file
    const fileInput = page.locator('[data-testid=file-input]');
    await fileInput.setInputFiles('e2e/fixtures/sample-code.js');

    // Wait for file to be processed
    await expect(page.locator('[data-testid=file-loaded]')).toBeVisible();
    
    // Run analysis
    await page.click('[data-testid=analyze-button]');

    // Check results
    await expect(page.locator('[data-testid=analysis-results]')).toBeVisible();
  });

  test('should analyze repository from URL', async ({ page }) => {
    await page.goto('/analyze');
    
    // Switch to repository analysis
    await page.click('[data-testid=repo-analysis-tab]');

    // Enter repository URL
    await page.fill('[data-testid=repo-url-input]', 'https://github.com/example/test-repo');
    
    // Configure options
    await page.check('[data-testid=include-tests]');
    await page.uncheck('[data-testid=shallow-clone]');

    // Start analysis
    await page.click('[data-testid=analyze-repo-button]');

    // Should show progress indicator
    await expect(page.locator('[data-testid=analysis-progress]')).toBeVisible();
    
    // Wait for completion (in real test, might need to wait longer)
    await expect(page.locator('[data-testid=repo-analysis-results]')).toBeVisible({ timeout: 30000 });
  });

  test('should display security vulnerabilities', async ({ page }) => {
    await page.goto('/analyze');
    
    // Enter code with security issues
    const vulnerableCode = `
      const userInput = req.body.query;
      const sql = "SELECT * FROM users WHERE name = '" + userInput + "'";
      db.query(sql);
    `;
    
    await page.fill('[data-testid=code-input]', vulnerableCode);
    await page.click('[data-testid=analyze-button]');

    // Check for security issues
    await expect(page.locator('[data-testid=vulnerability-sql-injection]')).toBeVisible();
    await expect(page.locator('text=SQL Injection')).toBeVisible();
    await expect(page.locator('[data-testid=severity-high]')).toBeVisible();
  });

  test('should suggest code improvements', async ({ page }) => {
    await page.goto('/analyze');
    
    // Enter code that can be improved
    const improvableCode = `
      var numbers = [1, 2, 3, 4, 5];
      var doubled = [];
      for (var i = 0; i < numbers.length; i++) {
        doubled.push(numbers[i] * 2);
      }
    `;
    
    await page.fill('[data-testid=code-input]', improvableCode);
    await page.click('[data-testid=analyze-button]');

    // Check for suggestions
    await expect(page.locator('[data-testid=suggestion-use-map]')).toBeVisible();
    await expect(page.locator('text=Use map instead of for loop')).toBeVisible();
    
    // Apply suggestion
    await page.click('[data-testid=apply-suggestion]');
    
    // Check that code was updated
    const updatedCode = await page.inputValue('[data-testid=code-input]');
    expect(updatedCode).toContain('.map(');
  });

  test('should export analysis report', async ({ page }) => {
    await page.goto('/analyze');
    
    // Analyze some code
    await page.fill('[data-testid=code-input]', 'function test() { return true; }');
    await page.click('[data-testid=analyze-button]');
    await expect(page.locator('[data-testid=analysis-results]')).toBeVisible();

    // Export report
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid=export-report]');
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toMatch(/analysis-report.*\.pdf/);
  });

  test('should save analysis to history', async ({ page }) => {
    await page.goto('/analyze');
    
    // Analyze code
    await page.fill('[data-testid=code-input]', 'function test() { return true; }');
    await page.click('[data-testid=analyze-button]');
    
    // Save analysis
    await page.click('[data-testid=save-analysis]');
    await page.fill('[data-testid=analysis-name]', 'Test Analysis');
    await page.click('[data-testid=confirm-save]');

    // Check that it appears in history
    await page.goto('/history');
    await expect(page.locator('text=Test Analysis')).toBeVisible();
    await expect(page.locator('[data-testid=analysis-item]')).toHaveCount(1);
  });

  test('should handle large code files', async ({ page }) => {
    await page.goto('/analyze');
    
    // Generate large code content
    const largeCode = 'function test() { return '.repeat(1000) + 'true; }';
    
    await page.fill('[data-testid=code-input]', largeCode);
    await page.click('[data-testid=analyze-button]');

    // Should show loading indicator for large files
    await expect(page.locator('[data-testid=processing-large-file]')).toBeVisible();
    
    // Eventually completes
    await expect(page.locator('[data-testid=analysis-results]')).toBeVisible({ timeout: 30000 });
  });
});
