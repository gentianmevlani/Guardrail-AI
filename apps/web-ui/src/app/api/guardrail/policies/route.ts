/**
 * API Route: Policies
 * Read/Write guardrail.config.json
 */
import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const DEFAULT_POLICIES = {
  strictness: "dev",
  boundaries: [
    { id: "1", name: "Client/Server", from: "client/**", to: "server/**", allowed: false },
    { id: "2", name: "Components/Pages", from: "components/**", to: "pages/**", allowed: false },
    { id: "3", name: "Utils Pure", from: "utils/**", to: "components/**", allowed: false },
  ],
  allowedDeps: [],
  blockedDeps: [],
};

export async function GET() {
  const repoPath = process.env.GUARDRAIL_REPO_PATH || process.cwd();
  const configPath = path.join(repoPath, "guardrail.config.json");

  if (!fs.existsSync(configPath)) {
    return NextResponse.json(DEFAULT_POLICIES);
  }

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);
    return NextResponse.json({ ...DEFAULT_POLICIES, ...config });
  } catch (error: any) {
    return NextResponse.json(DEFAULT_POLICIES);
  }
}

export async function POST(request: NextRequest) {
  const repoPath = process.env.GUARDRAIL_REPO_PATH || process.cwd();
  const configPath = path.join(repoPath, "guardrail.config.json");

  try {
    const body = await request.json();
    
    // Validate
    const errors = validatePolicies(body);
    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }

    fs.writeFileSync(configPath, JSON.stringify(body, null, 2), "utf-8");
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function validatePolicies(config: any): string[] {
  const errors: string[] = [];
  
  if (config.strictness && !["dev", "pre-merge", "pre-deploy"].includes(config.strictness)) {
    errors.push("Invalid strictness level");
  }
  
  if (config.boundaries) {
    for (const b of config.boundaries) {
      if (!b.from || !b.to) {
        errors.push(`Boundary "${b.name || b.id}" missing from/to pattern`);
      }
    }
  }
  
  return errors;
}
