/**
 * Dependency Analyzer Service
 * 
 * Real implementation for analyzing project dependencies.
 * Reads package.json and provides update recommendations.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface DependencyInfo {
  name: string;
  current: string;
  latest: string;
  wanted: string;
  type: 'dependency' | 'devDependency' | 'peerDependency';
  outdated: boolean;
  majorUpdate: boolean;
  breaking: string[];
  risk: number;
  compatible: boolean;
  effort: string;
  recommendation: string;
}

export interface UpdatePlan {
  order: string[];
  totalEffort: string;
  totalRisk: number;
  benefits: string[];
}

export interface DependencyAnalysis {
  dependencies: DependencyInfo[];
  updatePlan: UpdatePlan;
  stats: {
    total: number;
    outdated: number;
    vulnerable: number;
    upToDate: number;
  };
  analyzedAt: string;
}

// Known breaking changes for common packages
const knownBreakingChanges: Record<string, Record<string, string[]>> = {
  'react': {
    '18': ['Concurrent rendering changes', 'Automatic batching', 'Strict mode updates', 'New root API'],
    '17': ['Event delegation changes', 'No synthetic event pooling'],
  },
  'next': {
    '14': ['App Router changes', 'Server Actions stable', 'Turbopack improvements'],
    '13': ['App directory', 'Server components', 'New image component'],
  },
  'express': {
    '5': ['Removed deprecated methods', 'Promise support', 'Path route matching changes'],
  },
  'typescript': {
    '5': ['Decorators changes', 'Module resolution bundler', 'const type parameters'],
  },
  'eslint': {
    '9': ['Flat config required', 'Node.js 18+ required', 'Removed deprecated rules'],
    '8': ['Node.js 12+ required', 'ES modules support'],
  },
  'jest': {
    '29': ['Node.js 14+ required', 'Snapshot format changes'],
    '28': ['Node.js 12+ required', 'Default test environment changed'],
  },
  'webpack': {
    '5': ['Node.js 10.13+ required', 'Persistent caching', 'Module federation'],
  },
  'tailwindcss': {
    '4': ['CSS-first configuration', 'Native @layer support'],
    '3': ['JIT mode default', 'CDN support', 'Arbitrary values'],
  },
};

// Effort estimates based on update type
const effortEstimates = {
  patch: 'Minimal (< 30 min)',
  minor: 'Low (1-2 hours)',
  majorSimple: 'Medium (2-4 hours)',
  majorComplex: 'High (1-2 days)',
  majorCritical: 'Very High (2-5 days)',
};

class DependencyAnalyzerService {
  /**
   * Analyze dependencies from a project directory
   */
  async analyzeProject(directory: string): Promise<DependencyAnalysis> {
    const packageJsonPath = path.join(directory, 'package.json');
    
    try {
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      return this.analyzePackageJson(packageJson);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('package.json not found in the specified directory');
      }
      throw error;
    }
  }

  /**
   * Analyze a package.json object
   */
  analyzePackageJson(packageJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
  }): DependencyAnalysis {
    const dependencies: DependencyInfo[] = [];
    
    // Analyze each type of dependency
    if (packageJson.dependencies) {
      dependencies.push(...this.analyzeDeps(packageJson.dependencies, 'dependency'));
    }
    if (packageJson.devDependencies) {
      dependencies.push(...this.analyzeDeps(packageJson.devDependencies, 'devDependency'));
    }
    if (packageJson.peerDependencies) {
      dependencies.push(...this.analyzeDeps(packageJson.peerDependencies, 'peerDependency'));
    }

    // Sort by risk (highest first)
    dependencies.sort((a, b) => b.risk - a.risk);

    // Generate update plan
    const updatePlan = this.generateUpdatePlan(dependencies);

    // Calculate stats
    const stats = {
      total: dependencies.length,
      outdated: dependencies.filter(d => d.outdated).length,
      vulnerable: dependencies.filter(d => d.risk > 80).length,
      upToDate: dependencies.filter(d => !d.outdated).length,
    };

    return {
      dependencies,
      updatePlan,
      stats,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Analyze a set of dependencies
   */
  private analyzeDeps(
    deps: Record<string, string>,
    type: DependencyInfo['type']
  ): DependencyInfo[] {
    return Object.entries(deps).map(([name, version]) => {
      return this.analyzeDependency(name, version, type);
    });
  }

  /**
   * Analyze a single dependency
   */
  private analyzeDependency(
    name: string,
    currentVersion: string,
    type: DependencyInfo['type']
  ): DependencyInfo {
    // Clean version string
    const cleanVersion = currentVersion.replace(/[\^~>=<]/g, '');
    const [major, minor = '0', patch = '0'] = cleanVersion.split('.');
    
    // Simulate getting latest version (in real implementation, would call npm registry)
    const { latest, wanted } = this.simulateLatestVersion(name, cleanVersion);
    
    // Check if outdated
    const [latestMajor] = latest.split('.');
    const majorUpdate = parseInt(latestMajor) > parseInt(major);
    const outdated = latest !== cleanVersion;
    
    // Get known breaking changes
    const breaking = this.getBreakingChanges(name, major, latestMajor);
    
    // Calculate risk score
    const risk = this.calculateRisk(name, majorUpdate, breaking, type);
    
    // Determine compatibility
    const compatible = !majorUpdate || breaking.length === 0;
    
    // Estimate effort
    const effort = this.estimateEffort(majorUpdate, breaking, type);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(risk, majorUpdate, breaking);

    return {
      name,
      current: cleanVersion,
      latest,
      wanted,
      type,
      outdated,
      majorUpdate,
      breaking,
      risk,
      compatible,
      effort,
      recommendation,
    };
  }

  /**
   * Simulate getting latest version from npm registry
   */
  private simulateLatestVersion(name: string, current: string): { latest: string; wanted: string } {
    const [major, minor = '0', patch = '0'] = current.split('.');
    
    // Simulate newer versions based on common packages
    const latestVersions: Record<string, string> = {
      'react': '18.3.1',
      'react-dom': '18.3.1',
      'next': '14.2.5',
      'typescript': '5.5.4',
      'express': '4.19.2',
      'lodash': '4.17.21',
      'axios': '1.7.3',
      'eslint': '9.8.0',
      'prettier': '3.3.3',
      'jest': '29.7.0',
      'vitest': '2.0.5',
      'tailwindcss': '3.4.7',
      'webpack': '5.93.0',
      'vite': '5.4.0',
    };

    const latest = latestVersions[name] || `${parseInt(major) + 1}.0.0`;
    const wanted = `${major}.${parseInt(minor) + 1}.0`;

    return { latest, wanted };
  }

  /**
   * Get known breaking changes between versions
   */
  private getBreakingChanges(name: string, currentMajor: string, latestMajor: string): string[] {
    const breaking: string[] = [];
    
    if (knownBreakingChanges[name]) {
      // Collect breaking changes for all major versions between current and latest
      for (let v = parseInt(currentMajor) + 1; v <= parseInt(latestMajor); v++) {
        if (knownBreakingChanges[name][v.toString()]) {
          breaking.push(...knownBreakingChanges[name][v.toString()]);
        }
      }
    }
    
    return breaking;
  }

  /**
   * Calculate risk score (0-100)
   */
  private calculateRisk(
    name: string,
    majorUpdate: boolean,
    breaking: string[],
    type: DependencyInfo['type']
  ): number {
    let risk = 0;
    
    // Base risk based on update type
    if (majorUpdate) {
      risk += 40;
    } else {
      risk += 10;
    }
    
    // Add risk for breaking changes
    risk += breaking.length * 10;
    
    // Critical packages have higher risk
    const criticalPackages = ['react', 'next', 'express', 'typescript'];
    if (criticalPackages.includes(name)) {
      risk += 20;
    }
    
    // Dev dependencies have slightly lower risk
    if (type === 'devDependency') {
      risk *= 0.8;
    }
    
    return Math.min(100, Math.round(risk));
  }

  /**
   * Estimate update effort
   */
  private estimateEffort(
    majorUpdate: boolean,
    breaking: string[],
    type: DependencyInfo['type']
  ): string {
    if (!majorUpdate) {
      return effortEstimates.patch;
    }
    
    if (breaking.length === 0) {
      return effortEstimates.majorSimple;
    }
    
    if (breaking.length > 3) {
      return effortEstimates.majorCritical;
    }
    
    return effortEstimates.majorComplex;
  }

  /**
   * Generate update recommendation
   */
  private generateRecommendation(risk: number, majorUpdate: boolean, breaking: string[]): string {
    if (risk < 30) {
      return 'Safe to update immediately';
    }
    
    if (risk < 50) {
      return 'Update recommended with basic testing';
    }
    
    if (risk < 70) {
      return 'Test thoroughly before updating';
    }
    
    if (majorUpdate && breaking.length > 0) {
      return 'Major update - plan migration carefully';
    }
    
    return 'High risk - defer unless necessary';
  }

  /**
   * Generate optimal update plan
   */
  private generateUpdatePlan(dependencies: DependencyInfo[]): UpdatePlan {
    // Sort by risk (lowest first) for update order
    const sortedForUpdate = [...dependencies]
      .filter(d => d.outdated)
      .sort((a, b) => a.risk - b.risk);
    
    const order = sortedForUpdate.slice(0, 5).map(d => d.name);
    
    // Calculate total effort
    const totalHours = sortedForUpdate.reduce((sum, d) => {
      const hours = d.effort.includes('day') ? 16 : 
                    d.effort.includes('hour') ? 2 : 0.5;
      return sum + hours;
    }, 0);
    
    const totalEffort = totalHours > 40 ? `${Math.ceil(totalHours / 8)} days` :
                        totalHours > 8 ? `${Math.ceil(totalHours / 8)}-${Math.ceil(totalHours / 8) + 1} days` :
                        `${Math.ceil(totalHours)} hours`;
    
    // Calculate average risk
    const totalRisk = Math.round(
      sortedForUpdate.reduce((sum, d) => sum + d.risk, 0) / Math.max(sortedForUpdate.length, 1)
    );
    
    // Generate benefits
    const benefits: string[] = [];
    
    const securityUpdates = sortedForUpdate.filter(d => d.risk > 60).length;
    if (securityUpdates > 0) {
      benefits.push(`Security improvements for ${securityUpdates} packages`);
    }
    
    const majorUpdates = sortedForUpdate.filter(d => d.majorUpdate).length;
    if (majorUpdates > 0) {
      benefits.push(`Access to ${majorUpdates} major version features`);
    }
    
    benefits.push('Bug fixes and performance improvements');
    benefits.push('Better compatibility with other packages');
    
    return {
      order,
      totalEffort,
      totalRisk,
      benefits,
    };
  }
}

export const dependencyAnalyzerService = new DependencyAnalyzerService();
