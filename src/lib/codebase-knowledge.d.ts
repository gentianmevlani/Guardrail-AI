/**
 * Codebase Knowledge Base
 *
 * Deep understanding of a specific codebase - more context than general AI agents
 * Builds and maintains project-specific knowledge over time
 */
export interface CodebaseKnowledge {
    projectId: string;
    projectPath: string;
    architecture: ArchitectureKnowledge;
    patterns: PatternKnowledge[];
    decisions: DecisionKnowledge[];
    relationships: RelationshipKnowledge;
    context: ContextMemory;
    lastUpdated: string;
}
export interface ArchitectureKnowledge {
    structure: {
        type: 'monolith' | 'microservices' | 'modular' | 'unknown';
        layers: string[];
        entryPoints: string[];
        mainModules: string[];
    };
    techStack: {
        frontend: string[];
        backend: string[];
        database: string[];
        tools: string[];
    };
    conventions: {
        naming: Record<string, string>;
        fileOrganization: string[];
        importPatterns: string[];
    };
}
export interface PatternKnowledge {
    id: string;
    name: string;
    description: string;
    examples: string[];
    frequency: number;
    category: 'component' | 'hook' | 'utility' | 'api' | 'state' | 'routing';
}
export interface DecisionKnowledge {
    id: string;
    question: string;
    decision: string;
    rationale: string;
    date: string;
    files: string[];
    context: string;
}
export interface RelationshipKnowledge {
    dependencies: Map<string, string[]>;
    dependents: Map<string, string[]>;
    imports: Map<string, string[]>;
    exports: Map<string, string[]>;
}
export interface ContextMemory {
    recentChanges: Array<{
        file: string;
        change: string;
        date: string;
    }>;
    activeFeatures: string[];
    currentFocus: string[];
    painPoints: string[];
    improvements: string[];
}
export declare class CodebaseKnowledgeBase {
    private knowledgeFile;
    /**
     * Build deep knowledge of codebase
     *
     * Analyzes the entire codebase and builds comprehensive knowledge including
     * architecture, patterns, decisions, and relationships.
     *
     * @param projectPath - Path to the project root directory
     * @returns Complete codebase knowledge
     *
     * @example
     * ```typescript
     * const knowledge = await codebaseKnowledgeBase.buildKnowledge('./my-project');
     *
     * // Use the knowledge
     * console.log(`Project type: ${knowledge.architecture.structure.type}`);
     * console.log(`Patterns found: ${knowledge.patterns.length}`);
     * ```
     */
    buildKnowledge(projectPath: string): Promise<CodebaseKnowledge>;
    /**
     * Analyze architecture
     */
    analyzeArchitecture(projectPath: string): Promise<ArchitectureKnowledge>;
    /**
     * Detect project structure
     */
    private detectStructure;
    /**
     * Detect tech stack
     */
    private detectTechStack;
    /**
     * Detect conventions
     */
    private detectConventions;
    /**
     * Detect patterns in codebase
     */
    detectPatterns(projectPath: string): Promise<PatternKnowledge[]>;
    /**
     * Map file relationships
     */
    mapRelationships(projectPath: string): Promise<RelationshipKnowledge>;
    /**
     * Build context memory
     */
    private buildContext;
    /**
     * Get recent changes from git
     */
    private getRecentChanges;
    /**
     * Detect active features
     */
    private detectActiveFeatures;
    /**
     * Load decisions from knowledge base
     */
    loadDecisions(projectPath: string): Promise<DecisionKnowledge[]>;
    /**
     * Save knowledge base
     */
    saveKnowledge(projectPath: string, knowledge: CodebaseKnowledge): Promise<void>;
    /**
     * Get knowledge for project
     */
    loadKnowledge(projectPath: string): Promise<CodebaseKnowledge | null>;
    /**
     * Add decision to knowledge base
     */
    addDecision(projectPath: string, decision: Omit<DecisionKnowledge, 'id' | 'date'>): Promise<void>;
    /**
     * Update context memory
     */
    updateContext(projectPath: string, updates: Partial<ContextMemory>): Promise<void>;
    /**
     * Search knowledge base
     */
    searchKnowledge(projectPath: string, query: string): Promise<{
        patterns: PatternKnowledge[];
        decisions: DecisionKnowledge[];
        files: string[];
    }>;
    private pathExists;
    private findFile;
    findCodeFiles(dir: string): Promise<string[]>;
    private shouldIgnore;
    private getProjectId;
}
export declare const codebaseKnowledgeBase: CodebaseKnowledgeBase;
//# sourceMappingURL=codebase-knowledge.d.ts.map