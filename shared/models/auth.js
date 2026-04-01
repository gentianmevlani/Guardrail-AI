"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantUsers =
  exports.tenants =
  exports.notifications =
  exports.subscriptions =
  exports.tokenBlacklist =
  exports.refreshTokens =
  exports.users =
  exports.sessions =
    void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
exports.sessions = (0, pg_core_1.pgTable)(
  "sessions",
  {
    sid: (0, pg_core_1.varchar)("sid").primaryKey(),
    sess: (0, pg_core_1.jsonb)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire").notNull(),
  },
  (table) => [(0, pg_core_1.index)("IDX_session_expire").on(table.expire)],
);
exports.users = (0, pg_core_1.pgTable)("users", {
  id: (0, pg_core_1.varchar)("id")
    .primaryKey()
    .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
  email: (0, pg_core_1.varchar)("email").unique().notNull(),
  passwordHash: (0, pg_core_1.varchar)("password"),
  firstName: (0, pg_core_1.varchar)("name"),
  lastName: (0, pg_core_1.varchar)("last_name"),
  profileImageUrl: (0, pg_core_1.varchar)("avatar"),
  provider: (0, pg_core_1.varchar)("provider").default("email"),
  providerId: (0, pg_core_1.varchar)("provider_id"),
  emailVerified: (0, pg_core_1.boolean)("email_verified").default(false),
  createdAt: (0, pg_core_1.timestamp)("createdAt", {
    withTimezone: false,
  }).defaultNow(),
  updatedAt: (0, pg_core_1.timestamp)("updatedAt", {
    withTimezone: false,
  }).defaultNow(),
});
exports.refreshTokens = (0, pg_core_1.pgTable)(
  "refresh_tokens",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id")
      .notNull()
      .references(() => exports.users.id, { onDelete: "cascade" }),
    token: (0, pg_core_1.varchar)("token").unique().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    revoked: (0, pg_core_1.boolean)("revoked").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_refresh_tokens_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_refresh_tokens_expires_at").on(table.expiresAt),
  ],
);
exports.tokenBlacklist = (0, pg_core_1.pgTable)(
  "token_blacklist",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    tokenHash: (0, pg_core_1.varchar)("token_hash").unique().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_token_blacklist_expires_at").on(table.expiresAt),
  ],
);
exports.subscriptions = (0, pg_core_1.pgTable)(
  "subscriptions",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("userId").notNull(),
    stripeCustomerId: (0, pg_core_1.varchar)("stripeCustomerId").notNull(),
    stripeSubscriptionId: (0, pg_core_1.varchar)(
      "stripeSubscriptionId",
    ).unique(),
    tier: (0, pg_core_1.varchar)("tier").notNull().default("free"),
    status: (0, pg_core_1.varchar)("status").notNull().default("active"),
    currentPeriodStart: (0, pg_core_1.timestamp)("currentPeriodStart"),
    currentPeriodEnd: (0, pg_core_1.timestamp)("currentPeriodEnd"),
    cancelAtPeriodEnd: (0, pg_core_1.boolean)("cancelAtPeriodEnd").default(
      false,
    ),
    createdAt: (0, pg_core_1.timestamp)("createdAt").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updatedAt").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_subscriptions_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_subscriptions_stripe_customer_id").on(
      table.stripeCustomerId,
    ),
  ],
);
exports.notifications = (0, pg_core_1.pgTable)(
  "notifications",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id")
      .notNull()
      .references(() => exports.users.id, { onDelete: "cascade" }),
    type: (0, pg_core_1.varchar)("type").notNull().$type(),
    title: (0, pg_core_1.varchar)("title").notNull(),
    message: (0, pg_core_1.varchar)("message").notNull(),
    severity: (0, pg_core_1.varchar)("severity").notNull().$type(),
    read: (0, pg_core_1.boolean)("read").default(false).notNull(),
    actionUrl: (0, pg_core_1.varchar)("action_url"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_notifications_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_notifications_read").on(table.read),
  ],
);
exports.tenants = (0, pg_core_1.pgTable)(
  "tenants",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    name: (0, pg_core_1.varchar)("name").notNull(),
    domain: (0, pg_core_1.varchar)("domain").notNull(),
    status: (0, pg_core_1.varchar)("status")
      .notNull()
      .default("active")
      .$type(),
    plan: (0, pg_core_1.varchar)("plan").notNull().default("free").$type(),
    settings: (0, pg_core_1.jsonb)("settings").notNull().default({}),
    limits: (0, pg_core_1.jsonb)("limits").notNull().default({}),
    usage: (0, pg_core_1.jsonb)("usage").notNull().default({}),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow().notNull(),
  },
  (table) => [(0, pg_core_1.index)("IDX_tenants_domain").on(table.domain)],
);
exports.tenantUsers = (0, pg_core_1.pgTable)(
  "tenant_users",
  {
    tenantId: (0, pg_core_1.varchar)("tenant_id")
      .notNull()
      .references(() => exports.tenants.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.varchar)("user_id").notNull(),
    role: (0, pg_core_1.varchar)("role").notNull().default("member").$type(),
    joinedAt: (0, pg_core_1.timestamp)("joined_at").defaultNow().notNull(),
  },
  (table) => [
    (0, pg_core_1.primaryKey)({ columns: [table.tenantId, table.userId] }),
    (0, pg_core_1.index)("IDX_tenant_users_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_tenant_users_tenant_id").on(table.tenantId),
  ],
);
