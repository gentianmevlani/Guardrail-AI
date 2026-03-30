/**
 * Multi-Tenant Service
 * 
 * Handles tenant-specific operations and data isolation
 */

import type { Tier } from "@guardrail/core";
import { prisma } from '../db/index';
import { logger } from "../logger";

export interface Tenant {
  id: string;
  name: string;
  domain: string;
  status: "active" | "inactive" | "suspended";
  plan: Tier | "enterprise" | "unlimited";
  settings: TenantSettings;
  limits: TenantLimits;
  usage: TenantUsage;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  [key: string]: unknown;
  allowCustomDomains: boolean;
  allowSSO: boolean;
  allowAPIAccess: boolean;
  retentionDays: number;
  securityLevel: "basic" | "standard" | "high";
  notifications: {
    email: boolean;
    slack: boolean;
    webhook: boolean;
  };
  features: {
    aiSuggestions: boolean;
    advancedScanning: boolean;
    realTimeCollaboration: boolean;
    customReports: boolean;
  };
}

export interface TenantSettingsUpdate {
  allowCustomDomains?: boolean;
  allowSSO?: boolean;
  allowAPIAccess?: boolean;
  retentionDays?: number;
  securityLevel?: "basic" | "standard" | "high";
  notifications?: {
    email?: boolean;
    slack?: boolean;
    webhook?: boolean;
  };
  features?: {
    aiSuggestions?: boolean;
    advancedScanning?: boolean;
    realTimeCollaboration?: boolean;
    customReports?: boolean;
  };
}

interface TenantLimits {
  [key: string]: unknown;
  users: number;
  projects: number;
  scansPerMonth: number;
  apiCallsPerMonth: number;
  storageGB: number;
  collaboratorsPerProject: number;
}

interface TenantUsage {
  [key: string]: unknown;
  users: number;
  projects: number;
  scansThisMonth: number;
  apiCallsThisMonth: number;
  storageGB: number;
  lastReset: Date;
}

interface TenantContext {
  tenant: Tenant;
  userId: string;
  permissions: string[];
  role: "owner" | "admin" | "member" | "viewer";
}

class MultiTenantService {
  private logger = logger.child({ service: "multi-tenant" });
  private initialized = false;

  constructor() {
    this.initializeDefaultTenant();
  }

  private mapDbTenantToTenant(dbTenant: any): Tenant {
    return {
      id: dbTenant.id,
      name: dbTenant.name,
      domain: dbTenant.domain,
      status: dbTenant.status as "active" | "inactive" | "suspended",
      plan: dbTenant.plan as Tier | "enterprise" | "unlimited",
      settings: dbTenant.settings as TenantSettings,
      limits: dbTenant.limits as TenantLimits,
      usage: dbTenant.usage as TenantUsage,
      createdAt: dbTenant.createdAt,
      updatedAt: dbTenant.updatedAt,
    };
  }

  private async initializeDefaultTenant(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    try {
      const existingTenant = await prisma.tenant.findUnique({
        where: { id: "tenant-default" },
      });

      if (!existingTenant) {
        const defaultSettings: TenantSettings = {
          allowCustomDomains: true,
          allowSSO: true,
          allowAPIAccess: true,
          retentionDays: 365,
          securityLevel: "high",
          notifications: {
            email: true,
            slack: true,
            webhook: true,
          },
          features: {
            aiSuggestions: true,
            advancedScanning: true,
            realTimeCollaboration: true,
            customReports: true,
          },
        };

        const defaultLimits: TenantLimits = {
          users: 1000,
          projects: 500,
          scansPerMonth: 10000,
          apiCallsPerMonth: 100000,
          storageGB: 100,
          collaboratorsPerProject: 50,
        };

        const defaultUsage: TenantUsage = {
          users: 1,
          projects: 0,
          scansThisMonth: 0,
          apiCallsThisMonth: 0,
          storageGB: 0,
          lastReset: new Date(),
        };

        await prisma.tenant.create({
          data: {
            id: "tenant-default",
            name: "Default Organization",
            domain: "localhost",
            status: "active",
            plan: "enterprise",
            settings: defaultSettings as any,
            limits: defaultLimits as any,
            usage: defaultUsage as any,
          },
        });

        await prisma.tenantUser.create({
          data: {
            tenantId: "tenant-default",
            userId: "anonymous",
            role: "owner",
          },
        });

        this.logger.info("Default tenant initialized in database");
      }
    } catch (error) {
      this.logger.error({ error }, "Failed to initialize default tenant");
    }
  }

  async createTenant(data: {
    name: string;
    domain: string;
    plan: Tier;
    ownerId: string;
  }): Promise<Tenant> {
    const tenantId = this.generateTenantId();
    const settings = this.getDefaultSettings(data.plan);
    const limits = this.getDefaultLimits(data.plan);
    const usage: TenantUsage = {
      users: 1,
      projects: 0,
      scansThisMonth: 0,
      apiCallsThisMonth: 0,
      storageGB: 0,
      lastReset: new Date(),
    };

    const newTenant = await prisma.tenant.create({
      data: {
        id: tenantId,
        name: data.name,
        domain: data.domain,
        status: "active",
        plan: data.plan,
        settings: settings as any,
        limits: limits as any,
        usage: usage as any,
      },
    });

    await this.addUserToTenant(data.ownerId, tenantId, "owner");

    this.logger.info(
      {
        tenantId,
        name: data.name,
        plan: data.plan,
        ownerId: data.ownerId,
      },
      "Tenant created",
    );

    return this.mapDbTenantToTenant(newTenant);
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) return null;
    return this.mapDbTenantToTenant(tenant);
  }

  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    const tenant = await prisma.tenant.findFirst({
      where: { domain },
    });

    if (!tenant) return null;
    return this.mapDbTenantToTenant(tenant);
  }

  async updateTenant(
    tenantId: string,
    updates: Partial<Omit<Tenant, "settings">> & {
      settings?: TenantSettingsUpdate;
    },
  ): Promise<Tenant | null> {
    const existingTenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!existingTenant) return null;

    const currentSettings = existingTenant.settings as TenantSettings;
    let newSettings = currentSettings;
    let newLimits: any = existingTenant.limits;

    if (updates.settings) {
      newSettings = {
        ...currentSettings,
        ...updates.settings,
        notifications: {
          ...currentSettings.notifications,
          ...(updates.settings.notifications || {}),
        },
        features: {
          ...currentSettings.features,
          ...(updates.settings.features || {}),
        },
      };
    }

    if (updates.plan) {
      newLimits = this.getDefaultLimits(updates.plan);
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: updates.name ?? existingTenant.name,
        domain: updates.domain ?? existingTenant.domain,
        status: updates.status ?? existingTenant.status,
        plan: updates.plan ?? existingTenant.plan,
        settings: newSettings as any,
        limits: newLimits as any,
      },
    });

    this.logger.info({ tenantId, updates }, "Tenant updated");
    return this.mapDbTenantToTenant(updatedTenant);
  }

  async deleteTenant(tenantId: string): Promise<boolean> {
    try {
      await prisma.tenant.delete({
        where: { id: tenantId },
      });
      this.logger.info({ tenantId }, "Tenant deleted");
      return true;
    } catch {
      return false;
    }
  }

  async addUserToTenant(
    userId: string,
    tenantId: string,
    role: "owner" | "admin" | "member" | "viewer",
  ): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return false;

    if (tenant.usage.users >= tenant.limits.users && role !== "owner") {
      throw new Error("User limit exceeded for tenant");
    }

    const existingAssociation = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId, userId },
      },
    });

    if (!existingAssociation) {
      await prisma.tenantUser.create({
        data: { tenantId, userId, role },
      });

      if (role !== "owner") {
        const currentUsage = tenant.usage;
        currentUsage.users++;
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { usage: currentUsage as any },
        });
      }
    }

    this.logger.info({ userId, tenantId, role }, "User added to tenant");
    return true;
  }

  async removeUserFromTenant(
    userId: string,
    tenantId: string,
  ): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return false;

    try {
      await prisma.tenantUser.delete({
        where: {
          tenantId_userId: { tenantId, userId },
        },
      });
    } catch {
      return false;
    }

    const currentUsage = tenant.usage;
    currentUsage.users = Math.max(0, currentUsage.users - 1);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usage: currentUsage as any },
    });

    this.logger.info({ userId, tenantId }, "User removed from tenant");
    return true;
  }

  async getUserTenants(userId: string): Promise<Tenant[]> {
    const userTenantAssociations = await prisma.tenantUser.findMany({
      where: { userId },
    });

    const results: Tenant[] = [];
    for (const association of userTenantAssociations) {
      const tenant = await this.getTenant(association.tenantId);
      if (tenant) {
        results.push(tenant);
      }
    }

    return results;
  }

  async getTenantContext(
    userId: string,
    tenantId?: string,
    domain?: string,
  ): Promise<TenantContext | null> {
    let tenant: Tenant | null = null;

    if (tenantId) {
      tenant = await this.getTenant(tenantId);
    } else if (domain) {
      tenant = await this.getTenantByDomain(domain);
    }

    if (!tenant) return null;

    const userTenantAssociation = await prisma.tenantUser.findUnique({
      where: {
        tenantId_userId: { tenantId: tenant.id, userId },
      },
    });

    if (!userTenantAssociation) return null;

    const role = userTenantAssociation.role as
      | "owner"
      | "admin"
      | "member"
      | "viewer";
    const permissions = this.getPermissionsForRole(role);

    return {
      tenant,
      userId,
      permissions,
      role,
    };
  }

  async checkTenantLimit(
    tenantId: string,
    action: "create_project" | "run_scan" | "api_call" | "add_user",
  ): Promise<{ allowed: boolean; reason?: string }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { allowed: false, reason: "Tenant not found" };
    }

    if (tenant.status !== "active") {
      return { allowed: false, reason: "Tenant is not active" };
    }

    await this.resetMonthlyUsageIfNeeded(tenantId, tenant);

    switch (action) {
      case "create_project":
        if (tenant.usage.projects >= tenant.limits.projects) {
          return { allowed: false, reason: "Project limit exceeded" };
        }
        break;

      case "run_scan":
        if (tenant.usage.scansThisMonth >= tenant.limits.scansPerMonth) {
          return { allowed: false, reason: "Monthly scan limit exceeded" };
        }
        break;

      case "api_call":
        if (tenant.usage.apiCallsThisMonth >= tenant.limits.apiCallsPerMonth) {
          return { allowed: false, reason: "Monthly API limit exceeded" };
        }
        break;

      case "add_user":
        if (tenant.usage.users >= tenant.limits.users) {
          return { allowed: false, reason: "User limit exceeded" };
        }
        break;
    }

    return { allowed: true };
  }

  async incrementUsage(
    tenantId: string,
    metric: "projects" | "scans" | "api_calls",
  ): Promise<void> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return;

    await this.resetMonthlyUsageIfNeeded(tenantId, tenant);

    const currentUsage = { ...tenant.usage };

    switch (metric) {
      case "projects":
        currentUsage.projects++;
        break;
      case "scans":
        currentUsage.scansThisMonth++;
        break;
      case "api_calls":
        currentUsage.apiCallsThisMonth++;
        break;
    }

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { usage: currentUsage as any },
    });
  }

  async getTenantUsage(tenantId: string): Promise<{
    usage: TenantUsage;
    limits: TenantLimits;
    percentages: Record<string, number>;
  } | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return null;

    await this.resetMonthlyUsageIfNeeded(tenantId, tenant);

    const percentages = {
      users: (tenant.usage.users / tenant.limits.users) * 100,
      projects: (tenant.usage.projects / tenant.limits.projects) * 100,
      scans: (tenant.usage.scansThisMonth / tenant.limits.scansPerMonth) * 100,
      apiCalls:
        (tenant.usage.apiCallsThisMonth / tenant.limits.apiCallsPerMonth) * 100,
      storage: (tenant.usage.storageGB / tenant.limits.storageGB) * 100,
    };

    return {
      usage: tenant.usage,
      limits: tenant.limits,
      percentages,
    };
  }

  private getDefaultSettings(plan: string): TenantSettings {
    const base: TenantSettings = {
      allowCustomDomains: false,
      allowSSO: false,
      allowAPIAccess: true,
      retentionDays: 30,
      securityLevel: "basic",
      notifications: {
        email: true,
        slack: false,
        webhook: false,
      },
      features: {
        aiSuggestions: false,
        advancedScanning: false,
        realTimeCollaboration: false,
        customReports: false,
      },
    };

    switch (plan) {
      case "starter":
        return {
          ...base,
          allowCustomDomains: false,
          allowSSO: false,
          retentionDays: 60,
          securityLevel: "standard",
          notifications: {
            email: true,
            slack: false,
            webhook: false,
          },
          features: {
            aiSuggestions: true,
            advancedScanning: true,
            realTimeCollaboration: false,
            customReports: false,
          },
        };

      case "pro":
        return {
          ...base,
          allowCustomDomains: true,
          allowSSO: true,
          retentionDays: 90,
          securityLevel: "standard",
          notifications: {
            email: true,
            slack: true,
            webhook: false,
          },
          features: {
            aiSuggestions: true,
            advancedScanning: true,
            realTimeCollaboration: true,
            customReports: false,
          },
        };

      case "compliance":
      case "enterprise":
      case "unlimited":
        return {
          ...base,
          allowCustomDomains: true,
          allowSSO: true,
          allowAPIAccess: true,
          retentionDays: 365,
          securityLevel: "high",
          notifications: {
            email: true,
            slack: true,
            webhook: true,
          },
          features: {
            aiSuggestions: true,
            advancedScanning: true,
            realTimeCollaboration: true,
            customReports: true,
          },
        };

      default:
        return base;
    }
  }

  public getDefaultLimits(plan: string): TenantLimits {
    switch (plan) {
      case "free":
        return {
          users: 3,
          projects: 5,
          scansPerMonth: 50,
          apiCallsPerMonth: 1000,
          storageGB: 1,
          collaboratorsPerProject: 2,
        };

      case "starter":
        return {
          users: 10,
          projects: 25,
          scansPerMonth: 200,
          apiCallsPerMonth: 5000,
          storageGB: 5,
          collaboratorsPerProject: 5,
        };

      case "pro":
        return {
          users: 20,
          projects: 100,
          scansPerMonth: 1000,
          apiCallsPerMonth: 10000,
          storageGB: 10,
          collaboratorsPerProject: 10,
        };

      case "compliance":
      case "enterprise":
      case "unlimited":
        return {
          users: 1000,
          projects: 500,
          scansPerMonth: 10000,
          apiCallsPerMonth: 100000,
          storageGB: 100,
          collaboratorsPerProject: 50,
        };

      default:
        return {
          users: 3,
          projects: 5,
          scansPerMonth: 50,
          apiCallsPerMonth: 1000,
          storageGB: 1,
          collaboratorsPerProject: 2,
        };
    }
  }

  private getPermissionsForRole(role: string): string[] {
    switch (role) {
      case "owner":
        return [
          "tenant:read",
          "tenant:update",
          "tenant:delete",
          "user:invite",
          "user:remove",
          "user:update",
          "project:create",
          "project:read",
          "project:update",
          "project:delete",
          "scan:run",
          "scan:read",
          "report:generate",
        ];

      case "admin":
        return [
          "tenant:read",
          "user:invite",
          "user:remove",
          "project:create",
          "project:read",
          "project:update",
          "project:delete",
          "scan:run",
          "scan:read",
          "report:generate",
        ];

      case "member":
        return [
          "tenant:read",
          "project:create",
          "project:read",
          "project:update",
          "scan:run",
          "scan:read",
          "report:generate",
        ];

      case "viewer":
        return ["tenant:read", "project:read", "scan:read", "report:read"];

      default:
        return [];
    }
  }

  private async resetMonthlyUsageIfNeeded(
    tenantId: string,
    tenant: Tenant,
  ): Promise<void> {
    const now = new Date();
    const lastReset = new Date(tenant.usage.lastReset);

    if (
      now.getMonth() !== lastReset.getMonth() ||
      now.getFullYear() !== lastReset.getFullYear()
    ) {
      const updatedUsage = {
        ...tenant.usage,
        scansThisMonth: 0,
        apiCallsThisMonth: 0,
        lastReset: now,
      };

      await prisma.tenant.update({
        where: { id: tenantId },
        data: { usage: updatedUsage },
      });

      this.logger.info({ tenantId }, "Monthly usage reset");
    }
  }

  private generateTenantId(): string {
    return `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const multiTenantService = new MultiTenantService();

