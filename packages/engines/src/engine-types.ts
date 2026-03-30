/**
 * Engine registry types for Guardrail.
 * Canonical types live in core-types.ts; these extend for registry use.
 */
import type { ScanEngine } from './core-types';

export interface EngineSlot {
  engine: ScanEngine;
  timeoutMs: number;
  priority: number;
  enabled?: boolean;
  extensions?: Set<string> | null;
}

export interface RegisterEngineOptions {
  timeoutMs?: number;
  priority?: number;
  enabled?: boolean;
  extensions?: Set<string> | null;
}

export interface EngineMetric {
  engineId: string;
  durationMs: number;
  findingCount: number;
  status: 'ok' | 'timeout' | 'error' | 'circuit-open' | 'skipped';
  error?: string;
}

export interface ScanTelemetry {
  scanId: string;
  documentUri: string;
  languageId: string;
  fileSizeBytes: number;
  deltaLineCount: number;
  totalDurationMs: number;
  engineResults: EngineMetric[];
  findingCount: number;
  deduplicatedCount: number;
  aborted: boolean;
}
