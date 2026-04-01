/**
 * Enterprise API Routes
 *
 * /api/v1/enterprise/sbom      — SBOM generation
 * /api/v1/enterprise/policies  — Policy-as-Code
 * /api/v1/enterprise/audit     — Audit trail
 * /api/v1/enterprise/analytics — Trend analytics
 * /api/v1/enterprise/sso       — SSO configuration
 * /api/v1/enterprise/scim      — SCIM 2.0 provisioning
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const router = Router();

/** Express 5 may type `req.params` values as `string | string[]` */
function firstPathParam(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

/** Minimal SCIM body validation — compliance package SCIM zod exports vary by build */
const scimUserBodySchema = z.record(z.string(), z.unknown());
const scimPatchBodySchema = z.union([
  z.array(z.record(z.string(), z.unknown())),
  z.record(z.string(), z.unknown()),
]);

// ─── Auth Middleware ───────────────────────────────────────────

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }
  next();
}

function requireEnterprise(req: Request, res: Response, next: NextFunction): void {
  // In production, check user's tier from JWT claims or DB
  // For now, pass through
  next();
}

// ─── SBOM Routes ──────────────────────────────────────────────

const SBOMGenerateSchema = z.object({
  projectPath: z.string(),
  format: z.enum(['cyclonedx', 'spdx']).default('cyclonedx'),
  includeDevDependencies: z.boolean().default(false),
  includeLicenses: z.boolean().default(true),
  includeHashes: z.boolean().default(true),
});

router.post('/sbom/generate', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const input = SBOMGenerateSchema.parse(req.body);
    const { generateSBOM } = await import('@guardrail/compliance');

    const result = await generateSBOM({
      projectPath: input.projectPath,
      format: input.format,
      includeDevDependencies: input.includeDevDependencies,
      includeLicenses: input.includeLicenses,
      includeHashes: input.includeHashes,
    });

    res.json({
      success: true,
      data: {
        format: result.document.format,
        specVersion: result.document.specVersion,
        serialNumber: result.document.serialNumber,
        stats: result.stats,
        document: result.serialized,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'SBOM generation failed',
    });
  }
});

// ─── Policy Routes ────────────────────────────────────────────

const PolicyEvalSchema = z.object({
  projectPath: z.string(),
  policyName: z.string().optional(),
  scanResults: z.object({
    score: z.number(),
    grade: z.string(),
    issues: z.array(z.object({
      id: z.string(),
      severity: z.string(),
      category: z.string(),
      message: z.string(),
      file: z.string().optional(),
    })),
  }).optional(),
});

router.post('/policies/init', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { projectPath } = z.object({ projectPath: z.string() }).parse(req.body);
    const { PolicyManager } = await import('@guardrail/compliance');
    const manager = new PolicyManager(projectPath);
    const filePath = await manager.init();

    res.json({ success: true, data: { filePath } });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Policy init failed' });
  }
});

router.post('/policies/evaluate', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const input = PolicyEvalSchema.parse(req.body);
    const { PolicyManager } = await import('@guardrail/compliance');
    const manager = new PolicyManager(input.projectPath);

    const results = await manager.evaluate(
      {
        scanResults: input.scanResults,
        project: { name: '', path: input.projectPath },
      },
      input.policyName
    );

    const anyBlocked = results.some(r => !r.passed && r.action === 'block');

    res.json({
      success: true,
      data: {
        passed: !anyBlocked,
        results,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Policy evaluation failed' });
  }
});

router.get('/policies', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const projectPath = req.query['projectPath'] as string;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath query parameter required' });
      return;
    }

    const { PolicyManager } = await import('@guardrail/compliance');
    const manager = new PolicyManager(projectPath);
    const policies = await manager.loadPolicies();

    res.json({
      success: true,
      data: policies.map(p => ({
        name: p.metadata.name,
        version: p.metadata.version,
        description: p.metadata.description,
        target: p.spec.target,
        scope: p.spec.scope,
        ruleCount: p.spec.rules.length,
      })),
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Policy list failed' });
  }
});

router.post('/policies/validate', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { PolicyManager } = await import('@guardrail/compliance');
    const manager = new PolicyManager();
    const result = manager.validate(req.body.policy);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Validation failed' });
  }
});

// ─── Audit Routes ─────────────────────────────────────────────

router.get('/audit/events', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const projectPath = req.query['projectPath'] as string;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath query parameter required' });
      return;
    }

    const { LocalJSONLStorage } = await import('@guardrail/compliance');
    const storage = new LocalJSONLStorage(projectPath);

    const events = await storage.read({
      limit: parseInt(req.query['limit'] as string || '50', 10),
      offset: parseInt(req.query['offset'] as string || '0', 10),
      category: req.query['category'] as string | undefined,
      surface: req.query['surface'] as string | undefined,
      startDate: req.query['from'] ? new Date(req.query['from'] as string) : undefined,
      endDate: req.query['to'] ? new Date(req.query['to'] as string) : undefined,
    });

    res.json({ success: true, data: { events, count: events.length } });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Audit query failed' });
  }
});

router.post('/audit/verify', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { projectPath, signed } = z.object({
      projectPath: z.string(),
      signed: z.boolean().default(false),
    }).parse(req.body);

    if (signed) {
      const { SignedJSONLStorage } = await import('@guardrail/compliance');
      const storage = new SignedJSONLStorage(projectPath);
      const result = await storage.validateChain();
      res.json({ success: true, data: result });
    } else {
      const { LocalJSONLStorage } = await import('@guardrail/compliance');
      const storage = new LocalJSONLStorage(projectPath);
      const result = await storage.validateChain();
      res.json({ success: true, data: result });
    }
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Verification failed' });
  }
});

router.post('/audit/export', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { projectPath, format, from, to } = z.object({
      projectPath: z.string(),
      format: z.enum(['json', 'csv']).default('json'),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    }).parse(req.body);

    const { LocalJSONLStorage } = await import('@guardrail/compliance');
    const storage = new LocalJSONLStorage(projectPath);

    const exported = await storage.export(format, {
      startDate: from ? new Date(from) : undefined,
      endDate: to ? new Date(to) : undefined,
      includeMetadata: true,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=guardrail-audit.csv');
    }

    res.send(exported);
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Export failed' });
  }
});

router.get('/audit/keys', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const projectPath = req.query['projectPath'] as string;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath required' });
      return;
    }

    const { SignedJSONLStorage } = await import('@guardrail/compliance');
    const storage = new SignedJSONLStorage(projectPath);
    const keys = storage.getPublicKeys();

    res.json({ success: true, data: { keys } });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Key export failed' });
  }
});

// ─── Analytics Routes ─────────────────────────────────────────

router.get('/analytics/dashboard', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const projectPath = req.query['projectPath'] as string;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath required' });
      return;
    }

    const days = parseInt(req.query['days'] as string || '30', 10);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { TrendAnalyticsEngine } = await import('@guardrail/compliance');
    const engine = new TrendAnalyticsEngine(projectPath);
    const dashboard = await engine.generateDashboard({ from });

    res.json({ success: true, data: dashboard });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Dashboard failed' });
  }
});

router.get('/analytics/trends', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const projectPath = req.query['projectPath'] as string;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath required' });
      return;
    }

    const period = (req.query['period'] as string || 'day') as 'day' | 'week' | 'month';
    const days = parseInt(req.query['days'] as string || '30', 10);
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const { TrendAnalyticsEngine } = await import('@guardrail/compliance');
    const engine = new TrendAnalyticsEngine(projectPath);
    const trends = await engine.getTrends({ period, from });

    res.json({ success: true, data: trends });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Trends failed' });
  }
});

router.get('/analytics/hotspots', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const projectPath = req.query['projectPath'] as string;
    if (!projectPath) {
      res.status(400).json({ success: false, error: 'projectPath required' });
      return;
    }

    const limit = parseInt(req.query['limit'] as string || '10', 10);

    const { TrendAnalyticsEngine } = await import('@guardrail/compliance');
    const engine = new TrendAnalyticsEngine(projectPath);
    const hotspots = await engine.getHotspots({ limit });

    res.json({ success: true, data: hotspots });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Hotspots failed' });
  }
});

// ─── SSO Routes ───────────────────────────────────────────────

const SSOConfigSchema = z.object({
  organizationId: z.string(),
  provider: z.enum(['okta', 'azure-ad', 'google-workspace', 'onelogin', 'custom-saml', 'custom-oidc']),
  protocol: z.enum(['saml', 'oidc']),
  domains: z.array(z.string()),
  saml: z.object({
    ssoUrl: z.string().url(),
    sloUrl: z.string().url().optional(),
    certificate: z.string(),
    entityId: z.string().url().optional(),
    attributeMapping: z.object({
      email: z.string().default('email'),
      firstName: z.string().default('firstName'),
      lastName: z.string().default('lastName'),
      groups: z.string().optional(),
    }).optional(),
  }).optional(),
  oidc: z.object({
    issuer: z.string().url(),
    clientId: z.string(),
    clientSecret: z.string(),
    scopes: z.array(z.string()).optional(),
  }).optional(),
  enforceSSO: z.boolean().default(false),
  autoProvision: z.boolean().default(true),
  defaultRole: z.enum(['member', 'developer', 'admin']).default('member'),
});

router.post('/sso/configure', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const input = SSOConfigSchema.parse(req.body);
    const { ssoService } = await import('@guardrail/compliance');

    const config = await ssoService.configure({
      ...input,
      enabled: false, // Require explicit enable after domain verification
      verifiedDomains: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    res.json({
      success: true,
      data: {
        id: config.id,
        provider: config.provider,
        protocol: config.protocol,
        domains: config.domains,
        enabled: config.enabled,
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'SSO configuration failed' });
  }
});

router.post('/sso/verify-domain', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { organizationId, domain } = z.object({
      organizationId: z.string(),
      domain: z.string(),
    }).parse(req.body);

    const { ssoService } = await import('@guardrail/compliance');
    const result = await ssoService.verifyDomain(organizationId, domain);

    res.json({
      success: true,
      data: {
        verified: result.verified,
        dnsRecord: {
          type: 'TXT',
          value: result.expectedRecord,
          instructions: `Add a TXT record to ${domain} with the value above to verify ownership.`,
        },
      },
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Domain verification failed' });
  }
});

router.post('/sso/login', requireAuth, async (req: Request, res: Response) => {
  try {
    const { organizationId, returnUrl } = z.object({
      organizationId: z.string(),
      returnUrl: z.string().url().optional(),
    }).parse(req.body);

    const { ssoService } = await import('@guardrail/compliance');
    const result = await ssoService.initiateLogin(organizationId, returnUrl);

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'SSO login failed' });
  }
});

router.get('/sso/config/:organizationId', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { ssoService } = await import('@guardrail/compliance');
    const organizationId = firstPathParam(req.params['organizationId']);
    if (!organizationId) {
      res.status(400).json({ success: false, error: 'organizationId is required' });
      return;
    }
    const config = ssoService.getConfig(organizationId);

    if (!config) {
      res.status(404).json({ success: false, error: 'SSO not configured for this organization' });
      return;
    }

    // Don't expose secrets
    const safe = {
      id: config.id,
      provider: config.provider,
      protocol: config.protocol,
      domains: config.domains,
      verifiedDomains: config.verifiedDomains,
      enabled: config.enabled,
      enforceSSO: config.enforceSSO,
      autoProvision: config.autoProvision,
      defaultRole: config.defaultRole,
    };

    res.json({ success: true, data: safe });
  } catch (error) {
    res.status(400).json({ success: false, error: error instanceof Error ? error.message : 'Failed to get SSO config' });
  }
});

// ─── SCIM Routes (RFC 7644) ───────────────────────────────────

router.get('/scim/v2/Users', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { InMemorySCIMStore } = await import('@guardrail/compliance');
    const store = new InMemorySCIMStore();

    const filter = req.query['filter'] as string | undefined;
    const startIndex = parseInt(req.query['startIndex'] as string || '1', 10);
    const count = parseInt(req.query['count'] as string || '20', 10);

    const result = await store.list(filter, startIndex, count);

    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: result.total,
      startIndex,
      itemsPerPage: count,
      Resources: result.users,
    });
  } catch (error) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error instanceof Error ? error.message : 'SCIM query failed',
      status: '400',
    });
  }
});

router.post('/scim/v2/Users', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { InMemorySCIMStore } = await import('@guardrail/compliance');
    const store = new InMemorySCIMStore();

    const user = scimUserBodySchema.parse(req.body);
    const created = await store.create(user as never);

    res.status(201).json(created);
  } catch (error) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error instanceof Error ? error.message : 'SCIM create failed',
      status: '400',
    });
  }
});

router.get('/scim/v2/Users/:id', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { InMemorySCIMStore } = await import('@guardrail/compliance');
    const store = new InMemorySCIMStore();
    const id = firstPathParam(req.params['id']);
    if (!id) {
      res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User id is required',
        status: '400',
      });
      return;
    }
    const user = await store.get(id);

    if (!user) {
      res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error instanceof Error ? error.message : 'SCIM get failed',
      status: '400',
    });
  }
});

router.patch('/scim/v2/Users/:id', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { InMemorySCIMStore } = await import('@guardrail/compliance');
    const store = new InMemorySCIMStore();

    const operations = scimPatchBodySchema.parse(req.body);
    const id = firstPathParam(req.params['id']);
    if (!id) {
      res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User id is required',
        status: '400',
      });
      return;
    }
    const updated = await store.patch(id, operations as never);

    if (!updated) {
      res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
      return;
    }

    res.json(updated);
  } catch (error) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error instanceof Error ? error.message : 'SCIM patch failed',
      status: '400',
    });
  }
});

router.delete('/scim/v2/Users/:id', requireAuth, requireEnterprise, async (req: Request, res: Response) => {
  try {
    const { InMemorySCIMStore } = await import('@guardrail/compliance');
    const store = new InMemorySCIMStore();

    const id = firstPathParam(req.params['id']);
    if (!id) {
      res.status(400).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User id is required',
        status: '400',
      });
      return;
    }
    const deleted = await store.delete(id);
    if (!deleted) {
      res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      });
      return;
    }

    res.status(204).send();
  } catch (error) {
    res.status(400).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: error instanceof Error ? error.message : 'SCIM delete failed',
      status: '400',
    });
  }
});

export default router;
