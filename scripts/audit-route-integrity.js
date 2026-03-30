#!/usr/bin/env node

/**
 * Route Integrity Scanner
 *
 * Detects:
 * - Dead links (href to non-existent pages)
 * - Unused pages (exist but never linked)
 * - 404 routes
 * - "Coming soon" UI shipped accidentally
 * - Feature flags hiding whole sections
 * - Navigation dead ends
 *
 * Usage: node scripts/audit-route-integrity.js [projectPath]
 */

const fs = require("fs");
const path = require("path");

// Patterns for detecting links
const LINK_PATTERNS = [
  /href\s*=\s*['"`]([^'"`]+)['"`]/gi,
  /to\s*=\s*['"`]([^'"`]+)['"`]/gi,
  /router\.push\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /router\.replace\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /navigate\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /redirect\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  /Link\s+href\s*=\s*['"`]([^'"`]+)['"`]/gi,
  /window\.location\.href\s*=\s*['"`]([^'"`]+)['"`]/gi,
  /window\.location\.assign\s*\(\s*['"`]([^'"`]+)['"`]/gi,
];

// Patterns for "coming soon" / placeholder content
const PLACEHOLDER_PATTERNS = [
  { pattern: /coming\s*soon/gi, type: "coming_soon" },
  { pattern: /under\s*construction/gi, type: "under_construction" },
  { pattern: /not\s*yet\s*implemented/gi, type: "not_implemented" },
  { pattern: /TODO[:\s]/gi, type: "todo" },
  { pattern: /FIXME[:\s]/gi, type: "fixme" },
  { pattern: /placeholder/gi, type: "placeholder" },
  { pattern: /lorem\s*ipsum/gi, type: "lorem_ipsum" },
  { pattern: /work\s*in\s*progress/gi, type: "work_in_progress" },
  { pattern: /feature\s*not\s*available/gi, type: "not_available" },
];

// Feature flag patterns
const FEATURE_FLAG_PATTERNS = [
  /if\s*\(\s*!?\s*featureFlag/gi,
  /if\s*\(\s*!?\s*process\.env\.[A-Z_]*FEATURE/gi,
  /if\s*\(\s*!?\s*flags\./gi,
  /useFeatureFlag\s*\(/gi,
  /isFeatureEnabled\s*\(/gi,
  /{\/\*\s*feature\s*flag/gi,
  /enabled:\s*false/gi,
  /disabled:\s*true/gi,
];

// Skip these directories
const SKIP_DIRS = [
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
  ".git",
  "coverage",
];

/**
 * Detect Next.js App Router pages
 */
function detectNextAppPages(srcDir) {
  const pages = [];
  const appDir = path.join(srcDir, "app");

  if (!fs.existsSync(appDir)) {
    return pages;
  }

  function scanAppDir(dir, routePath = "") {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        // Skip route groups (parentheses)
        const cleanName = item.replace(/^\(.*\)$/, "");
        const newRoutePath = item.startsWith("(")
          ? routePath
          : `${routePath}/${cleanName}`;

        // Check for page.tsx/js
        const pageFile = ["page.tsx", "page.ts", "page.jsx", "page.js"]
          .map((f) => path.join(itemPath, f))
          .find((f) => fs.existsSync(f));

        if (pageFile) {
          pages.push({
            route: newRoutePath || "/",
            file: pageFile,
            type: "page",
          });
        }

        // Check for layout
        const layoutFile = [
          "layout.tsx",
          "layout.ts",
          "layout.jsx",
          "layout.js",
        ]
          .map((f) => path.join(itemPath, f))
          .find((f) => fs.existsSync(f));

        if (layoutFile) {
          pages.push({
            route: newRoutePath || "/",
            file: layoutFile,
            type: "layout",
          });
        }

        scanAppDir(itemPath, newRoutePath);
      }
    }
  }

  scanAppDir(appDir);
  return pages;
}

/**
 * Detect Vite/React Router routes
 */
function detectViteRoutes(srcDir) {
  const pages = [];
  
  // Look for React Router route definitions
  const routeFiles = findFilesRecursive(srcDir, [".tsx", ".ts", ".jsx", ".js"]);
  
  for (const file of routeFiles) {
    try {
      const content = fs.readFileSync(file, "utf8");
      
      // Match React Router patterns: <Route path="/..." /> or path: "/..."
      const routePatterns = [
        /<Route\s+path=['"`]([^'"`]+)['"`]/g,
        /path:\s*['"`]([^'"`]+)['"`]/g,
        /createBrowserRouter\s*\(\s*\[([\s\S]*?)\]/g,
        /createRoutesFromElements\s*\([\s\S]*?<Route\s+path=['"`]([^'"`]+)['"`]/g,
      ];
      
      for (const pattern of routePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const routePath = match[1] || match[0];
          if (routePath && routePath.startsWith("/")) {
            pages.push({
              route: routePath,
              file: file,
              type: "page",
            });
          }
        }
      }
      
      // Also check for pages directory (common in Vite projects)
      const pagesDir = path.join(srcDir, "pages");
      if (fs.existsSync(pagesDir)) {
        const pageFiles = findFilesRecursive(pagesDir, [".tsx", ".ts", ".jsx", ".js"]);
        for (const pageFile of pageFiles) {
          const relativePath = path.relative(pagesDir, pageFile);
          const route = "/" + relativePath.replace(/\\/g, "/").replace(/\.(tsx|ts|jsx|js)$/, "").replace(/\/index$/, "");
          pages.push({
            route: route,
            file: pageFile,
            type: "page",
          });
        }
      }
    } catch (err) {
      // Skip files we can't read
    }
  }
  
  return pages;
}

/**
 * Helper to recursively find files
 */
function findFilesRecursive(dir, extensions) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory() && !SKIP_DIRS.includes(item.name)) {
        files.push(...findFilesRecursive(fullPath, extensions));
      } else if (item.isFile()) {
        const ext = path.extname(item.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    // Skip
  }
  
  return files;
}

/**
 * Detect Next.js Pages Router pages
 */
function detectNextPagesPages(srcDir) {
  const pages = [];
  const pagesDir = path.join(srcDir, "pages");

  if (!fs.existsSync(pagesDir)) {
    return pages;
  }

  function scanPagesDir(dir, routePath = "") {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        if (!SKIP_DIRS.includes(item)) {
          scanPagesDir(itemPath, `${routePath}/${item}`);
        }
      } else if (/\.(tsx?|jsx?)$/.test(item)) {
        // Skip special files
        if (item.startsWith("_")) continue;

        const fileName = item.replace(/\.(tsx?|jsx?)$/, "");
        const route =
          fileName === "index" ? routePath || "/" : `${routePath}/${fileName}`;

        pages.push({
          route: route.replace(/\[([^\]]+)\]/g, ":$1"), // Convert [id] to :id
          file: itemPath,
          type: "page",
        });
      }
    }
  }

  scanPagesDir(pagesDir);
  return pages;
}

/**
 * Extract all links from source files
 */
function extractLinks(srcDir) {
  const links = [];

  function scanDir(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (SKIP_DIRS.includes(item)) continue;

      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        scanDir(itemPath);
      } else if (/\.(tsx?|jsx?)$/.test(item)) {
        const content = fs.readFileSync(itemPath, "utf8");
        const relativePath = path.relative(srcDir, itemPath);

        for (const pattern of LINK_PATTERNS) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const href = match[1];

            // Skip external links, anchors, template literals, and API endpoints
            if (
              href.startsWith("http") ||
              href.startsWith("mailto:") ||
              href.startsWith("tel:") ||
              href.startsWith("#") ||
              href.includes("${") ||
              href.includes("{") ||
              href.startsWith("/api/") ||
              href.includes("?")
            ) {
              continue;
            }

            links.push({
              href: href,
              file: relativePath,
              line: content.substring(0, match.index).split("\n").length,
            });
          }
        }
      }
    }
  }

  scanDir(srcDir);
  return links;
}

/**
 * Detect placeholder/coming soon content
 */
function detectPlaceholders(srcDir) {
  const placeholders = [];

  function scanDir(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (SKIP_DIRS.includes(item)) continue;

      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        scanDir(itemPath);
      } else if (/\.(tsx?|jsx?)$/.test(item)) {
        const content = fs.readFileSync(itemPath, "utf8");
        const relativePath = path.relative(srcDir, itemPath);

        for (const { pattern, type } of PLACEHOLDER_PATTERNS) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            // Get context
            const lineNum = content
              .substring(0, match.index)
              .split("\n").length;
            const lines = content.split("\n");
            const context = lines[lineNum - 1]?.trim() || "";

            // Skip if in a comment that looks intentional
            if (
              /\/\/\s*(TODO|FIXME|NOTE):/i.test(context) &&
              type !== "todo" &&
              type !== "fixme"
            ) {
              continue;
            }

            placeholders.push({
              type,
              file: relativePath,
              line: lineNum,
              context: context.substring(0, 100),
            });
          }
        }
      }
    }
  }

  scanDir(srcDir);
  return placeholders;
}

/**
 * Detect feature flags that might hide content
 */
function detectFeatureFlags(srcDir) {
  const flags = [];

  function scanDir(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      if (SKIP_DIRS.includes(item)) continue;

      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        scanDir(itemPath);
      } else if (/\.(tsx?|jsx?)$/.test(item)) {
        const content = fs.readFileSync(itemPath, "utf8");
        const relativePath = path.relative(srcDir, itemPath);

        for (const pattern of FEATURE_FLAG_PATTERNS) {
          let match;
          while ((match = pattern.exec(content)) !== null) {
            const lineNum = content
              .substring(0, match.index)
              .split("\n").length;
            const lines = content.split("\n");
            const context = lines[lineNum - 1]?.trim() || "";

            flags.push({
              file: relativePath,
              line: lineNum,
              context: context.substring(0, 100),
              pattern: match[0],
            });
          }
        }
      }
    }
  }

  scanDir(srcDir);
  return flags;
}

/**
 * Analyze route integrity
 */
function analyzeRouteIntegrity(pages, links) {
  const results = {
    validLinks: [],
    deadLinks: [],
    unusedPages: [],
    dynamicLinks: [],
  };

  // Normalize routes for comparison
  const normalizeRoute = (route) => {
    return route
      .replace(/\/$/, "") // Remove trailing slash
      .replace(/:\w+/g, ":param") // Normalize params
      .replace(/\[\w+\]/g, ":param")
      .toLowerCase();
  };

  const pageRoutes = new Set(pages.map((p) => normalizeRoute(p.route)));
  const linkedRoutes = new Set();

  // Check each link
  for (const link of links) {
    const normalizedHref = normalizeRoute(link.href);

    // Check if it's a dynamic route
    if (link.href.includes(":") || link.href.includes("[")) {
      results.dynamicLinks.push(link);
      linkedRoutes.add(normalizedHref);
      continue;
    }

    // Check if page exists
    if (pageRoutes.has(normalizedHref) || normalizedHref === "") {
      results.validLinks.push(link);
      linkedRoutes.add(normalizedHref);
    } else {
      // Check for dynamic route match
      let matched = false;
      for (const pageRoute of pageRoutes) {
        if (pageRoute.includes(":param")) {
          const pattern = new RegExp(
            "^" + pageRoute.replace(/:param/g, "[^/]+") + "$",
          );
          if (pattern.test(normalizedHref)) {
            matched = true;
            results.validLinks.push(link);
            linkedRoutes.add(normalizedHref);
            break;
          }
        }
      }

      if (!matched) {
        results.deadLinks.push(link);
      }
    }
  }

  // Find unused pages
  for (const page of pages) {
    if (page.type === "layout") continue; // Layouts don't need direct links

    const normalizedRoute = normalizeRoute(page.route);
    if (normalizedRoute === "" || normalizedRoute === "/") continue; // Root is always used

    // Check if any link points to this page
    let isLinked = false;
    for (const linkedRoute of linkedRoutes) {
      if (linkedRoute === normalizedRoute) {
        isLinked = true;
        break;
      }
      // Check dynamic match
      if (normalizedRoute.includes(":param")) {
        const pattern = new RegExp(
          "^" + normalizedRoute.replace(/:param/g, "[^/]+") + "$",
        );
        if (pattern.test(linkedRoute)) {
          isLinked = true;
          break;
        }
      }
    }

    if (!isLinked) {
      results.unusedPages.push(page);
    }
  }

  return results;
}

/**
 * Recursively find all frontend projects (Next.js, Vite, React, Vue, etc.) in a monorepo
 */
function findFrontendProjects(projectPath, maxDepth = 5, currentDepth = 0) {
  const srcDirs = [];
  
  // Check common locations first
  const commonPaths = [
    path.join(projectPath, "apps", "web-ui", "src"),
    path.join(projectPath, "apps", "web", "src"),
    path.join(projectPath, "client", "src"),
    path.join(projectPath, "frontend", "src"),
    path.join(projectPath, "services", "scanner-dash", "src"),
    path.join(projectPath, "dashboard", "src"),
    path.join(projectPath, "src"),
    projectPath,
  ];
  
  // Check for framework indicators
  function isFrontendProject(dir) {
    if (!fs.existsSync(dir)) return false;
    
    // Check for Next.js
    if (fs.existsSync(path.join(dir, "app")) || fs.existsSync(path.join(dir, "pages"))) {
      return true;
    }
    
    // Check for Vite (has vite.config.* or src/main.* or src/App.*)
    const viteConfig = fs.existsSync(path.join(projectPath, "vite.config.ts")) ||
                       fs.existsSync(path.join(projectPath, "vite.config.js")) ||
                       fs.existsSync(path.join(projectPath, "vite.config.mjs"));
    if (viteConfig && (fs.existsSync(path.join(dir, "main.tsx")) || 
                       fs.existsSync(path.join(dir, "main.ts")) ||
                       fs.existsSync(path.join(dir, "main.jsx")) ||
                       fs.existsSync(path.join(dir, "main.js")) ||
                       fs.existsSync(path.join(dir, "App.tsx")) ||
                       fs.existsSync(path.join(dir, "App.tsx")))) {
      return true;
    }
    
    // Check for React/Vue/Svelte components
    if (fs.existsSync(path.join(dir, "components")) || 
        fs.existsSync(path.join(dir, "routes")) ||
        fs.existsSync(path.join(dir, "pages"))) {
      return true;
    }
    
    return false;
  }
  
  for (const dir of commonPaths) {
    if (isFrontendProject(dir)) {
      srcDirs.push(dir);
    }
  }
  
  // Recursively search subdirectories (for monorepos)
  if (currentDepth < maxDepth) {
    try {
      const items = fs.readdirSync(projectPath, { withFileTypes: true });
      
      for (const item of items) {
        if (item.isDirectory() && !SKIP_DIRS.includes(item.name)) {
          const subPath = path.join(projectPath, item.name);
          
          // Check if this subdirectory has frontend structure
          const possibleSrc = [
            path.join(subPath, "src"),
            subPath,
          ];
          
          for (const srcPath of possibleSrc) {
            if (isFrontendProject(srcPath)) {
              if (!srcDirs.includes(srcPath)) {
                srcDirs.push(srcPath);
              }
            }
          }
          
          // Recursively search deeper (but limit depth)
          if (currentDepth < 2) {
            const subDirs = findFrontendProjects(subPath, maxDepth, currentDepth + 1);
            for (const subDir of subDirs) {
              if (!srcDirs.includes(subDir)) {
                srcDirs.push(subDir);
              }
            }
          }
        }
      }
    } catch (err) {
      // Skip directories we can't read
    }
  }
  
  return srcDirs;
}

/**
 * Main audit function
 */
async function auditRouteIntegrity(projectPath = ".") {
  const results = {
    projectPath: path.resolve(projectPath),
    pages: [],
    links: [],
    integrity: null,
    placeholders: [],
    featureFlags: [],
  };

  // Find all frontend projects (including monorepo subdirectories)
  const srcDirs = findFrontendProjects(projectPath);

  if (srcDirs.length === 0) {
    console.warn("No frontend project (Next.js, Vite, React, etc.) found");
    return results;
  }

  // Process all found frontend projects
  for (const srcDir of srcDirs) {
    // Detect pages (Next.js App Router)
    const appPages = detectNextAppPages(srcDir);
    results.pages.push(...appPages);
    
    // Detect pages (Next.js Pages Router)
    const pagesRouterPages = detectNextPagesPages(srcDir);
    results.pages.push(...pagesRouterPages);
    
    // Detect Vite/React Router pages (if no Next.js pages found)
    if (appPages.length === 0 && pagesRouterPages.length === 0) {
      const vitePages = detectViteRoutes(srcDir);
      results.pages.push(...vitePages);
    }

    // Extract links
    const links = extractLinks(srcDir);
    results.links.push(...links);

    // Detect placeholders
    const placeholders = detectPlaceholders(srcDir);
    results.placeholders.push(...placeholders);

    // Detect feature flags
    const featureFlags = detectFeatureFlags(srcDir);
    results.featureFlags.push(...featureFlags);
  }

  // Analyze integrity across all projects
  results.integrity = analyzeRouteIntegrity(results.pages, results.links);

  return results;
}

/**
 * Generate report
 */
function formatRouteResults(results) {
  const lines = [];

  lines.push("# 🗺️ Route Integrity Report\n");
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push(`**Project:** ${results.projectPath}\n`);

  // Summary
  lines.push("## 📊 Summary\n");
  lines.push("| Metric | Count | Status |");
  lines.push("|--------|-------|--------|");
  lines.push(`| 📄 Total Pages | ${results.pages.length} | Info |`);
  lines.push(`| 🔗 Total Links | ${results.links.length} | Info |`);
  lines.push(
    `| ✅ Valid Links | ${results.integrity?.validLinks.length || 0} | Good |`,
  );
  lines.push(
    `| 🔴 Dead Links | ${results.integrity?.deadLinks.length || 0} | ${results.integrity?.deadLinks.length > 0 ? "**Issue**" : "Good"} |`,
  );
  lines.push(
    `| ⚠️ Unused Pages | ${results.integrity?.unusedPages.length || 0} | ${results.integrity?.unusedPages.length > 0 ? "Review" : "Good"} |`,
  );
  lines.push(
    `| 🚧 Placeholders | ${results.placeholders.length} | ${results.placeholders.length > 0 ? "Review" : "Good"} |`,
  );
  lines.push(`| 🚩 Feature Flags | ${results.featureFlags.length} | Info |`);
  lines.push("");

  // Dead links
  if (results.integrity?.deadLinks.length > 0) {
    lines.push("## 🔴 Dead Links (404 Risk)\n");
    lines.push("These links point to pages that don't exist:\n");

    // Group by href
    const byHref = {};
    for (const link of results.integrity.deadLinks) {
      if (!byHref[link.href]) {
        byHref[link.href] = [];
      }
      byHref[link.href].push(link);
    }

    for (const [href, links] of Object.entries(byHref)) {
      lines.push(`### \`${href}\`\n`);
      for (const link of links.slice(0, 5)) {
        lines.push(`- \`${link.file}:${link.line}\``);
      }
      if (links.length > 5) {
        lines.push(`- ... and ${links.length - 5} more occurrences`);
      }
      lines.push("");
    }
  }

  // Unused pages
  if (results.integrity?.unusedPages.length > 0) {
    lines.push("## ⚠️ Unused Pages (Orphaned)\n");
    lines.push("These pages exist but have no links pointing to them:\n");
    for (const page of results.integrity.unusedPages) {
      lines.push(`- **${page.route}**`);
      lines.push(
        `  - File: \`${path.relative(results.projectPath, page.file)}\``,
      );
    }
    lines.push("");
  }

  // Placeholders shipped
  if (results.placeholders.length > 0) {
    lines.push("## 🚧 Placeholder Content Detected\n");
    lines.push("This content may not be ready for production:\n");

    // Group by type
    const byType = {};
    for (const p of results.placeholders) {
      if (!byType[p.type]) {
        byType[p.type] = [];
      }
      byType[p.type].push(p);
    }

    for (const [type, items] of Object.entries(byType)) {
      lines.push(`### ${type.replace(/_/g, " ").toUpperCase()}\n`);
      for (const item of items.slice(0, 10)) {
        lines.push(`- \`${item.file}:${item.line}\``);
        lines.push(`  - Context: "${item.context}"`);
      }
      if (items.length > 10) {
        lines.push(`- ... and ${items.length - 10} more`);
      }
      lines.push("");
    }
  }

  // Feature flags
  if (results.featureFlags.length > 0) {
    lines.push("## 🚩 Feature Flags Detected\n");
    lines.push(
      "Review these to ensure features are properly enabled/disabled:\n",
    );

    const uniqueFiles = [...new Set(results.featureFlags.map((f) => f.file))];
    for (const file of uniqueFiles.slice(0, 20)) {
      const fileFlags = results.featureFlags.filter((f) => f.file === file);
      lines.push(`- \`${file}\` (${fileFlags.length} flags)`);
    }
    if (uniqueFiles.length > 20) {
      lines.push(`- ... and ${uniqueFiles.length - 20} more files`);
    }
    lines.push("");
  }

  // All pages
  lines.push("## 📄 All Routes\n");
  lines.push("<details>");
  lines.push("<summary>Show all detected routes</summary>\n");
  for (const page of results.pages.filter((p) => p.type === "page")) {
    lines.push(`- ${page.route}`);
  }
  lines.push("</details>\n");

  // Recommendations
  lines.push("## 💡 Recommendations\n");

  if (results.integrity?.deadLinks.length > 0) {
    lines.push("### 🔴 Fix Dead Links");
    lines.push("1. Create missing pages or update links to correct routes");
    lines.push("2. Add a custom 404 page for better UX");
    lines.push("3. Consider adding link validation to CI/CD\n");
  }

  if (results.integrity?.unusedPages.length > 0) {
    lines.push("### ⚠️ Review Unused Pages");
    lines.push("1. Add navigation links to orphaned pages");
    lines.push("2. Remove pages that are no longer needed");
    lines.push("3. Check if pages are dynamically linked\n");
  }

  if (results.placeholders.length > 0) {
    lines.push("### 🚧 Clean Up Placeholders");
    lines.push('1. Replace "Coming Soon" with real content or remove');
    lines.push("2. Address all TODOs before production");
    lines.push("3. Replace lorem ipsum with real copy\n");
  }

  return lines.join("\n");
}

// CLI execution
if (require.main === module) {
  const projectPath = process.argv[2] || ".";

  console.log("🗺️ Auditing route integrity...\n");

  auditRouteIntegrity(projectPath)
    .then((results) => {
      const report = formatRouteResults(results);
      console.log(report);

      // Save report
      const reportDir = path.join(projectPath, ".guardrail");
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(reportDir, "route-integrity-report.md"),
        report,
      );
      console.log(
        `\n📄 Report saved to: ${reportDir}/route-integrity-report.md`,
      );
    })
    .catch((err) => {
      console.error("Error:", err.message);
      process.exit(1);
    });
}

module.exports = { auditRouteIntegrity, formatRouteResults };
