import { NextRequest, NextResponse } from "next/server";

/**
 * Dynamic SVG badge generator for certification verification
 *
 * Returns an SVG badge that can be embedded in READMEs
 * Each badge creates a backlink = SEO fuel
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const projectId = params.projectId;

  // In production, fetch from database
  // For now, generate deterministic data from projectId
  const certification = await getCertification(projectId);

  const svg = generateBadgeSVG(certification.score, certification.certified);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600", // Cache for 1 hour
    },
  });
}

async function getCertification(projectId: string) {
  // Generate deterministic score from projectId
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash << 5) - hash + projectId.charCodeAt(i);
    hash = hash & hash;
  }
  const score = 70 + (Math.abs(hash) % 30);

  return {
    certified: score >= 70,
    score,
  };
}

function generateBadgeSVG(score: number, certified: boolean): string {
  const label = "guardrail";
  const statusText = certified ? `${score}/100 certified` : `${score}/100`;
  const color =
    score >= 80
      ? "4ade80"
      : score >= 70
        ? "facc15"
        : score >= 50
          ? "fb923c"
          : "f87171";

  const labelWidth = label.length * 6.5 + 10;
  const statusWidth = statusText.length * 6.5 + 10;
  const totalWidth = labelWidth + statusWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${statusText}">
  <title>${label}: ${statusText}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${statusWidth}" height="20" fill="#${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${label}</text>
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text aria-hidden="true" x="${labelWidth + statusWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${statusText}</text>
    <text x="${labelWidth + statusWidth / 2}" y="14">${statusText}</text>
  </g>
</svg>`;
}
