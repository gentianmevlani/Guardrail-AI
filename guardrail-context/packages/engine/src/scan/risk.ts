import type { RiskMap, RiskTag } from "@guardrail-context/shared";

export function scanRisk(filesRel: string[]): RiskMap {
  const out: RiskMap = {};
  
  for (const f of filesRel) {
    const tags: RiskTag[] = [];
    const lf = f.toLowerCase();

    // Auth/session/security
    if (lf.includes("auth") || lf.includes("session") || lf.includes("jwt") || 
        lf.includes("login") || lf.includes("permission") || lf.includes("role")) {
      tags.push("auth");
    }
    
    // Payments/billing
    if (lf.includes("stripe") || lf.includes("billing") || lf.includes("payment") ||
        lf.includes("subscription") || lf.includes("checkout")) {
      tags.push("payments");
    }
    
    // Database/schema
    if (lf.includes("prisma") || lf.includes("migration") || lf.includes("schema") || 
        lf.includes("db") || lf.includes("drizzle") || lf.includes("database")) {
      tags.push("db");
    }
    
    // Infrastructure
    if (lf.includes("docker") || lf.includes("k8") || lf.includes("terraform") || 
        lf.includes("infra") || lf.includes("deploy") || lf.includes("ci")) {
      tags.push("infra");
    }
    
    // Security
    if (lf.includes("security") || lf.includes("crypto") || lf.includes("encrypt") ||
        lf.includes("secret") || lf.includes("credential") || lf.includes("password")) {
      tags.push("security");
    }
    
    // Core/critical
    if (lf.includes("core") || lf.includes("server") || lf.includes("api") ||
        lf.includes("middleware") || lf.includes("config") || lf.includes("index.ts")) {
      tags.push("core");
    }

    const score = Math.min(1, tags.length * 0.25);
    if (tags.length > 0 || score > 0) {
      out[f] = { tags, score };
    }
  }
  
  return out;
}

export function getHighRiskFiles(risk: RiskMap, threshold = 0.5): string[] {
  return Object.entries(risk)
    .filter(([_, r]) => r.score >= threshold)
    .map(([f, _]) => f);
}

export function getFilesByTag(risk: RiskMap, tag: RiskTag): string[] {
  return Object.entries(risk)
    .filter(([_, r]) => r.tags.includes(tag))
    .map(([f, _]) => f);
}
