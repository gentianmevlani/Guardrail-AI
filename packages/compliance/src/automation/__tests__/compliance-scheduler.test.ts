import { ComplianceScheduler } from "../compliance-scheduler";
import { describe, it, expect, jest } from "@jest/globals";

// Create mocks for the dependencies
jest.mock("@guardrail/database", () => ({
  prisma: {
    complianceSchedule: {
      findMany: jest.fn<() => Promise<any[]>>().mockResolvedValue([]),
      upsert: jest.fn<() => Promise<any>>(),
      deleteMany: jest.fn<() => Promise<any>>(),
      update: jest.fn<() => Promise<any>>(),
      findFirst: jest
        .fn<({ where }: { where: any }) => Promise<any>>()
        .mockImplementation(async ({ where }) => {
          if (
            where.projectId === "test-project" &&
            where.frameworkId === "test-framework"
          ) {
            return {
              id: "test-id",
              projectId: "test-project",
              frameworkId: "test-framework",
              enabled: true,
              schedule: "0 0 * * *",
              notifications: {
                slack: "https://hooks.slack.com/services/test/webhook",
                email: ["test@example.com"],
              },
            };
          }
          return null;
        }),
    },
    project: {
      findUnique: jest
        .fn<() => Promise<any>>()
        .mockResolvedValue({ id: "test-project", path: "/tmp" }),
    },
  },
}));

jest.mock("../../frameworks/engine", () => ({
  complianceAutomationEngine: {
    // Return structure matching result.result.assessment.summary.score
    assess: jest.fn<() => Promise<any>>().mockResolvedValue({
      summary: { score: 85 },
      details: {},
    }),
  },
}));

jest.mock("../reporting-engine", () => ({
  reportingEngine: {
    generateReport: jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({ id: "report-1" }),
  },
}));

jest.mock("../email-service", () => ({
  emailService: {
    sendComplianceNotification: jest
      .fn<() => Promise<any>>()
      .mockResolvedValue({
        success: true,
        messageId: "test-message-id",
      }),
  },
}));

describe("ComplianceScheduler Slack Integration", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should send Slack notification", async () => {
    // Mock fetch
    const fetchMock = jest.fn<() => Promise<any>>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    global.fetch = fetchMock;

    // Spy on console.log to check current behavior
    const consoleSpy = jest.spyOn(console, "log");

    const scheduler = new ComplianceScheduler();

    // Create a mock result
    const mockResult = {
      scheduleId: "test-schedule",
      executionId: "test-execution",
      startTime: new Date(),
      endTime: new Date(),
      status: "completed" as const,
      result: {
        assessment: {
          summary: { score: 85 },
        },
      },
    };

    // Call sendNotifications directly
    await (scheduler as any).sendNotifications(
      "test-project",
      "test-framework",
      mockResult,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/test/webhook",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("Compliance Check WARNING"), // Score is 85, so warning
      }),
    );

    // Verify block structure in body
    const callArgs = fetchMock.mock.calls[0] as any[];
    if (callArgs && callArgs.length > 1) {
      const body = JSON.parse(callArgs[1].body);
      expect(body.blocks).toBeDefined();
      // Check for score in fields instead of text
      expect(
        body.blocks.some(
          (b: any) =>
            b.fields &&
            b.fields.some((f: any) => f.text && f.text.includes("85%")),
        ),
      ).toBe(true);
    }

    // Check if console log was called
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Sending Slack notification to https://hooks.slack.com/services/test/webhook",
      ),
    );
  });

  it("should handle Slack errors gracefully", async () => {
    // Mock fetch error
    const fetchMock = jest
      .fn<() => Promise<any>>()
      .mockRejectedValue(new Error("Network error"));
    global.fetch = fetchMock;

    const consoleErrorSpy = jest.spyOn(console, "error");

    const scheduler = new ComplianceScheduler();

    // Create a mock result
    const mockResult = {
      scheduleId: "test-schedule",
      executionId: "test-execution",
      startTime: new Date(),
      endTime: new Date(),
      status: "completed" as const,
      result: {
        assessment: {
          summary: { score: 85 },
        },
      },
    };

    // Call sendNotifications directly
    await (scheduler as any).sendNotifications(
      "test-project",
      "test-framework",
      mockResult,
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to send Slack notification:",
      expect.any(Error),
    );
  });
});
