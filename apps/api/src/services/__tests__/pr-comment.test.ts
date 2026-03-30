/**
 * Tests for PR Comment Generation (generatePRCommentSummary)
 */

import { describe, it, expect, jest } from "@jest/globals";

// Mock dependencies to isolate the function
jest.mock("@octokit/rest", () => ({ Octokit: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn().mockReturnValue("mock-jwt") }));

import { generatePRCommentSummary } from "../github-app-service";

describe("generatePRCommentSummary", () => {
  const baseFindings = [
    { severity: "critical", category: "security", title: "Hardcoded API key", file: "src/config.ts", line: 42 },
    { severity: "high", category: "api_truth", title: "Hallucinated method", file: "src/api.ts", line: 15 },
    { severity: "medium", category: "env_var", title: "Missing ENV var", file: "src/env.ts", line: 3 },
    { severity: "low", category: "style", title: "Unused import", file: "src/utils.ts", line: 1 },
  ];

  it("generates basic comment without trust score", () => {
    const comment = generatePRCommentSummary(
      baseFindings,
      "run-abc123",
      "https://guardrail.dev/runs/run-abc123"
    );

    expect(comment).toContain("Guardrail Scan");
    expect(comment).toContain("Critical");
    expect(comment).toContain("run-abc1"); // truncated run ID
    expect(comment).toContain("Powered by");
  });

  it("includes trust score header when provided", () => {
    const comment = generatePRCommentSummary(
      baseFindings,
      "run-abc123",
      "https://guardrail.dev/runs/run-abc123",
      {
        score: 72,
        verdict: "REVIEW",
        grade: "C",
      }
    );

    expect(comment).toContain("72/100");
    expect(comment).toContain("REVIEW");
    expect(comment).toContain("Grade:** C");
  });

  it("shows delta from main when available", () => {
    const comment = generatePRCommentSummary(
      baseFindings,
      "run-abc123",
      "https://guardrail.dev/runs/run-abc123",
      {
        score: 85,
        verdict: "SHIP",
        grade: "B",
        delta: -3,
        previousScore: 88,
      }
    );

    expect(comment).toContain("-3 from `main`");
  });

  it("shows positive delta", () => {
    const comment = generatePRCommentSummary(
      baseFindings,
      "run-abc123",
      "https://guardrail.dev/runs/run-abc123",
      {
        score: 90,
        verdict: "SHIP",
        grade: "B",
        delta: 5,
        previousScore: 85,
      }
    );

    expect(comment).toContain("+5 from `main`");
  });

  it("includes dimension table when provided", () => {
    const comment = generatePRCommentSummary(
      baseFindings,
      "run-abc123",
      "https://guardrail.dev/runs/run-abc123",
      {
        score: 80,
        verdict: "REVIEW",
        grade: "C",
        dimensions: {
          api_integrity: { score: 95, label: "API Integrity", findingCount: 1 },
          contract_health: { score: 60, label: "Contract Health", findingCount: 3 },
        },
      }
    );

    expect(comment).toContain("Trust Score Dimensions");
    expect(comment).toContain("API Integrity");
    expect(comment).toContain("Contract Health");
  });

  it("shows top critical/high findings", () => {
    const comment = generatePRCommentSummary(
      baseFindings,
      "run-abc123",
      "https://guardrail.dev/runs/run-abc123"
    );

    expect(comment).toContain("Top Findings");
    expect(comment).toContain("Hardcoded API key");
    expect(comment).toContain("src/config.ts:42");
    expect(comment).toContain("Hallucinated method");
  });

  it("renders clean all-clear for zero findings", () => {
    const comment = generatePRCommentSummary(
      [],
      "run-clean",
      "https://guardrail.dev/runs/run-clean",
      { score: 100, verdict: "SHIP", grade: "A" }
    );

    expect(comment).toContain("SHIP");
    expect(comment).toContain("100/100");
    expect(comment).not.toContain("Top Findings");
  });
});
