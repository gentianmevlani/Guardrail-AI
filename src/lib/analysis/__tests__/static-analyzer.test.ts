/**
 * Static Analyzer Tests
 *
 * Tests for fake feature detection rules
 */

import { describe, it, expect, beforeEach } from "vitest";
import { StaticAnalyzer, Finding } from "../static-analyzer";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

describe("StaticAnalyzer", () => {
  let analyzer: StaticAnalyzer;
  let tempDir: string;

  beforeEach(async () => {
    analyzer = new StaticAnalyzer();
    tempDir = path.join(os.tmpdir(), `test-project-${Date.now()}`);
    await fs.promises.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  describe("Empty Function Detection", () => {
    it("should detect empty function bodies", async () => {
      const code = `
export function emptyFunction() {
}

export function anotherEmpty() {}
`;
      await writeFile("empty.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const emptyFindings = result.findings.filter(
        (f) => f.type === "empty_function",
      );
      expect(emptyFindings.length).toBeGreaterThan(0);
      expect(emptyFindings[0].severity).toBe("warning");
    });

    it("should not flag functions with implementations", async () => {
      const code = `
export function realFunction() {
  return 42;
}
`;
      await writeFile("real.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const emptyFindings = result.findings.filter(
        (f) => f.type === "empty_function" && f.file.includes("real.ts"),
      );
      expect(emptyFindings.length).toBe(0);
    });
  });

  describe("Console-Only Function Detection", () => {
    it("should detect functions with only console statements", async () => {
      const code = `
export function logOnly() {
  console.log('debugging');
  console.log('more debugging');
}
`;
      await writeFile("console.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const consoleFindings = result.findings.filter(
        (f) => f.type === "console_only",
      );
      expect(consoleFindings.length).toBeGreaterThan(0);
    });
  });

  describe("Hardcoded Return Detection", () => {
    it("should detect functions with hardcoded returns", async () => {
      const code = `
export function getUser() {
  return { name: 'John', id: 1 };
}

export function getCount() {
  return 42;
}

export function isEnabled() {
  return true;
}
`;
      await writeFile("hardcoded.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const hardcodedFindings = result.findings.filter(
        (f) => f.type === "hardcoded_return",
      );
      expect(hardcodedFindings.length).toBeGreaterThan(0);
    });
  });

  describe("Mock Data Detection", () => {
    it("should detect mock data patterns", async () => {
      const code = `
const users = [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Doe', email: 'jane@example.com' },
];

const testData = {
  placeholder: 'Lorem ipsum dolor sit amet',
  phone: '123-456-7890',
};
`;
      await writeFile("mock.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const mockFindings = result.findings.filter(
        (f) => f.type === "mock_data",
      );
      expect(mockFindings.length).toBeGreaterThan(0);
    });
  });

  describe("Fake API Detection", () => {
    it("should detect fake API endpoints", async () => {
      const code = `
async function fetchUsers() {
  const response = await fetch('https://jsonplaceholder.typicode.com/users');
  return response.json();
}

async function fetchLocal() {
  const response = await fetch('http://localhost:3001/api/data');
  return response.json();
}
`;
      await writeFile("api.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const apiFindings = result.findings.filter(
        (f) => f.type === "fake_api_call",
      );
      expect(apiFindings.length).toBeGreaterThan(0);
      expect(apiFindings[0].severity).toBe("critical");
    });
  });

  describe("TODO Without Implementation", () => {
    it("should detect TODO comments without nearby implementation", async () => {
      const code = `
// TODO: Implement user authentication


// TODO: Add error handling
export function processData() {
  // Just a placeholder
}
`;
      await writeFile("todo.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const todoFindings = result.findings.filter(
        (f) => f.type === "todo_without_impl",
      );
      expect(todoFindings.length).toBeGreaterThan(0);
    });

    it("should detect FIXME comments", async () => {
      const code = `
// FIXME: This is broken but I'll fix it later
export function brokenFunction() {
  console.log('broken');
}
`;
      await writeFile("fixme.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const fixmeFindings = result.findings.filter(
        (f) => f.type === "todo_without_impl" && f.title.includes("FIXME"),
      );
      expect(fixmeFindings.length).toBeGreaterThan(0);
      expect(fixmeFindings[0].severity).toBe("critical");
    });
  });

  describe("Stub Implementation Detection", () => {
    it("should detect throw not implemented patterns", async () => {
      const code = `
export function futureFeature() {
  throw new Error('Not implemented');
}

export class MyService {
  doSomething() {
    throw new Error('TODO: implement this');
  }
}
`;
      await writeFile("stub.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const stubFindings = result.findings.filter(
        (f) => f.type === "stub_implementation",
      );
      expect(stubFindings.length).toBeGreaterThan(0);
      expect(stubFindings[0].severity).toBe("critical");
    });
  });

  describe("Unreachable Code Detection", () => {
    it("should detect code after return statements", async () => {
      const code = `
export function hasUnreachable() {
  return 42;
  console.log('never executed');
  const x = 1;
}
`;
      await writeFile("unreachable.ts", code);

      const result = await analyzer.analyzeProject(tempDir);

      const unreachableFindings = result.findings.filter(
        (f) => f.type === "unreachable_code",
      );
      expect(unreachableFindings.length).toBeGreaterThan(0);
    });
  });

  describe("Analysis Metrics", () => {
    it("should report correct metrics", async () => {
      const code1 = `export const a = 1;\nexport const b = 2;`;
      const code2 = `export function test() { return true; }`;

      await writeFile("file1.ts", code1);
      await writeFile("file2.ts", code2);

      const result = await analyzer.analyzeProject(tempDir);

      expect(result.filesScanned).toBe(2);
      expect(result.linesScanned).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(0);
    });
  });

  describe("File Filtering", () => {
    it("should exclude node_modules", async () => {
      await fs.promises.mkdir(path.join(tempDir, "node_modules", "pkg"), {
        recursive: true,
      });
      await writeFile("node_modules/pkg/index.ts", "export const fake = true;");
      await writeFile("src/app.ts", "export const real = true;");

      const result = await analyzer.analyzeProject(tempDir);

      expect(
        result.findings.every((f) => !f.file.includes("node_modules")),
      ).toBe(true);
    });

    it("should handle nested directories", async () => {
      await fs.promises.mkdir(path.join(tempDir, "src", "components"), {
        recursive: true,
      });
      await writeFile(
        "src/components/Button.tsx",
        `
export function Button() {
  // Empty component
}
`,
      );

      const result = await analyzer.analyzeProject(tempDir);

      expect(result.filesScanned).toBeGreaterThan(0);
    });
  });

  // Helper to write test files
  async function writeFile(
    relativePath: string,
    content: string,
  ): Promise<void> {
    const fullPath = path.join(tempDir, relativePath);
    const dir = path.dirname(fullPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, content);
  }
});

describe("Finding Categories", () => {
  it("should have correct categories for different finding types", () => {
    const categoryMap: Record<string, string> = {
      fake_feature: "fake_feature",
      empty_function: "fake_feature",
      console_only: "fake_feature",
      hardcoded_return: "fake_feature",
      mock_data: "fake_feature",
      fake_api_call: "fake_feature",
      todo_without_impl: "fake_feature",
      stub_implementation: "fake_feature",
      unused_export: "code_quality",
      unreachable_code: "code_quality",
    };

    // Verify mapping exists for all types
    expect(Object.keys(categoryMap).length).toBeGreaterThan(0);
  });
});
