/**
 * Config Truth Detector
 *
 * Builds environment variable dependency graph and detects dangerous defaults:
 * - Secrets/auth/webhooks/billing URLs with test/empty defaults
 * - Missing required environment variables
 * - Unsafe fallbacks for security-sensitive values
 */
import { RealityFinding } from './reality-sniff-scanner';
export interface EnvDependency {
    name: string;
    file: string;
    line: number;
    defaultValue?: string;
    category: 'secret' | 'auth' | 'url' | 'webhook' | 'billing' | 'harmless';
    required: boolean;
    usedIn: string[];
}
export interface ConfigTruthResult {
    dependencies: EnvDependency[];
    dangerousDefaults: EnvDependency[];
    missingRequired: EnvDependency[];
    findings: RealityFinding[];
}
export declare class ConfigTruthDetector {
    private projectPath;
    private dependencies;
    constructor(projectPath: string);
    /**
     * Scan for environment variable dependencies
     */
    detect(): Promise<ConfigTruthResult>;
    private findSourceFiles;
    private walkDirectory;
    private shouldExclude;
    private scanFile;
    private categorizeVariable;
    private isDangerousDefault;
    private findDangerousDefaults;
    private findMissingRequired;
    private generateFindings;
    private getLineNumber;
}
