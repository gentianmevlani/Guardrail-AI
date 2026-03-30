/**
 * Malicious Package Database
 *
 * Checks packages against known malicious packages
 */

export interface MaliciousPackageInfo {
  name: string;
  version?: string;
  reason: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cve?: string;
  reported: Date;
}

/**
 * Known malicious packages (this would be updated regularly from external sources)
 */
const KNOWN_MALICIOUS: MaliciousPackageInfo[] = [
  // Example entries - in production, this would be fetched from:
  // - npm security advisories
  // - Snyk vulnerability database
  // - GitHub Advisory Database
  // - Custom threat intelligence feeds
];

export class MaliciousPackageDB {
  private maliciousPackages: Map<string, MaliciousPackageInfo[]> = new Map();

  constructor() {
    this.loadDatabase();
  }

  /**
   * Check if package is known to be malicious
   */
  async checkPackage(name: string, version: string): Promise<{
    isMalicious: boolean;
    matches: MaliciousPackageInfo[];
  }> {
    const matches: MaliciousPackageInfo[] = [];

    // Check exact name match
    const nameMatches = this.maliciousPackages.get(name) || [];

    for (const match of nameMatches) {
      // If no version specified in DB, flag all versions
      if (!match.version) {
        matches.push(match);
        continue;
      }

      // Check version match
      if (match.version === version || match.version === '*') {
        matches.push(match);
      }
    }

    return {
      isMalicious: matches.length > 0,
      matches,
    };
  }

  /**
   * Load malicious packages database
   */
  private loadDatabase(): void {
    for (const pkg of KNOWN_MALICIOUS) {
      if (!this.maliciousPackages.has(pkg.name)) {
        this.maliciousPackages.set(pkg.name, []);
      }
      this.maliciousPackages.get(pkg.name)!.push(pkg);
    }
  }

  /**
   * Update database from external sources
   */
  async updateDatabase(): Promise<{ added: number; updated: number }> {
    // In production, this would:
    // 1. Fetch from npm security advisories API
    // 2. Fetch from Snyk API
    // 3. Fetch from GitHub Advisory Database
    // 4. Merge with existing database
    // 5. Return statistics

    return { added: 0, updated: 0 };
  }

  /**
   * Add custom malicious package
   */
  addMaliciousPackage(info: MaliciousPackageInfo): void {
    if (!this.maliciousPackages.has(info.name)) {
      this.maliciousPackages.set(info.name, []);
    }
    this.maliciousPackages.get(info.name)!.push(info);
  }
}

// Export singleton
export const maliciousPackageDB = new MaliciousPackageDB();
