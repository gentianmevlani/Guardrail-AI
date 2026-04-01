/**
 * Pattern Detection Module
 * Detects code patterns, hooks, state management, styling, and anti-patterns
 */

const fs = require("fs");
const path = require("path");

/**
 * Find files recursively (local helper)
 */
function findFiles(dir, extensions, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth || !fs.existsSync(dir)) return [];
  
  const files = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        files.push(...findFiles(fullPath, extensions, maxDepth, currentDepth + 1));
      } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  } catch {}
  return files;
}

/**
 * Extract a function example from code
 */
function extractFunctionExample(content, functionName) {
  const regex = new RegExp(`(export\\s+)?(function|const)\\s+${functionName}[^{]*\\{`, 'g');
  const match = regex.exec(content);
  if (!match) return null;
  
  const startIndex = match.index;
  let braceCount = 0;
  let endIndex = startIndex;
  let started = false;
  
  for (let i = startIndex; i < content.length && i < startIndex + 500; i++) {
    if (content[i] === '{') {
      braceCount++;
      started = true;
    } else if (content[i] === '}') {
      braceCount--;
    }
    if (started && braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
  
  const example = content.slice(startIndex, endIndex);
  return example.length < 400 ? example : example.slice(0, 400) + '\n  // ...';
}

/**
 * Detect anti-patterns in code
 */
function detectAntiPatterns(content, filePath, antiPatterns) {
  // Console.log in production code
  if (!filePath.includes('.test.') && !filePath.includes('.spec.') && !filePath.includes('__tests__')) {
    if (/console\.(log|error|warn)\(/.test(content)) {
      const existing = antiPatterns.find(a => a.type === 'console-log');
      if (!existing) {
        antiPatterns.push({
          type: 'console-log',
          severity: 'warning',
          message: 'Console statements found in production code',
          suggestion: 'Use a proper logger or remove before production',
        });
      }
    }
  }

  // Any type usage
  if (/:\s*any\b/.test(content)) {
    const existing = antiPatterns.find(a => a.type === 'any-type');
    if (!existing) {
      antiPatterns.push({
        type: 'any-type',
        severity: 'warning',
        message: 'Usage of `any` type detected',
        suggestion: 'Use proper TypeScript types or `unknown`',
      });
    }
  }

  // Hardcoded secrets
  if (/(api[_-]?key|password|secret|token)\s*[:=]\s*['"][^'"]+['"]/i.test(content)) {
    const existing = antiPatterns.find(a => a.type === 'hardcoded-secret');
    if (!existing) {
      antiPatterns.push({
        type: 'hardcoded-secret',
        severity: 'error',
        message: 'Potential hardcoded secrets detected',
        suggestion: 'Use environment variables for sensitive data',
      });
    }
  }

  // Mock data patterns
  if (/(jsonplaceholder|reqres\.in|mockapi|faker|fake[A-Z])/i.test(content)) {
    const existing = antiPatterns.find(a => a.type === 'mock-data');
    if (!existing) {
      antiPatterns.push({
        type: 'mock-data',
        severity: 'warning',
        message: 'Mock data or fake APIs detected',
        suggestion: 'Replace with real API endpoints before production',
      });
    }
  }

  // TODO/FIXME comments
  if (/\/\/\s*(TODO|FIXME|HACK|XXX):/i.test(content)) {
    const existing = antiPatterns.find(a => a.type === 'todo-comments');
    if (!existing) {
      antiPatterns.push({
        type: 'todo-comments',
        severity: 'info',
        message: 'TODO/FIXME comments found',
        suggestion: 'Address these items before shipping',
      });
    }
  }
}

/**
 * Deep pattern detection - analyzes actual code patterns
 */
function detectPatterns(projectPath) {
  const patterns = {
    hooks: [],
    stateManagement: null,
    styling: [],
    testing: [],
    dataFetching: [],
    validation: null,
    authentication: null,
    codeExamples: {},
    antiPatterns: [],
  };

  const srcFiles = findFiles(projectPath, [".ts", ".tsx", ".js", ".jsx"], 6);
  
  for (const file of srcFiles.slice(0, 100)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(projectPath, file);
      
      // Detect custom hooks
      const hookMatches = content.match(/export\s+(function|const)\s+(use[A-Z]\w+)/g);
      if (hookMatches) {
        hookMatches.forEach(match => {
          const hookName = match.match(/use[A-Z]\w+/)?.[0];
          if (hookName && !patterns.hooks.includes(hookName)) {
            patterns.hooks.push(hookName);
            if (!patterns.codeExamples.hooks) {
              const hookExample = extractFunctionExample(content, hookName);
              if (hookExample) {
                patterns.codeExamples.hooks = { name: hookName, code: hookExample, file: relativePath };
              }
            }
          }
        });
      }

      // Detect state management
      if (content.includes("zustand") || content.includes("create(")) {
        patterns.stateManagement = "Zustand";
      } else if (content.includes("@reduxjs/toolkit") || content.includes("createSlice")) {
        patterns.stateManagement = "Redux Toolkit";
      } else if (content.includes("recoil") || content.includes("atom(")) {
        patterns.stateManagement = "Recoil";
      } else if (content.includes("jotai")) {
        patterns.stateManagement = "Jotai";
      } else if (content.includes("createContext") && !patterns.stateManagement) {
        patterns.stateManagement = "React Context";
      }

      // Detect styling patterns
      if (content.includes("styled-components") || content.includes("styled.")) {
        if (!patterns.styling.includes("Styled Components")) patterns.styling.push("Styled Components");
      }
      if (content.includes("@emotion") || content.includes("css``")) {
        if (!patterns.styling.includes("Emotion")) patterns.styling.push("Emotion");
      }
      if (content.includes("className=") && content.includes("tailwind")) {
        if (!patterns.styling.includes("Tailwind CSS")) patterns.styling.push("Tailwind CSS");
      }
      if (content.includes(".module.css") || content.includes(".module.scss")) {
        if (!patterns.styling.includes("CSS Modules")) patterns.styling.push("CSS Modules");
      }

      // Detect data fetching patterns
      if (content.includes("@tanstack/react-query") || content.includes("useQuery")) {
        if (!patterns.dataFetching.includes("TanStack Query")) patterns.dataFetching.push("TanStack Query");
      }
      if (content.includes("useSWR") || content.includes("swr")) {
        if (!patterns.dataFetching.includes("SWR")) patterns.dataFetching.push("SWR");
      }
      if (content.includes("trpc") || content.includes("createTRPCReact")) {
        if (!patterns.dataFetching.includes("tRPC")) patterns.dataFetching.push("tRPC");
      }

      // Detect validation
      if (content.includes("zod") || content.includes("z.object")) {
        patterns.validation = "Zod";
      } else if (content.includes("yup") && !patterns.validation) {
        patterns.validation = "Yup";
      }

      // Detect authentication
      if (content.includes("next-auth") || content.includes("NextAuth")) {
        patterns.authentication = "NextAuth.js";
      } else if (content.includes("clerk") || content.includes("@clerk")) {
        patterns.authentication = "Clerk";
      } else if (content.includes("supabase") && content.includes("auth")) {
        patterns.authentication = "Supabase Auth";
      }

      // Detect testing patterns
      if (content.includes("@testing-library") || content.includes("render(")) {
        if (!patterns.testing.includes("React Testing Library")) patterns.testing.push("React Testing Library");
      }
      if (content.includes("vitest") || content.includes("vi.mock")) {
        if (!patterns.testing.includes("Vitest")) patterns.testing.push("Vitest");
      }
      if (content.includes("jest") || content.includes("describe(")) {
        if (!patterns.testing.includes("Jest")) patterns.testing.push("Jest");
      }
      if (content.includes("playwright") || content.includes("@playwright")) {
        if (!patterns.testing.includes("Playwright")) patterns.testing.push("Playwright");
      }

      // Detect anti-patterns
      detectAntiPatterns(content, relativePath, patterns.antiPatterns);
      
    } catch {}
  }

  return patterns;
}

module.exports = {
  detectPatterns,
  detectAntiPatterns,
  extractFunctionExample,
};
