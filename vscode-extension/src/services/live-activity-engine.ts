/**
 * Live Activity Engine — real-time event bus for all guardrail services.
 *
 * Emits typed events that the sidebar and other UI surfaces can subscribe to,
 * making the extension feel alive and responsive rather than static.
 */

import * as vscode from "vscode";

// ── Event types ──

export type ServiceId =
  | "context-engine"
  | "security-scanner"
  | "vibe-check"
  | "template-engine"
  | "reality-check"
  | "compliance"
  | "performance"
  | "change-impact"
  | "ai-explainer"
  | "production-integrity"
  | "mdc-generator"
  | "code-health"
  | "hallucination-guard"
  | "accessibility"
  | "doc-coverage"
  | "code-dna"
  | "dep-impact"
  | "duplicate-detector";

export type ServiceStatus = "idle" | "active" | "watching" | "alert" | "success" | "error";

export interface ServiceHeartbeat {
  id: ServiceId;
  status: ServiceStatus;
  label: string;
  detail?: string;
  timestamp: number;
}

export type ActivityType =
  | "file-scanned"
  | "context-updated"
  | "vibe-scored"
  | "template-applied"
  | "finding-detected"
  | "finding-resolved"
  | "scan-started"
  | "scan-completed"
  | "service-activated"
  | "workspace-indexed"
  | "secret-detected"
  | "vulnerability-found"
  | "guard-passed"
  | "guard-failed";

export interface ActivityEvent {
  type: ActivityType;
  message: string;
  icon: string;       // Material Symbols icon name
  accent?: string;    // CSS color override
  service: ServiceId;
  timestamp: number;
  file?: string;      // Relative file path if applicable
}

export interface LiveSnapshot {
  services: ServiceHeartbeat[];
  recentActivity: ActivityEvent[];
  filesWatched: number;
  findingsLive: number;
  contextScore: number;    // 0-100 context freshness
  lastScanAge: string;     // "2m ago", "just now", etc.
  isScanning: boolean;
}

// ── Engine ──

const MAX_ACTIVITY_ITEMS = 50;
const HEARTBEAT_DECAY_MS = 30_000; // services decay to "idle" after 30s of no activity

export class LiveActivityEngine implements vscode.Disposable {
  private static _instance: LiveActivityEngine | undefined;

  private _onActivity = new vscode.EventEmitter<ActivityEvent>();
  private _onHeartbeat = new vscode.EventEmitter<ServiceHeartbeat>();
  private _onSnapshot = new vscode.EventEmitter<LiveSnapshot>();

  /** Subscribe to individual activity events */
  public readonly onActivity = this._onActivity.event;
  /** Subscribe to service heartbeat changes */
  public readonly onHeartbeat = this._onHeartbeat.event;
  /** Subscribe to full snapshot updates (throttled) */
  public readonly onSnapshot = this._onSnapshot.event;

  private _services = new Map<ServiceId, ServiceHeartbeat>();
  private _activity: ActivityEvent[] = [];
  private _filesWatched = 0;
  private _findingsLive = 0;
  private _contextScore = 0;
  private _lastScanTime: number | null = null;
  private _isScanning = false;
  private _snapshotTimer: ReturnType<typeof setInterval> | undefined;
  private _decayTimer: ReturnType<typeof setInterval> | undefined;
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    LiveActivityEngine._instance = this;

    // Initialize all services as idle
    const serviceLabels: Record<ServiceId, string> = {
      "context-engine": "Context Engine",
      "security-scanner": "Security Scanner",
      "vibe-check": "Vibe Check",
      "template-engine": "Template Engine",
      "reality-check": "Reality Check",
      "compliance": "Compliance",
      "performance": "Performance",
      "change-impact": "Change Impact",
      "ai-explainer": "AI Explainer",
      "production-integrity": "Production Integrity",
      "mdc-generator": "MDC Generator",
      "code-health": "Code Health",
      "hallucination-guard": "Hallucination Guard",
      "accessibility": "Accessibility",
      "doc-coverage": "Doc Coverage",
      "code-dna": "Code DNA",
      "dep-impact": "Dependency Impact",
      "duplicate-detector": "Duplicate Detector",
    };

    for (const [id, label] of Object.entries(serviceLabels)) {
      this._services.set(id as ServiceId, {
        id: id as ServiceId,
        status: "idle",
        label,
        timestamp: Date.now(),
      });
    }

    // Emit snapshots every 2 seconds for smooth UI updates
    this._snapshotTimer = setInterval(() => {
      this._emitSnapshot();
    }, 2000);

    // Decay active services back to idle/watching if no activity
    this._decayTimer = setInterval(() => {
      this._decayServices();
    }, 5000);
  }

  static getInstance(): LiveActivityEngine {
    if (!LiveActivityEngine._instance) {
      LiveActivityEngine._instance = new LiveActivityEngine();
    }
    return LiveActivityEngine._instance;
  }

  // ── Public API ──

  /** Update a service's heartbeat status */
  pulse(id: ServiceId, status: ServiceStatus, detail?: string): void {
    const existing = this._services.get(id);
    if (!existing) return;

    const updated: ServiceHeartbeat = {
      ...existing,
      status,
      detail,
      timestamp: Date.now(),
    };
    this._services.set(id, updated);
    this._onHeartbeat.fire(updated);
  }

  /** Push an activity event */
  emit(event: Omit<ActivityEvent, "timestamp">): void {
    const full: ActivityEvent = { ...event, timestamp: Date.now() };
    this._activity.unshift(full);
    if (this._activity.length > MAX_ACTIVITY_ITEMS) {
      this._activity.length = MAX_ACTIVITY_ITEMS;
    }
    this._onActivity.fire(full);

    // Auto-pulse the service as active
    this.pulse(event.service, "active", event.message);
  }

  /** Convenience: emit a file-scanned event */
  fileScanned(relativePath: string, findingCount: number): void {
    this.emit({
      type: findingCount > 0 ? "finding-detected" : "file-scanned",
      message: findingCount > 0
        ? `${findingCount} finding${findingCount > 1 ? "s" : ""} in ${relativePath}`
        : `${relativePath} — clean`,
      icon: findingCount > 0 ? "warning" : "check_circle",
      accent: findingCount > 0 ? "var(--tertiary)" : "var(--primary-fixed-dim)",
      service: "reality-check",
      file: relativePath,
    });
  }

  /** Convenience: context engine updated */
  contextUpdated(detail: string): void {
    this._contextScore = Math.min(100, this._contextScore + 5);
    this.emit({
      type: "context-updated",
      message: detail,
      icon: "psychology",
      service: "context-engine",
    });
  }

  /** Convenience: scan lifecycle */
  scanStarted(): void {
    this._isScanning = true;
    this.emit({
      type: "scan-started",
      message: "Workspace scan initiated",
      icon: "radar",
      accent: "var(--secondary)",
      service: "reality-check",
    });
  }

  scanCompleted(score: number, findings: number): void {
    this._isScanning = false;
    this._lastScanTime = Date.now();
    this._findingsLive = findings;
    this.emit({
      type: "scan-completed",
      message: `Score: ${score}/100 — ${findings} finding${findings !== 1 ? "s" : ""}`,
      icon: score >= 80 ? "verified" : score >= 50 ? "info" : "error",
      accent: score >= 80 ? "#6bcb77" : score >= 50 ? "var(--secondary)" : "var(--error)",
      service: "reality-check",
    });
  }

  /** Convenience: vibe check scored */
  vibeScored(score: number, canShip: boolean): void {
    this.emit({
      type: "vibe-scored",
      message: canShip
        ? `Ship-ready! Score: ${score}/100`
        : `Score: ${score}/100 — not ship-ready`,
      icon: canShip ? "rocket_launch" : "construction",
      accent: canShip ? "#6bcb77" : "var(--tertiary)",
      service: "vibe-check",
    });
  }

  /** Convenience: template applied */
  templateApplied(templateName: string): void {
    this.emit({
      type: "template-applied",
      message: `Applied: ${templateName}`,
      icon: "file_copy",
      accent: "var(--secondary)",
      service: "template-engine",
    });
  }

  /** Update files-watched counter (from workspace indexing) */
  setFilesWatched(count: number): void {
    this._filesWatched = count;
  }

  /** Update live findings counter */
  setFindingsLive(count: number): void {
    this._findingsLive = count;
  }

  /** Get current snapshot */
  getSnapshot(): LiveSnapshot {
    return {
      services: Array.from(this._services.values()),
      recentActivity: this._activity.slice(0, 15),
      filesWatched: this._filesWatched,
      findingsLive: this._findingsLive,
      contextScore: this._contextScore,
      lastScanAge: this._formatAge(this._lastScanTime),
      isScanning: this._isScanning,
    };
  }

  // ── Internal ──

  private _emitSnapshot(): void {
    this._onSnapshot.fire(this.getSnapshot());
  }

  private _decayServices(): void {
    const now = Date.now();
    for (const [id, svc] of this._services) {
      if (svc.status === "active" && now - svc.timestamp > HEARTBEAT_DECAY_MS) {
        this.pulse(id, "watching");
      }
    }
  }

  private _formatAge(ts: number | null): string {
    if (!ts) return "never";
    const delta = Date.now() - ts;
    if (delta < 5000) return "just now";
    if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    return `${Math.floor(delta / 3_600_000)}h ago`;
  }

  dispose(): void {
    if (this._snapshotTimer) clearInterval(this._snapshotTimer);
    if (this._decayTimer) clearInterval(this._decayTimer);
    this._onActivity.dispose();
    this._onHeartbeat.dispose();
    this._onSnapshot.dispose();
    this._disposables.forEach(d => d.dispose());
    if (LiveActivityEngine._instance === this) {
      LiveActivityEngine._instance = undefined;
    }
  }
}
