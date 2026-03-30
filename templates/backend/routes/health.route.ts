/**
 * Health Check Endpoint
 * 
 * Essential health check that AI agents often miss
 * Used by monitoring, load balancers, and deployment systems
 */

import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../utils/database.util';
import { sendSuccess, sendError } from '../utils/response.util';

const router = Router();

/**
 * Basic health check
 */
router.get('/health', async (req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Detailed health check with dependencies
 */
router.get('/health/check', async (req: Request, res: Response) => {
  const checks: Record<string, boolean> = {
    api: true,
    database: false,
  };

  // Check database
  try {
    checks.database = await checkDatabaseHealth();
  } catch (error) {
    checks.database = false;
  }

  const allHealthy = Object.values(checks).every((check) => check);

  if (allHealthy) {
    return sendSuccess(res, {
      status: 'healthy',
      checks,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  return sendError(res, 'Service unhealthy', 503);
});

/**
 * Readiness probe (for Kubernetes)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealthy = await checkDatabaseHealth();
    
    if (!dbHealthy) {
      return sendError(res, 'Service not ready', 503);
    }

    return sendSuccess(res, {
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return sendError(res, 'Service not ready', 503);
  }
});

/**
 * Liveness probe (for Kubernetes)
 */
router.get('/live', (req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'alive',
    timestamp: new Date().toISOString(),
  });
});

export default router;

