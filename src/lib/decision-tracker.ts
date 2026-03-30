/**
 * Automatic Decision Tracking
 * 
 * Extracts architectural decisions from git commits, PRs, and code comments
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { codebaseKnowledgeBase } from './codebase-knowledge';

export interface ExtractedDecision {
  question: string;
  decision: string;
  rationale: string;
  date: string;
  files: string[];
  source: 'commit' | 'pr' | 'comment' | 'manual';
  confidence: number;
}

class DecisionTracker {
  /**
   * Extract decisions from git history
   */
  async extractFromGit(projectPath: string): Promise<ExtractedDecision[]> {
    const decisions: ExtractedDecision[] = [];

    try {
      // Get commits with decision keywords
      const result = execSync(
        'git log --all --grep="decision\\|decided\\|chose\\|architecture\\|pattern" -i --format="%H|%s|%b|%ad" --date=iso -20',
        { cwd: projectPath, encoding: 'utf8' }
      );

      const commits = result.split('\n').filter(Boolean);
      
      for (const commit of commits) {
        const [hash, subject, body, date] = commit.split('|');
        const decision = this.parseCommitForDecision(subject, body, hash, date, projectPath);
        if (decision) {
          decisions.push(decision);
        }
      }
    } catch {
      // Git not available or not a git repo
    }

    return decisions;
  }

  /**
   * Parse commit message for decision
   */
  private parseCommitForDecision(
    subject: string,
    body: string,
    hash: string,
    date: string,
    projectPath: string
  ): ExtractedDecision | null {
    const text = `${subject} ${body}`.toLowerCase();

    // Look for decision patterns
    if (!text.match(/decision|decided|chose|architecture|pattern|rationale/)) {
      return null;
    }

    // Extract question (what was being decided)
    let question = subject;
    if (body) {
      const questionMatch = body.match(/(?:question|problem|issue):\s*(.+?)(?:\n|$)/i);
      if (questionMatch) {
        question = questionMatch[1];
      }
    }

    // Extract decision
    let decision = subject;
    const decisionMatch = text.match(/(?:decision|decided|chose):\s*(.+?)(?:\n|$)/i);
    if (decisionMatch) {
      decision = decisionMatch[1];
    }

    // Extract rationale
    let rationale = body || '';
    const rationaleMatch = body?.match(/(?:rationale|reason|because):\s*(.+?)(?:\n\n|$)/i);
    if (rationaleMatch) {
      rationale = rationaleMatch[1];
    }

    // Get files changed in commit
    const files = this.getCommitFiles(hash, projectPath);

    return {
      question: question.trim(),
      decision: decision.trim(),
      rationale: rationale.trim() || 'No rationale provided',
      date: date || new Date().toISOString(),
      files,
      source: 'commit',
      confidence: this.calculateConfidence(text, decision, rationale),
    };
  }

  /**
   * Get files changed in commit
   */
  private getCommitFiles(hash: string, projectPath: string): string[] {
    try {
      const result = execSync(`git show --name-only --format="" ${hash}`, {
        cwd: projectPath,
        encoding: 'utf8',
      });
      return result.split('\n').filter(Boolean).slice(0, 10);
    } catch {
      return [];
    }
  }

  /**
   * Extract decisions from code comments
   */
  async extractFromComments(projectPath: string): Promise<ExtractedDecision[]> {
    const decisions: ExtractedDecision[] = [];
    const files = await this.findCodeFiles(projectPath);

    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        const commentDecisions = this.parseCommentsForDecisions(file, content, projectPath);
        decisions.push(...commentDecisions);
      } catch (error) {
        // Failed to process - continue with other operations
      }
    }

    return decisions;
  }

  /**
   * Parse code comments for decisions
   */
  private parseCommentsForDecisions(
    file: string,
    content: string,
    projectPath: string
  ): ExtractedDecision[] {
    const decisions: ExtractedDecision[] = [];

    // Look for decision comments
    const decisionCommentRegex = /\/\*\*\s*DECISION:\s*(.+?)\n\s*Decision:\s*(.+?)\n\s*Rationale:\s*(.+?)\s*\*\//gs;
    let match;

    while ((match = decisionCommentRegex.exec(content)) !== null) {
      decisions.push({
        question: match[1].trim(),
        decision: match[2].trim(),
        rationale: match[3].trim(),
        date: new Date().toISOString(),
        files: [path.relative(projectPath, file)],
        source: 'comment',
        confidence: 0.9,
      });
    }

    // Look for TODO/FIXME with decision context
    const todoRegex = /\/\/\s*(?:TODO|FIXME|NOTE):\s*(.+?)(?:\n|$)/g;
    while ((match = todoRegex.exec(content)) !== null) {
      const text = match[1].toLowerCase();
      if (text.includes('decision') || text.includes('chose') || text.includes('architecture')) {
        decisions.push({
          question: 'Architectural decision',
          decision: match[1].trim(),
          rationale: 'Extracted from code comment',
          date: new Date().toISOString(),
          files: [path.relative(projectPath, file)],
          source: 'comment',
          confidence: 0.5,
        });
      }
    }

    return decisions;
  }

  /**
   * Calculate confidence in extracted decision
   */
  private calculateConfidence(text: string, decision: string, rationale: string): number {
    let confidence = 0.5;

    // Higher confidence if has rationale
    if (rationale && rationale.length > 20) {
      confidence += 0.2;
    }

    // Higher confidence if has clear decision statement
    if (decision && decision.length > 10) {
      confidence += 0.2;
    }

    // Higher confidence if mentions architecture/pattern
    if (text.includes('architecture') || text.includes('pattern')) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Sync decisions to knowledge base
   */
  async syncToKnowledgeBase(projectPath: string): Promise<void> {
    const gitDecisions = await this.extractFromGit(projectPath);
    const commentDecisions = await this.extractFromComments(projectPath);

    // Filter high-confidence decisions
    const allDecisions = [...gitDecisions, ...commentDecisions]
      .filter(d => d.confidence > 0.6);

    // Add to knowledge base
    for (const decision of allDecisions) {
      await codebaseKnowledgeBase.addDecision(projectPath, {
        question: decision.question,
        decision: decision.decision,
        rationale: decision.rationale,
        files: decision.files,
        context: `Extracted from ${decision.source}`,
      });
    }

    console.log(`✅ Synced ${allDecisions.length} decisions to knowledge base`);
  }

  // Helper methods
  private async findCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findCodeFiles(fullPath));
        } else if (item.isFile() && /\.(ts|tsx|js|jsx)$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'].includes(name);
  }
}

export const decisionTracker = new DecisionTracker();

