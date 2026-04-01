/**
 * Shared types for runs API and execution pipeline
 */

export interface SecurityResult {
  verdict: string;
  critical?: number;
  high?: number;
  medium?: number;
  low?: number;
  total?: number;
  scannedFiles?: number;
  totalFiles?: number;
  detections?: unknown[];
  byType?: Record<string, number>;
  note?: string;
  error?: string;
}

export interface RealityResult {
  verdict: string;
  totalTests?: number;
  passed?: number;
  failed?: number;
  skipped?: number;
  duration?: number;
  failures?: unknown[];
  message?: string;
  error?: string;
}

export interface GuardrailResult {
  verdict: string;
  score?: number;
  checks?: Record<string, boolean>;
  violations?: string[];
  findings?: unknown[];
  filesScanned?: number;
  error?: string;
}

export interface RunResponse {
  id: string;
  repo: string;
  branch: string;
  commitSha?: string;
  verdict: string;
  score: number;
  status: string;
  progress: number;
  securityResult?: SecurityResult | null;
  realityResult?: RealityResult | null;
  guardrailResult?: GuardrailResult | null;
  traceUrl?: string;
  videoUrl?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface RunDbRow {
  id: string;
  user_id: string;
  repo: string;
  branch: string;
  commit_sha?: string;
  verdict: string;
  score: number;
  status: string;
  progress: number;
  security_result?: Record<string, unknown> | null;
  reality_result?: Record<string, unknown> | null;
  guardrail_result?: Record<string, unknown> | null;
  trace_url?: string;
  video_url?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at?: Date;
}

export interface CountDbRow {
  total: string;
  running_count?: string;
  completed_count?: string;
  failed_count?: string;
  pass_count?: string;
  fail_count?: string;
  review_count?: string;
  avg_score?: string;
}
