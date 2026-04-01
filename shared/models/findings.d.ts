export declare const scans: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "scans";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "scans";
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
        tableName: "scans";
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
    projectId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "project_id";
        tableName: "scans";
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
    repoName: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "repo_name";
        tableName: "scans";
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
    repoBranch: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "repo_branch";
        tableName: "scans";
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
    scanType: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "scan_type";
        tableName: "scans";
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
        tableName: "scans";
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
    progress: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "progress";
        tableName: "scans";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    totalFindings: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "total_findings";
        tableName: "scans";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    summary: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "summary";
        tableName: "scans";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
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
    startedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "started_at";
        tableName: "scans";
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
    completedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "completed_at";
        tableName: "scans";
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
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "scans";
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
export declare const findings: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "findings";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "findings";
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
    scanId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "scan_id";
        tableName: "findings";
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
        tableName: "findings";
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
        tableName: "findings";
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
        tableName: "findings";
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
    rule: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "rule";
        tableName: "findings";
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
        tableName: "findings";
        dataType: "string";
        columnType: "PgText";
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
      {}
    >;
    file: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "file";
        tableName: "findings";
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
    line: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "line";
        tableName: "findings";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    column: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "column";
        tableName: "findings";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    codeSnippet: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "code_snippet";
        tableName: "findings";
        dataType: "string";
        columnType: "PgText";
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
      {}
    >;
    repo: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "repo";
        tableName: "findings";
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
    branch: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "branch";
        tableName: "findings";
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
    fixable: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "fixable";
        tableName: "findings";
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
    recommendation: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "recommendation";
        tableName: "findings";
        dataType: "string";
        columnType: "PgText";
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
      {}
    >;
    cwe: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "cwe";
        tableName: "findings";
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
    cve: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "cve";
        tableName: "findings";
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
    owasp: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "owasp";
        tableName: "findings";
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
    confidence: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "confidence";
        tableName: "findings";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    metadata: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "metadata";
        tableName: "findings";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
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
    firstSeen: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "first_seen";
        tableName: "findings";
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
    lastSeen: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "last_seen";
        tableName: "findings";
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
    occurrences: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "occurrences";
        tableName: "findings";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
        tableName: "findings";
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
        name: "updated_at";
        tableName: "findings";
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
export declare const scansRelations: import("drizzle-orm").Relations<
  "scans",
  {
    user: import("drizzle-orm").One<"users", true>;
    findings: import("drizzle-orm").Many<"findings">;
  }
>;
export declare const findingsRelations: import("drizzle-orm").Relations<
  "findings",
  {
    scan: import("drizzle-orm").One<"scans", true>;
    user: import("drizzle-orm").One<"users", true>;
  }
>;
export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;
export declare const runs: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "runs";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "runs";
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
        tableName: "runs";
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
    repo: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "repo";
        tableName: "runs";
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
    branch: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "branch";
        tableName: "runs";
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
    commitSha: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "commit_sha";
        tableName: "runs";
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
    verdict: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "verdict";
        tableName: "runs";
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
    score: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "score";
        tableName: "runs";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    status: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "status";
        tableName: "runs";
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
    progress: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "progress";
        tableName: "runs";
        dataType: "number";
        columnType: "PgInteger";
        data: number;
        driverParam: string | number;
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
    securityResult: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "security_result";
        tableName: "runs";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
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
    realityResult: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "reality_result";
        tableName: "runs";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
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
    guardrailResult: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "guardrail_result";
        tableName: "runs";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
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
    traceUrl: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "trace_url";
        tableName: "runs";
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
    videoUrl: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "video_url";
        tableName: "runs";
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
    reportJson: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "report_json";
        tableName: "runs";
        dataType: "json";
        columnType: "PgJsonb";
        data: unknown;
        driverParam: unknown;
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
    startedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "started_at";
        tableName: "runs";
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
    completedAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "completed_at";
        tableName: "runs";
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
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "runs";
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
export declare const runsRelations: import("drizzle-orm").Relations<
  "runs",
  {
    user: import("drizzle-orm").One<"users", true>;
  }
>;
export type Run = typeof runs.$inferSelect;
export type InsertRun = typeof runs.$inferInsert;
export declare const reports: import("drizzle-orm/pg-core").PgTableWithColumns<{
  name: "reports";
  schema: undefined;
  columns: {
    id: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "id";
        tableName: "reports";
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
    projectId: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "project_id";
        tableName: "reports";
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
        tableName: "reports";
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
        tableName: "reports";
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
    format: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "format";
        tableName: "reports";
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
    content: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "content";
        tableName: "reports";
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
    createdAt: import("drizzle-orm/pg-core").PgColumn<
      {
        name: "created_at";
        tableName: "reports";
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
export declare const reportsRelations: import("drizzle-orm").Relations<
  "reports",
  {
    user: import("drizzle-orm").One<"users", true>;
  }
>;
export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
//# sourceMappingURL=findings.d.ts.map
