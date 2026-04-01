/**
 * Export Routes
 * 
 * API endpoints for exporting data in various formats
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { exportService, ExportOptions } from '../services/export-service';
import { authMiddleware } from '../middleware/fastify-auth';
import { requirePlan } from '../middleware/plan-gating';
import { logger } from '../logger';
import { toErrorMessage, getErrorStack } from "../utils/toErrorMessage";

// Request schemas
const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json', 'pdf']).default('csv'),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(10000).default(1000),
});

const FindingsExportSchema = ExportQuerySchema.extend({
  runId: z.string().optional(),
});

export async function exportsRoutes(fastify: FastifyInstance) {
  // All export routes require authentication
  fastify.addHook('preHandler', authMiddleware);

  /**
   * GET /api/exports/runs - Export runs data
   */
  fastify.get(
    '/runs',
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: 'Data Export' }),
      schema: {
        description: 'Export runs data in CSV or JSON format',
        tags: ['Exports'],
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'json'] },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            limit: { type: 'number' },
          },
        },
        response: {
          200: {
            type: 'string',
            description: 'Exported data',
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const query = ExportQuerySchema.parse(request.query);

        const options: ExportOptions = {
          format: query.format,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          userId: user.id,
          limit: query.limit,
        };

        const result = await exportService.exportRuns(options);

        logger.info({
          userId: user.id,
          format: query.format,
          recordCount: result.recordCount,
        }, 'Runs exported');

        return reply
          .header('Content-Type', result.mimeType)
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.data);
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Export runs failed');
        return reply.status(500).send({ error: 'Export failed' });
      }
    }
  );

  /**
   * GET /api/exports/findings - Export findings data
   */
  fastify.get(
    '/findings',
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: 'Data Export' }),
      schema: {
        description: 'Export findings data in CSV or JSON format',
        tags: ['Exports'],
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'json'] },
            runId: { type: 'string' },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const query = FindingsExportSchema.parse(request.query);

        const options: ExportOptions & { runId?: string } = {
          format: query.format,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          userId: user.id,
          limit: query.limit,
          runId: query.runId,
        };

        const result = await exportService.exportFindings(options);

        logger.info({
          userId: user.id,
          format: query.format,
          recordCount: result.recordCount,
        }, 'Findings exported');

        return reply
          .header('Content-Type', result.mimeType)
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.data);
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Export findings failed');
        return reply.status(500).send({ error: 'Export failed' });
      }
    }
  );

  /**
   * GET /api/exports/audit-logs - Export security events / audit logs
   */
  fastify.get(
    '/audit-logs',
    {
      preHandler: requirePlan({ minTierLevel: 2, featureName: 'Audit Log Export' }),
      schema: {
        description: 'Export security audit logs in CSV or JSON format',
        tags: ['Exports'],
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'json'] },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const query = ExportQuerySchema.parse(request.query);

        const options: ExportOptions = {
          format: query.format,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          userId: user.id,
          limit: query.limit,
        };

        const result = await exportService.exportAuditLogs(options);

        logger.info({
          userId: user.id,
          format: query.format,
          recordCount: result.recordCount,
        }, 'Audit logs exported');

        return reply
          .header('Content-Type', result.mimeType)
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.data);
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Export audit logs failed');
        return reply.status(500).send({ error: 'Export failed' });
      }
    }
  );

  /**
   * GET /api/exports/billing - Export billing history
   */
  fastify.get(
    '/billing',
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: 'Billing Export' }),
      schema: {
        description: 'Export billing history in CSV or JSON format',
        tags: ['Exports'],
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'json'] },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const query = ExportQuerySchema.parse(request.query);

        const options: ExportOptions = {
          format: query.format,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          userId: user.id,
          limit: query.limit,
        };

        const result = await exportService.exportBillingHistory(options);

        logger.info({
          userId: user.id,
          format: query.format,
          recordCount: result.recordCount,
        }, 'Billing history exported');

        return reply
          .header('Content-Type', result.mimeType)
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.data);
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Export billing history failed');
        return reply.status(500).send({ error: 'Export failed' });
      }
    }
  );

  /**
   * GET /api/exports/usage - Export usage records
   */
  fastify.get(
    '/usage',
    {
      preHandler: requirePlan({ minTierLevel: 1, featureName: 'Usage Export' }),
      schema: {
        description: 'Export usage records in CSV or JSON format',
        tags: ['Exports'],
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'json'] },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            limit: { type: 'number' },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const user = (request as any).user;
        const query = ExportQuerySchema.parse(request.query);

        const options: ExportOptions = {
          format: query.format,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          userId: user.id,
          limit: query.limit,
        };

        const result = await exportService.exportUsageRecords(options);

        logger.info({
          userId: user.id,
          format: query.format,
          recordCount: result.recordCount,
        }, 'Usage records exported');

        return reply
          .header('Content-Type', result.mimeType)
          .header('Content-Disposition', `attachment; filename="${result.filename}"`)
          .send(result.data);
      } catch (error: unknown) {
        logger.error({ error: toErrorMessage(error) }, 'Export usage records failed');
        return reply.status(500).send({ error: 'Export failed' });
      }
    }
  );
}
