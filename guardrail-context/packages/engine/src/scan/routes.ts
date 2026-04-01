import fs from "node:fs";
import path from "node:path";

export type Route = {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";
  path: string;
  file: string;
  line: number;
  handler?: string;
  middleware?: string[];
  proof: string;
};

export type RoutesMap = {
  routes: Route[];
  byMethod: Record<string, Route[]>;
  byFile: Record<string, Route[]>;
  summary: {
    total: number;
    byMethod: Record<string, number>;
  };
};

const ROUTE_PATTERNS = [
  // Express/Fastify style
  /(?:app|router|server)\.(get|post|put|delete|patch|all)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
  // Next.js API routes (file-based)
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/gi,
  // Nest.js decorators
  /@(Get|Post|Put|Delete|Patch)\s*\(\s*['"`]?([^'"`)\s]*)['"`]?\s*\)/gi,
  // tRPC procedures
  /\.(query|mutation)\s*\(\s*['"`]([^'"`]+)['"`]/gi,
];

export async function scanRoutes(repoRoot: string, files: string[]): Promise<RoutesMap> {
  const routes: Route[] = [];
  const routeFiles = files.filter(f => 
    /\.(ts|tsx|js|jsx)$/.test(f) &&
    (f.includes("route") || f.includes("api") || f.includes("controller") || 
     f.includes("pages/api") || f.includes("app/api")) &&
    // Exclude test files and mocks
    !f.includes("test") && !f.includes("spec") && !f.includes("mock") &&
    !f.includes("__tests__") && !f.includes(".test.") && !f.includes(".spec.")
  );

  for (const file of routeFiles) {
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const lines = content.split("\n");
      const relativePath = path.relative(repoRoot, file);

      // Check for Next.js App Router file-based routes
      if (relativePath.includes("app/api") || relativePath.includes("app\\api")) {
        const routePath = extractNextJsRoute(relativePath);
        
        // Check for HTTP method exports
        const methodMatch = content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)/g);
        if (methodMatch) {
          for (const m of methodMatch) {
            const methodName = m.match(/(GET|POST|PUT|DELETE|PATCH)/)?.[1] as Route["method"];
            if (methodName) {
              const lineNum = findLineNumber(lines, m);
              routes.push({
                method: methodName,
                path: routePath,
                file: relativePath,
                line: lineNum,
                proof: `${relativePath}:${lineNum}`
              });
            }
          }
        }
      }

      // Check for Express/Fastify/etc style routes
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        for (const pattern of ROUTE_PATTERNS) {
          pattern.lastIndex = 0;
          let match;
          
          while ((match = pattern.exec(line)) !== null) {
            const rawMethod = match[1].toUpperCase();
            const routePath = match[2] || "/";
            
            // Skip if it's a tRPC query/mutation (different pattern)
            if (rawMethod === "QUERY" || rawMethod === "MUTATION") continue;
            
            const method = rawMethod as Route["method"];
            routes.push({
              method: method === "ALL" ? "ALL" : method,
              path: routePath,
              file: relativePath,
              line: i + 1,
              proof: `${relativePath}:${i + 1}`
            });
          }
        }
      }
    } catch {}
  }

  // Group by method
  const byMethod: Record<string, Route[]> = {};
  for (const route of routes) {
    if (!byMethod[route.method]) byMethod[route.method] = [];
    byMethod[route.method].push(route);
  }

  // Group by file
  const byFile: Record<string, Route[]> = {};
  for (const route of routes) {
    if (!byFile[route.file]) byFile[route.file] = [];
    byFile[route.file].push(route);
  }

  // Summary
  const methodCounts: Record<string, number> = {};
  for (const route of routes) {
    methodCounts[route.method] = (methodCounts[route.method] || 0) + 1;
  }

  return {
    routes,
    byMethod,
    byFile,
    summary: {
      total: routes.length,
      byMethod: methodCounts
    }
  };
}

function extractNextJsRoute(filePath: string): string {
  // Convert file path to API route
  // e.g., app/api/users/[id]/route.ts -> /api/users/[id]
  const normalized = filePath.replace(/\\/g, "/");
  const match = normalized.match(/app(\/api\/[^/]+(?:\/[^/]+)*?)\/route\.[jt]sx?$/);
  if (match) {
    return match[1];
  }
  
  // Pages router style
  const pagesMatch = normalized.match(/pages(\/api\/[^.]+)/);
  if (pagesMatch) {
    return pagesMatch[1];
  }
  
  return "/";
}

function findLineNumber(lines: string[], searchText: string): number {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(searchText.split(" ")[0])) {
      return i + 1;
    }
  }
  return 1;
}

export function routeExists(routes: RoutesMap, method: string, routePath: string): Route | null {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = routePath.toLowerCase();
  
  return routes.routes.find(r => 
    r.method === normalizedMethod && 
    r.path.toLowerCase() === normalizedPath
  ) || null;
}
