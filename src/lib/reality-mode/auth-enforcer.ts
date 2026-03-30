export interface AuthCheckConfig {
  baseUrl: string;
  outputDir: string;
  adminRoutes?: string[];
  sensitiveRoutes?: string[];
}

export class AuthEnforcer {
  /**
   * Generate a Playwright test snippet to verify RBAC/Auth at runtime
   */
  generateAuthCheckTest(config: AuthCheckConfig): string {
    const adminRoutes = config.adminRoutes || [
      "/admin",
      "/dashboard/settings",
      "/api/admin",
    ];
    const sensitiveRoutes = config.sensitiveRoutes || [
      "/api/users",
      "/api/billing",
      "/settings/billing",
    ];
    // Escape backslashes for Windows paths in the generated string
    const outputDir = config.outputDir.replace(/\\/g, "\\\\");

    return `
  test('🛡️ Auth Enforcer: Runtime RBAC Check', async ({ page, request }) => {
    console.log('  🔒 Checking unauthenticated access to protected routes...');
    
    const adminRoutes = ${JSON.stringify(adminRoutes)};
    const sensitiveRoutes = ${JSON.stringify(sensitiveRoutes)};
    const violations: { route: string, status: number, type: string }[] = [];

    // 1. Clear cookies/storage to ensure we are unauthenticated
    await page.context().clearCookies();
    await page.context().clearPermissions();

    // 2. Try to access admin routes (Frontend)
    for (const route of adminRoutes) {
      const target = \`\${'${config.baseUrl}'}\${route}\`;
      try {
        const response = await page.goto(target);
        const url = page.url();
        
        // If we are still on the admin route and got 200, that's a violation (unless it redirected to login)
        if (response && response.status() === 200 && !url.includes('login') && !url.includes('signin') && !url.includes('sign-in')) {
          // Double check we are actually seeing content, not just a loaded React shell that redirects later
          // Use a heuristic: check for "Login" text or form
          const loginForm = await page.$('input[type="password"]');
          if (!loginForm) {
             violations.push({ route, status: 200, type: 'Auth Mirage (Frontend)' });
             console.log(\`  ❌ Auth Mirage: Public access to \${route} (Status: 200, No Login Form)\`);
          }
        }
      } catch (e) {
        // Navigation failed, maybe good?
      }
    }

    // 3. Try to access sensitive API endpoints (Backend)
    for (const route of sensitiveRoutes) {
        if (!route.startsWith('/api')) continue; // Only test API directly
        
        const target = \`\${'${config.baseUrl}'}\${route}\`;
        try {
          const response = await request.get(target);
          
          if (response.status() === 200) {
              // Check if it returns actual data or just an error wrapper
              const body = await response.json().catch(() => null);
              // Assume if we get a JSON body without explicit error fields, it's a leak
              if (body && !body.error && !body.redirect && !body.code) {
                  violations.push({ route, status: 200, type: 'Auth Mirage (Backend)' });
                  console.log(\`  ❌ Auth Mirage: Unauthenticated API access to \${route}\`);
              }
          }
        } catch (e) {
          // Request failed
        }
    }

    // Save auth results
    const authResultPath = path.join('${outputDir}', 'auth-result.json');
    await fs.promises.writeFile(authResultPath, JSON.stringify({ violations }, null, 2));

    // Assert no violations
    if (violations.length > 0) {
        // Don't throw here if we want other tests to run? 
        // Actually Playwright stops on failure. But we saved the result.
        expect(violations.length, \`Auth Mirage detected! \${violations.length} protected routes are accessible without auth\`).toBe(0);
    } else {
        console.log('  ✅ Auth checks passed. Protected routes are secure.');
    }
  });
`;
  }
}
