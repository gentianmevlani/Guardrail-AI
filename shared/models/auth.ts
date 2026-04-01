import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, primaryKey } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password"),
  firstName: varchar("name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("avatar"),
  provider: varchar("provider").default("email"),
  providerId: varchar("provider_id"),
  emailVerified: boolean("email_verified").default(false),
  createdAt: timestamp("createdAt", { withTimezone: false }).defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: false }).defaultNow(),
});

export const refreshTokens = pgTable("refresh_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  revoked: boolean("revoked").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_refresh_tokens_user_id").on(table.userId), index("IDX_refresh_tokens_expires_at").on(table.expiresAt)]);

export const tokenBlacklist = pgTable("token_blacklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tokenHash: varchar("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_token_blacklist_expires_at").on(table.expiresAt)]);

export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("userId").notNull(),
  stripeCustomerId: varchar("stripeCustomerId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId").unique(),
  tier: varchar("tier").notNull().default("free"),
  status: varchar("status").notNull().default("active"),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
}, (table) => [index("IDX_subscriptions_user_id").on(table.userId), index("IDX_subscriptions_stripe_customer_id").on(table.stripeCustomerId)]);

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type").notNull().$type<'security' | 'compliance' | 'system' | 'billing'>(),
  title: varchar("title").notNull(),
  message: varchar("message").notNull(),
  severity: varchar("severity").notNull().$type<'info' | 'warning' | 'error' | 'success'>(),
  read: boolean("read").default(false).notNull(),
  actionUrl: varchar("action_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("IDX_notifications_user_id").on(table.userId), index("IDX_notifications_read").on(table.read)]);

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  domain: varchar("domain").notNull(),
  status: varchar("status").notNull().default("active").$type<'active' | 'inactive' | 'suspended'>(),
  plan: varchar("plan").notNull().default("free").$type<'free' | 'pro' | 'enterprise'>(),
  settings: jsonb("settings").notNull().default({}),
  limits: jsonb("limits").notNull().default({}),
  usage: jsonb("usage").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("IDX_tenants_domain").on(table.domain)]);

export const tenantUsers = pgTable("tenant_users", {
  tenantId: varchar("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  role: varchar("role").notNull().default("member").$type<'owner' | 'admin' | 'member' | 'viewer'>(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.tenantId, table.userId] }),
  index("IDX_tenant_users_user_id").on(table.userId),
  index("IDX_tenant_users_tenant_id").on(table.tenantId),
]);

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
export type TokenBlacklist = typeof tokenBlacklist.$inferSelect;
export type InsertTokenBlacklist = typeof tokenBlacklist.$inferInsert;
export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = typeof tenants.$inferInsert;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type InsertTenantUser = typeof tenantUsers.$inferInsert;
