/**
 * License Compliance Engine Tests
 *
 * Test suite for the LicenseComplianceEngine class
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { LicenseComplianceEngine } from "../../license/engine";

// Import ResponseType
type ResponseType =
  | "basic"
  | "cors"
  | "default"
  | "error"
  | "opaque"
  | "opaqueredirect";

// Mock fs
jest.mock("fs", () => ({
  readFileSync: jest.fn<(path: string) => string>().mockReturnValue(""),
  existsSync: jest.fn<(path: string) => boolean>(() => true),
}));

// Mock prisma
jest.mock("@guardrail/database", () => ({
  prisma: {
    licenseAnalysis: {
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      create: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      update: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      delete: jest.fn<() => Promise<any>>().mockResolvedValue({}),
      findUnique: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    },
  },
}));

// Mock fetch
const mockFetch = jest.fn<() => Promise<Response>>();
global.fetch = mockFetch;

describe("LicenseComplianceEngine", () => {
  let engine: LicenseComplianceEngine;

  beforeEach(() => {
    engine = new LicenseComplianceEngine();
    jest.clearAllMocks();
  });

  describe("license fetching", () => {
    it("should fetch license from npm registry", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              license: "MIT",
            },
          },
        }),
        headers: new Headers(),
        status: 200,
        statusText: "OK",
        type: "basic" as ResponseType,
        url: "",
        redirected: false,
        clone: jest.fn<() => Response>(),
        body: null,
        bodyUsed: false,
        bytes: jest.fn<() => Promise<Uint8Array<ArrayBufferLike>>>(),
        text: jest.fn<() => Promise<string>>(),
        blob: jest.fn<() => Promise<Blob>>(),
        formData: jest.fn<() => Promise<FormData>>(),
        arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>(),
      };

      mockFetch.mockResolvedValue(mockResponse);

      // Access private method through type assertion
      const result = await (engine as any).fetchLicenseFromRegistry(
        "test-package",
      );

      expect(result.license).toBe("MIT");
      expect(result.category).toBe("permissive");
    });

    it("should handle SPDX expressions", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": {
              license: {
                type: "MIT",
              },
            },
          },
        }),
        headers: new Headers(),
        status: 200,
        statusText: "OK",
        type: "basic" as ResponseType,
        url: "",
        redirected: false,
        clone: jest.fn<() => Response>(),
        body: null,
        bodyUsed: false,
        bytes: jest.fn<() => Promise<Uint8Array<ArrayBufferLike>>>(),
        text: jest.fn<() => Promise<string>>(),
        blob: jest.fn<() => Promise<Blob>>(),
        formData: jest.fn<() => Promise<FormData>>(),
        arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>(),
      };

      mockFetch.mockResolvedValue(mockResponse);

      const result = await (engine as any).fetchLicenseFromRegistry(
        "test-package",
      );

      expect(result.license).toBe("MIT");
    });

    it("should normalize license names", async () => {
      // Test the normalizeLicenseName method directly
      const result = (engine as any).normalizeLicenseName("Apache 2.0");
      expect(result).toBe("Apache-2.0");
    });

    it("should use fallback on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await (engine as any).fetchLicenseFromRegistry(
        "private-package",
      );

      expect(result.license).toBe("UNKNOWN");
      expect(result.category).toBe("unknown");
    });
  });

  describe("license categorization", () => {
    it("should categorize MIT as permissive", () => {
      const result = (engine as any).categorizeLicense("MIT");
      expect(result).toBe("permissive");
    });

    it("should categorize GPL as copyleft", () => {
      const result = (engine as any).categorizeLicense("GPL-3.0");
      expect(result).toBe("copyleft");
    });

    it("should categorize LGPL as weak-copyleft", () => {
      const result = (engine as any).categorizeLicense("LGPL-3.0");
      expect(result).toBe("weak-copyleft");
    });

    it("should categorize unknown licenses", () => {
      const result = (engine as any).categorizeLicense("UNKNOWN-LICENSE");
      expect(result).toBe("unknown");
    });
  });

  describe("conflict detection", () => {
    it("should detect GPL contamination in proprietary project", () => {
      const dependencies = [
        { name: "dep1", license: "MIT", category: "permissive" },
        { name: "dep2", license: "GPL-3.0", category: "copyleft" },
      ];

      const conflicts = (engine as any).detectGPLContamination(
        dependencies,
        "Proprietary",
      );

      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].dependency).toBe("dep1");
      expect(conflicts[0].severity).toBe("warning");
      expect(conflicts[1].dependency).toBe("dep2");
      expect(conflicts[1].severity).toBe("error");
    });

    it("should allow LGPL in Apache project", () => {
      const dependencies = [
        { name: "dep1", license: "Apache-2.0", category: "permissive" },
        { name: "dep2", license: "LGPL-3.0", category: "weak-copyleft" },
      ];

      const conflicts = (engine as any).detectGPLContamination(
        dependencies,
        "Apache-2.0",
      );

      expect(conflicts).toHaveLength(0);
    });
  });

  describe("project analysis", () => {
    it("should analyze simple project", async () => {
      const mockFs = await import("fs");
      jest.mocked(mockFs.readFileSync).mockReturnValue(
        JSON.stringify({
          dependencies: {
            express: "^4.18.0",
            lodash: "^4.17.21",
          },
        }),
      );

      // Mock fetch responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn<() => Promise<any>>().mockResolvedValue({
          "dist-tags": { latest: "1.0.0" },
          versions: {
            "1.0.0": { license: "MIT" },
          },
        }),
        headers: new Headers(),
        status: 200,
        statusText: "OK",
        type: "basic" as ResponseType,
        url: "",
        redirected: false,
        clone: jest.fn<() => Response>(),
        body: null,
        bodyUsed: false,
        bytes: jest.fn<() => Promise<Uint8Array<ArrayBufferLike>>>(),
        text: jest.fn<() => Promise<string>>(),
        blob: jest.fn<() => Promise<Blob>>(),
        formData: jest.fn<() => Promise<FormData>>(),
        arrayBuffer: jest.fn<() => Promise<ArrayBuffer>>(),
      });

      const result = await engine.analyzeProject(
        "/test/path",
        "test-project",
        "MIT",
      );

      expect(result.projectId).toBe("test-project");
      expect(result.projectLicense).toBe("MIT");
      expect(result.dependencies).toHaveLength(2);
      expect(result.overallStatus).toBe("compliant");
    });
  });
});
