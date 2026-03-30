/**
 * Tests for Ship Badge Generator
 */

import * as path from "path";
import { ShipBadgeGenerator } from "../ship-badge-generator";

describe("ShipBadgeGenerator", () => {
  let generator: ShipBadgeGenerator;

  beforeEach(() => {
    generator = new ShipBadgeGenerator();
  });

  describe("generateShipBadge", () => {
    it("should generate badges for a project", async () => {
      const result = await generator.generateShipBadge({
        projectPath: path.join(__dirname, "..", "..", "..", ".."),
        projectName: "test-project",
      });

      expect(result).toHaveProperty("verdict");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("checks");
      expect(result).toHaveProperty("badges");
      expect(result).toHaveProperty("permalink");
      expect(result).toHaveProperty("embedCode");

      expect(result.checks.length).toBeGreaterThan(0);
      expect(["ship", "no-ship", "review"]).toContain(result.verdict);
    });

    it("should include all required checks", async () => {
      const result = await generator.generateShipBadge({
        projectPath: __dirname,
        projectName: "test",
      });

      const checkIds = result.checks.map((c) => c.id);

      expect(checkIds).toContain("no-mock-data");
      expect(checkIds).toContain("no-localhost");
      expect(checkIds).toContain("env-vars");
      expect(checkIds).toContain("real-billing");
      expect(checkIds).toContain("real-database");
      expect(checkIds).toContain("oauth-callbacks");
    });
  });

  describe("generateReport", () => {
    it("should generate readable report for passing project", () => {
      const mockResult = {
        projectId: "test123",
        projectName: "My App",
        verdict: "ship" as const,
        score: 100,
        checks: [
          {
            id: "no-mock-data",
            name: "No Mock Data",
            shortName: "Mock",
            status: "pass" as const,
            message: "Clean",
          },
          {
            id: "no-localhost",
            name: "No Localhost",
            shortName: "URLs",
            status: "pass" as const,
            message: "Clean",
          },
        ],
        badges: {
          main: "<svg>...</svg>",
          mockData: "<svg>...</svg>",
          realApi: "<svg>...</svg>",
          envVars: "<svg>...</svg>",
          billing: "<svg>...</svg>",
          database: "<svg>...</svg>",
          oauth: "<svg>...</svg>",
          combined: "<svg>...</svg>",
        },
        timestamp: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        permalink: "https://guardrail.dev/badge/test123",
        embedCode: "[![Badge](url)](link)",
      };

      const report = generator.generateReport(mockResult);

      expect(report).toContain("SHIP IT!");
      expect(report).toContain("My App");
      expect(report).toContain("100/100");
    });

    it("should generate readable report for failing project", () => {
      const mockResult = {
        projectId: "test123",
        projectName: "Bad App",
        verdict: "no-ship" as const,
        score: 33,
        checks: [
          {
            id: "no-mock-data",
            name: "No Mock Data",
            shortName: "Mock",
            status: "fail" as const,
            message: "Found 5 issues",
            details: ["file1.ts", "file2.ts"],
          },
          {
            id: "no-localhost",
            name: "No Localhost",
            shortName: "URLs",
            status: "pass" as const,
            message: "Clean",
          },
          {
            id: "env-vars",
            name: "Env Vars",
            shortName: "Env",
            status: "fail" as const,
            message: "Missing vars",
          },
        ],
        badges: {
          main: "<svg>...</svg>",
          mockData: "<svg>...</svg>",
          realApi: "<svg>...</svg>",
          envVars: "<svg>...</svg>",
          billing: "<svg>...</svg>",
          database: "<svg>...</svg>",
          oauth: "<svg>...</svg>",
          combined: "<svg>...</svg>",
        },
        timestamp: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        permalink: "https://guardrail.dev/badge/test123",
        embedCode: "[![Badge](url)](link)",
      };

      const report = generator.generateReport(mockResult);

      expect(report).toContain("NO SHIP");
      expect(report).toContain("Bad App");
      expect(report).toContain("❌");
    });
  });

  describe("badges", () => {
    it("should generate valid SVG badges", async () => {
      const result = await generator.generateShipBadge({
        projectPath: __dirname,
        projectName: "test",
      });

      expect(result.badges.main).toContain("<svg");
      expect(result.badges.main).toContain("</svg>");
      expect(result.badges.combined).toContain("<svg");
    });
  });
});
