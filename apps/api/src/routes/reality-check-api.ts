import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import path from "path";
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

interface RunRequest {
  projectPath: string;
  mode?: "full" | "quick";
}

interface PdfRequest {
  projectPath: string;
  result: any;
  findings?: unknown;
}

export default async function realityCheckApiRoutes(fastify: FastifyInstance) {
  // Run reality check
  fastify.post(
    "/run",
    async (
      request: FastifyRequest<{ Body: RunRequest }>,
      reply: FastifyReply,
    ) => {
      try {
        const { projectPath, mode = "full" } = request.body;

        if (!projectPath) {
          return reply.status(400).send({
            success: false,
            error: "Project path is required",
          });
        }

        // Import the production integrity audit
        const {
          auditProductionIntegrity,
        } = require("../../../../scripts/audit-production-integrity.js");

        const { results, integrity } =
          await auditProductionIntegrity(projectPath);

        // Build summary for frontend
        const summary = {
          score: integrity.score,
          grade: integrity.grade,
          canShip: integrity.canShip,
          verdict: integrity.canShip ? "SHIP" : "NO_SHIP",
          counts: {
            api: {
              connected: results.api?.summary?.connected || 0,
              missing: results.api?.summary?.missingBackend || 0,
            },
            auth: {
              protected: results.auth?.analysis?.protected?.length || 0,
              exposed:
                (results.auth?.analysis?.adminExposed?.length || 0) +
                (results.auth?.analysis?.sensitiveUnprotected?.length || 0),
            },
            secrets: {
              critical:
                results.env?.secrets?.filter(
                  (s: any) => s.severity === "critical",
                ).length || 0,
            },
            routes: {
              deadLinks: results.routes?.integrity?.deadLinks?.length || 0,
            },
            mocks: {
              critical: (results.mocks?.issues || []).filter(
                (i: any) => i.severity === "critical",
              ).length,
              high: (results.mocks?.issues || []).filter(
                (i: any) => i.severity === "high",
              ).length,
            },
          },
          deductions: integrity.deductions,
          timestamp: new Date().toISOString(),
        };

        // Build detailed findings
        const findings = {
          missingApis: (results.api?.missing || [])
            .slice(0, 50)
            .map((m: any) => ({
              method: m.method,
              path: m.path,
              file: m.file,
            })),
          exposedEndpoints: [
            ...(results.auth?.analysis?.adminExposed || []),
            ...(results.auth?.analysis?.sensitiveUnprotected || []),
          ]
            .slice(0, 20)
            .map((e: any) => ({
              method: e.method,
              path: e.fullApiPath || e.path,
              file: e.file,
            })),
          hardcodedSecrets: (results.env?.secrets || [])
            .filter(
              (s: any) => s.severity === "critical" || s.severity === "high",
            )
            .slice(0, 20)
            .map((s: any) => ({
              type: s.type,
              file: s.file,
              line: s.line,
            })),
          deadLinks: Object.entries(
            (results.routes?.integrity?.deadLinks || []).reduce(
              (acc: any, link: any) => {
                if (!acc[link.href]) acc[link.href] = 0;
                acc[link.href]++;
                return acc;
              },
              {},
            ),
          ).map(([href, count]) => ({ href, count })),
          mockCode: [
            ...(results.mocks?.issues || []),
            ...(results.mocks?.packageIssues || []),
          ]
            .filter(
              (i: any) => i.severity === "critical" || i.severity === "high",
            )
            .slice(0, 30)
            .map((m: any) => ({
              name: m.name,
              file: m.file,
              severity: m.severity,
            })),
          todos: (results.routes?.placeholders || [])
            .filter((p: any) => p.type === "todo")
            .slice(0, 20)
            .map((t: any) => ({
              file: t.file,
              line: t.line,
              context: t.context,
            })),
          consoleLogs: (results.mocks?.issues || []).filter(
            (i: any) => i.name === "console.log",
          ).length,
          envVars: results.env?.envExample?.variables?.length || 0,
        };

        return reply.send({
          success: true,
          summary,
          findings,
        });
      } catch (error: unknown) {
        request.log.error({ error: toErrorMessage(error) }, "Reality check failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "Reality check failed",
        });
      }
    },
  );

  // Generate PDF report
  fastify.post(
    "/pdf",
    async (
      request: FastifyRequest<{ Body: PdfRequest }>,
      reply: FastifyReply,
    ) => {
      try {
        const { projectPath, result, findings } = request.body;

        if (!result) {
          return reply.status(400).send({
            success: false,
            error: "Result data is required",
          });
        }

        const {
          generatePdfHtml,
        } = require("../../../../scripts/generate-reality-check-pdf.js");

        const html = generatePdfHtml({
          projectPath: projectPath || "Unknown Project",
          result,
          findings,
          timestamp: new Date().toISOString(),
        });

        // Try to generate PDF with puppeteer
        try {
          const puppeteer = require("puppeteer");
          const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
          });
          const page = await browser.newPage();

          await page.setContent(html, { waitUntil: "networkidle0" });

          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
              top: "20px",
              right: "20px",
              bottom: "20px",
              left: "20px",
            },
          });

          await browser.close();

          reply.header("Content-Type", "application/pdf");
          reply.header(
            "Content-Disposition",
            `attachment; filename="reality-check-${new Date().toISOString().split("T")[0]}.pdf"`,
          );

          return reply.send(Buffer.from(pdfBuffer));
        } catch (puppeteerError: any) {
          // Puppeteer not available, return HTML
          request.log.warn("Puppeteer not available, returning HTML");

          reply.header("Content-Type", "text/html");
          reply.header(
            "Content-Disposition",
            `attachment; filename="reality-check-${new Date().toISOString().split("T")[0]}.html"`,
          );

          return reply.send(html);
        }
      } catch (error: unknown) {
        request.log.error({ error: toErrorMessage(error) }, "PDF generation failed");
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error) || "PDF generation failed",
        });
      }
    },
  );

  // Get latest report (if cached)
  fastify.get(
    "/latest",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Return cached report if available
        return reply.send({
          success: true,
          message: "No cached report available. Run a new reality check.",
        });
      } catch (error: unknown) {
        return reply.status(500).send({
          success: false,
          error: toErrorMessage(error),
        });
      }
    },
  );
}
