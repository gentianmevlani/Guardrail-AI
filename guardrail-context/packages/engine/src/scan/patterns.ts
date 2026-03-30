import fs from "node:fs";
import path from "node:path";

export type GoldenPattern = {
  id: string;
  name: string;
  description: string;
  file: string;
  code: string;
  tags: string[];
};

export type PatternsMap = Record<string, GoldenPattern>;

export async function scanPatterns(repoRoot: string, files: string[]): Promise<PatternsMap> {
  const patterns: PatternsMap = {};
  const tsFiles = files.filter(f => /\.(ts|tsx|js|jsx)$/.test(f));

  // Find API route pattern
  for (const file of tsFiles) {
    if (!file.includes("route") && !file.includes("api")) continue;
    
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const rel = path.relative(repoRoot, file);
      
      const routeMatch = content.match(/router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`][^)]*\)\s*(?:async\s*)?\([^)]*\)\s*(?:=>|{)\s*[\s\S]{30,400}?(?:}\s*\)|res\.\w+\([^)]*\))/);
      if (routeMatch && !patterns["api-route"]) {
        patterns["api-route"] = {
          id: "api-route",
          name: "API Route Handler",
          description: "Standard Express/router route handler pattern",
          file: rel,
          code: routeMatch[0].substring(0, 350),
          tags: ["api", "route", "express"]
        };
      }
    } catch {}
  }

  // Find React component pattern
  for (const file of tsFiles) {
    if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) continue;
    
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const rel = path.relative(repoRoot, file);
      
      const componentMatch = content.match(/export\s+(?:default\s+)?function\s+([A-Z]\w+)\s*\([^)]*\)[^{]*\{[\s\S]{30,250}?return\s*\(/);
      if (componentMatch && !patterns["component"]) {
        patterns["component"] = {
          id: "component",
          name: "React Component",
          description: "Standard React function component pattern",
          file: rel,
          code: componentMatch[0].substring(0, 300),
          tags: ["react", "component", "ui"]
        };
      }
    } catch {}
  }

  // Find custom hook pattern
  for (const file of tsFiles) {
    if (!file.includes("hook") && !file.includes("use")) continue;
    
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const rel = path.relative(repoRoot, file);
      
      const hookMatch = content.match(/export\s+(?:function|const)\s+(use[A-Z]\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)[^{]*\{[\s\S]{30,300}?(?:return|}\s*$)/);
      if (hookMatch && !patterns["hook"]) {
        patterns["hook"] = {
          id: "hook",
          name: "Custom Hook",
          description: "Standard React custom hook pattern",
          file: rel,
          code: hookMatch[0].substring(0, 280),
          tags: ["react", "hook", "state"]
        };
      }
    } catch {}
  }

  // Find Zod schema pattern
  for (const file of tsFiles) {
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const rel = path.relative(repoRoot, file);
      
      const zodMatch = content.match(/(?:export\s+)?const\s+(\w+Schema)\s*=\s*z\.object\(\{[\s\S]{30,300}?\}\)/);
      if (zodMatch && !patterns["zod-schema"]) {
        patterns["zod-schema"] = {
          id: "zod-schema",
          name: "Zod Schema",
          description: "Standard Zod validation schema pattern",
          file: rel,
          code: zodMatch[0].substring(0, 300),
          tags: ["zod", "validation", "schema"]
        };
      }
    } catch {}
  }

  // Find Drizzle table pattern
  for (const file of tsFiles) {
    if (!file.includes("schema")) continue;
    
    try {
      const content = await fs.promises.readFile(file, "utf8");
      const rel = path.relative(repoRoot, file);
      
      const drizzleMatch = content.match(/export\s+const\s+(\w+)\s*=\s*(?:pgTable|sqliteTable|mysqlTable)\s*\(\s*['"`](\w+)['"`]\s*,\s*\{[\s\S]{30,350}?\}\s*\)/);
      if (drizzleMatch && !patterns["drizzle-table"]) {
        patterns["drizzle-table"] = {
          id: "drizzle-table",
          name: "Drizzle Table",
          description: "Standard Drizzle ORM table definition",
          file: rel,
          code: drizzleMatch[0].substring(0, 320),
          tags: ["drizzle", "database", "schema"]
        };
      }
    } catch {}
  }

  return patterns;
}

export function pickPattern(patterns: PatternsMap, intent: string): GoldenPattern | null {
  // Map intents to pattern IDs
  const intentMap: Record<string, string[]> = {
    "new-endpoint": ["api-route"],
    "new-api": ["api-route"],
    "add-route": ["api-route"],
    "new-component": ["component"],
    "add-component": ["component"],
    "new-hook": ["hook"],
    "add-hook": ["hook"],
    "new-schema": ["zod-schema", "drizzle-table"],
    "add-table": ["drizzle-table"],
    "validation": ["zod-schema"],
  };

  const lowerIntent = intent.toLowerCase();
  
  // Direct match
  if (patterns[lowerIntent]) {
    return patterns[lowerIntent];
  }

  // Intent mapping
  for (const [key, patternIds] of Object.entries(intentMap)) {
    if (lowerIntent.includes(key)) {
      for (const id of patternIds) {
        if (patterns[id]) return patterns[id];
      }
    }
  }

  return null;
}
