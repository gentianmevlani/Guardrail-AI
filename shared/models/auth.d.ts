export declare const sessions: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "sessions";
  schema: undefined;
  columns: {
    sid: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "sid";
        tableName: "sessions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    sess: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "sess";
        tableName: "sessions";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    expire: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "expire";
        tableName: "sessions";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const users: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "users";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    email: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "email";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    passwordHash: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "password";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    firstName: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "name";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    lastName: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "last_name";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    profileImageUrl: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "avatar";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    provider: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "provider";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    providerId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "provider_id";
        tableName: "users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    emailVerified: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "email_verified";
        tableName: "users";
        dataType: "boolean";
        columnType: "PgBoolean";
        data: boolean;
        driverParam: boolean;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "createdAt";
        tableName: "users";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    updatedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "updatedAt";
        tableName: "users";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const refreshTokens: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "refresh_tokens";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "refresh_tokens";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    userId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "user_id";
        tableName: "refresh_tokens";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    token: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "token";
        tableName: "refresh_tokens";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    expiresAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "expires_at";
        tableName: "refresh_tokens";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    revoked: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "revoked";
        tableName: "refresh_tokens";
        dataType: "boolean";
        columnType: "PgBoolean";
        data: boolean;
        driverParam: boolean;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "refresh_tokens";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const tokenBlacklist: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "token_blacklist";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "token_blacklist";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    tokenHash: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "token_hash";
        tableName: "token_blacklist";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    expiresAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "expires_at";
        tableName: "token_blacklist";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "token_blacklist";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const subscriptions: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "subscriptions";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "subscriptions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    userId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "userId";
        tableName: "subscriptions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    stripeCustomerId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "stripeCustomerId";
        tableName: "subscriptions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    stripeSubscriptionId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "stripeSubscriptionId";
        tableName: "subscriptions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    tier: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "tier";
        tableName: "subscriptions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    status: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "status";
        tableName: "subscriptions";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    currentPeriodStart: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "currentPeriodStart";
        tableName: "subscriptions";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    currentPeriodEnd: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "currentPeriodEnd";
        tableName: "subscriptions";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    cancelAtPeriodEnd: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "cancelAtPeriodEnd";
        tableName: "subscriptions";
        dataType: "boolean";
        columnType: "PgBoolean";
        data: boolean;
        driverParam: boolean;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "createdAt";
        tableName: "subscriptions";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    updatedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "updatedAt";
        tableName: "subscriptions";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: false;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const notifications: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "notifications";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    userId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "user_id";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    type: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "type";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: "security" | "compliance" | "system" | "billing";
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
        $type: "security" | "compliance" | "system" | "billing";
      }
    >;
    title: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "title";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    message: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "message";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    severity: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "severity";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: "warning" | "error" | "info" | "success";
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
        $type: "warning" | "error" | "info" | "success";
      }
    >;
    read: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "read";
        tableName: "notifications";
        dataType: "boolean";
        columnType: "PgBoolean";
        data: boolean;
        driverParam: boolean;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    actionUrl: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "action_url";
        tableName: "notifications";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: false;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "notifications";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const tenants: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "tenants";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "tenants";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: true;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    name: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "name";
        tableName: "tenants";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    domain: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "domain";
        tableName: "tenants";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    status: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "status";
        tableName: "tenants";
        dataType: "string";
        columnType: "PgVarchar";
        data: "active" | "inactive" | "suspended";
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
        $type: "active" | "inactive" | "suspended";
      }
    >;
    plan: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "plan";
        tableName: "tenants";
        dataType: "string";
        columnType: "PgVarchar";
        data: "free" | "pro" | "enterprise";
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
        $type: "free" | "pro" | "enterprise";
      }
    >;
    settings: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "settings";
        tableName: "tenants";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    limits: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "limits";
        tableName: "tenants";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    usage: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "usage";
        tableName: "tenants";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "tenants";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
    updatedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "updated_at";
        tableName: "tenants";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
export declare const tenantUsers: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "tenant_users";
  schema: undefined;
  columns: {
    tenantId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "tenant_id";
        tableName: "tenant_users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    userId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "user_id";
        tableName: "tenant_users";
        dataType: "string";
        columnType: "PgVarchar";
        data: string;
        driverParam: string;
        notNull: true;
        hasDefault: false;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
      }
    >;
    role: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "role";
        tableName: "tenant_users";
        dataType: "string";
        columnType: "PgVarchar";
        data: "member" | "owner" | "admin" | "viewer";
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: [string, ...string[]];
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {
        length: number | undefined;
        $type: "member" | "owner" | "admin" | "viewer";
      }
    >;
    joinedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "joined_at";
        tableName: "tenant_users";
        dataType: "date";
        columnType: "PgTimestamp";
        data: Date;
        driverParam: string;
        notNull: true;
        hasDefault: true;
        isPrimaryKey: false;
        isAutoincrement: false;
        hasRuntimeDefault: false;
        enumValues: undefined;
        baseColumn: never;
        identity: undefined;
        generated: undefined;
      },
      {},
      {}
    >;
  };
  dialect: "pg";
}>;
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
//# sourceMappingURL=auth.d.ts.map
