/**
 * Team Collaboration
 * 
 * Team workspace management, shared configurations, and knowledge base sync
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodebaseKnowledge } from './codebase-knowledge';
import { GuardrailRule } from './universal-guardrails';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface TeamWorkspace {
  id: string;
  name: string;
  members: string[];
  config: TeamConfig;
  sharedRules: GuardrailRule[];
  lastSynced: string;
}

export interface TeamConfig {
  sharedKnowledgeBase?: boolean;
  ruleSharing?: boolean;
  syncInterval?: number;
  conflictResolution?: 'merge' | 'overwrite' | 'manual';
}

export interface TeamAnalytics {
  workspaceId: string;
  totalMembers: number;
  sharedRules: number;
  knowledgeBaseSize: number;
  lastSync: string;
  syncStatus: 'synced' | 'pending' | 'conflict';
}

class TeamCollaboration {
  private workspaces: Map<string, TeamWorkspace> = new Map();
  private syncDir = '.guardrail-team';

  /**
   * Create or get team workspace
   */
  async createWorkspace(
    workspaceId: string,
    name: string,
    config?: TeamConfig
  ): Promise<TeamWorkspace> {
    const workspace: TeamWorkspace = {
      id: workspaceId,
      name,
      members: [],
      config: {
        sharedKnowledgeBase: true,
        ruleSharing: true,
        syncInterval: 3600000, // 1 hour
        conflictResolution: 'merge',
        ...config,
      },
      sharedRules: [],
      lastSynced: new Date().toISOString(),
    };

    this.workspaces.set(workspaceId, workspace);
    await this.saveWorkspace(workspace);

    return workspace;
  }

  /**
   * Sync knowledge base with team
   */
  async syncKnowledge(
    workspaceId: string,
    projectPath: string
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.config.sharedKnowledgeBase) {
      return; // Sharing disabled
    }

    // Get local knowledge
    const localKnowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!localKnowledge) {
      throw new Error('Local knowledge base not found. Run build-knowledge first.');
    }

    // Save to team sync directory
    const syncPath = path.join(projectPath, this.syncDir, workspaceId);
    await fs.promises.mkdir(syncPath, { recursive: true });

    const knowledgePath = path.join(syncPath, 'knowledge.json');
    await fs.promises.writeFile(
      knowledgePath,
      JSON.stringify(localKnowledge, null, 2)
    );

    workspace.lastSynced = new Date().toISOString();
    await this.saveWorkspace(workspace);

    console.log(`✅ Synced knowledge base to team workspace: ${workspace.name}`);
  }

  /**
   * Share rules with team
   */
  async shareRules(
    workspaceId: string,
    rules: GuardrailRule[]
  ): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.config.ruleSharing) {
      return; // Sharing disabled
    }

    // Merge with existing rules
    const existingIds = new Set(workspace.sharedRules.map(r => r.id));
    for (const rule of rules) {
      if (!existingIds.has(rule.id)) {
        workspace.sharedRules.push(rule);
      }
    }

    await this.saveWorkspace(workspace);
    console.log(`✅ Shared ${rules.length} rule(s) with team`);
  }

  /**
   * Get team analytics
   */
  async getTeamAnalytics(workspaceId: string): Promise<TeamAnalytics> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    // Calculate knowledge base size (simplified)
    let knowledgeBaseSize = 0;
    try {
      const syncPath = path.join(process.cwd(), this.syncDir, workspaceId);
      if (await this.pathExists(path.join(syncPath, 'knowledge.json'))) {
        const content = await fs.promises.readFile(
          path.join(syncPath, 'knowledge.json'),
          'utf8'
        );
        knowledgeBaseSize = content.length;
      }
    } catch {
      // No synced knowledge
    }

    return {
      workspaceId,
      totalMembers: workspace.members.length,
      sharedRules: workspace.sharedRules.length,
      knowledgeBaseSize,
      lastSync: workspace.lastSynced,
      syncStatus: this.getSyncStatus(workspace),
    };
  }

  /**
   * Load shared rules from team
   */
  async loadSharedRules(workspaceId: string): Promise<GuardrailRule[]> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      return [];
    }

    return workspace.sharedRules;
  }

  /**
   * Add team member
   */
  async addMember(workspaceId: string, memberId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    if (!workspace.members.includes(memberId)) {
      workspace.members.push(memberId);
      await this.saveWorkspace(workspace);
    }
  }

  /**
   * Remove team member
   */
  async removeMember(workspaceId: string, memberId: string): Promise<void> {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    workspace.members = workspace.members.filter(m => m !== memberId);
    await this.saveWorkspace(workspace);
  }

  /**
   * Get workspace
   */
  getWorkspace(workspaceId: string): TeamWorkspace | undefined {
    return this.workspaces.get(workspaceId);
  }

  /**
   * List all workspaces
   */
  listWorkspaces(): TeamWorkspace[] {
    return Array.from(this.workspaces.values());
  }

  private async saveWorkspace(workspace: TeamWorkspace): Promise<void> {
    const configPath = path.join(process.cwd(), '.guardrail-team.json');
    const workspaces = Array.from(this.workspaces.values());
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(workspaces, null, 2)
    );
  }

  private async loadWorkspaces(): Promise<void> {
    const configPath = path.join(process.cwd(), '.guardrail-team.json');
    if (await this.pathExists(configPath)) {
      const content = await fs.promises.readFile(configPath, 'utf8');
      const workspaces: TeamWorkspace[] = JSON.parse(content);
      workspaces.forEach(ws => {
        this.workspaces.set(ws.id, ws);
      });
    }
  }

  private getSyncStatus(workspace: TeamWorkspace): 'synced' | 'pending' | 'conflict' {
    const lastSync = new Date(workspace.lastSynced).getTime();
    const now = Date.now();
    const syncInterval = workspace.config.syncInterval || 3600000;

    if (now - lastSync > syncInterval * 2) {
      return 'pending';
    }

    return 'synced';
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }

  constructor() {
    this.loadWorkspaces().catch(console.error);
  }
}

export const teamCollaboration = new TeamCollaboration();

