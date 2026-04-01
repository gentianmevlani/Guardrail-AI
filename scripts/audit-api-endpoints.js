#!/usr/bin/env node

/**
 * API Endpoint Audit Tool
 *
 * Scans backend routes and frontend API calls to identify:
 * - Backend endpoints not used by frontend (unused)
 * - Frontend API calls with no backend implementation (missing)
 * - Properly connected endpoints
 */

const fs = require("fs");
const path = require("path");

/**
 * Extract endpoints from Fastify route files
 */
function extractBackendEndpoints(routesDir) {
  const endpoints = [];

  if (!fs.existsSync(routesDir)) {
    return endpoints;
  }

  const files = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of files) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, "utf8");

    // Extract route prefix from index.ts registration (we'll need to pass this)
    const routeName = path.basename(file, path.extname(file));

    // Match Fastify route patterns: fastify.get, fastify.post, etc.
    const routePatterns = [
      /fastify\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
      /\.route\s*\(\s*\{\s*method:\s*['"`]([^'"`]+)['"`]\s*,\s*url:\s*['"`]([^'"`]+)['"`]/gi,
      /\.route\s*\(\s*\{\s*url:\s*['"`]([^'"`]+)['"`]\s*,\s*method:\s*['"`]([^'"`]+)['"`]/gi,
    ];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let method, routePath;

        if (pattern.source.includes("fastify\\.")) {
          method = match[1].toUpperCase();
          routePath = match[2];
        } else if (pattern.source.includes("url:.*method:")) {
          routePath = match[1];
          method = match[2].toUpperCase();
        } else {
          method = match[1].toUpperCase();
          routePath = match[2];
        }

        endpoints.push({
          method,
          path: routePath,
          file: file,
          fullPath: filePath,
          status: "defined",
        });
      }
    }
  }

  return endpoints;
}

/**
 * Extract API calls from frontend code
 */
function extractFrontendApiCalls(frontendDir) {
  const apiCalls = [];

  if (!fs.existsSync(frontendDir)) {
    return apiCalls;
  }

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        if (!["node_modules", ".next", "dist", ".turbo"].includes(item)) {
          scanDirectory(itemPath);
        }
      } else if (
        item.endsWith(".ts") ||
        item.endsWith(".tsx") ||
        item.endsWith(".js") ||
        item.endsWith(".jsx")
      ) {
        const content = fs.readFileSync(itemPath, "utf8");

        // Match fetch calls to API endpoints
        const fetchPatterns = [
          /fetch\s*\(\s*[`'"]([^`'"]*\/api\/[^`'"]+)[`'"]/gi,
          /fetch\s*\(\s*`\$\{[^}]+\}(\/api\/[^`]+)`/gi,
          /fetch\s*\(\s*`\$\{API_BASE\}(\/[^`]+)`/gi,
          /fetch\s*\(\s*`(\/api\/[^`]+)`/gi,
          /fetch\s*\(\s*['"](\$\{API_BASE\}[^'"]+)['"]/gi,
        ];

        // Also look for method specifications
        const methodPatterns = [
          /method:\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/gi,
        ];

        for (const pattern of fetchPatterns) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            let apiPath = match[1];

            // Clean up the path - remove API_BASE first, then handle other template vars
            apiPath = apiPath.replace(/\$\{API_BASE\}/g, "");
            apiPath = apiPath.replace(/\$\{[^}]*BASE[^}]*\}/gi, "");
            // Only replace actual dynamic params (like ${id}, ${projectId}) with :param
            apiPath = apiPath.replace(/\$\{[^}]+\}/g, ":param");

            // Skip if the path still starts with :param (malformed)
            if (apiPath.startsWith(":param")) {
              continue;
            }

            // Try to determine method from context
            const contextStart = Math.max(0, match.index - 200);
            const contextEnd = Math.min(content.length, match.index + 500);
            const context = content.slice(contextStart, contextEnd);

            let method = "GET";
            const methodMatch = context.match(
              /method:\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/i,
            );
            if (methodMatch) {
              method = methodMatch[1].toUpperCase();
            }

            apiCalls.push({
              method,
              path: apiPath,
              file: path.relative(frontendDir, itemPath),
              fullPath: itemPath,
              status: "called",
            });
          }
        }
      }
    }
  }

  scanDirectory(frontendDir);
  return apiCalls;
}

/**
 * Get prefix mapping from the main API index file
 */
function extractRoutePrefixes(apiIndexPath) {
  const prefixMap = {};

  if (!fs.existsSync(apiIndexPath)) {
    return prefixMap;
  }

  const content = fs.readFileSync(apiIndexPath, "utf8");

  // Match: fastify.register(routeName, { prefix: "/api/xxx" })
  const registerPattern =
    /fastify\.register\s*\(\s*(\w+)\s*,\s*\{\s*prefix:\s*['"`]([^'"`]+)['"`]/gi;

  let match;
  while ((match = registerPattern.exec(content)) !== null) {
    const routeVar = match[1];
    const prefix = match[2];

    // Try to find the import for this route variable
    const importPattern = new RegExp(
      `import\\s*\\{\\s*${routeVar}\\s*\\}\\s*from\\s*['"\`]\\.\\/routes\\/([^'"\`]+)['"\`]`,
      "i",
    );
    const importMatch = content.match(importPattern);

    if (importMatch) {
      const routeFile = importMatch[1].replace(/\.js$|\.ts$/, "");
      prefixMap[routeFile] = prefix;
      prefixMap[routeFile + ".ts"] = prefix;
      prefixMap[routeFile + ".js"] = prefix;
    }
  }

  return prefixMap;
}

/**
 * Normalize path for comparison
 */
function normalizePath(apiPath) {
  return apiPath
    .replace(/\/+/g, "/")
    .replace(/\/:[\w]+/g, "/:param")
    .replace(/\/\[[\w]+\]/g, "/:param")
    .replace(/\$\{[^}]+\}/g, ":param")
    .replace(/\?.*$/, "")
    .toLowerCase();
}

/**
 * Main audit function
 */
async function auditApiEndpoints(projectPath) {
  const results = {
    timestamp: new Date().toISOString(),
    projectPath,
    summary: {
      totalBackendEndpoints: 0,
      totalFrontendCalls: 0,
      connectedEndpoints: 0,
      unusedBackendEndpoints: 0,
      missingBackendEndpoints: 0,
    },
    connected: [],
    unused: [],
    missing: [],
    details: {
      backendEndpoints: [],
      frontendCalls: [],
    },
  };

  // Recursively find backend routes directories
  function findBackendRoutes(projectPath, depth = 0) {
    const routesDirs = [];
    if (depth > 3) return routesDirs;
    
    const commonBackendPaths = [
      path.join(projectPath, "apps", "api", "src", "routes"),
      path.join(projectPath, "server", "routes"),
      path.join(projectPath, "src", "routes"),
      path.join(projectPath, "src", "api", "routes"),
      path.join(projectPath, "api", "routes"),
    ];
    
    for (const routesPath of commonBackendPaths) {
      if (fs.existsSync(routesPath)) {
        routesDirs.push(routesPath);
      }
    }
    
    // Recursively search subdirectories
    try {
      const items = fs.readdirSync(projectPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !["node_modules", ".git", ".next", "dist", "build", ".turbo"].includes(item.name)) {
          const subPath = path.join(projectPath, item.name);
          if (item.name === "routes" || item.name === "api") {
            routesDirs.push(subPath);
          }
          if (depth < 2) {
            routesDirs.push(...findBackendRoutes(subPath, depth + 1));
          }
        }
      }
    } catch (err) {
      // Skip
    }
    
    return routesDirs;
  }
  
  // Recursively find frontend directories
  function findFrontendDirs(projectPath, depth = 0) {
    const frontendDirs = [];
    if (depth > 3) return frontendDirs;
    
    const commonFrontendPaths = [
      path.join(projectPath, "apps", "web-ui", "src"),
      path.join(projectPath, "apps", "web", "src"),
      path.join(projectPath, "services", "scanner-dash", "src"),
      path.join(projectPath, "dashboard", "src"),
      path.join(projectPath, "client", "src"),
      path.join(projectPath, "frontend", "src"),
      path.join(projectPath, "src"),
    ];
    
    for (const frontendPath of commonFrontendPaths) {
      if (fs.existsSync(frontendPath)) {
        // Check if it's a frontend project (has components, pages, or vite config)
        const hasViteConfig = fs.existsSync(path.join(projectPath, "vite.config.ts")) ||
                             fs.existsSync(path.join(projectPath, "vite.config.js"));
        const hasComponents = fs.existsSync(path.join(frontendPath, "components")) ||
                             fs.existsSync(path.join(frontendPath, "pages")) ||
                             fs.existsSync(path.join(frontendPath, "app")) ||
                             fs.existsSync(path.join(frontendPath, "routes"));
        if (hasViteConfig || hasComponents) {
          frontendDirs.push(frontendPath);
        }
      }
    }
    
    // Recursively search subdirectories
    try {
      const items = fs.readdirSync(projectPath, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && !["node_modules", ".git", ".next", "dist", "build", ".turbo"].includes(item.name)) {
          const subPath = path.join(projectPath, item.name);
          const subSrcPath = path.join(subPath, "src");
          
          // Check for vite config in subdirectory
          const hasViteConfig = fs.existsSync(path.join(subPath, "vite.config.ts")) ||
                               fs.existsSync(path.join(subPath, "vite.config.js"));
          
          if (hasViteConfig && fs.existsSync(subSrcPath)) {
            frontendDirs.push(subSrcPath);
          }
          
          if (depth < 2) {
            frontendDirs.push(...findFrontendDirs(subPath, depth + 1));
          }
        }
      }
    } catch (err) {
      // Skip
    }
    
    return [...new Set(frontendDirs)];
  }

  // Find all backend routes directories
  const routesDirs = findBackendRoutes(projectPath);
  
  // Find API index files for route prefixes
  const apiIndexPaths = [
    path.join(projectPath, "apps", "api", "src", "index.ts"),
    path.join(projectPath, "apps", "api", "src", "index.js"),
    path.join(projectPath, "server", "index.ts"),
    path.join(projectPath, "src", "index.ts"),
  ];
  
  let prefixMap = {};
  for (const indexPath of apiIndexPaths) {
    if (fs.existsSync(indexPath)) {
      prefixMap = { ...prefixMap, ...extractRoutePrefixes(indexPath) };
    }
  }

  // Extract backend endpoints from all found routes directories
  let backendEndpoints = [];
  for (const routesDir of routesDirs) {
    const endpoints = extractBackendEndpoints(routesDir);
    backendEndpoints.push(...endpoints);
  }

  // Apply prefixes to backend endpoints
  backendEndpoints = backendEndpoints.map((ep) => {
    const prefix =
      prefixMap[ep.file] || prefixMap[ep.file.replace(".ts", "")] || "";
    const fullApiPath = prefix + ep.path;
    return {
      ...ep,
      prefix,
      fullApiPath,
      normalizedPath: normalizePath(fullApiPath),
    };
  });

  // Find all frontend directories and extract API calls
  const frontendDirs = findFrontendDirs(projectPath);
  let frontendCalls = [];
  
  for (const frontendDir of frontendDirs) {
    const calls = extractFrontendApiCalls(frontendDir);
    frontendCalls.push(...calls);
  }

  // Normalize frontend paths
  frontendCalls = frontendCalls.map((call) => ({
    ...call,
    normalizedPath: normalizePath(call.path),
  }));

  // Deduplicate
  const uniqueBackend = new Map();
  for (const ep of backendEndpoints) {
    const key = `${ep.method}:${ep.normalizedPath}`;
    if (!uniqueBackend.has(key)) {
      uniqueBackend.set(key, ep);
    }
  }

  const uniqueFrontend = new Map();
  for (const call of frontendCalls) {
    const key = `${call.method}:${call.normalizedPath}`;
    if (!uniqueFrontend.has(key)) {
      uniqueFrontend.set(key, call);
    }
  }

  // Cross-reference
  const connectedSet = new Set();

  for (const [backendKey, backendEp] of uniqueBackend) {
    let found = false;

    for (const [frontendKey, frontendCall] of uniqueFrontend) {
      // Check if paths match (considering params)
      const backendNorm = backendEp.normalizedPath;
      const frontendNorm = frontendCall.normalizedPath;

      if (
        backendNorm === frontendNorm &&
        backendEp.method === frontendCall.method
      ) {
        found = true;
        connectedSet.add(backendKey);
        connectedSet.add(frontendKey);

        results.connected.push({
          method: backendEp.method,
          path: backendEp.fullApiPath,
          backendFile: backendEp.file,
          frontendFile: frontendCall.file,
          status: "✅ Connected",
        });
        break;
      }
    }

    if (!found) {
      results.unused.push({
        method: backendEp.method,
        path: backendEp.fullApiPath,
        file: backendEp.file,
        status: "⚠️ Unused - No frontend calls",
        suggestion: `Frontend may need to implement a call to ${backendEp.method} ${backendEp.fullApiPath}`,
      });
    }
  }

  for (const [frontendKey, frontendCall] of uniqueFrontend) {
    if (!connectedSet.has(frontendKey)) {
      // Check if this might match a backend endpoint with different params
      let possibleMatch = null;

      for (const [, backendEp] of uniqueBackend) {
        if (frontendCall.method === backendEp.method) {
          const frontendParts = frontendCall.normalizedPath
            .split("/")
            .filter(Boolean);
          const backendParts = backendEp.normalizedPath
            .split("/")
            .filter(Boolean);

          if (frontendParts.length === backendParts.length) {
            let matches = true;
            for (let i = 0; i < frontendParts.length; i++) {
              if (
                frontendParts[i] !== backendParts[i] &&
                frontendParts[i] !== ":param" &&
                backendParts[i] !== ":param"
              ) {
                matches = false;
                break;
              }
            }
            if (matches) {
              possibleMatch = backendEp;
              break;
            }
          }
        }
      }

      results.missing.push({
        method: frontendCall.method,
        path: frontendCall.path,
        file: frontendCall.file,
        status: "❌ Missing Backend",
        suggestion: possibleMatch
          ? `Possible match: ${possibleMatch.method} ${possibleMatch.fullApiPath} in ${possibleMatch.file}`
          : `Backend needs to implement: ${frontendCall.method} ${frontendCall.path}`,
      });
    }
  }

  // Update summary
  results.summary.totalBackendEndpoints = uniqueBackend.size;
  results.summary.totalFrontendCalls = uniqueFrontend.size;
  results.summary.connectedEndpoints = results.connected.length;
  results.summary.unusedBackendEndpoints = results.unused.length;
  results.summary.missingBackendEndpoints = results.missing.length;

  // Store details
  results.details.backendEndpoints = [...uniqueBackend.values()].map((ep) => ({
    method: ep.method,
    path: ep.fullApiPath,
    file: ep.file,
  }));

  results.details.frontendCalls = [...uniqueFrontend.values()].map((call) => ({
    method: call.method,
    path: call.path,
    file: call.file,
  }));

  return results;
}

/**
 * Format results for display
 */
function formatAuditResults(results) {
  const lines = [];

  lines.push("# 🔍 API Endpoint Audit Report");
  lines.push("");
  lines.push(`**Timestamp:** ${results.timestamp}`);
  lines.push(`**Project:** ${results.projectPath}`);
  lines.push("");

  lines.push("## 📊 Summary");
  lines.push("");
  lines.push(`| Metric | Count |`);
  lines.push(`|--------|-------|`);
  lines.push(
    `| Total Backend Endpoints | ${results.summary.totalBackendEndpoints} |`,
  );
  lines.push(
    `| Total Frontend API Calls | ${results.summary.totalFrontendCalls} |`,
  );
  lines.push(`| ✅ Connected | ${results.summary.connectedEndpoints} |`);
  lines.push(
    `| ⚠️ Unused Backend | ${results.summary.unusedBackendEndpoints} |`,
  );
  lines.push(
    `| ❌ Missing Backend | ${results.summary.missingBackendEndpoints} |`,
  );
  lines.push("");

  if (results.missing.length > 0) {
    lines.push("## ❌ Missing Backend Implementations");
    lines.push("");
    lines.push(
      "These API calls in the frontend have no corresponding backend endpoint:",
    );
    lines.push("");
    for (const item of results.missing) {
      lines.push(`- **${item.method} ${item.path}**`);
      lines.push(`  - Frontend file: \`${item.file}\``);
      lines.push(`  - ${item.suggestion}`);
    }
    lines.push("");
  }

  if (results.unused.length > 0) {
    lines.push("## ⚠️ Unused Backend Endpoints");
    lines.push("");
    lines.push("These backend endpoints have no frontend calls:");
    lines.push("");
    for (const item of results.unused.slice(0, 20)) {
      lines.push(`- **${item.method} ${item.path}** (${item.file})`);
    }
    if (results.unused.length > 20) {
      lines.push(`- ... and ${results.unused.length - 20} more`);
    }
    lines.push("");
  }

  if (results.connected.length > 0) {
    lines.push("## ✅ Connected Endpoints");
    lines.push("");
    lines.push(`${results.connected.length} endpoints are properly connected.`);
    lines.push("");
    lines.push("<details>");
    lines.push("<summary>Show connected endpoints</summary>");
    lines.push("");
    for (const item of results.connected) {
      lines.push(`- ${item.method} ${item.path}`);
    }
    lines.push("</details>");
  }

  return lines.join("\n");
}

// Module exports
module.exports = {
  auditApiEndpoints,
  formatAuditResults,
};

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();

  console.log("🔍 Auditing API endpoints...\n");

  auditApiEndpoints(projectPath)
    .then((results) => {
      console.log(formatAuditResults(results));
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}
