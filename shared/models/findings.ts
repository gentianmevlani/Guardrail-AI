import { sql, relations } from "drizzle-orm";
import { index, pgTable, timestamp, varchar, integer, jsonb, text } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const scans = pgTable(
  "scans",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    projectId: varchar("project_id"),
    repoName: varchar("repo_name"),
    repoBranch: varchar("repo_branch").default("main"),
    scanType: varchar("scan_type").notNull().default("quick"),
    status: varchar("status").notNull().default("pending"),
    progress: integer("progress").default(0),
    totalFindings: integer("total_findings").default(0),
    summary: jsonb("summary"),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_scans_user_id").on(table.userId),
    index("IDX_scans_status").on(table.status),
  ]
);

export const findings = pgTable(
  "findings",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    scanId: varchar("scan_id").notNull().references(() => scans.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    severity: varchar("severity").notNull().default("medium"),
    status: varchar("status").notNull().default("open"),
    rule: varchar("rule").notNull(),
    message: text("message").notNull(),
    file: varchar("file").notNull(),
    line: integer("line").default(1),
    column: integer("column"),
    codeSnippet: text("code_snippet"),
    repo: varchar("repo"),
    branch: varchar("branch").default("main"),
    fixable: varchar("fixable").default("false"),
    recommendation: text("recommendation"),
    cwe: varchar("cwe"),
    cve: varchar("cve"),
    owasp: varchar("owasp"),
    confidence: integer("confidence").default(100),
    metadata: jsonb("metadata"),
    firstSeen: timestamp("first_seen").defaultNow(),
    lastSeen: timestamp("last_seen").defaultNow(),
    occurrences: integer("occurrences").default(1),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("IDX_findings_user_id").on(table.userId),
    index("IDX_findings_scan_id").on(table.scanId),
    index("IDX_findings_severity").on(table.severity),
    index("IDX_findings_status").on(table.status),
  ]
);

export const scansRelations = relations(scans, ({ one, many }) => ({
  user: one(users, {
    fields: [scans.userId],
    references: [users.id],
  }),
  findings: many(findings),
}));

export const findingsRelations = relations(findings, ({ one }) => ({
  scan: one(scans, {
    fields: [findings.scanId],
    references: [scans.id],
  }),
  user: one(users, {
    fields: [findings.userId],
    references: [users.id],
  }),
}));

export type Scan = typeof scans.$inferSelect;
export type InsertScan = typeof scans.$inferInsert;
export type Finding = typeof findings.$inferSelect;
export type InsertFinding = typeof findings.$inferInsert;

// Runs table for Ship Badge / Reality Mode
export const runs = pgTable(
  "runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    repo: varchar("repo").notNull(),
    branch: varchar("branch").default("main"),
    commitSha: varchar("commit_sha"),
    verdict: varchar("verdict").notNull().default("pending"),
    score: integer("score").default(0),
    status: varchar("status").notNull().default("pending"),
    progress: integer("progress").default(0),
    securityResult: jsonb("security_result"),
    realityResult: jsonb("reality_result"),
    guardrailResult: jsonb("guardrail_result"),
    traceUrl: varchar("trace_url"),
    videoUrl: varchar("video_url"),
    reportJson: jsonb("report_json"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_runs_user_id").on(table.userId),
    index("IDX_runs_verdict").on(table.verdict),
    index("IDX_runs_status").on(table.status),
    index("IDX_runs_repo").on(table.repo),
  ]
);

export const runsRelations = relations(runs, ({ one }) => ({
  user: one(users, {
    fields: [runs.userId],
    references: [users.id],
  }),
}));

export type Run = typeof runs.$inferSelect;
export type InsertRun = typeof runs.$inferInsert;

export const reports = pgTable(
  "reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    projectId: varchar("project_id").notNull(),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type").notNull().default("custom"),
    format: varchar("format").notNull().default("json"),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("IDX_reports_user_id").on(table.userId),
    index("IDX_reports_project_id").on(table.projectId),
    index("IDX_reports_created_at").on(table.createdAt),
  ]
);

export const reportsRelations = relations(reports, ({ one }) => ({
  user: one(users, {
    fields: [reports.userId],
    references: [users.id],
  }),
}));

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;
