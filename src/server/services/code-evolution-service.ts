/**
 * Code Evolution Service
 * 
 * Provides persistent historical data storage for:
 * - Code snapshots over time
 * - Pattern evolution tracking
 * - Trend analysis
 * - Metrics history
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Types
interface EvolutionSnapshot {
  id: string;
  projectId: string;
  timestamp: string;
  patterns: Array<{
    id: string;
    name: string;
    frequency: number;
    category: string;
  }>;
  metrics: {
    totalFiles: number;
    totalLines: number;
    complexity: number;
    testCoverage?: number;
    lintErrors?: number;
  };
  fileHashes: Record<string, string>;
  changes: {
    filesAdded: number;
    filesModified: number;
    filesDeleted: number;
    linesAdded: number;
    linesDeleted: number;
  };
  metadata?: Record<string, unknown>;
}

interface EvolutionTrend {
  pattern: string;
  trend: 'increasing' | 'decreasing' | 'stable' | 'emerging' | 'declining';
  change: number;
  changePercent: number;
  dataPoints: Array<{
    timestamp: string;
    value: number;
  }>;
  prediction: {
    direction: 'up' | 'down' | 'stable';
    confidence: number;
    timeframe: string;
    predictedValue: number;
  };
}

interface ProjectEvolution {
  projectId: string;
  name: string;
  snapshots: EvolutionSnapshot[];
  trends: EvolutionTrend[];
  metrics: {
    avgComplexity: number;
    avgFiles: number;
    avgLines: number;
    growthRate: number;
    qualityTrend: 'improving' | 'stable' | 'declining';
  };
  analyzedAt: string;
}

// In-memory storage (would use database in production)
const snapshotStore: Map<string, EvolutionSnapshot[]> = new Map();
const trendStore: Map<string, EvolutionTrend[]> = new Map();

// Storage directory for file-based persistence
const STORAGE_DIR = process.env.CODE_EVOLUTION_STORAGE || '/tmp/guardrail-evolution';

class CodeEvolutionService {
  constructor() {
    this.initializeStorage();
  }

  /**
   * Initialize storage directory
   */
  private initializeStorage(): void {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
      }
      this.loadFromDisk();
    } catch (error) {
      console.error('Failed to initialize storage:', error);
    }
  }

  /**
   * Load snapshots from disk
   */
  private loadFromDisk(): void {
    try {
      const files = fs.readdirSync(STORAGE_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(STORAGE_DIR, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (data.projectId && data.snapshots) {
            snapshotStore.set(data.projectId, data.snapshots);
            if (data.trends) {
              trendStore.set(data.projectId, data.trends);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load from disk:', error);
    }
  }

  /**
   * Save snapshots to disk
   */
  private saveToDisk(projectId: string): void {
    try {
      const snapshots = snapshotStore.get(projectId) || [];
      const trends = trendStore.get(projectId) || [];
      const filePath = path.join(STORAGE_DIR, `${projectId}.json`);
      fs.writeFileSync(filePath, JSON.stringify({
        projectId,
        snapshots,
        trends,
        updatedAt: new Date().toISOString(),
      }, null, 2));
    } catch (error) {
      console.error('Failed to save to disk:', error);
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Calculate file hash
   */
  private calculateFileHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Create a snapshot of the current project state
   */
  async createSnapshot(
    projectId: string,
    directory: string,
    metadata?: Record<string, unknown>
  ): Promise<EvolutionSnapshot> {
    const previousSnapshot = this.getLatestSnapshot(projectId);
    const patterns = await this.analyzePatterns(directory);
    const metrics = await this.collectMetrics(directory);
    const fileHashes = await this.hashFiles(directory);

    // Calculate changes from previous snapshot
    const changes = this.calculateChanges(previousSnapshot?.fileHashes || {}, fileHashes);

    const snapshot: EvolutionSnapshot = {
      id: this.generateId(),
      projectId,
      timestamp: new Date().toISOString(),
      patterns,
      metrics,
      fileHashes,
      changes,
      metadata,
    };

    // Store snapshot
    const projectSnapshots = snapshotStore.get(projectId) || [];
    projectSnapshots.push(snapshot);
    
    // Keep only last 100 snapshots per project
    if (projectSnapshots.length > 100) {
      projectSnapshots.shift();
    }
    
    snapshotStore.set(projectId, projectSnapshots);

    // Update trends
    this.updateTrends(projectId);

    // Persist to disk
    this.saveToDisk(projectId);

    return snapshot;
  }

  /**
   * Get the latest snapshot for a project
   */
  getLatestSnapshot(projectId: string): EvolutionSnapshot | null {
    const snapshots = snapshotStore.get(projectId);
    if (!snapshots || snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1];
  }

  /**
   * Get all snapshots for a project
   */
  getSnapshots(projectId: string, options?: {
    limit?: number;
    since?: string;
    until?: string;
  }): EvolutionSnapshot[] {
    let snapshots = snapshotStore.get(projectId) || [];

    if (options?.since) {
      const sinceDate = new Date(options.since);
      snapshots = snapshots.filter(s => new Date(s.timestamp) >= sinceDate);
    }

    if (options?.until) {
      const untilDate = new Date(options.until);
      snapshots = snapshots.filter(s => new Date(s.timestamp) <= untilDate);
    }

    if (options?.limit) {
      snapshots = snapshots.slice(-options.limit);
    }

    return snapshots;
  }

  /**
   * Get a specific snapshot
   */
  getSnapshot(projectId: string, snapshotId: string): EvolutionSnapshot | null {
    const snapshots = snapshotStore.get(projectId);
    if (!snapshots) return null;
    return snapshots.find(s => s.id === snapshotId) || null;
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(projectId: string, snapshotId: string): boolean {
    const snapshots = snapshotStore.get(projectId);
    if (!snapshots) return false;

    const index = snapshots.findIndex(s => s.id === snapshotId);
    if (index === -1) return false;

    snapshots.splice(index, 1);
    snapshotStore.set(projectId, snapshots);
    this.saveToDisk(projectId);
    return true;
  }

  /**
   * Get evolution trends for a project
   */
  getTrends(projectId: string): EvolutionTrend[] {
    return trendStore.get(projectId) || [];
  }

  /**
   * Get full project evolution analysis
   */
  getProjectEvolution(projectId: string, projectName?: string): ProjectEvolution | null {
    const snapshots = snapshotStore.get(projectId);
    if (!snapshots || snapshots.length === 0) return null;

    const trends = trendStore.get(projectId) || [];

    // Calculate aggregate metrics
    const avgComplexity = snapshots.reduce((sum, s) => sum + s.metrics.complexity, 0) / snapshots.length;
    const avgFiles = snapshots.reduce((sum, s) => sum + s.metrics.totalFiles, 0) / snapshots.length;
    const avgLines = snapshots.reduce((sum, s) => sum + s.metrics.totalLines, 0) / snapshots.length;

    // Calculate growth rate
    let growthRate = 0;
    if (snapshots.length >= 2) {
      const first = snapshots[0];
      const last = snapshots[snapshots.length - 1];
      const timeDiff = new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      growthRate = daysDiff > 0 ? ((last.metrics.totalLines - first.metrics.totalLines) / daysDiff) : 0;
    }

    // Determine quality trend
    let qualityTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (snapshots.length >= 3) {
      const recent = snapshots.slice(-3);
      const complexityTrend = recent[2].metrics.complexity - recent[0].metrics.complexity;
      if (complexityTrend < -5) qualityTrend = 'improving';
      else if (complexityTrend > 5) qualityTrend = 'declining';
    }

    return {
      projectId,
      name: projectName || projectId,
      snapshots,
      trends,
      metrics: {
        avgComplexity,
        avgFiles,
        avgLines,
        growthRate,
        qualityTrend,
      },
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Compare two snapshots
   */
  compareSnapshots(projectId: string, snapshotId1: string, snapshotId2: string): {
    snapshot1: EvolutionSnapshot | null;
    snapshot2: EvolutionSnapshot | null;
    diff: {
      metricsDiff: Record<string, number>;
      patternsAdded: string[];
      patternsRemoved: string[];
      filesChanged: number;
    };
  } | null {
    const snapshot1 = this.getSnapshot(projectId, snapshotId1);
    const snapshot2 = this.getSnapshot(projectId, snapshotId2);

    if (!snapshot1 || !snapshot2) return null;

    const patternNames1 = new Set(snapshot1.patterns.map(p => p.name));
    const patternNames2 = new Set(snapshot2.patterns.map(p => p.name));

    return {
      snapshot1,
      snapshot2,
      diff: {
        metricsDiff: {
          totalFiles: snapshot2.metrics.totalFiles - snapshot1.metrics.totalFiles,
          totalLines: snapshot2.metrics.totalLines - snapshot1.metrics.totalLines,
          complexity: snapshot2.metrics.complexity - snapshot1.metrics.complexity,
        },
        patternsAdded: [...patternNames2].filter(p => !patternNames1.has(p)),
        patternsRemoved: [...patternNames1].filter(p => !patternNames2.has(p)),
        filesChanged: Object.keys(snapshot2.fileHashes).filter(
          f => snapshot1.fileHashes[f] !== snapshot2.fileHashes[f]
        ).length,
      },
    };
  }

  /**
   * Analyze patterns in a directory
   */
  private async analyzePatterns(directory: string): Promise<EvolutionSnapshot['patterns']> {
    const patterns: EvolutionSnapshot['patterns'] = [];
    const patternCounters: Map<string, { count: number; category: string }> = new Map();

    // Define pattern detection rules
    const patternRules = [
      { name: 'Component Pattern', regex: /export\s+(default\s+)?function\s+[A-Z]/g, category: 'React' },
      { name: 'Hook Pattern', regex: /use[A-Z]\w+\s*\(/g, category: 'React' },
      { name: 'Context Pattern', regex: /createContext|useContext/g, category: 'React' },
      { name: 'Redux Pattern', regex: /createSlice|useSelector|useDispatch/g, category: 'State' },
      { name: 'API Call Pattern', regex: /fetch\(|axios\.|useSWR|useQuery/g, category: 'Data' },
      { name: 'Error Boundary', regex: /componentDidCatch|ErrorBoundary/g, category: 'Error' },
      { name: 'Lazy Loading', regex: /React\.lazy|dynamic import/g, category: 'Performance' },
      { name: 'Memoization', regex: /useMemo|useCallback|React\.memo/g, category: 'Performance' },
      { name: 'Form Pattern', regex: /useForm|Formik|handleSubmit/g, category: 'Forms' },
      { name: 'Testing Pattern', regex: /describe\(|it\(|test\(|expect\(/g, category: 'Testing' },
    ];

    const codeFiles = this.getCodeFiles(directory);

    for (const file of codeFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        for (const rule of patternRules) {
          const matches = content.match(rule.regex);
          if (matches) {
            const existing = patternCounters.get(rule.name) || { count: 0, category: rule.category };
            existing.count += matches.length;
            patternCounters.set(rule.name, existing);
          }
        }
      } catch (error) {
        // Skip unreadable files
      }
    }

    // Convert to array
    for (const [name, data] of patternCounters) {
      patterns.push({
        id: this.generateId(),
        name,
        frequency: data.count,
        category: data.category,
      });
    }

    return patterns.sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Collect metrics from a directory
   */
  private async collectMetrics(directory: string): Promise<EvolutionSnapshot['metrics']> {
    const codeFiles = this.getCodeFiles(directory);
    let totalLines = 0;
    let complexity = 0;

    for (const file of codeFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        totalLines += lines.length;

        // Simple complexity calculation based on control structures
        const controlStructures = (content.match(/if\s*\(|for\s*\(|while\s*\(|switch\s*\(|catch\s*\(/g) || []).length;
        complexity += controlStructures;
      } catch (error) {
        // Skip unreadable files
      }
    }

    // Normalize complexity to a 0-100 scale
    const normalizedComplexity = Math.min(100, Math.round((complexity / Math.max(codeFiles.length, 1)) * 10));

    return {
      totalFiles: codeFiles.length,
      totalLines,
      complexity: normalizedComplexity,
    };
  }

  /**
   * Hash all files in a directory
   */
  private async hashFiles(directory: string): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    const codeFiles = this.getCodeFiles(directory);

    for (const file of codeFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const relativePath = path.relative(directory, file);
        hashes[relativePath] = this.calculateFileHash(content);
      } catch (error) {
        // Skip unreadable files
      }
    }

    return hashes;
  }

  /**
   * Calculate changes between snapshots
   */
  private calculateChanges(
    oldHashes: Record<string, string>,
    newHashes: Record<string, string>
  ): EvolutionSnapshot['changes'] {
    const oldFiles = new Set(Object.keys(oldHashes));
    const newFiles = new Set(Object.keys(newHashes));

    let filesAdded = 0;
    let filesModified = 0;
    let filesDeleted = 0;

    for (const file of newFiles) {
      if (!oldFiles.has(file)) {
        filesAdded++;
      } else if (oldHashes[file] !== newHashes[file]) {
        filesModified++;
      }
    }

    for (const file of oldFiles) {
      if (!newFiles.has(file)) {
        filesDeleted++;
      }
    }

    return {
      filesAdded,
      filesModified,
      filesDeleted,
      linesAdded: 0, // Would need actual diff calculation
      linesDeleted: 0,
    };
  }

  /**
   * Update trends for a project
   */
  private updateTrends(projectId: string): void {
    const snapshots = snapshotStore.get(projectId);
    if (!snapshots || snapshots.length < 2) return;

    const trends: EvolutionTrend[] = [];
    const patternHistory: Map<string, number[]> = new Map();

    // Collect pattern history
    for (const snapshot of snapshots) {
      for (const pattern of snapshot.patterns) {
        const history = patternHistory.get(pattern.name) || [];
        history.push(pattern.frequency);
        patternHistory.set(pattern.name, history);
      }
    }

    // Calculate trends
    for (const [patternName, history] of patternHistory) {
      if (history.length < 2) continue;

      const first = history[0];
      const last = history[history.length - 1];
      const change = last - first;
      const changePercent = first > 0 ? ((last - first) / first) * 100 : 0;

      // Determine trend direction
      let trend: EvolutionTrend['trend'] = 'stable';
      if (changePercent > 20) trend = history.length <= 3 ? 'emerging' : 'increasing';
      else if (changePercent < -20) trend = history.length <= 3 ? 'declining' : 'decreasing';

      // Simple linear prediction
      const avgChange = history.length > 1 
        ? (history[history.length - 1] - history[0]) / (history.length - 1)
        : 0;
      const predictedValue = Math.max(0, last + avgChange * 3);

      trends.push({
        pattern: patternName,
        trend,
        change,
        changePercent,
        dataPoints: history.map((value, i) => ({
          timestamp: snapshots[i]?.timestamp || new Date().toISOString(),
          value,
        })),
        prediction: {
          direction: avgChange > 0.5 ? 'up' : avgChange < -0.5 ? 'down' : 'stable',
          confidence: Math.min(0.95, 0.5 + (history.length * 0.05)),
          timeframe: '1-month',
          predictedValue,
        },
      });
    }

    trendStore.set(projectId, trends);
  }

  /**
   * Get code files from directory
   */
  private getCodeFiles(directory: string): string[] {
    const files: string[] = [];
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rb'];

    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
            walk(fullPath);
          } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip unreadable directories
      }
    };

    walk(directory);
    return files;
  }

  /**
   * Get all tracked projects
   */
  getTrackedProjects(): string[] {
    return Array.from(snapshotStore.keys());
  }

  /**
   * Delete all data for a project
   */
  deleteProjectData(projectId: string): boolean {
    const existed = snapshotStore.has(projectId);
    snapshotStore.delete(projectId);
    trendStore.delete(projectId);
    
    try {
      const filePath = path.join(STORAGE_DIR, `${projectId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error('Failed to delete project file:', error);
    }

    return existed;
  }

  /**
   * Export project data
   */
  exportProjectData(projectId: string): string | null {
    const snapshots = snapshotStore.get(projectId);
    const trends = trendStore.get(projectId);
    
    if (!snapshots) return null;

    return JSON.stringify({
      projectId,
      snapshots,
      trends,
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  /**
   * Import project data
   */
  importProjectData(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.projectId || !parsed.snapshots) {
        return false;
      }

      snapshotStore.set(parsed.projectId, parsed.snapshots);
      if (parsed.trends) {
        trendStore.set(parsed.projectId, parsed.trends);
      }

      this.saveToDisk(parsed.projectId);
      return true;
    } catch (error) {
      console.error('Failed to import project data:', error);
      return false;
    }
  }
}

export const codeEvolutionService = new CodeEvolutionService();
