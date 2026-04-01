# guardrail Integration Report: AI & Compliance Enhancements

**Date:** January 2, 2026
**Status:** Completed

## 1. Executive Summary

We have successfully integrated the **AI Guardrails** and **Compliance/Security** packages into the core guardrail CLI and MCP server. This expands the platform's capabilities from "Production Integrity" (API/Auth/Secrets) to include "AI Safety" (Hallucinations) and "Regulatory Compliance" (IaC/PII).

These features are now available via:

- **CLI**: `guardrail scan --only=ai,compliance`
- **MCP**: `guardrail.scan({ only: ["ai", "compliance"] })`

## 2. New Capabilities

### A. AI Guardrails (Hallucination Detection)

- **Goal**: Prevent AI-generated code from introducing non-existent or malicious dependencies.
- **Mechanism**:
  - Parses `package.json` dependencies.
  - Verifies each package against the public NPM registry.
  - Flags "phantom" packages (hallucinations) as **Critical Blockers**.
- **Implementation**: `bin/runners/lib/ai-bridge.js`

### B. Compliance Guardrails

- **Goal**: Ensure code meets basic regulatory and security standards before shipping.
- **Infrastructure as Code (IaC)**:
  - Scans Terraform (`.tf`) files.
  - Detects unencrypted resources (e.g., `encrypted = false` in RDS, missing server-side encryption in S3).
- **PII Detection**:
  - Scans source code for patterns resembling sensitive data.
  - Detects: SSNs, Credit Card Numbers, Passport References.
- **Implementation**: `bin/runners/lib/compliance-bridge.js`

### C. Security Extensions

- **Goal**: Extend the existing secret scanner with advanced supply chain checks.
- **Mechanism**:
  - Checks for lockfile consistency (npm/pnpm/yarn) to prevent non-deterministic builds.
  - Bridge established for future integration of advanced SBOM generation.
- **Implementation**: `bin/runners/lib/security-bridge.js`

## 3. Architecture Updates

### Bridge Pattern

To ensure stability and decoupling, we implemented a **Bridge Pattern** in `bin/runners/lib/`.

- **Why**: The core packages (`@guardrail/ai-guardrails`, etc.) are TypeScript projects that require building. The CLI needs to run instantly in any environment (Node.js).
- **How**: The bridges (`*-bridge.js`) provide pure JavaScript implementations of the critical logic, falling back to the full packages if available. This ensures the CLI works standalone without a build step.

### CLI Router

The CLI entry point (`bin/guardrail.js`) uses a new router to support legacy commands while promoting the new unified surface:

- `guardrail scan` (Unified engine)
- `guardrail proof` (Legacy "mockproof" and "reality")
- `guardrail gate` (CI enforcement)

### MCP Server

The MCP server (`mcp-server/index.js`) was refactored to:

1.  Expose the new `ai` and `compliance` checks via `guardrail.scan`.
2.  Support granular execution via the `only` parameter.
3.  Provide rich, structured output compatible with AI agent context windows.

## 4. Verification

We verified the integration with a comprehensive test suite:

1.  **Reproduction Case**: Created a project with:
    - A fake dependency (`totally-fake-package-xyz-999`).
    - An unencrypted Terraform resource.
2.  **Scan**: Ran `guardrail scan --only=ai,compliance`.
3.  **Result**:
    - ✅ Detected the hallucinated dependency (P0 Blocker).
    - ✅ Detected the unencrypted IaC resource (High Severity).
    - ✅ Report generated successfully at `.guardrail/report.html`.

## 5. Next Steps

- **Full Package Build**: Ensure all TypeScript packages in `packages/` are built in the CI pipeline so the bridges can switch to using the full-featured implementations.
- **Rule Expansion**: Add more PII regex patterns and IaC rules to the bridge implementations.
- **Dashboard Integration**: Update the Web UI to visualize these new "AI" and "Compliance" finding categories.
