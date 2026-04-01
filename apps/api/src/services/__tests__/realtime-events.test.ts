/**
 * Tests for Realtime Events Service
 */

import { WebSocket } from "ws";

// Mock logger before importing realtime-events
jest.mock("../../logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    child: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

import { realtimeEventsService } from "../realtime-events";

// Mock WebSocket
class MockWebSocket {
  readyState = WebSocket.OPEN;
  send = jest.fn();
  close = jest.fn();
  on = jest.fn();
}

describe("RealtimeEventsService", () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = new MockWebSocket() as any;
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up connections
    (realtimeEventsService as any).connections.clear();
  });

  describe("registerConnection", () => {
    it("should register a connection with userId", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");

      const connections = (realtimeEventsService as any).connections;
      expect(connections.has(mockWs)).toBe(true);
      expect(connections.get(mockWs).userId).toBe("user-123");
    });

    it("should set up flush interval for log batching", () => {
      jest.useFakeTimers();
      realtimeEventsService.registerConnection(mockWs as any, "user-123");

      // Fast-forward past flush interval
      jest.advanceTimersByTime(600);

      // Verify flush was called (buffer should be empty, so no send)
      jest.useRealTimers();
    });
  });

  describe("subscribe", () => {
    it("should subscribe to a run", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      const subscribed = realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      expect(subscribed).toBe(true);

      const connection = (realtimeEventsService as any).connections.get(mockWs);
      expect(connection.subscriptions.has("run-456")).toBe(true);
    });

    it("should reject subscription if user mismatch", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      const subscribed = realtimeEventsService.subscribe(mockWs as any, "run-456", "user-999");

      expect(subscribed).toBe(false);
    });

    it("should send confirmation message on subscribe", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe("subscribed");
      expect(sentMessage.runId).toBe("run-456");
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe from a run", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      realtimeEventsService.unsubscribe(mockWs as any, "run-456");

      const connection = (realtimeEventsService as any).connections.get(mockWs);
      expect(connection.subscriptions.has("run-456")).toBe(false);
    });
  });

  describe("emitStatus", () => {
    it("should emit status event to subscribers", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      realtimeEventsService.emitStatus("run-456", "user-123", "running");

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0]);
      expect(sentMessage.type).toBe("run.status");
      expect(sentMessage.runId).toBe("run-456");
      expect(sentMessage.data.status).toBe("running");
    });

    it("should not emit to non-subscribers", () => {
      const mockWs2 = new MockWebSocket();
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.registerConnection(mockWs2 as any, "user-999");

      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");
      // mockWs2 is not subscribed

      realtimeEventsService.emitStatus("run-456", "user-123", "running");

      expect(mockWs.send).toHaveBeenCalled();
      expect(mockWs2.send).not.toHaveBeenCalled();
    });
  });

  describe("emitProgress", () => {
    it("should emit progress event", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      realtimeEventsService.emitProgress("run-456", "user-123", 50);

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0]);
      expect(sentMessage.type).toBe("run.progress");
      expect(sentMessage.data.progress).toBe(50);
    });
  });

  describe("emitLog", () => {
    it("should batch log lines", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      // Clear the subscribe confirmation message
      mockWs.send.mockClear();

      // Emit logs (should be batched)
      for (let i = 0; i < 5; i++) {
        realtimeEventsService.emitLog("run-456", "user-123", `Log line ${i}`);
      }

      // Should not send yet (buffer not full - need 10 lines)
      expect(mockWs.send).not.toHaveBeenCalled();

      // Fill buffer to trigger flush (need 5 more to reach 10)
      for (let i = 5; i < 15; i++) {
        realtimeEventsService.emitLog("run-456", "user-123", `Log line ${i}`);
      }

      // Should have sent batched logs
      const logMessages = mockWs.send.mock.calls.filter((call) => {
        const msg = JSON.parse(call[0]);
        return msg.type === "run.log";
      });

      expect(logMessages.length).toBeGreaterThan(0);
      const lastLogMessage = JSON.parse(logMessages[logMessages.length - 1][0]);
      expect(Array.isArray(lastLogMessage.data.log)).toBe(true);
      expect(lastLogMessage.data.log.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("emitFinding", () => {
    it("should emit finding event", () => {
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");

      const finding = {
        id: "finding-1",
        type: "security",
        severity: "high",
        file: "src/app.ts",
        line: 42,
        message: "Potential security issue",
      };

      realtimeEventsService.emitFinding("run-456", "user-123", finding, 1);

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1][0]);
      expect(sentMessage.type).toBe("run.finding");
      expect(sentMessage.data.finding).toEqual(finding);
      expect(sentMessage.data.findingsCount).toBe(1);
    });
  });

  describe("getConnectionCount", () => {
    it("should return correct connection count for user", () => {
      const mockWs2 = new MockWebSocket();
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.registerConnection(mockWs2 as any, "user-123");

      expect(realtimeEventsService.getConnectionCount("user-123")).toBe(2);
      expect(realtimeEventsService.getConnectionCount("user-999")).toBe(0);
    });
  });

  describe("getSubscriptionCount", () => {
    it("should return correct subscription count for run", () => {
      const mockWs2 = new MockWebSocket();
      realtimeEventsService.registerConnection(mockWs as any, "user-123");
      realtimeEventsService.registerConnection(mockWs2 as any, "user-123");

      realtimeEventsService.subscribe(mockWs as any, "run-456", "user-123");
      realtimeEventsService.subscribe(mockWs2 as any, "run-456", "user-123");

      expect(realtimeEventsService.getSubscriptionCount("run-456")).toBe(2);
      expect(realtimeEventsService.getSubscriptionCount("run-999")).toBe(0);
    });
  });
});
