/**
 * Change Tracker
 *
 * Tracks changes in knowledge base and provides visual diffs
 */
import { CodebaseKnowledge } from './codebase-knowledge';
export interface Change {
    type: 'added' | 'modified' | 'deleted';
    file: string;
    timestamp: string;
    description?: string;
}
export interface ChangeReport {
    projectPath: string;
    period: {
        start: string;
        end: string;
    };
    changes: Change[];
    summary: {
        added: number;
        modified: number;
        deleted: number;
    };
}
export interface DiffVisualization {
    before: Partial<CodebaseKnowledge>;
    after: Partial<CodebaseKnowledge>;
    differences: Array<{
        path: string;
        before: unknown;
        after: unknown;
        type: 'added' | 'modified' | 'deleted';
    }>;
}
declare class ChangeTracker {
    /**
     * Track changes in project
     */
    trackChanges(projectPath: string, since?: string): Promise<ChangeReport>;
    /**
     * Visualize diff between two knowledge bases
     */
    visualizeDiff(before: CodebaseKnowledge, after: CodebaseKnowledge): Promise<DiffVisualization>;
    /**
     * Get changes from git
     */
    private getGitChanges;
    /**
     * Get changes from file system
     */
    private getFileSystemChanges;
    /**
     * Find all files in project
     */
    private findFiles;
    private shouldIgnore;
}
export declare const changeTracker: ChangeTracker;
export {};
//# sourceMappingURL=change-tracker.d.ts.map