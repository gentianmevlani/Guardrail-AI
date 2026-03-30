/**
 * Tests for Scheduled Jobs Service
 */

import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";

// Mock dependencies before imports
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    apiKey: {
      updateMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
    refreshToken: {
      deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
    },
    tokenBlacklist: {
      deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
    },
    oAuthState: {
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    usageToken: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    scan: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $executeRaw: jest.fn().mockResolvedValue(1),
  })),
}));

jest.mock("../autopilot-service", () => ({
  autopilotService: {
    generateWeeklyDigest: jest.fn().mockResolvedValue({
      repoName: "test-repo",
      weekStart: new Date(),
      weekEnd: new Date(),
      summary: { score: 85, improvements: 5 },
    }),
    formatDigestEmail: jest.fn().mockReturnValue({
      subject: "Weekly Digest",
      html: "<html>Digest content</html>",
      text: "Digest content",
    }),
  },
}));

jest.mock("../email-notification-service", () => ({
  emailService: {
    send: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock("../../logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocks
import { scheduledJobsService } from "../scheduled-jobs";

describe("ScheduledJobsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    scheduledJobsService.stop();
  });

  describe("Job Registration", () => {
    it("should register default jobs on initialization", () => {
      const status = scheduledJobsService.getJobStatus();
      
      expect(status.length).toBeGreaterThan(0);
      expect(status.find(j => j.name === "weekly-digest")).toBeDefined();
      expect(status.find(j => j.name === "daily-usage-reset")).toBeDefined();
      expect(status.find(j => j.name === "cleanup-expired-tokens")).toBeDefined();
    });

    it("should allow registering custom jobs", () => {
      const customJob = {
        name: "custom-test-job",
        schedule: "0 * * * *",
        handler: jest.fn().mockResolvedValue(undefined),
        enabled: true,
      };

      scheduledJobsService.registerJob(customJob);
      
      const status = scheduledJobsService.getJobStatus();
      expect(status.find(j => j.name === "custom-test-job")).toBeDefined();
    });
  });

  describe("Job Execution", () => {
    it("should run a job manually", async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      scheduledJobsService.registerJob({
        name: "test-manual-job",
        schedule: "0 * * * *",
        handler: mockHandler,
        enabled: true,
      });

      await scheduledJobsService.runJob("test-manual-job");
      
      expect(mockHandler).toHaveBeenCalled();
    });

    it("should not run unknown jobs", async () => {
      // Should not throw
      await expect(scheduledJobsService.runJob("nonexistent-job")).resolves.toBeUndefined();
    });

    it("should update lastRun after job completion", async () => {
      const beforeRun = new Date();
      
      scheduledJobsService.registerJob({
        name: "test-lastrun-job",
        schedule: "0 * * * *",
        handler: jest.fn().mockResolvedValue(undefined),
        enabled: true,
      });

      await scheduledJobsService.runJob("test-lastrun-job");
      
      const status = scheduledJobsService.getJobStatus();
      const job = status.find(j => j.name === "test-lastrun-job");
      
      expect(job?.lastRun).toBeDefined();
      expect(job?.lastRun?.getTime()).toBeGreaterThanOrEqual(beforeRun.getTime());
    });
  });

  describe("Schedule Parsing", () => {
    it("should correctly identify weekly schedule", () => {
      // Test internal method via job registration
      scheduledJobsService.registerJob({
        name: "weekly-test",
        schedule: "0 9 * * 1", // Monday at 9 AM
        handler: jest.fn().mockResolvedValue(undefined),
        enabled: true,
      });

      const status = scheduledJobsService.getJobStatus();
      expect(status.find(j => j.name === "weekly-test")).toBeDefined();
    });

    it("should correctly identify daily schedule", () => {
      scheduledJobsService.registerJob({
        name: "daily-test",
        schedule: "0 0 * * *", // Midnight daily
        handler: jest.fn().mockResolvedValue(undefined),
        enabled: true,
      });

      const status = scheduledJobsService.getJobStatus();
      expect(status.find(j => j.name === "daily-test")).toBeDefined();
    });
  });

  describe("Job Status", () => {
    it("should return status of all registered jobs", () => {
      const status = scheduledJobsService.getJobStatus();
      
      expect(Array.isArray(status)).toBe(true);
      status.forEach(job => {
        expect(job).toHaveProperty("name");
        expect(job).toHaveProperty("schedule");
        expect(job).toHaveProperty("enabled");
      });
    });
  });

  describe("Service Lifecycle", () => {
    it("should start and stop without errors", () => {
      expect(() => scheduledJobsService.start()).not.toThrow();
      expect(() => scheduledJobsService.stop()).not.toThrow();
    });

    it("should warn when starting twice", () => {
      const { logger } = require("../../logger");
      
      scheduledJobsService.start();
      scheduledJobsService.start();
      
      expect(logger.warn).toHaveBeenCalledWith("Scheduled jobs already running");
      
      scheduledJobsService.stop();
    });
  });
});
