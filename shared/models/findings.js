"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportsRelations =
  exports.reports =
  exports.runsRelations =
  exports.runs =
  exports.findingsRelations =
  exports.scansRelations =
  exports.findings =
  exports.scans =
    void 0;
const drizzle_orm_1 = require("drizzle-orm");
const pg_core_1 = require("drizzle-orm/pg-core");
const auth_1 = require("./auth");
exports.scans = (0, pg_core_1.pgTable)(
  "scans",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id")
      .notNull()
      .references(() => auth_1.users.id, { onDelete: "cascade" }),
    projectId: (0, pg_core_1.varchar)("project_id"),
    repoName: (0, pg_core_1.varchar)("repo_name"),
    repoBranch: (0, pg_core_1.varchar)("repo_branch").default("main"),
    scanType: (0, pg_core_1.varchar)("scan_type").notNull().default("quick"),
    status: (0, pg_core_1.varchar)("status").notNull().default("pending"),
    progress: (0, pg_core_1.integer)("progress").default(0),
    totalFindings: (0, pg_core_1.integer)("total_findings").default(0),
    summary: (0, pg_core_1.jsonb)("summary"),
    startedAt: (0, pg_core_1.timestamp)("started_at").defaultNow(),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_scans_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_scans_status").on(table.status),
  ],
);
exports.findings = (0, pg_core_1.pgTable)(
  "findings",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    scanId: (0, pg_core_1.varchar)("scan_id")
      .notNull()
      .references(() => exports.scans.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.varchar)("user_id")
      .notNull()
      .references(() => auth_1.users.id, { onDelete: "cascade" }),
    severity: (0, pg_core_1.varchar)("severity").notNull().default("medium"),
    status: (0, pg_core_1.varchar)("status").notNull().default("open"),
    rule: (0, pg_core_1.varchar)("rule").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    file: (0, pg_core_1.varchar)("file").notNull(),
    line: (0, pg_core_1.integer)("line").default(1),
    column: (0, pg_core_1.integer)("column"),
    codeSnippet: (0, pg_core_1.text)("code_snippet"),
    repo: (0, pg_core_1.varchar)("repo"),
    branch: (0, pg_core_1.varchar)("branch").default("main"),
    fixable: (0, pg_core_1.varchar)("fixable").default("false"),
    recommendation: (0, pg_core_1.text)("recommendation"),
    cwe: (0, pg_core_1.varchar)("cwe"),
    cve: (0, pg_core_1.varchar)("cve"),
    owasp: (0, pg_core_1.varchar)("owasp"),
    confidence: (0, pg_core_1.integer)("confidence").default(100),
    metadata: (0, pg_core_1.jsonb)("metadata"),
    firstSeen: (0, pg_core_1.timestamp)("first_seen").defaultNow(),
    lastSeen: (0, pg_core_1.timestamp)("last_seen").defaultNow(),
    occurrences: (0, pg_core_1.integer)("occurrences").default(1),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_findings_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_findings_scan_id").on(table.scanId),
    (0, pg_core_1.index)("IDX_findings_severity").on(table.severity),
    (0, pg_core_1.index)("IDX_findings_status").on(table.status),
  ],
);
exports.scansRelations = (0, drizzle_orm_1.relations)(
  exports.scans,
  ({ one, many }) => ({
    user: one(auth_1.users, {
      fields: [exports.scans.userId],
      references: [auth_1.users.id],
    }),
    findings: many(exports.findings),
  }),
);
exports.findingsRelations = (0, drizzle_orm_1.relations)(
  exports.findings,
  ({ one }) => ({
    scan: one(exports.scans, {
      fields: [exports.findings.scanId],
      references: [exports.scans.id],
    }),
    user: one(auth_1.users, {
      fields: [exports.findings.userId],
      references: [auth_1.users.id],
    }),
  }),
);
// Runs table for Ship Badge / Reality Mode
exports.runs = (0, pg_core_1.pgTable)(
  "runs",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    userId: (0, pg_core_1.varchar)("user_id")
      .notNull()
      .references(() => auth_1.users.id, { onDelete: "cascade" }),
    repo: (0, pg_core_1.varchar)("repo").notNull(),
    branch: (0, pg_core_1.varchar)("branch").default("main"),
    commitSha: (0, pg_core_1.varchar)("commit_sha"),
    verdict: (0, pg_core_1.varchar)("verdict").notNull().default("pending"),
    score: (0, pg_core_1.integer)("score").default(0),
    status: (0, pg_core_1.varchar)("status").notNull().default("pending"),
    progress: (0, pg_core_1.integer)("progress").default(0),
    securityResult: (0, pg_core_1.jsonb)("security_result"),
    realityResult: (0, pg_core_1.jsonb)("reality_result"),
    guardrailResult: (0, pg_core_1.jsonb)("guardrail_result"),
    traceUrl: (0, pg_core_1.varchar)("trace_url"),
    videoUrl: (0, pg_core_1.varchar)("video_url"),
    reportJson: (0, pg_core_1.jsonb)("report_json"),
    startedAt: (0, pg_core_1.timestamp)("started_at"),
    completedAt: (0, pg_core_1.timestamp)("completed_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_runs_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_runs_verdict").on(table.verdict),
    (0, pg_core_1.index)("IDX_runs_status").on(table.status),
    (0, pg_core_1.index)("IDX_runs_repo").on(table.repo),
  ],
);
exports.runsRelations = (0, drizzle_orm_1.relations)(
  exports.runs,
  ({ one }) => ({
    user: one(auth_1.users, {
      fields: [exports.runs.userId],
      references: [auth_1.users.id],
    }),
  }),
);
exports.reports = (0, pg_core_1.pgTable)(
  "reports",
  {
    id: (0, pg_core_1.varchar)("id")
      .primaryKey()
      .default((0, drizzle_orm_1.sql)`gen_random_uuid()`),
    projectId: (0, pg_core_1.varchar)("project_id").notNull(),
    userId: (0, pg_core_1.varchar)("user_id")
      .notNull()
      .references(() => auth_1.users.id, { onDelete: "cascade" }),
    type: (0, pg_core_1.varchar)("type").notNull().default("custom"),
    format: (0, pg_core_1.varchar)("format").notNull().default("json"),
    content: (0, pg_core_1.jsonb)("content").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
  },
  (table) => [
    (0, pg_core_1.index)("IDX_reports_user_id").on(table.userId),
    (0, pg_core_1.index)("IDX_reports_project_id").on(table.projectId),
    (0, pg_core_1.index)("IDX_reports_created_at").on(table.createdAt),
  ],
);
exports.reportsRelations = (0, drizzle_orm_1.relations)(
  exports.reports,
  ({ one }) => ({
    user: one(auth_1.users, {
      fields: [exports.reports.userId],
      references: [auth_1.users.id],
    }),
  }),
);
