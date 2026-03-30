/**
 * Cross-Project Pattern Analyzer
 * 
 * Analyzes patterns across multiple projects and shares insights
 * Unique: Multi-project pattern discovery and sharing
 */

import * as fs from 'fs';
import * as path from 'path';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface CrossProjectPattern {
  pattern: string;
  projects: string[];
  frequency: number;
  category: string;
  confidence: number;
  bestPractice: boolean;
  recommendation?: string;
}

export interface CrossProjectReport {
  totalProjects: number;
  commonPatterns: CrossProjectPattern[];
  uniquePatterns: Array<{
    pattern: string;
    project: string;
    description: string;
  }>;
  bestPractices: CrossProjectPattern[];
  antiPatterns: CrossProjectPattern[];
  insights: string[];
}

class CrossProjectAnalyzer {
  /**
   * Analyze patterns across multiple projects
   */
  async analyzeProjects(projectPaths: string[]): Promise<CrossProjectReport> {
    const allPatterns = new Map<string, {
      projects: Set<string>;
      frequency: number;
      category: string;
    }>();

    // Collect patterns from all projects
    for (const projectPath of projectPaths) {
      try {
        const knowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
        if (!knowledge) continue;

        for (const pattern of knowledge.patterns) {
          const key = `${pattern.category}:${pattern.name}`;
          if (!allPatterns.has(key)) {
            allPatterns.set(key, {
              projects: new Set(),
              frequency: 0,
              category: pattern.category,
            });
          }

          const entry = allPatterns.get(key)!;
          entry.projects.add(projectPath);
          entry.frequency += pattern.frequency;
        }
      } catch {
        // Error reading project
      }
    }

    // Identify common patterns (appear in multiple projects)
    const commonPatterns: CrossProjectPattern[] = [];
    const uniquePatterns: Array<{
      pattern: string;
      project: string;
      description: string;
    }> = [];

    for (const [key, data] of allPatterns.entries()) {
      const [category, name] = key.split(':');
      const projectCount = data.projects.size;
      const avgFrequency = data.frequency / projectCount;

      if (projectCount > 1) {
        // Common pattern
        commonPatterns.push({
          pattern: name,
          projects: Array.from(data.projects),
          frequency: avgFrequency,
          category,
          confidence: projectCount / projectPaths.length,
          bestPractice: projectCount >= projectPaths.length * 0.7,
          recommendation: projectCount >= projectPaths.length * 0.7
            ? 'This pattern is used in most projects - consider standardizing'
            : undefined,
        });
      } else {
        // Unique pattern
        uniquePatterns.push({
          pattern: name,
          project: Array.from(data.projects)[0],
          description: `Unique pattern found only in this project`,
        });
      }
    }

    // Identify best practices (high frequency, high confidence)
    const bestPractices = commonPatterns
      .filter(p => p.bestPractice && p.confidence > 0.7)
      .sort((a, b) => b.frequency - a.frequency);

    // Identify anti-patterns (low frequency, but present)
    const antiPatterns = commonPatterns
      .filter(p => p.confidence < 0.3 && p.frequency < 5)
      .sort((a, b) => a.frequency - b.frequency);

    // Generate insights
    const insights = this.generateInsights(commonPatterns, uniquePatterns, projectPaths.length);

    return {
      totalProjects: projectPaths.length,
      commonPatterns,
      uniquePatterns,
      bestPractices,
      antiPatterns,
      insights,
    };
  }

  /**
   * Share pattern to other projects
   */
  async sharePattern(
    sourceProject: string,
    patternId: string,
    targetProjects: string[]
  ): Promise<void> {
    const sourceKnowledge = await codebaseKnowledgeBase.getKnowledge(sourceProject);
    if (!sourceKnowledge) {
      throw new Error('Source project knowledge not found');
    }

    const pattern = sourceKnowledge.patterns.find(p => p.id === patternId);
    if (!pattern) {
      throw new Error(`Pattern ${patternId} not found`);
    }

    // Apply pattern to target projects
    for (const targetProject of targetProjects) {
      const targetKnowledge = await codebaseKnowledgeBase.getKnowledge(targetProject);
      if (targetKnowledge) {
        // Check if pattern already exists
        const exists = targetKnowledge.patterns.some(p => p.id === patternId);
        if (!exists) {
          targetKnowledge.patterns.push(pattern);
          await codebaseKnowledgeBase.saveKnowledge(targetProject, targetKnowledge);
        }
      }
    }
  }

  /**
   * Find similar projects
   */
  async findSimilarProjects(
    projectPath: string,
    allProjects: string[]
  ): Promise<Array<{ project: string; similarity: number; sharedPatterns: number }>> {
    const sourceKnowledge = await codebaseKnowledgeBase.getKnowledge(projectPath);
    if (!sourceKnowledge) {
      return [];
    }

    const similarities: Array<{ project: string; similarity: number; sharedPatterns: number }> = [];

    for (const otherProject of allProjects) {
      if (otherProject === projectPath) continue;

      const otherKnowledge = await codebaseKnowledgeBase.getKnowledge(otherProject);
      if (!otherKnowledge) continue;

      // Calculate similarity based on shared patterns
      const sourcePatterns = new Set(sourceKnowledge.patterns.map(p => p.id));
      const otherPatterns = new Set(otherKnowledge.patterns.map(p => p.id));

      const shared = Array.from(sourcePatterns).filter(p => otherPatterns.has(p));
      const total = new Set([...sourcePatterns, ...otherPatterns]).size;
      const similarity = total > 0 ? (shared.length / total) * 100 : 0;

      if (similarity > 0) {
        similarities.push({
          project: otherProject,
          similarity,
          sharedPatterns: shared.length,
        });
      }
    }

    return similarities.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Generate insights
   */
  private generateInsights(
    commonPatterns: CrossProjectPattern[],
    uniquePatterns: Array<{ pattern: string; project: string; description: string }>,
    totalProjects: number
  ): string[] {
    const insights: string[] = [];

    if (commonPatterns.length > 0) {
      insights.push(`${commonPatterns.length} patterns are common across projects`);
    }

    if (uniquePatterns.length > 0) {
      insights.push(`${uniquePatterns.length} unique patterns found - consider sharing best ones`);
    }

    const bestPracticeCount = commonPatterns.filter(p => p.bestPractice).length;
    if (bestPracticeCount > 0) {
      insights.push(`${bestPracticeCount} patterns identified as best practices`);
    }

    return insights;
  }
}

export const crossProjectAnalyzer = new CrossProjectAnalyzer();

