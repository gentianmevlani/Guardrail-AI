/**
 * Team Knowledge Graph
 * 
 * Collaborative code understanding across team members
 * Unique: Shared knowledge graph that learns from entire team
 */

import { codebaseKnowledgeBase } from './codebase-knowledge';
import { teamCollaboration } from './team-collaboration';
import * as fs from 'fs';
import * as path from 'path';

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'pattern' | 'decision' | 'file' | 'person';
  label: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface KnowledgeEdge {
  from: string;
  to: string;
  type: 'knows' | 'created' | 'modified' | 'understands' | 'relates';
  weight?: number;
  metadata?: Record<string, any>;
}

export interface TeamKnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  insights: Array<{
    type: string;
    description: string;
    confidence: number;
  }>;
}

export interface TeamInsight {
  type: 'expert' | 'knowledge-gap' | 'collaboration' | 'pattern';
  description: string;
  members?: string[];
  files?: string[];
  confidence: number;
}

class TeamKnowledgeGraphBuilder {
  /**
   * Build team knowledge graph
   */
  async buildGraph(
    workspaceId: string,
    projectPath: string
  ): Promise<TeamKnowledgeGraph> {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];

    // Get team workspace
    const workspace = teamCollaboration.getWorkspace(workspaceId);
    if (!workspace) {
      throw new Error(`Workspace ${workspaceId} not found`);
    }

    // Add team members as nodes
    for (const member of workspace.members) {
      nodes.push({
        id: `member-${member}`,
        type: 'person',
        label: member,
        metadata: {
          memberId: member,
        },
      });
    }

    // Get knowledge base
    const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (knowledge) {
      // Add patterns as nodes
      for (const pattern of knowledge.patterns) {
        nodes.push({
          id: `pattern-${pattern.id}`,
          type: 'pattern',
          label: pattern.name,
          description: pattern.description,
          metadata: {
            category: pattern.category,
            frequency: pattern.frequency,
          },
        });
      }

      // Add decisions as nodes
      for (const decision of knowledge.decisions) {
        nodes.push({
          id: `decision-${decision.id}`,
          type: 'decision',
          label: decision.question,
          description: decision.decision,
          metadata: {
            rationale: decision.rationale,
            date: decision.date,
          },
        });
      }

      // Add files as nodes
      for (const [file] of knowledge.relationships.imports.entries()) {
        nodes.push({
          id: `file-${file}`,
          type: 'file',
          label: path.basename(file),
          metadata: {
            path: file,
          },
        });
      }

      // Add relationships
      for (const [file, imports] of knowledge.relationships.imports.entries()) {
        for (const imp of imports) {
          edges.push({
            from: `file-${file}`,
            to: `file-${imp}`,
            type: 'relates',
            weight: 1,
          });
        }
      }
    }

    // Generate insights
    const insights = await this.generateInsights(nodes, edges, workspace);

    return {
      nodes,
      edges,
      insights,
    };
  }

  /**
   * Generate team insights
   */
  async generateInsights(
    nodes: KnowledgeNode[],
    edges: KnowledgeEdge[],
    workspace: Record<string, unknown>
  ): Promise<Array<{ type: string; description: string; confidence: number }>> {
    const insights: Array<{ type: string; description: string; confidence: number }> = [];

    // Find experts (people who know most patterns)
    const expertNodes = nodes.filter(n => n.type === 'person');
    if (expertNodes.length > 0) {
      insights.push({
        type: 'expert',
        description: `Team has ${expertNodes.length} members with specialized knowledge`,
        confidence: 0.8,
      });
    }

    // Find knowledge gaps
    const patternNodes = nodes.filter(n => n.type === 'pattern');
    if (patternNodes.length > 0 && expertNodes.length === 0) {
      insights.push({
        type: 'knowledge-gap',
        description: 'Patterns exist but no team members are associated with them',
        confidence: 0.7,
      });
    }

    // Find collaboration opportunities
    const fileNodes = nodes.filter(n => n.type === 'file');
    if (fileNodes.length > 10) {
      insights.push({
        type: 'collaboration',
        description: 'Large codebase suggests need for better knowledge sharing',
        confidence: 0.6,
      });
    }

    return insights;
  }

  /**
   * Find team experts on specific topics
   */
  findExperts(
    graph: TeamKnowledgeGraph,
    topic: string
  ): Array<{ member: string; expertise: number }> {
    const experts: Array<{ member: string; expertise: number }> = [];

    // Find nodes related to topic
    const topicNodes = graph.nodes.filter(n =>
      n.label.toLowerCase().includes(topic.toLowerCase()) ||
      n.description?.toLowerCase().includes(topic.toLowerCase())
    );

    // Find members connected to topic nodes
    for (const memberNode of graph.nodes.filter(n => n.type === 'person')) {
      const connections = graph.edges.filter(e =>
        (e.from === memberNode.id || e.to === memberNode.id) &&
        topicNodes.some(tn => tn.id === e.from || tn.id === e.to)
      );

      if (connections.length > 0) {
        experts.push({
          member: memberNode.label,
          expertise: connections.length,
        });
      }
    }

    return experts.sort((a, b) => b.expertise - a.expertise);
  }

  /**
   * Find knowledge gaps
   */
  findKnowledgeGaps(graph: TeamKnowledgeGraph): TeamInsight[] {
    const gaps: TeamInsight[] = [];

    // Find patterns without associated experts
    const patterns = graph.nodes.filter(n => n.type === 'pattern');
    const members = graph.nodes.filter(n => n.type === 'person');

    for (const pattern of patterns) {
      const hasExpert = graph.edges.some(e =>
        (e.from === pattern.id || e.to === pattern.id) &&
        members.some(m => m.id === e.from || m.id === e.to)
      );

      if (!hasExpert) {
        gaps.push({
          type: 'knowledge-gap',
          description: `Pattern "${pattern.label}" has no team expert`,
          confidence: 0.8,
          files: [pattern.metadata?.file].filter(Boolean),
        });
      }
    }

    return gaps;
  }

  /**
   * Suggest collaboration opportunities
   */
  suggestCollaboration(graph: TeamKnowledgeGraph): TeamInsight[] {
    const suggestions: TeamInsight[] = [];

    // Find files worked on by single person
    const fileNodes = graph.nodes.filter(n => n.type === 'file');
    const memberNodes = graph.nodes.filter(n => n.type === 'person');

    for (const file of fileNodes) {
      const fileEdges = graph.edges.filter(e =>
        e.type === 'created' || e.type === 'modified'
      ).filter(e => e.to === file.id || e.from === file.id);

      const uniqueMembers = new Set(
        fileEdges.map(e => {
          const memberId = e.from.startsWith('member-') ? e.from : e.to;
          return memberId;
        })
      );

      if (uniqueMembers.size === 1) {
        suggestions.push({
          type: 'collaboration',
          description: `File ${file.label} is only worked on by one person - consider code review`,
          confidence: 0.7,
          files: [file.metadata?.path].filter(Boolean),
          members: Array.from(uniqueMembers),
        });
      }
    }

    return suggestions;
  }
}

export const teamKnowledgeGraphBuilder = new TeamKnowledgeGraphBuilder();

