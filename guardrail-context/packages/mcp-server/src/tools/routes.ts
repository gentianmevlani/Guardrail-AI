import path from "node:path";
import { readJsonSync, truthPackExists } from "@guardrail-context/engine";
import type { RoutesMap } from "@guardrail-context/engine";

export async function routesListTool(repoRoot: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  try {
    const routes = readJsonSync<RoutesMap>(outDir, "routes.json");
    
    return {
      total: routes.summary.total,
      byMethod: routes.summary.byMethod,
      routes: routes.routes.slice(0, 50).map(r => ({
        method: r.method,
        path: r.path,
        file: r.file,
        line: r.line,
        proof: r.proof
      })),
      message: `Found ${routes.summary.total} API routes`
    };
  } catch {
    return { 
      error: "Routes not indexed. Run 'guardrail-context index' to scan.",
      indexed: false
    };
  }
}

export async function routesExistsTool(repoRoot: string, method: string, routePath: string) {
  const outDir = path.join(repoRoot, ".guardrail-context");

  if (!truthPackExists(repoRoot)) {
    return { error: "Truth Pack not found. Run 'guardrail-context index' first." };
  }

  try {
    const routes = readJsonSync<RoutesMap>(outDir, "routes.json");
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = routePath.toLowerCase();
    
    const match = routes.routes.find(r => 
      r.method === normalizedMethod && 
      r.path.toLowerCase() === normalizedPath
    );

    if (match) {
      return {
        exists: true,
        method: match.method,
        path: match.path,
        file: match.file,
        line: match.line,
        proof: match.proof,
        message: `✅ Route ${method} ${routePath} exists at ${match.proof}`
      };
    }

    // Check for similar routes
    const similar = routes.routes
      .filter(r => r.path.toLowerCase().includes(normalizedPath.split("/").pop() || ""))
      .slice(0, 5);

    return {
      exists: false,
      method,
      path: routePath,
      similar: similar.map(r => `${r.method} ${r.path}`),
      message: `❌ Route ${method} ${routePath} does NOT exist. DO NOT use this route.`,
      suggestion: similar.length > 0 
        ? `Did you mean one of these? ${similar.map(r => `${r.method} ${r.path}`).join(", ")}`
        : "Check the routes list to find available endpoints."
    };
  } catch {
    return { error: "Routes not indexed." };
  }
}
