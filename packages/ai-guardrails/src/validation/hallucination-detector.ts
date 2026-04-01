import { PackageCheck, APICheck } from '@guardrail/core';
import https from 'https';

/**
 * Hallucination Detector
 *
 * Detects when AI generates code using non-existent packages or APIs
 */
export class HallucinationDetector {
  private packageCache: Map<string, { exists: boolean; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 3600000; // 1 hour

  /**
   * Verify if a package exists in its registry
   */
  async verifyPackage(
    name: string,
    registry: string = 'npm'
  ): Promise<PackageCheck> {
    const cacheKey = `${registry}:${name}`;
    const cached = this.packageCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return {
        exists: cached.exists,
        name,
        registry,
      };
    }

    let exists = false;
    let version: string | undefined;

    try {
      switch (registry) {
        case 'npm':
          const result = await this.checkNpmPackage(name);
          exists = result.exists;
          version = result.version;
          break;

        case 'pypi':
          exists = await this.checkPyPiPackage(name);
          break;

        case 'crates':
          exists = await this.checkCratesPackage(name);
          break;

        default:
          throw new Error(`Unknown registry: ${registry}`);
      }
    } catch (error) {
      console.error(`Error verifying package ${name}:`, error);
      exists = false;
    }

    this.packageCache.set(cacheKey, { exists, timestamp: Date.now() });

    const result: PackageCheck = {
      exists,
      name,
      version,
      registry,
    };

    if (!exists) {
      result.alternativeSuggestions = await this.findSimilarPackages(name);
    }

    return result;
  }

  /**
   * Check if NPM package exists
   */
  private async checkNpmPackage(name: string): Promise<{ exists: boolean; version?: string }> {
    return new Promise((resolve) => {
      const url = `https://registry.npmjs.org/${name}`;

      https
        .get(url, (res) => {
          if (res.statusCode === 200) {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const pkg = JSON.parse(data);
                resolve({ exists: true, version: pkg['dist-tags']?.latest });
              } catch {
                resolve({ exists: false });
              }
            });
          } else {
            resolve({ exists: false });
          }
        })
        .on('error', () => resolve({ exists: false }))
        .setTimeout(5000, () => resolve({ exists: false }));
    });
  }

  /**
   * Check if PyPI package exists
   */
  private async checkPyPiPackage(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const url = `https://pypi.org/pypi/${name}/json`;

      https
        .get(url, (res) => {
          resolve(res.statusCode === 200);
        })
        .on('error', () => resolve(false))
        .setTimeout(5000, () => resolve(false));
    });
  }

  /**
   * Check if Crates.io package exists
   */
  private async checkCratesPackage(name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const url = `https://crates.io/api/v1/crates/${name}`;

      https
        .get(url, (res) => {
          resolve(res.statusCode === 200);
        })
        .on('error', () => resolve(false))
        .setTimeout(5000, () => resolve(false));
    });
  }

  /**
   * Verify if an API/method exists (simplified version)
   */
  async verifyAPI(
    pkg: string,
    method: string,
    signature?: string
  ): Promise<APICheck> {
    // This is a simplified implementation
    // In production, you'd use TypeScript compiler API or documentation APIs

    const result: APICheck = {
      exists: false, // Default to false for safety
      package: pkg,
      method,
      signature,
    };

    // Check if package exists first
    const packageCheck = await this.verifyPackage(pkg);
    if (!packageCheck.exists) {
      result.alternativeSuggestions = packageCheck.alternativeSuggestions;
      return result;
    }

    // In a production system, you would:
    // 1. Load package types from DefinitelyTyped or package itself
    // 2. Parse TypeScript definitions
    // 3. Verify method signature

    // For now, mark as exists if package exists
    result.exists = true;

    return result;
  }

  /**
   * Find similar real packages (for suggestions)
   */
  async findSimilarPackages(name: string): Promise<string[]> {
    // Simple Levenshtein distance or fuzzy matching
    // In production, use a proper package search API

    const commonPackages: Record<string, string[]> = {
      react: ['react', 'preact', 'vue'],
      axios: ['axios', 'fetch', 'node-fetch'],
      express: ['express', 'fastify', 'koa'],
      lodash: ['lodash', 'underscore', 'ramda'],
      moment: ['moment', 'dayjs', 'date-fns'],
    };

    const lowercaseName = name.toLowerCase();

    for (const [key, alternatives] of Object.entries(commonPackages)) {
      if (lowercaseName.includes(key) || key.includes(lowercaseName)) {
        return alternatives;
      }
    }

    return [];
  }

  /**
   * Extract package imports from code
   */
  extractPackages(code: string, language: string): string[] {
    const packages: Set<string> = new Set();

    if (language === 'typescript' || language === 'javascript') {
      // Match: import ... from 'package'
      const importMatches = code.matchAll(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g);
      for (const match of importMatches) {
        const pkg = match[1];
        if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/')) {
          const pkgName = pkg.split('/')[0];
          if (pkgName && pkgName.startsWith('@')) {
            packages.add(`${pkgName}/${pkg.split('/')[1] || ''}`);
          } else if (pkgName) {
            packages.add(pkgName);
          }
        }
      }

      // Match: require('package')
      const requireMatches = code.matchAll(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of requireMatches) {
        const pkg = match[1];
        if (pkg && !pkg.startsWith('.') && !pkg.startsWith('/')) {
          const pkgName = pkg.split('/')[0];
          if (pkgName && pkgName.startsWith('@')) {
            packages.add(`${pkgName}/${pkg.split('/')[1] || ''}`);
          } else if (pkgName) {
            packages.add(pkgName);
          }
        }
      }
    } else if (language === 'python') {
      // Match: import package
      const importMatches = code.matchAll(/^import\s+([a-zA-Z0-9_]+)/gm);
      for (const match of importMatches) {
        if (match[1]) {
          packages.add(match[1]);
        }
      }

      // Match: from package import ...
      const fromMatches = code.matchAll(/^from\s+([a-zA-Z0-9_]+)\s+import/gm);
      for (const match of fromMatches) {
        if (match[1]) {
          packages.add(match[1]);
        }
      }
    }

    return Array.from(packages);
  }

  /**
   * Verify all packages in generated code
   */
  async verifyAllPackages(
    code: string,
    language: string
  ): Promise<Map<string, PackageCheck>> {
    const packages = this.extractPackages(code, language);
    const results = new Map<string, PackageCheck>();

    const registry = language === 'python' ? 'pypi' : 'npm';

    for (const pkg of packages) {
      const check = await this.verifyPackage(pkg, registry);
      results.set(pkg, check);
    }

    return results;
  }
}

// Export singleton instance
export const hallucinationDetector = new HallucinationDetector();
