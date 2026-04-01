/**
 * CLI scan adapter — bridges `scan` / `guard` commands to @guardrail/engines.
 */
import {
  createDefaultRegistry,
  type DeltaContext,
  type Finding,
  type EngineRegistry,
} from '@guardrail/engines';

export interface PolicyViolation {
  ruleId: string;
  severity: string;
  message: string;
  engine: string;
  autoRemediable: boolean;
}

export interface GuardrailScanResult {
  documentUri: string;
  findings: Finding[];
  blocked: boolean;
  policyViolations: PolicyViolation[];
}

export interface GuardrailScanAdapter {
  activate(): Promise<void>;
  dispose(): void;
  scan(
    delta: DeltaContext,
    opts: {
      engines: string[] | null;
      minSeverity?: string;
      initiatedBy: string;
    }
  ): Promise<GuardrailScanResult>;
  getEngineStats(): Array<{ id: string; enabled: boolean }>;
  getAuditLog(): Array<{
    timestamp: Date;
    blocked: boolean;
    findingCount: number;
    documentUri: string;
  }>;
}

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

class EnginesBackedAdapter implements GuardrailScanAdapter {
  private readonly registry: EngineRegistry;
  private readonly auditLog: Array<{
    timestamp: Date;
    blocked: boolean;
    findingCount: number;
    documentUri: string;
  }> = [];

  constructor() {
    this.registry = createDefaultRegistry();
  }

  async activate(): Promise<void> {
    await this.registry.activateAll();
  }

  dispose(): void {
    this.registry.dispose();
  }

  async scan(
    delta: DeltaContext,
    opts: {
      engines: string[] | null;
      minSeverity?: string;
      initiatedBy: string;
    }
  ): Promise<GuardrailScanResult> {
    const parent = new AbortController();
    const findings: Finding[] = [];
    const wantEngines = opts.engines;
    const minSev = opts.minSeverity?.toLowerCase();
    const minRank =
      minSev !== undefined && minSev in SEVERITY_ORDER
        ? SEVERITY_ORDER[minSev]!
        : undefined;

    for (const slot of this.registry.getActive()) {
      if (wantEngines && wantEngines.length > 0 && !wantEngines.includes(slot.engine.id)) {
        continue;
      }
      const { findings: chunk } = await this.registry.runEngine(slot, delta, parent.signal);
      findings.push(...chunk);
    }

    const filtered =
      minRank === undefined
        ? findings
        : findings.filter((f) => {
            const r = SEVERITY_ORDER[f.severity] ?? 99;
            return r <= minRank;
          });

    const blocked = filtered.some((f) => f.severity === 'critical' || f.severity === 'high');

    this.auditLog.push({
      timestamp: new Date(),
      blocked,
      findingCount: filtered.length,
      documentUri: delta.documentUri,
    });

    void opts.initiatedBy;

    return {
      documentUri: delta.documentUri,
      findings: filtered,
      blocked,
      policyViolations: [],
    };
  }

  getEngineStats(): Array<{ id: string; enabled: boolean }> {
    return this.registry.getAll().map((slot) => ({
      id: slot.engine.id,
      enabled: slot.enabled !== false,
    }));
  }

  getAuditLog(): Array<{
    timestamp: Date;
    blocked: boolean;
    findingCount: number;
    documentUri: string;
  }> {
    return [...this.auditLog];
  }
}

export function createGuardrailRegistry(): GuardrailScanAdapter {
  return new EnginesBackedAdapter();
}
