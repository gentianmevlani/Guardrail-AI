/**
 * Flow Pack YAML Parser
 *
 * Parses custom flow definitions from YAML files so users can
 * define their own critical paths to test.
 *
 * Example YAML:
 * ```yaml
 * id: custom-checkout
 * name: Custom Checkout Flow
 * description: Tests our specific checkout process
 * steps:
 *   - action: navigate
 *     target: /products
 *   - action: click
 *     target: button:has-text("Add to Cart")
 *   - action: navigate
 *     target: /checkout
 *   - action: fill
 *     target: "#email"
 *     value: "{{email}}"
 * assertions:
 *   - type: url-contains
 *     value: /confirmation
 *     critical: true
 * ```
 */

import type { CriticalFlow, FlowStep, FlowAssertion } from "./types";

interface RawFlowYAML {
  id: string;
  name: string;
  description?: string;
  required?: boolean;
  steps: Array<{
    action: string;
    target?: string;
    value?: string;
    timeout?: number;
  }>;
  assertions?: Array<{
    type: string;
    value: string;
    critical?: boolean;
  }>;
}

/**
 * Parse a YAML flow definition into a CriticalFlow object
 */
export function parseFlowYAML(yaml: string): CriticalFlow {
  // Simple YAML parser for flow definitions
  // In production, would use a proper YAML library
  const lines = yaml.split("\n");
  const flow: Partial<RawFlowYAML> = {
    steps: [],
    assertions: [],
  };

  let currentSection: "root" | "steps" | "assertions" = "root";
  let currentItem: Record<string, any> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Detect section changes
    if (trimmed === "steps:") {
      currentSection = "steps";
      continue;
    }
    if (trimmed === "assertions:") {
      currentSection = "assertions";
      continue;
    }

    // Handle list items
    if (trimmed.startsWith("- ")) {
      if (currentItem && currentSection === "steps") {
        flow.steps!.push(currentItem as any);
      } else if (currentItem && currentSection === "assertions") {
        flow.assertions!.push(currentItem as any);
      }

      currentItem = {};
      const content = trimmed.slice(2);
      if (content.includes(":")) {
        const [keyPart, ...valueParts] = content.split(":");
        const key = keyPart?.trim();
        const value = valueParts
          .join(":")
          .trim()
          .replace(/^["']|["']$/g, "");
        if (key) currentItem[key] = parseValue(value);
      }
      continue;
    }

    // Handle properties
    if (trimmed.includes(":")) {
      const [keyPart, ...valueParts] = trimmed.split(":");
      const key = keyPart?.trim();
      const value = valueParts
        .join(":")
        .trim()
        .replace(/^["']|["']$/g, "");

      if (key && currentSection === "root") {
        (flow as any)[key] = parseValue(value);
      } else if (key && currentItem) {
        currentItem[key] = parseValue(value);
      }
    }
  }

  // Don't forget the last item
  if (currentItem) {
    if (currentSection === "steps") {
      flow.steps!.push(currentItem as any);
    } else if (currentSection === "assertions") {
      flow.assertions!.push(currentItem as any);
    }
  }

  return convertToFlow(flow as RawFlowYAML);
}

/**
 * Parse a value, handling booleans and numbers
 */
function parseValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  return value;
}

/**
 * Convert raw YAML to CriticalFlow
 */
function convertToFlow(raw: RawFlowYAML): CriticalFlow {
  return {
    id: raw.id || "custom-flow",
    name: raw.name || "Custom Flow",
    description: raw.description || "",
    required: raw.required ?? false,
    steps: raw.steps.map(
      (s): FlowStep => ({
        action: s.action as FlowStep["action"],
        target: s.target,
        value: s.value,
        timeout: s.timeout,
      }),
    ),
    assertions: (raw.assertions || []).map(
      (a): FlowAssertion => ({
        type: a.type as FlowAssertion["type"],
        value: a.value,
        critical: a.critical ?? true,
      }),
    ),
  };
}

/**
 * Load flow from file path
 */
export async function loadFlowFromFile(
  filePath: string,
): Promise<CriticalFlow> {
  const fs = await import("fs").then((m) => m.promises);
  const content = await fs.readFile(filePath, "utf-8");
  return parseFlowYAML(content);
}

/**
 * Load all flows from a directory
 */
export async function loadFlowsFromDirectory(
  dirPath: string,
): Promise<CriticalFlow[]> {
  const fs = await import("fs").then((m) => m.promises);
  const path = await import("path");

  const flows: CriticalFlow[] = [];

  try {
    const files = await fs.readdir(dirPath);

    for (const file of files) {
      if (file.endsWith(".yaml") || file.endsWith(".yml")) {
        const filePath = path.join(dirPath, file);
        const flow = await loadFlowFromFile(filePath);
        flows.push(flow);
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  return flows;
}

/**
 * Validate a flow definition
 */
export function validateFlow(flow: CriticalFlow): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!flow.id) errors.push("Flow must have an id");
  if (!flow.name) errors.push("Flow must have a name");
  if (!flow.steps || flow.steps.length === 0)
    errors.push("Flow must have at least one step");

  const validActions = ["navigate", "click", "fill", "wait", "assert"];
  for (const step of flow.steps || []) {
    if (!validActions.includes(step.action)) {
      errors.push(`Invalid action: ${step.action}`);
    }
    if (step.action !== "wait" && !step.target) {
      errors.push(`Step "${step.action}" requires a target`);
    }
    if (step.action === "fill" && !step.value) {
      errors.push("Fill action requires a value");
    }
  }

  const validAssertionTypes = [
    "url-contains",
    "element-visible",
    "element-hidden",
    "cookie-exists",
    "localstorage-has",
    "network-success",
    "no-errors",
  ];
  for (const assertion of flow.assertions || []) {
    if (!validAssertionTypes.includes(assertion.type)) {
      errors.push(`Invalid assertion type: ${assertion.type}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Generate example flow YAML
 */
export function generateExampleFlowYAML(): string {
  return `# Example Critical Flow Definition
# Save this as .guardrail/flows/my-flow.yaml

id: my-custom-flow
name: My Custom Flow
description: Tests my specific user journey
required: false

steps:
  - action: navigate
    target: /my-page

  - action: fill
    target: input[name="email"]
    value: "{{email}}"

  - action: fill
    target: input[name="password"]
    value: "{{password}}"

  - action: click
    target: button[type="submit"]

  - action: wait
    timeout: 3000

assertions:
  - type: url-contains
    value: /success
    critical: true

  - type: element-visible
    value: .welcome-message
    critical: false

  - type: no-errors
    value: ""
    critical: true
`;
}
