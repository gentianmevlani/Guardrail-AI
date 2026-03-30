import type { SymbolRecord } from "@guardrail-context/shared";
import type { DepsTruth } from "@guardrail-context/shared";
import type { RoutesMap } from "./routes.js";

export type HallucinationTest = {
  id: string;
  category: "symbol" | "route" | "package" | "file";
  query: string;
  expectedResult: "exists" | "not_exists";
  proof?: string;
  trapNote: string;
};

export type HallucinationTestSuite = {
  tests: HallucinationTest[];
  generatedAt: string;
  summary: {
    total: number;
    symbolTests: number;
    routeTests: number;
    packageTests: number;
    fileTests: number;
  };
};

export function generateHallucinationTests(
  symbols: SymbolRecord[],
  deps: DepsTruth,
  routes: RoutesMap,
  files: string[]
): HallucinationTestSuite {
  const tests: HallucinationTest[] = [];
  let testId = 0;

  // === POSITIVE TESTS (things that DO exist) ===
  
  // Sample real symbols
  const exportedSymbols = symbols.filter(s => s.isExported).slice(0, 10);
  for (const sym of exportedSymbols) {
    tests.push({
      id: `sym-pos-${testId++}`,
      category: "symbol",
      query: sym.name,
      expectedResult: "exists",
      proof: `${sym.file}:${sym.startLine}`,
      trapNote: `✅ ${sym.name} exists at ${sym.file}:${sym.startLine}`
    });
  }

  // Sample real packages
  const realPkgs = Object.keys(deps.packageJson?.dependencies || {}).slice(0, 10);
  for (const pkg of realPkgs) {
    tests.push({
      id: `pkg-pos-${testId++}`,
      category: "package",
      query: pkg,
      expectedResult: "exists",
      proof: "package.json",
      trapNote: `✅ ${pkg} is installed`
    });
  }

  // Sample real routes
  const realRoutes = routes.routes.slice(0, 10);
  for (const route of realRoutes) {
    tests.push({
      id: `route-pos-${testId++}`,
      category: "route",
      query: `${route.method} ${route.path}`,
      expectedResult: "exists",
      proof: route.proof,
      trapNote: `✅ ${route.method} ${route.path} exists at ${route.proof}`
    });
  }

  // === NEGATIVE TESTS (hallucination traps - things that DON'T exist) ===

  // Generate fake symbols that sound real but don't exist
  const fakeSymbols = generateFakeSymbols(symbols);
  for (const fake of fakeSymbols) {
    tests.push({
      id: `sym-neg-${testId++}`,
      category: "symbol",
      query: fake.name,
      expectedResult: "not_exists",
      trapNote: `🚨 TRAP: ${fake.name} does NOT exist - ${fake.reason}`
    });
  }

  // Generate fake packages that sound useful but aren't installed
  const fakePackages = generateFakePackages(deps);
  for (const fake of fakePackages) {
    tests.push({
      id: `pkg-neg-${testId++}`,
      category: "package",
      query: fake.name,
      expectedResult: "not_exists",
      trapNote: `🚨 TRAP: ${fake.name} is NOT installed - ${fake.reason}`
    });
  }

  // Generate fake routes that sound like they should exist
  const fakeRoutes = generateFakeRoutes(routes);
  for (const fake of fakeRoutes) {
    tests.push({
      id: `route-neg-${testId++}`,
      category: "route",
      query: fake.name,
      expectedResult: "not_exists",
      trapNote: `🚨 TRAP: ${fake.name} does NOT exist - ${fake.reason}`
    });
  }

  return {
    tests,
    generatedAt: new Date().toISOString(),
    summary: {
      total: tests.length,
      symbolTests: tests.filter(t => t.category === "symbol").length,
      routeTests: tests.filter(t => t.category === "route").length,
      packageTests: tests.filter(t => t.category === "package").length,
      fileTests: tests.filter(t => t.category === "file").length,
    }
  };
}

function generateFakeSymbols(symbols: SymbolRecord[]): Array<{ name: string; reason: string }> {
  const fakes: Array<{ name: string; reason: string }> = [];
  const existingNames = new Set(symbols.map(s => s.name.toLowerCase()));

  // Common patterns that AIs hallucinate
  const hallucinationPatterns = [
    { prefix: "use", suffix: "Hook", reason: "Common React hook pattern" },
    { prefix: "get", suffix: "Data", reason: "Common getter pattern" },
    { prefix: "fetch", suffix: "Api", reason: "Common fetch pattern" },
    { prefix: "handle", suffix: "Click", reason: "Common handler pattern" },
    { prefix: "on", suffix: "Change", reason: "Common event pattern" },
    { prefix: "is", suffix: "Valid", reason: "Common validation pattern" },
    { prefix: "create", suffix: "Instance", reason: "Common factory pattern" },
  ];

  for (const pattern of hallucinationPatterns) {
    const fakeName = `${pattern.prefix}${randomWord()}${pattern.suffix}`;
    if (!existingNames.has(fakeName.toLowerCase())) {
      fakes.push({ name: fakeName, reason: pattern.reason });
    }
  }

  // Add variations of real symbols
  const realSymbol = symbols[0];
  if (realSymbol) {
    fakes.push({ 
      name: realSymbol.name + "V2", 
      reason: "Version suffix trap - original exists but V2 doesn't" 
    });
    fakes.push({ 
      name: realSymbol.name.charAt(0).toLowerCase() + realSymbol.name.slice(1), 
      reason: "Case variation trap" 
    });
  }

  return fakes.slice(0, 10);
}

function generateFakePackages(deps: DepsTruth): Array<{ name: string; reason: string }> {
  const fakes: Array<{ name: string; reason: string }> = [];
  const installed = new Set(Object.keys(deps.packageJson?.dependencies || {}));
  
  // Commonly hallucinated packages
  const commonFakes = [
    { name: "lodash", reason: "Very common but often not installed" },
    { name: "axios", reason: "Popular HTTP client often assumed" },
    { name: "moment", reason: "Legacy date library often assumed" },
    { name: "underscore", reason: "Alternative to lodash often confused" },
    { name: "jquery", reason: "Legacy library often assumed in older patterns" },
    { name: "express-validator", reason: "Express middleware often assumed" },
    { name: "passport", reason: "Auth library often assumed" },
    { name: "mongoose", reason: "MongoDB ODM often assumed" },
    { name: "sequelize", reason: "SQL ORM often assumed" },
    { name: "body-parser", reason: "Legacy Express middleware (now built-in)" },
  ];

  for (const fake of commonFakes) {
    if (!installed.has(fake.name)) {
      fakes.push(fake);
    }
  }

  return fakes.slice(0, 10);
}

function generateFakeRoutes(routes: RoutesMap): Array<{ name: string; reason: string }> {
  const fakes: Array<{ name: string; reason: string }> = [];
  const existingRoutes = new Set(routes.routes.map(r => `${r.method} ${r.path}`));

  // Common route patterns AIs assume exist
  const commonFakeRoutes = [
    { name: "GET /api/users", reason: "Generic users endpoint often assumed" },
    { name: "POST /api/users", reason: "Generic create user often assumed" },
    { name: "DELETE /api/users/:id", reason: "Generic delete often assumed" },
    { name: "GET /api/health", reason: "Health check often assumed" },
    { name: "POST /api/login", reason: "Login endpoint often assumed vs /auth/login" },
    { name: "POST /api/register", reason: "Register endpoint often assumed" },
    { name: "GET /api/profile", reason: "Profile endpoint often assumed" },
    { name: "PUT /api/settings", reason: "Settings update often assumed" },
    { name: "GET /api/search", reason: "Search endpoint often assumed" },
    { name: "POST /api/upload", reason: "Upload endpoint often assumed" },
  ];

  for (const fake of commonFakeRoutes) {
    if (!existingRoutes.has(fake.name)) {
      fakes.push(fake);
    }
  }

  return fakes.slice(0, 10);
}

function randomWord(): string {
  const words = ["User", "Auth", "Data", "Item", "List", "Form", "Modal", "Page", "View", "State"];
  return words[Math.floor(Math.random() * words.length)];
}

export function runHallucinationTest(
  suite: HallucinationTestSuite,
  checkSymbol: (name: string) => boolean,
  checkPackage: (name: string) => boolean,
  checkRoute: (query: string) => boolean
): { passed: number; failed: number; failures: HallucinationTest[] } {
  let passed = 0;
  const failures: HallucinationTest[] = [];

  for (const test of suite.tests) {
    let result: boolean;
    
    switch (test.category) {
      case "symbol":
        result = checkSymbol(test.query);
        break;
      case "package":
        result = checkPackage(test.query);
        break;
      case "route":
        result = checkRoute(test.query);
        break;
      default:
        continue;
    }

    const expected = test.expectedResult === "exists";
    if (result === expected) {
      passed++;
    } else {
      failures.push(test);
    }
  }

  return { passed, failed: failures.length, failures };
}
