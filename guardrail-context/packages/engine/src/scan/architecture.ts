import type { Graph } from "@guardrail-context/shared";

export type ArchitectureBoundary = {
  name: string;
  glob: string;
  allowedDependencies: string[];
  forbiddenDependencies: string[];
  description?: string;
};

export type ArchitectureViolation = {
  file: string;
  boundary: string;
  violation: "forbidden_import" | "missing_allowed";
  importedFrom: string;
  message: string;
};

export type ArchitectureConfig = {
  boundaries: ArchitectureBoundary[];
};

export type ArchitectureReport = {
  violations: ArchitectureViolation[];
  summary: {
    totalViolations: number;
    byBoundary: Record<string, number>;
    cleanBoundaries: string[];
  };
};

// Default architecture boundaries for common project structures
export const DEFAULT_BOUNDARIES: ArchitectureBoundary[] = [
  {
    name: "client",
    glob: "client/**",
    allowedDependencies: ["client/**", "shared/**", "@/*"],
    forbiddenDependencies: ["server/**"],
    description: "Client code should not import server code"
  },
  {
    name: "server",
    glob: "server/**",
    allowedDependencies: ["server/**", "shared/**", "@/*"],
    forbiddenDependencies: ["client/**"],
    description: "Server code should not import client code"
  },
  {
    name: "components",
    glob: "**/components/**",
    allowedDependencies: ["**/components/**", "**/lib/**", "**/hooks/**", "**/utils/**"],
    forbiddenDependencies: ["**/pages/**", "**/app/**", "**/routes/**"],
    description: "Components should not import page-level code"
  },
  {
    name: "hooks",
    glob: "**/hooks/**",
    allowedDependencies: ["**/hooks/**", "**/lib/**", "**/utils/**", "**/store/**"],
    forbiddenDependencies: ["**/components/**", "**/pages/**"],
    description: "Hooks should not import components"
  },
  {
    name: "utils",
    glob: "**/utils/**",
    allowedDependencies: ["**/utils/**"],
    forbiddenDependencies: ["**/components/**", "**/hooks/**", "**/pages/**", "**/routes/**"],
    description: "Utils should be pure and not import domain code"
  },
  {
    name: "db",
    glob: "**/db/**",
    allowedDependencies: ["**/db/**", "**/lib/**"],
    forbiddenDependencies: ["**/routes/**", "**/components/**", "**/hooks/**"],
    description: "Database layer should not know about routes or UI"
  }
];

export function checkArchitectureBoundaries(
  graph: Graph,
  config: ArchitectureConfig = { boundaries: DEFAULT_BOUNDARIES }
): ArchitectureReport {
  const violations: ArchitectureViolation[] = [];
  const violationsByBoundary: Record<string, number> = {};

  for (const boundary of config.boundaries) {
    violationsByBoundary[boundary.name] = 0;
    
    // Find files matching this boundary
    const boundaryFiles = graph.nodes.filter(node => matchGlob(node, boundary.glob));
    
    for (const file of boundaryFiles) {
      // Get imports for this file
      const imports = graph.edges
        .filter(e => e.from === file)
        .map(e => e.to);
      
      for (const imp of imports) {
        // Skip external modules
        if (!imp.startsWith(".") && !imp.startsWith("/") && !graph.nodes.includes(imp)) {
          continue;
        }

        // Check forbidden dependencies
        for (const forbidden of boundary.forbiddenDependencies) {
          if (matchGlob(imp, forbidden)) {
            violations.push({
              file,
              boundary: boundary.name,
              violation: "forbidden_import",
              importedFrom: imp,
              message: `${file} imports ${imp} which violates ${boundary.name} boundary: ${boundary.description || ""}`
            });
            violationsByBoundary[boundary.name]++;
          }
        }
      }
    }
  }

  const cleanBoundaries = Object.entries(violationsByBoundary)
    .filter(([_, count]) => count === 0)
    .map(([name]) => name);

  return {
    violations,
    summary: {
      totalViolations: violations.length,
      byBoundary: violationsByBoundary,
      cleanBoundaries
    }
  };
}

function matchGlob(str: string, glob: string): boolean {
  const normalizedStr = str.replace(/\\/g, "/");
  const normalizedGlob = glob.replace(/\\/g, "/");
  
  const re = new RegExp("^" + normalizedGlob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".") + "$");
  
  return re.test(normalizedStr);
}

export function suggestBoundaryFix(violation: ArchitectureViolation): string {
  switch (violation.violation) {
    case "forbidden_import":
      return `Move shared code to a shared/ directory, or refactor to remove the dependency from ${violation.file} to ${violation.importedFrom}`;
    default:
      return "Review the architecture boundaries configuration";
  }
}
