#!/usr/bin/env node

/**
 * Auth/RBAC Coverage Scanner
 *
 * Detects:
 * - Unprotected API endpoints (no auth middleware)
 * - Missing role-based access control
 * - Public endpoints that should be protected
 * - Admin endpoints exposed without proper guards
 *
 * Usage: node scripts/audit-auth-coverage.js [projectPath]
 */

const fs = require("fs");
const path = require("path");

// Patterns that indicate auth protection
const AUTH_PATTERNS = {
  middleware: [
    /preHandler.*requireAuth/i,
    /preHandler.*requireAdmin/i,
    /preHandler.*authenticate/i,
    /preHandler.*verifyToken/i,
    /preHandler.*isAuthenticated/i,
    /preHandler.*checkAuth/i,
    /preHandler.*authMiddleware/i,
    /preHandler.*passport/i,
    /preHandler.*jwt/i,
    /\.use\s*\(\s*requireAuth/i,
    /\.use\s*\(\s*requireAdmin/i,
    /\.use\s*\(\s*authenticate/i,
    /\.use\s*\(\s*authMiddleware/i,
    /addHook.*preHandler.*requireAuth/i,
    /addHook.*preHandler.*requireAdmin/i,
    /addHook.*preHandler.*auth/i,
    /fastify\.addHook\s*\(\s*["']preHandler["']/i,
  ],
  roleCheck: [
    /requireRole\s*\(\s*\[/i,
    /checkRole/i,
    /hasRole/i,
    /isAdmin/i,
    /requireAdmin/i,
    /authorize\s*\(/i,
    /permission/i,
    /rbac/i,
  ],
  publicMarkers: [
    /\/\*\s*public\s*\*\//i,
    /\/\/\s*public/i,
    /isPublic:\s*true/i,
    /skipAuth/i,
    /noAuth/i,
  ],
};

// Endpoints that should ALWAYS be protected
const SENSITIVE_PATTERNS = [
  /\/admin/i,
  /\/user(s)?\/.*\/(delete|update|edit)/i,
  /\/billing/i,
  /\/payment/i,
  /\/subscription/i,
  /\/settings/i,
  /\/profile/i,
  /\/account/i,
  /\/api-key/i,
  /\/webhook/i,
  /\/export/i,
  /\/import/i,
  /\/upload/i,
  /\/delete/i,
  /\/create/i,
  /\/update/i,
];

// Endpoints that are typically public
const TYPICALLY_PUBLIC = [
  /^\/health/i,
  /^\/api\/health/i,
  /^\/api\/live/i,
  /^\/api\/ready/i,
  /^\/api\/startup/i,
  /^\/login/i,
  /^\/api\/auth\/login/i,
  /\/webhook/i, // Webhooks use signature verification, not user auth
  /\/github$/i, // GitHub webhooks use signature verification
  /^\/api\/auth\/register/i,
  /^\/api\/auth\/forgot-password/i,
  /^\/api\/auth\/reset-password/i,
  /^\/api\/auth\/verify/i,
  /^\/docs/i,
  /^\/api\/docs/i,
  /^\/openapi/i,
  /^\/swagger/i,
  /^\/metrics/i,
  /^\/$/, // root
];

/**
 * Extract route definitions from a file
 */
function extractRoutes(content, filePath) {
  const routes = [];
  const fileName = path.basename(filePath);

  // Check for file-level auth hook (applies to ALL routes in file)
  const hasFileAuthHook =
    /fastify\.addHook\s*\(\s*["']preHandler["']\s*,\s*requireAuth/i.test(
      content,
    ) ||
    /addHook\s*\(\s*["']preHandler["']\s*,\s*requireAuth/i.test(content) ||
    /addHook\s*\(\s*["']preHandler["']\s*,\s*auth/i.test(content) ||
    /addHook\s*\(\s*["']preHandler["']\s*,\s*async\s*\(request/i.test(content);

  // Match Fastify route patterns
  const fastifyPatterns = [
    /fastify\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{[^}]*\})?\s*,?\s*(async\s+)?\(?/gi,
    /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{[^}]*\})?\s*,?\s*(async\s+)?\(?/gi,
  ];

  // Match Express route patterns
  const expressPatterns = [
    /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
    /app\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  ];

  const allPatterns = [...fastifyPatterns, ...expressPatterns];

  for (const pattern of allPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      const options = match[3] || "";

      // Get context around the route definition (for auth detection)
      const startIdx = Math.max(0, match.index - 100);
      const endIdx = Math.min(content.length, match.index + 500);
      const context = content.slice(startIdx, endIdx);

      // Check for auth protection (route-level OR file-level hook)
      const hasAuth =
        hasFileAuthHook ||
        AUTH_PATTERNS.middleware.some((p) => p.test(context));
      const hasRoleCheck = AUTH_PATTERNS.roleCheck.some((p) => p.test(context));
      const markedPublic = AUTH_PATTERNS.publicMarkers.some((p) =>
        p.test(context),
      );

      // Extract role requirements if present
      let roles = [];
      const roleMatch = context.match(/requireRole\s*\(\s*\[([^\]]+)\]/i);
      if (roleMatch) {
        roles = roleMatch[1]
          .split(",")
          .map((r) => r.trim().replace(/['"]/g, ""));
      }

      routes.push({
        method,
        path: routePath,
        file: fileName,
        fullPath: filePath,
        hasAuth,
        hasRoleCheck,
        markedPublic,
        roles,
        context: context.substring(0, 200), // Store truncated context
      });
    }
  }

  return routes;
}

/**
 * Get route prefix from index/main file registrations
 */
function extractPrefixes(content) {
  const prefixes = {};

  // Match fastify.register patterns
  const registerPattern =
    /fastify\.register\s*\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]/gi;
  let match;

  while ((match = registerPattern.exec(content)) !== null) {
    const routeName = match[1];
    const prefix = match[2];
    prefixes[routeName] = prefix;
  }

  return prefixes;
}

/**
 * Analyze auth coverage
 */
function analyzeAuthCoverage(routes, prefixes) {
  const results = {
    protected: [],
    unprotected: [],
    publicIntentional: [],
    sensitiveUnprotected: [], // HIGH RISK
    missingRBAC: [],
    adminExposed: [],
  };

  for (const route of routes) {
    // Build full path with prefix
    let fullPath = route.path;
    for (const [name, prefix] of Object.entries(prefixes)) {
      if (
        route.file
          .toLowerCase()
          .includes(name.toLowerCase().replace("routes", ""))
      ) {
        fullPath = prefix + route.path;
        break;
      }
    }
    route.fullApiPath = fullPath;

    // Check if typically public
    const isTypicallyPublic = TYPICALLY_PUBLIC.some((p) => p.test(fullPath));

    // Check if sensitive
    const isSensitive = SENSITIVE_PATTERNS.some((p) => p.test(fullPath));

    // Categorize
    if (route.hasAuth) {
      results.protected.push({
        ...route,
        hasRBAC: route.hasRoleCheck,
        roles: route.roles,
      });

      // Check if sensitive endpoint has RBAC
      if (isSensitive && !route.hasRoleCheck) {
        results.missingRBAC.push(route);
      }
    } else if (route.markedPublic || isTypicallyPublic) {
      results.publicIntentional.push(route);
    } else {
      results.unprotected.push(route);

      // High risk: sensitive endpoint without auth
      if (isSensitive) {
        results.sensitiveUnprotected.push(route);
      }

      // Check for admin routes
      if (/admin/i.test(fullPath)) {
        results.adminExposed.push(route);
      }
    }
  }

  return results;
}

/**
 * Scan frontend for protected pages
 */
function scanFrontendAuth(frontendDir) {
  const pageAuth = [];

  if (!fs.existsSync(frontendDir)) {
    return pageAuth;
  }

  function scanDir(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        if (!["node_modules", ".next", "dist", ".turbo"].includes(item)) {
          scanDir(itemPath);
        }
      } else if (
        item.endsWith(".tsx") ||
        item.endsWith(".ts") ||
        item.endsWith(".jsx")
      ) {
        const content = fs.readFileSync(itemPath, "utf8");
        const relativePath = path.relative(frontendDir, itemPath);

        // Check for auth protection patterns
        const hasAuthCheck =
          /useAuth|isAuthenticated|requireAuth|ProtectedRoute|withAuth|useSession|getSession/i.test(
            content,
          );
        const hasRedirect =
          /redirect.*login|router\.push.*login|navigate.*login/i.test(content);
        const isLayout = /layout\.(tsx|ts|jsx)/i.test(item);
        const isPage =
          /page\.(tsx|ts|jsx)/i.test(item) || /\[.*\]\.(tsx|ts|jsx)/.test(item);

        if (isPage || isLayout) {
          pageAuth.push({
            file: relativePath,
            fullPath: itemPath,
            hasAuthCheck,
            hasRedirect,
            isProtected: hasAuthCheck || hasRedirect,
            isLayout,
          });
        }
      }
    }
  }

  scanDir(frontendDir);
  return pageAuth;
}

/**
 * Generate report
 */
function generateReport(results, frontendAuth) {
  const lines = [];

  lines.push("# 🔐 Auth/RBAC Coverage Report\n");
  lines.push(`**Generated:** ${new Date().toISOString()}\n`);

  // Summary
  lines.push("## 📊 Summary\n");
  lines.push("| Category | Count | Risk |");
  lines.push("|----------|-------|------|");
  lines.push(`| ✅ Protected Endpoints | ${results.protected.length} | Low |`);
  lines.push(
    `| ⚠️ Unprotected Endpoints | ${results.unprotected.length} | Medium |`,
  );
  lines.push(
    `| 🟢 Intentionally Public | ${results.publicIntentional.length} | None |`,
  );
  lines.push(
    `| 🔴 Sensitive Without Auth | ${results.sensitiveUnprotected.length} | **HIGH** |`,
  );
  lines.push(`| 🟠 Missing RBAC | ${results.missingRBAC.length} | Medium |`);
  lines.push(
    `| 🔴 Admin Exposed | ${results.adminExposed.length} | **CRITICAL** |`,
  );
  lines.push("");

  // Critical issues first
  if (results.adminExposed.length > 0) {
    lines.push("## 🚨 CRITICAL: Admin Endpoints Exposed\n");
    lines.push("These admin endpoints have NO authentication:\n");
    for (const route of results.adminExposed) {
      lines.push(
        `- **${route.method} ${route.fullApiPath || route.path}** (${route.file})`,
      );
    }
    lines.push("");
  }

  if (results.sensitiveUnprotected.length > 0) {
    lines.push("## 🔴 HIGH RISK: Sensitive Endpoints Unprotected\n");
    lines.push("These sensitive endpoints have NO authentication:\n");
    for (const route of results.sensitiveUnprotected) {
      lines.push(
        `- **${route.method} ${route.fullApiPath || route.path}** (${route.file})`,
      );
      lines.push(`  - Risk: Contains sensitive operation pattern`);
    }
    lines.push("");
  }

  // Unprotected endpoints
  if (results.unprotected.length > 0) {
    lines.push("## ⚠️ Unprotected Endpoints\n");
    lines.push("These endpoints have no visible auth middleware:\n");
    for (const route of results.unprotected.slice(0, 30)) {
      lines.push(
        `- **${route.method} ${route.fullApiPath || route.path}** (${route.file})`,
      );
    }
    if (results.unprotected.length > 30) {
      lines.push(`- ... and ${results.unprotected.length - 30} more`);
    }
    lines.push("");
  }

  // Missing RBAC
  if (results.missingRBAC.length > 0) {
    lines.push("## 🟠 Protected but Missing Role Checks\n");
    lines.push("These endpoints have auth but no RBAC:\n");
    for (const route of results.missingRBAC) {
      lines.push(
        `- **${route.method} ${route.fullApiPath || route.path}** (${route.file})`,
      );
    }
    lines.push("");
  }

  // Protected endpoints (good)
  lines.push("## ✅ Protected Endpoints\n");
  lines.push("<details>");
  lines.push("<summary>Show protected endpoints</summary>\n");
  for (const route of results.protected) {
    const roleInfo =
      route.roles.length > 0 ? ` [Roles: ${route.roles.join(", ")}]` : "";
    lines.push(
      `- ${route.method} ${route.fullApiPath || route.path}${roleInfo}`,
    );
  }
  lines.push("</details>\n");

  // Frontend auth coverage
  if (frontendAuth.length > 0) {
    lines.push("## 🖥️ Frontend Page Protection\n");
    const protectedPages = frontendAuth.filter((p) => p.isProtected);
    const unprotectedPages = frontendAuth.filter(
      (p) => !p.isProtected && !p.isLayout,
    );

    lines.push(`| Protected Pages | Unprotected Pages |`);
    lines.push(`|-----------------|-------------------|`);
    lines.push(`| ${protectedPages.length} | ${unprotectedPages.length} |`);
    lines.push("");

    if (unprotectedPages.length > 0) {
      lines.push("### Unprotected Pages\n");
      for (const page of unprotectedPages.slice(0, 20)) {
        lines.push(`- ${page.file}`);
      }
      if (unprotectedPages.length > 20) {
        lines.push(`- ... and ${unprotectedPages.length - 20} more`);
      }
    }
    lines.push("");
  }

  // Recommendations
  lines.push("## 💡 Recommendations\n");

  if (results.adminExposed.length > 0) {
    lines.push("### 🔴 Immediate Action Required");
    lines.push("1. Add `requireAuth` middleware to ALL admin endpoints");
    lines.push("2. Add `requireRole(['admin'])` to restrict access");
    lines.push("3. Review access logs for unauthorized access attempts\n");
  }

  if (results.sensitiveUnprotected.length > 0) {
    lines.push("### 🟠 High Priority");
    lines.push(
      "1. Add authentication to sensitive endpoints (billing, settings, profile)",
    );
    lines.push("2. Implement rate limiting on these endpoints");
    lines.push("3. Add audit logging for sensitive operations\n");
  }

  if (results.missingRBAC.length > 0) {
    lines.push("### 🟡 Medium Priority");
    lines.push("1. Add role-based access control to protected endpoints");
    lines.push("2. Define clear permission levels (admin, member, viewer)");
    lines.push("3. Implement permission checks in business logic\n");
  }

  return lines.join("\n");
}

/**
 * Main audit function
 */
async function auditAuthCoverage(projectPath = ".") {
  const results = {
    routes: [],
    prefixes: {},
    analysis: null,
    frontendAuth: [],
  };

  // Find API routes directory
  const possibleApiDirs = [
    path.join(projectPath, "apps", "api", "src", "routes"),
    path.join(projectPath, "server", "routes"),
    path.join(projectPath, "src", "routes"),
    path.join(projectPath, "api", "routes"),
    path.join(projectPath, "routes"),
  ];

  let apiDir = null;
  for (const dir of possibleApiDirs) {
    if (fs.existsSync(dir)) {
      apiDir = dir;
      break;
    }
  }

  // Find index file for prefixes
  const possibleIndexFiles = [
    path.join(projectPath, "apps", "api", "src", "index.ts"),
    path.join(projectPath, "server", "index.ts"),
    path.join(projectPath, "src", "index.ts"),
    path.join(projectPath, "index.ts"),
  ];

  for (const indexFile of possibleIndexFiles) {
    if (fs.existsSync(indexFile)) {
      const content = fs.readFileSync(indexFile, "utf8");
      results.prefixes = { ...results.prefixes, ...extractPrefixes(content) };
    }
  }

  // Scan API routes
  if (apiDir) {
    const files = fs.readdirSync(apiDir);
    for (const file of files) {
      if (file.endsWith(".ts") || file.endsWith(".js")) {
        const filePath = path.join(apiDir, file);
        const content = fs.readFileSync(filePath, "utf8");
        const routes = extractRoutes(content, filePath);
        results.routes.push(...routes);
      }
    }
  }

  // Analyze auth coverage
  results.analysis = analyzeAuthCoverage(results.routes, results.prefixes);

  // Scan frontend
  const possibleFrontendDirs = [
    path.join(projectPath, "apps", "web-ui", "src"),
    path.join(projectPath, "client", "src"),
    path.join(projectPath, "frontend", "src"),
    path.join(projectPath, "src"),
  ];

  for (const frontendDir of possibleFrontendDirs) {
    if (
      fs.existsSync(path.join(frontendDir, "app")) ||
      fs.existsSync(path.join(frontendDir, "pages"))
    ) {
      results.frontendAuth = scanFrontendAuth(frontendDir);
      break;
    }
  }

  return results;
}

/**
 * Format results as markdown
 */
function formatAuthResults(results) {
  return generateReport(results.analysis, results.frontendAuth);
}

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || ".";

  console.log("🔐 Auditing auth coverage...\n");

  auditAuthCoverage(projectPath)
    .then((results) => {
      const report = formatAuthResults(results);
      console.log(report);

      // Save report
      const reportPath = path.join(
        projectPath,
        ".guardrail",
        "auth-coverage-report.md",
      );
      const reportDir = path.dirname(reportPath);
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      fs.writeFileSync(reportPath, report);
      console.log(`\n📄 Report saved to: ${reportPath}`);
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { auditAuthCoverage, formatAuthResults };
