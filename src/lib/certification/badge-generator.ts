/**
 * guardrail Certified Badge Generator
 *
 * Creates verifiable badges that link back to guardrail.dev
 * Each badge creates a backlink = SEO fuel
 */

export interface CertificationResult {
  certified: boolean;
  score: number;
  grade: string;
  timestamp: string;
  expiresAt: string;
  projectId: string;
  verifyUrl: string;
  badges: {
    svg: string;
    markdown: string;
    html: string;
    json: string;
  };
}

export interface BadgeOptions {
  style?: "flat" | "flat-square" | "plastic";
  label?: string;
  logoColor?: string;
}

/**
 * Generate certification badge in multiple formats
 */
export function generateCertificationBadge(
  score: number,
  projectId: string,
  options: BadgeOptions = {},
): CertificationResult {
  const { style = "flat", label = "guardrail" } = options;

  const certified = score >= 70;
  const grade = getGrade(score);
  const timestamp = new Date().toISOString();
  const expiresAt = new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString(); // 30 days
  const verifyUrl = `https://guardrail.dev/verify/${projectId}`;

  // Color based on score
  const color =
    score >= 80
      ? "4ade80"
      : score >= 70
        ? "facc15"
        : score >= 50
          ? "fb923c"
          : "f87171";
  const statusText = certified ? `${score}/100 certified` : `${score}/100`;

  // SVG Badge
  const svg = generateSVGBadge(label, statusText, color, style);

  // Markdown format (for README.md)
  const markdown = `[![guardrail Certified](${verifyUrl}/badge.svg)](${verifyUrl})`;

  // HTML format (for websites)
  const html = `<a href="${verifyUrl}"><img src="${verifyUrl}/badge.svg" alt="guardrail Certified: ${score}/100" /></a>`;

  // JSON format (for APIs and programmatic verification)
  const json = JSON.stringify(
    {
      certified,
      score,
      grade,
      projectId,
      verifyUrl,
      timestamp,
      expiresAt,
    },
    null,
    2,
  );

  return {
    certified,
    score,
    grade,
    timestamp,
    expiresAt,
    projectId,
    verifyUrl,
    badges: { svg, markdown, html, json },
  };
}

/**
 * Generate SVG badge similar to shields.io style
 */
function generateSVGBadge(
  label: string,
  status: string,
  color: string,
  style: string,
): string {
  const labelWidth = label.length * 6.5 + 10;
  const statusWidth = status.length * 6.5 + 10;
  const totalWidth = labelWidth + statusWidth;

  const borderRadius =
    style === "flat-square" ? 0 : style === "plastic" ? 4 : 3;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${status}">
  <title>${label}: ${status}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="${borderRadius}" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="#${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + statusWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${status}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${status}</text>
  </g>
  <!-- Verify at ${`https://guardrail.dev/verify`} -->
</svg>`;
}

/**
 * Get letter grade from score
 */
function getGrade(score: number): string {
  if (score >= 95) return "A+";
  if (score >= 90) return "A";
  if (score >= 85) return "A-";
  if (score >= 80) return "B+";
  if (score >= 75) return "B";
  if (score >= 70) return "B-";
  if (score >= 65) return "C+";
  if (score >= 60) return "C";
  if (score >= 55) return "C-";
  if (score >= 50) return "D";
  return "F";
}

/**
 * Generate project ID from repo info
 */
export function generateProjectId(repoUrl: string): string {
  // Extract org/repo from URL
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (match) {
    const [, org, repo] = match;
    const hash = simpleHash(`${org}/${repo}`).toString(16).slice(0, 8);
    return `${org}-${repo}-${hash}`;
  }

  // Fallback: use timestamp-based ID
  return `proj-${Date.now().toString(36)}`;
}

/**
 * Simple hash function for project IDs
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Validate certification by project ID
 */
export async function validateCertification(projectId: string): Promise<{
  valid: boolean;
  certification?: CertificationResult;
  error?: string;
}> {
  // In production, this would check a database
  // For now, return validation structure
  return {
    valid: false,
    error: "Certification not found. Run `guardrail certify` to generate.",
  };
}

/**
 * Generate certification data file for embedding in repo
 */
export function generateCertificationFile(result: CertificationResult): string {
  return JSON.stringify(
    {
      $schema: "https://guardrail.dev/schemas/certification.json",
      version: "1.0.0",
      certified: result.certified,
      score: result.score,
      grade: result.grade,
      timestamp: result.timestamp,
      expiresAt: result.expiresAt,
      projectId: result.projectId,
      verifyUrl: result.verifyUrl,
    },
    null,
    2,
  );
}
