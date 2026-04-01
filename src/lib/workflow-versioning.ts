/**
 * Workflow Versioning & Iteration History
<<<<<<< HEAD
 *
 * Track, rollback, fork, and evolve AI workflows.
 * Persists to `.guardrail/workflow-versions.json` when a project root is set.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { Workflow } from "./llm-orchestrator";
=======
 * 
 * Track, rollback, fork, and evolve AI workflows
 */

import { Workflow } from './llm-orchestrator';
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  workflow: Workflow;
  metadata: {
    created: string;
    author: string;
    message: string;
    parentVersion?: string;
    tags: string[];
  };
  metrics: {
    executions: number;
    successRate: number;
    averageExecutionTime: number;
    totalCost: number;
  };
}

export interface IterationHistory {
  workflowId: string;
  versions: WorkflowVersion[];
  currentVersion: number;
  branches: Branch[];
}

export interface Branch {
  id: string;
  name: string;
  baseVersion: number;
  versions: WorkflowVersion[];
}

class WorkflowVersioning {
  private versions: Map<string, WorkflowVersion[]> = new Map();
  private histories: Map<string, IterationHistory> = new Map();
<<<<<<< HEAD
  /** When set, versions are flushed to disk after each mutation. */
  private persistenceRoot: string | null = null;

  /**
   * Enable loading/saving under `projectRoot/.guardrail/workflow-versions.json`.
   */
  setPersistenceRoot(root: string | null): void {
    this.persistenceRoot = root;
  }

  async hydrateFromDisk(projectRoot: string): Promise<void> {
    this.persistenceRoot = projectRoot;
    const file = path.join(projectRoot, ".guardrail", "workflow-versions.json");
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw) as { histories?: Record<string, IterationHistory> };
      const h = parsed.histories;
      if (h && typeof h === "object") {
        this.histories = new Map(Object.entries(h));
        this.versions.clear();
        for (const [wid, hist] of this.histories) {
          this.versions.set(wid, hist.versions);
        }
      }
    } catch {
      /* missing or invalid file */
    }
  }

  private async flushToDisk(): Promise<void> {
    if (!this.persistenceRoot) return;
    const dir = path.join(this.persistenceRoot, ".guardrail");
    const file = path.join(dir, "workflow-versions.json");
    try {
      await fs.mkdir(dir, { recursive: true });
      const histories = Object.fromEntries(this.histories);
      await fs.writeFile(
        file,
        JSON.stringify({ v: 1, histories }, null, 2),
        "utf8",
      );
    } catch {
      /* disk errors ignored — in-memory still works */
    }
  }
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7

  /**
   * Save workflow version
   */
  async saveVersion(
    workflow: Workflow,
    message: string = 'Auto-saved',
    author: string = 'system'
  ): Promise<WorkflowVersion> {
    const history = this.getOrCreateHistory(workflow.id);
    const versionNumber = history.currentVersion + 1;

    const version: WorkflowVersion = {
      id: this.generateId(),
      workflowId: workflow.id,
      version: versionNumber,
      workflow: JSON.parse(JSON.stringify(workflow)), // Deep clone
      metadata: {
        created: new Date().toISOString(),
        author,
        message,
        parentVersion: history.versions[history.versions.length - 1]?.id,
        tags: [],
      },
      metrics: {
        executions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        totalCost: 0,
      },
    };

    history.versions.push(version);
    history.currentVersion = versionNumber;

    const versions = this.versions.get(workflow.id) || [];
    versions.push(version);
    this.versions.set(workflow.id, versions);
    this.histories.set(workflow.id, history);

<<<<<<< HEAD
    await this.flushToDisk();

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    return version;
  }

  /**
   * Rollback to previous version
   */
  async rollback(workflowId: string, targetVersion: number): Promise<Workflow> {
    const history = this.histories.get(workflowId);
    if (!history) {
      throw new Error(`No history found for workflow: ${workflowId}`);
    }

    const targetVersionData = history.versions.find(v => v.version === targetVersion);
    if (!targetVersionData) {
      throw new Error(`Version ${targetVersion} not found`);
    }

    // Create new version from rollback
    const rolledBack = await this.saveVersion(
      targetVersionData.workflow,
      `Rolled back to version ${targetVersion}`,
      'system'
    );

    return rolledBack.workflow;
  }

  /**
   * Fork workflow (create branch)
   */
  async forkWorkflow(
    workflowId: string,
    baseVersion: number,
    branchName: string
  ): Promise<Branch> {
    const history = this.histories.get(workflowId);
    if (!history) {
      throw new Error(`No history found for workflow: ${workflowId}`);
    }

    const baseVersionData = history.versions.find(v => v.version === baseVersion);
    if (!baseVersionData) {
      throw new Error(`Version ${baseVersion} not found`);
    }

    const branch: Branch = {
      id: this.generateId(),
      name: branchName,
      baseVersion,
      versions: [baseVersionData],
    };

    history.branches.push(branch);
    this.histories.set(workflowId, history);

<<<<<<< HEAD
    void this.flushToDisk();

=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
    return branch;
  }

  /**
   * Get iteration history
   */
  getHistory(workflowId: string): IterationHistory | undefined {
    return this.histories.get(workflowId);
  }

  /**
   * Compare versions
   */
  compareVersions(workflowId: string, version1: number, version2: number): {
    added: Array<Record<string, unknown>>;
    removed: Array<Record<string, unknown>>;
    modified: Array<Record<string, unknown>>;
  } {
    const history = this.histories.get(workflowId);
    if (!history) {
      throw new Error(`No history found for workflow: ${workflowId}`);
    }

    const v1 = history.versions.find(v => v.version === version1);
    const v2 = history.versions.find(v => v.version === version2);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    return this.diffWorkflows(v1.workflow, v2.workflow);
  }

  /**
   * Update metrics
   */
  updateMetrics(
    workflowId: string,
    version: number,
    metrics: Partial<WorkflowVersion['metrics']>
  ): void {
    const history = this.histories.get(workflowId);
    if (!history) return;

    const versionData = history.versions.find(v => v.version === version);
    if (!versionData) return;

    Object.assign(versionData.metrics, metrics);
    this.histories.set(workflowId, history);
<<<<<<< HEAD
    void this.flushToDisk();
=======
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  }

  // Private methods
  private getOrCreateHistory(workflowId: string): IterationHistory {
    let history = this.histories.get(workflowId);
    if (!history) {
      history = {
        workflowId,
        versions: [],
        currentVersion: 0,
        branches: [],
      };
      this.histories.set(workflowId, history);
    }
    return history;
  }

  private diffWorkflows(w1: Workflow, w2: Workflow): {
    added: Array<Record<string, unknown>>;
    removed: Array<Record<string, unknown>>;
    modified: Array<Record<string, unknown>>;
  } {
    const added: any[] = [];
    const removed: any[] = [];
    const modified: any[] = [];

    const nodes1 = new Map(w1.nodes.map(n => [n.id, n]));
    const nodes2 = new Map(w2.nodes.map(n => [n.id, n]));

    // Find added nodes
    for (const [id, node] of nodes2.entries()) {
      if (!nodes1.has(id)) {
        added.push({ type: 'node', id, node });
      }
    }

    // Find removed nodes
    for (const [id, node] of nodes1.entries()) {
      if (!nodes2.has(id)) {
        removed.push({ type: 'node', id, node });
      }
    }

    // Find modified nodes
    for (const [id, node1] of nodes1.entries()) {
      const node2 = nodes2.get(id);
      if (node2 && JSON.stringify(node1) !== JSON.stringify(node2)) {
        modified.push({ type: 'node', id, before: node1, after: node2 });
      }
    }

    return { added, removed, modified };
  }

  private generateId(): string {
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const workflowVersioning = new WorkflowVersioning();

