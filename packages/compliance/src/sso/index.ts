/**
 * SSO & SCIM Module
 *
 * Enterprise SSO integration with SAML 2.0, OIDC, and SCIM 2.0 provisioning.
 * Supports: Okta, Azure AD, Google Workspace, and generic SAML/OIDC providers.
 *
 * Enterprise tier feature.
 */

import { z } from 'zod';
import { randomUUID, createHash } from 'crypto';

// ─── SSO Configuration Schema ─────────────────────────────────

export const SSOProviderSchema = z.enum([
  'okta', 'azure-ad', 'google-workspace', 'onelogin', 'custom-saml', 'custom-oidc',
]);
export type SSOProvider = z.infer<typeof SSOProviderSchema>;

export const SSOProtocolSchema = z.enum(['saml', 'oidc']);
export type SSOProtocol = z.infer<typeof SSOProtocolSchema>;

export const SSOConfigSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  provider: SSOProviderSchema,
  protocol: SSOProtocolSchema,
  enabled: z.boolean().default(false),

  // SAML configuration
  saml: z.object({
    entityId: z.string().url().optional(),
    ssoUrl: z.string().url(),
    sloUrl: z.string().url().optional(),
    certificate: z.string(),               // IdP's X.509 cert (PEM)
    signatureAlgorithm: z.enum(['sha256', 'sha384', 'sha512']).default('sha256'),
    nameIdFormat: z.enum([
      'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      'urn:oasis:names:tc:SAML:2.0:nameid-format:persistent',
      'urn:oasis:names:tc:SAML:2.0:nameid-format:transient',
    ]).default('urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'),
    attributeMapping: z.object({
      email: z.string().default('email'),
      firstName: z.string().default('firstName'),
      lastName: z.string().default('lastName'),
      groups: z.string().optional(),
    }),
  }).optional(),

  // OIDC configuration
  oidc: z.object({
    issuer: z.string().url(),
    clientId: z.string(),
    clientSecret: z.string(),
    scopes: z.array(z.string()).default(['openid', 'profile', 'email']),
    authorizationEndpoint: z.string().url().optional(),
    tokenEndpoint: z.string().url().optional(),
    userInfoEndpoint: z.string().url().optional(),
    jwksUri: z.string().url().optional(),
  }).optional(),

  // Domain verification
  domains: z.array(z.string()),
  verifiedDomains: z.array(z.string()).default([]),

  // Options
  autoProvision: z.boolean().default(true),
  defaultRole: z.enum(['member', 'developer', 'admin']).default('member'),
  enforceSSO: z.boolean().default(false),   // Block non-SSO login

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SSOConfig = z.infer<typeof SSOConfigSchema>;

// ─── SCIM 2.0 Schema ─────────────────────────────────────────

export const SCIMUserSchema = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:schemas:core:2.0:User']),
  id: z.string(),
  externalId: z.string().optional(),
  userName: z.string(),
  name: z.object({
    givenName: z.string(),
    familyName: z.string(),
    formatted: z.string().optional(),
  }),
  emails: z.array(z.object({
    value: z.string().email(),
    type: z.enum(['work', 'personal']).default('work'),
    primary: z.boolean().default(true),
  })),
  active: z.boolean().default(true),
  groups: z.array(z.object({
    value: z.string(),
    display: z.string().optional(),
  })).optional(),
  meta: z.object({
    resourceType: z.literal('User').default('User'),
    created: z.string().datetime().optional(),
    lastModified: z.string().datetime().optional(),
    location: z.string().url().optional(),
  }).optional(),
});
export type SCIMUser = z.infer<typeof SCIMUserSchema>;

export const SCIMGroupSchema = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:schemas:core:2.0:Group']),
  id: z.string(),
  externalId: z.string().optional(),
  displayName: z.string(),
  members: z.array(z.object({
    value: z.string(),
    display: z.string().optional(),
  })).optional(),
  meta: z.object({
    resourceType: z.literal('Group').default('Group'),
    created: z.string().datetime().optional(),
    lastModified: z.string().datetime().optional(),
  }).optional(),
});
export type SCIMGroup = z.infer<typeof SCIMGroupSchema>;

export const SCIMListResponseSchema = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:api:messages:2.0:ListResponse']),
  totalResults: z.number(),
  startIndex: z.number().default(1),
  itemsPerPage: z.number().default(20),
  Resources: z.array(z.union([SCIMUserSchema, SCIMGroupSchema])),
});

export const SCIMPatchOpSchema = z.object({
  schemas: z.array(z.string()).default(['urn:ietf:params:scim:api:messages:2.0:PatchOp']),
  Operations: z.array(z.object({
    op: z.enum(['add', 'remove', 'replace']),
    path: z.string().optional(),
    value: z.unknown(),
  })),
});
export type SCIMPatchOp = z.infer<typeof SCIMPatchOpSchema>;

// ─── SSO Service ──────────────────────────────────────────────

export interface SSOSession {
  sessionId: string;
  userId: string;
  email: string;
  provider: SSOProvider;
  protocol: SSOProtocol;
  organizationId: string;
  roles: string[];
  groups: string[];
  issuedAt: string;
  expiresAt: string;
  idpSessionId?: string;
}

export interface SSOAuthResult {
  success: boolean;
  session?: SSOSession;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    groups: string[];
  };
  error?: string;
  provisioned?: boolean; // Was user auto-provisioned?
}

/**
 * SSO Service — manages SSO configurations and authentication flows
 */
export class SSOService {
  private configs: Map<string, SSOConfig> = new Map();

  /**
   * Register an SSO configuration
   */
  async configure(config: Omit<SSOConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<SSOConfig> {
    const now = new Date().toISOString();
    const fullConfig: SSOConfig = {
      ...config,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };

    const validated = SSOConfigSchema.parse(fullConfig);
    this.configs.set(validated.organizationId, validated);
    return validated;
  }

  /**
   * Get SSO config for an organization
   */
  getConfig(organizationId: string): SSOConfig | undefined {
    return this.configs.get(organizationId);
  }

  /**
   * Check if SSO is enforced for an email domain
   */
  isSSOEnforced(email: string): { enforced: boolean; config?: SSOConfig } {
    const domain = email.split('@')[1];
    if (!domain) return { enforced: false };

    for (const config of this.configs.values()) {
      if (config.enabled && config.enforceSSO && config.verifiedDomains.includes(domain)) {
        return { enforced: true, config };
      }
    }

    return { enforced: false };
  }

  /**
   * Initiate SSO login — returns the redirect URL
   */
  async initiateLogin(organizationId: string, returnUrl?: string): Promise<{ redirectUrl: string; state: string }> {
    const config = this.configs.get(organizationId);
    if (!config || !config.enabled) {
      throw new Error('SSO not configured or disabled for this organization');
    }

    const state = randomUUID();

    if (config.protocol === 'saml' && config.saml) {
      // Build SAML AuthnRequest URL
      const acsUrl = `${process.env['GUARDRAIL_BASE_URL'] || 'https://api.guardrail.dev'}/auth/sso/saml/callback`;
      const params = new URLSearchParams({
        SAMLRequest: Buffer.from(`<AuthnRequest xmlns="urn:oasis:names:tc:SAML:2.0:protocol" ID="_${randomUUID()}" Version="2.0" IssueInstant="${new Date().toISOString()}" AssertionConsumerServiceURL="${acsUrl}"><Issuer xmlns="urn:oasis:names:tc:SAML:2.0:assertion">${config.saml.entityId || acsUrl}</Issuer></AuthnRequest>`).toString('base64'),
        RelayState: JSON.stringify({ state, returnUrl, orgId: organizationId }),
      });

      return {
        redirectUrl: `${config.saml.ssoUrl}?${params.toString()}`,
        state,
      };
    }

    if (config.protocol === 'oidc' && config.oidc) {
      const redirectUri = `${process.env['GUARDRAIL_BASE_URL'] || 'https://api.guardrail.dev'}/auth/sso/oidc/callback`;
      const params = new URLSearchParams({
        client_id: config.oidc.clientId,
        response_type: 'code',
        scope: config.oidc.scopes.join(' '),
        redirect_uri: redirectUri,
        state: JSON.stringify({ state, returnUrl, orgId: organizationId }),
        nonce: randomUUID(),
      });

      const authEndpoint = config.oidc.authorizationEndpoint || `${config.oidc.issuer}/authorize`;

      return {
        redirectUrl: `${authEndpoint}?${params.toString()}`,
        state,
      };
    }

    throw new Error('Invalid SSO configuration: missing protocol-specific settings');
  }

  /**
   * Validate domain ownership via DNS TXT record
   */
  async verifyDomain(organizationId: string, domain: string): Promise<{
    verified: boolean;
    expectedRecord: string;
  }> {
    const config = this.configs.get(organizationId);
    if (!config) throw new Error('SSO not configured');

    const verificationToken = createHash('sha256')
      .update(`guardrail-verify:${organizationId}:${domain}`)
      .digest('hex')
      .substring(0, 32);

    const expectedRecord = `guardrail-domain-verification=${verificationToken}`;

    // In production, this would do a DNS TXT lookup
    // For now, return the expected record for manual verification
    return {
      verified: false,
      expectedRecord,
    };
  }

  /**
   * List all SSO configurations
   */
  listConfigs(): SSOConfig[] {
    return Array.from(this.configs.values());
  }
}

// ─── SCIM Service ─────────────────────────────────────────────

export interface SCIMUserStore {
  create(user: SCIMUser): Promise<SCIMUser>;
  get(id: string): Promise<SCIMUser | null>;
  list(filter?: string, startIndex?: number, count?: number): Promise<{ users: SCIMUser[]; total: number }>;
  update(id: string, user: Partial<SCIMUser>): Promise<SCIMUser | null>;
  patch(id: string, operations: SCIMPatchOp): Promise<SCIMUser | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * In-memory SCIM user store (replace with DB adapter in production)
 */
export class InMemorySCIMStore implements SCIMUserStore {
  private users: Map<string, SCIMUser> = new Map();

  async create(user: SCIMUser): Promise<SCIMUser> {
    const id = user.id || randomUUID();
    const now = new Date().toISOString();
    const stored: SCIMUser = {
      ...user,
      id,
      meta: {
        resourceType: 'User',
        created: now,
        lastModified: now,
      },
    };
    this.users.set(id, stored);
    return stored;
  }

  async get(id: string): Promise<SCIMUser | null> {
    return this.users.get(id) || null;
  }

  async list(filter?: string, startIndex = 1, count = 20): Promise<{ users: SCIMUser[]; total: number }> {
    let users = Array.from(this.users.values());

    if (filter) {
      // Simple SCIM filter: "userName eq "john@example.com""
      const match = filter.match(/(\w+)\s+eq\s+"([^"]+)"/);
      if (match) {
        const [, field, value] = match;
        users = users.filter(u => {
          if (field === 'userName') return u.userName === value;
          if (field === 'externalId') return u.externalId === value;
          return true;
        });
      }
    }

    const total = users.length;
    const paged = users.slice(startIndex - 1, startIndex - 1 + count);

    return { users: paged, total };
  }

  async update(id: string, user: Partial<SCIMUser>): Promise<SCIMUser | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated: SCIMUser = {
      ...existing,
      ...user,
      id, // Keep original ID
      meta: {
        ...existing.meta,
        resourceType: 'User',
        lastModified: new Date().toISOString(),
      },
    };
    this.users.set(id, updated);
    return updated;
  }

  async patch(id: string, operations: SCIMPatchOp): Promise<SCIMUser | null> {
    const existing = this.users.get(id);
    if (!existing) return null;

    const updated = { ...existing } as Record<string, unknown>;

    for (const op of operations.Operations) {
      switch (op.op) {
        case 'replace':
          if (op.path === 'active') {
            updated['active'] = op.value;
          } else if (op.path && typeof op.value !== 'undefined') {
            updated[op.path] = op.value;
          }
          break;
        case 'add':
          if (op.path && typeof op.value !== 'undefined') {
            updated[op.path] = op.value;
          }
          break;
        case 'remove':
          if (op.path) {
            delete updated[op.path];
          }
          break;
      }
    }

    updated['meta'] = {
      ...existing.meta,
      resourceType: 'User' as const,
      lastModified: new Date().toISOString(),
    };

    const result = updated as unknown as SCIMUser;
    this.users.set(id, result);
    return result;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}

// ─── Exports ──────────────────────────────────────────────────

export const ssoService = new SSOService();
