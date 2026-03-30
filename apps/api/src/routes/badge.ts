/**
 * Dynamic Badge API - World-Class SVG Badge Generation
 *
 * Shields.io-quality badges with Guardrail branding.
 * GET /api/badge/:org/:repo.svg → SVG badge
 * GET /api/badge/:org/:repo.json → Shields.io-compatible JSON
 * GET /api/badge/test.svg?v=SHIP&s=92 → Test badge
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import * as fs from 'fs';
import * as path from 'path';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface BadgeRequest {
  org: string;
  repo: string;
}

interface ProjectBadgeData {
  verdict: 'SHIP' | 'NO-SHIP' | 'REVIEW';
  score: number;
  grade: string;
  timestamp: string;
  scans: Array<{
    name: string;
    status: string;
    score: number;
  }>;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;"
  }[c]!));
}

/**
 * Measure text width using character-class approximation.
 * Far more accurate than `length * 7` for proportional fonts.
 */
function measureText(text: string): number {
  let width = 0;
  for (const ch of text) {
    if ('lij|!:;.,\''.includes(ch)) width += 3.5;
    else if ('ft(){}[]'.includes(ch)) width += 4.5;
    else if ('rI1 '.includes(ch)) width += 5;
    else if ('MWm%@'.includes(ch)) width += 8.5;
    else if (ch >= 'A' && ch <= 'Z') width += 7;
    else width += 6;
  }
  return width;
}

/**
 * Generate a shields.io-quality SVG badge with Guardrail logo.
 */
function generateBadgeSvg(
  label: string,
  message: string,
  color: string,
  options: { style?: 'flat' | 'flat-square'; logo?: boolean } = {}
): string {
  const { style = 'flat', logo = true } = options;
  const left = escapeXml(label);
  const right = escapeXml(message);

  const logoWidth = logo ? 14 : 0;
  const logoGap = logo ? 4 : 0;
  const hPad = 8;

  const leftTextW = measureText(label);
  const rightTextW = measureText(message);

  const leftW = Math.round(leftTextW + logoWidth + logoGap + hPad * 2);
  const rightW = Math.round(rightTextW + hPad * 2);
  const totalW = leftW + rightW;
  const h = 20;

  const leftCenter = Math.round((leftW + logoWidth + logoGap) / 2);
  const rightCenter = Math.round(leftW + rightW / 2);

  // Guardrail shield logo (simplified SVG path)
  const logoSvg = logo ? `
  <g transform="translate(${hPad}, 3)" fill="#fff" opacity="0.9">
    <path d="M6 0L0 3v5c0 3.5 2.5 6.5 6 8 3.5-1.5 6-4.5 6-8V3L6 0zm0 1.5l4.5 2.3v4.2c0 2.8-2 5.2-4.5 6.5-2.5-1.3-4.5-3.7-4.5-6.5V3.8L6 1.5z" fill-rule="evenodd"/>
    <path d="M5 7.5l-1.5-1.5-.7.7L5 8.9l3.2-3.2-.7-.7z"/>
  </g>` : '';

  const radius = style === 'flat-square' ? '0' : '3';
  const gradient = style === 'flat' ? `
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>` : '';
  const gradientFill = style === 'flat' ? `<rect width="${totalW}" height="${h}" rx="${radius}" fill="url(#s)"/>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalW}" height="${h}" role="img" aria-label="${left}: ${right}">
  <title>${left}: ${right}</title>${gradient}
  <clipPath id="r"><rect width="${totalW}" height="${h}" rx="${radius}" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftW}" height="${h}" fill="#555"/>
    <rect x="${leftW}" width="${rightW}" height="${h}" fill="${color}"/>
    ${gradientFill}
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">${logoSvg}
    <text aria-hidden="true" x="${leftCenter}" y="15" fill="#010101" fill-opacity=".3">${left}</text>
    <text x="${leftCenter}" y="14" fill="#fff">${left}</text>
    <text aria-hidden="true" x="${rightCenter}" y="15" fill="#010101" fill-opacity=".3">${right}</text>
    <text x="${rightCenter}" y="14" fill="#fff">${right}</text>
  </g>
</svg>`;
}

/** Color palette matching Guardrail brand */
function getBadgeColor(verdict: string, score?: number): string {
  if (score !== undefined) {
    if (score >= 95) return '#44cc11'; // bright green
    if (score >= 85) return '#2ea44f'; // green
    if (score >= 70) return '#dfb317'; // yellow
    if (score >= 55) return '#fe7d37'; // orange
    return '#e05d44'; // red
  }
  switch (verdict) {
    case 'SHIP': return '#2ea44f';
    case 'NO-SHIP': return '#e05d44';
    case 'REVIEW': return '#dfb317';
    default: return '#9f9f9f';
  }
}

function gradeFromScore(n: number): string {
  if (n >= 95) return 'A';
  if (n >= 85) return 'B';
  if (n >= 70) return 'C';
  if (n >= 55) return 'D';
  return 'F';
}

function getProjectBadgeData(org: string, repo: string): ProjectBadgeData | null {
  const possiblePaths = [
    path.join(process.cwd(), '.guardrail', 'pro-ship', 'latest-pro-ship.json'),
    path.join(process.cwd(), 'projects', org, repo, '.guardrail', 'pro-ship', 'latest-pro-ship.json'),
    path.join(process.cwd(), 'repos', org, repo, '.guardrail', 'pro-ship', 'latest-pro-ship.json'),
  ];

  for (const dataPath of possiblePaths) {
    try {
      if (fs.existsSync(dataPath)) {
        const content = fs.readFileSync(dataPath, 'utf-8');
        const data = JSON.parse(content);
        const score = data.overallScore ?? data.score ?? 0;
        return {
          verdict: data.verdict,
          score,
          grade: gradeFromScore(score),
          timestamp: data.timestamp,
          scans: data.scans?.map((s: any) => ({
            name: s.name,
            status: s.status,
            score: s.score
          })) || []
        };
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

export async function badgeRoutes(fastify: FastifyInstance) {
  /**
   * SVG Badge Endpoint
   * GET /api/badge/:org/:repo.svg
   *
   * Query params:
   *   style=flat|flat-square
   *   logo=true|false
   *   label=custom-label
   */
  fastify.get(
    "/badge/:org/:repo.svg",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as BadgeRequest;
        const { org, repo } = params;
        const query = request.query as { style?: string; logo?: string; label?: string };

        const style = (query.style === 'flat-square' ? 'flat-square' : 'flat') as 'flat' | 'flat-square';
        const logo = query.logo !== 'false';
        const label = query.label || 'guardrail';

        // Try database first, fall back to file system
        let projectData: ProjectBadgeData | null = null;

        const prisma = (fastify as any).prisma;
        if (prisma) {
          try {
            const scan = await prisma.scan.findFirst({
              where: {
                OR: [
                  { repository: { fullName: `${org}/${repo}` } },
                  { project: { name: repo, user: { username: org } } },
                ],
              },
              orderBy: { completedAt: 'desc' },
              select: { verdict: true, score: true, completedAt: true, issuesFound: true },
            });

            if (scan) {
              projectData = {
                verdict: scan.verdict as 'SHIP' | 'NO-SHIP' | 'REVIEW',
                score: scan.score ?? 0,
                grade: gradeFromScore(scan.score ?? 0),
                timestamp: scan.completedAt?.toISOString() ?? new Date().toISOString(),
                scans: [],
              };
            }
          } catch {
            // DB not available, fall through to file-based lookup
          }
        }

        if (!projectData) {
          projectData = getProjectBadgeData(org, repo);
        }

        if (!projectData) {
          const svg = generateBadgeSvg(label, "no data", "#9f9f9f", { style, logo });
          reply.header("Content-Type", "image/svg+xml; charset=utf-8");
          reply.header("Cache-Control", "public, max-age=60, s-maxage=60");
          return reply.send(svg);
        }

        const color = getBadgeColor(projectData.verdict, projectData.score);
        const message = `${projectData.verdict} ${projectData.score} (${projectData.grade})`;
        const svg = generateBadgeSvg(label, message, color, { style, logo });

        reply.header("Content-Type", "image/svg+xml; charset=utf-8");
        reply.header("Cache-Control", "public, max-age=300, s-maxage=300");
        reply.header("ETag", `"${org}-${repo}-${projectData.score}-${projectData.verdict}"`);
        return reply.send(svg);
      } catch (error: unknown) {
        fastify.log.error({ msg: "Badge SVG error", error: toErrorMessage(error) });
        const errorSvg = generateBadgeSvg("guardrail", "error", "#e05d44");
        reply.header("Content-Type", "image/svg+xml; charset=utf-8");
        return reply.status(500).send(errorSvg);
      }
    }
  );

  /**
   * Shields.io-compatible JSON endpoint
   * GET /api/badge/:org/:repo.json
   *
   * Returns Shields.io endpoint schema so you can also use:
   * ![](https://img.shields.io/endpoint?url=https://guardrail.dev/api/badge/org/repo.json)
   */
  fastify.get(
    "/badge/:org/:repo.json",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as BadgeRequest;
        const { org, repo } = params;

        let projectData: ProjectBadgeData | null = null;

        const prisma = (fastify as any).prisma;
        if (prisma) {
          try {
            const scan = await prisma.scan.findFirst({
              where: {
                OR: [
                  { repository: { fullName: `${org}/${repo}` } },
                  { project: { name: repo, user: { username: org } } },
                ],
              },
              orderBy: { completedAt: 'desc' },
              select: { verdict: true, score: true, completedAt: true, issuesFound: true },
            });

            if (scan) {
              projectData = {
                verdict: scan.verdict as 'SHIP' | 'NO-SHIP' | 'REVIEW',
                score: scan.score ?? 0,
                grade: gradeFromScore(scan.score ?? 0),
                timestamp: scan.completedAt?.toISOString() ?? new Date().toISOString(),
                scans: [],
              };
            }
          } catch {
            // fall through
          }
        }

        if (!projectData) {
          projectData = getProjectBadgeData(org, repo);
        }

        if (!projectData) {
          return reply.status(404).send({
            schemaVersion: 1,
            label: "guardrail",
            message: "no data",
            color: "inactive",
            isError: true,
          });
        }

        const baseUrl = process.env.API_BASE_URL || 'https://guardrail.dev';

        // Shields.io-compatible response + extra metadata
        reply.header("Cache-Control", "public, max-age=300, s-maxage=300");
        return reply.send({
          // Shields.io endpoint schema
          schemaVersion: 1,
          label: "guardrail",
          message: `${projectData.verdict} ${projectData.score}`,
          color: getBadgeColor(projectData.verdict, projectData.score).replace('#', ''),

          // Extended metadata
          org,
          repo,
          verdict: projectData.verdict,
          score: projectData.score,
          grade: projectData.grade,
          timestamp: projectData.timestamp,
          scans: projectData.scans,

          // Embed helpers
          badgeUrl: `${baseUrl}/api/badge/${org}/${repo}.svg`,
          reportUrl: `${baseUrl}/report/${org}/${repo}`,
          shieldsUrl: `https://img.shields.io/endpoint?url=${encodeURIComponent(`${baseUrl}/api/badge/${org}/${repo}.json`)}`,
          embedMarkdown: `[![Guardrail Score](${baseUrl}/api/badge/${org}/${repo}.svg)](${baseUrl}/report/${org}/${repo})`,
          embedHtml: `<a href="${baseUrl}/report/${org}/${repo}"><img src="${baseUrl}/api/badge/${org}/${repo}.svg" alt="Guardrail Score"></a>`,
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Badge JSON error", error: toErrorMessage(error) });
        return reply.status(500).send({
          schemaVersion: 1,
          label: "guardrail",
          message: "error",
          color: "critical",
          isError: true,
        });
      }
    }
  );

  /**
   * Test badge endpoint
   * GET /api/badge/test.svg?v=SHIP&s=92&style=flat
   */
  fastify.get(
    "/badge/test.svg",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as { v?: string; s?: string; style?: string; logo?: string };
        const verdict = (query.v || "SHIP").toUpperCase();
        const score = parseInt(query.s || "92", 10);
        const style = (query.style === 'flat-square' ? 'flat-square' : 'flat') as 'flat' | 'flat-square';
        const logo = query.logo !== 'false';

        const color = getBadgeColor(verdict, isNaN(score) ? undefined : score);
        const grade = isNaN(score) ? '' : ` (${gradeFromScore(score)})`;
        const message = score ? `${verdict} ${score}${grade}` : verdict;
        const svg = generateBadgeSvg("guardrail", message, color, { style, logo });

        reply.header("Content-Type", "image/svg+xml; charset=utf-8");
        reply.header("Cache-Control", "no-cache");
        return reply.send(svg);
      } catch (error: unknown) {
        fastify.log.error({ msg: "Test badge error", error: toErrorMessage(error) });
        const errorSvg = generateBadgeSvg("guardrail", "error", "#e05d44");
        reply.header("Content-Type", "image/svg+xml; charset=utf-8");
        return reply.status(500).send(errorSvg);
      }
    }
  );

  /**
   * Report endpoint - detailed scan results page data
   * GET /report/:org/:repo
   */
  fastify.get(
    "/report/:org/:repo",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const params = request.params as BadgeRequest;
        const { org, repo } = params;

        const projectData = getProjectBadgeData(org, repo);

        if (!projectData) {
          return reply.status(404).send({
            error: "No scan data found",
            org,
            repo,
            message: "Run 'guardrail scan' to generate scan data"
          });
        }

        const baseUrl = process.env.API_BASE_URL || 'https://guardrail.dev';

        return reply.send({
          org,
          repo,
          ...projectData,
          reportGenerated: new Date().toISOString(),
          badge: {
            svg: `${baseUrl}/api/badge/${org}/${repo}.svg`,
            json: `${baseUrl}/api/badge/${org}/${repo}.json`,
            markdown: `[![Guardrail Score](${baseUrl}/api/badge/${org}/${repo}.svg)](${baseUrl}/report/${org}/${repo})`,
          },
        });
      } catch (error: unknown) {
        fastify.log.error({ msg: "Report error", error: toErrorMessage(error) });
        return reply.status(500).send({
          error: "Failed to generate report",
          message: toErrorMessage(error)
        });
      }
    }
  );
}
