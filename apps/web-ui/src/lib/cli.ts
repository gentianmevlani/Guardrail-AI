/**
 * CLI API functions for guardrail
 */

export interface CLICommand {
  command: string;
  description: string;
  example: string;
  requiresAuth: boolean;
}

export const CLI_COMMANDS: CLICommand[] = [
  {
    command: "guardrail scan",
    description: "Scan your repository for security vulnerabilities",
    example: "guardrail scan --path ./src --output json",
    requiresAuth: false,
  },
  {
    command: "guardrail init",
    description: "Initialize guardrail in your project",
    example: "guardrail init --template react",
    requiresAuth: false,
  },
  {
    command: "guardrail guard",
    description: "Run AI guardrails on your code",
    example: "guardrail guard --file app.ts --rules ai-security",
    requiresAuth: true,
  },
  {
    command: "guardrail fix",
    description: "Auto-fix detected issues",
    example: "guardrail fix --issue-type security --auto",
    requiresAuth: true,
  },
  {
    command: "guardrail monitor",
    description: "Monitor your repository in real-time",
    example: "guardrail monitor --webhook https://your-webhook.com",
    requiresAuth: true,
  },
  {
    command: "guardrail report",
    description: "Generate security reports",
    example: "guardrail report --format pdf --output ./reports",
    requiresAuth: true,
  },
];

export function getInstallCommand(os: "macos" | "linux" | "windows"): string {
  switch (os) {
    case "macos":
      return "brew install guardrail/tap/guardrail";
    case "linux":
      return "curl -sSL https://install.guardrail.dev | bash";
    case "windows":
      return "iwr -useb https://install.guardrail.dev | iex";
    default:
      return "npm install -g @guardrail/cli";
  }
}

export function getSetupInstructions(apiKey?: string): string[] {
  const instructions = [
    "# Install guardrail CLI",
    "",
    "## Installation",
    "",
    "### macOS (Recommended)",
    "```bash",
    getInstallCommand("macos"),
    "```",
    "",
    "### Linux",
    "```bash",
    getInstallCommand("linux"),
    "```",
    "",
    "### Windows",
    "```powershell",
    getInstallCommand("windows"),
    "```",
    "",
    "## Setup",
    "",
    "1. Authenticate with your API key:",
    "```bash",
    "guardrail auth login YOUR_API_KEY",
    "```",
    "",
    "2. Verify installation:",
    "```bash",
    "guardrail --version",
    "```",
    "",
    "3. Scan your first project:",
    "```bash",
    "guardrail scan",
    "```",
  ];

  if (apiKey) {
    instructions.splice(
      instructions.findIndex((line) => line.includes("YOUR_API_KEY")) + 1,
      0,
      "",
      "   Your API key: " + apiKey,
    );
  }

  return instructions;
}
