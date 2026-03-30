/**
 * Script Analyzer
 *
 * Analyzes package.json scripts for suspicious behavior
 */

export interface ScriptAnalysisResult {
  scriptName: string;
  scriptContent: string;
  isSuspicious: boolean;
  threats: ScriptThreat[];
  riskScore: number;
}

export interface ScriptThreat {
  type: 'data_exfiltration' | 'crypto_mining' | 'backdoor' | 'malicious_download' | 'privilege_escalation';
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export class ScriptAnalyzer {
  /**
   * Analyze package.json scripts
   */
  async analyzeScripts(_packageName: string, _version: string): Promise<ScriptAnalysisResult[]> {
    // In production, this would fetch package.json from npm registry
    // For now, return empty array
    return [];
  }

  /**
   * Analyze a single script
   */
  analyzeScript(scriptName: string, scriptContent: string): ScriptAnalysisResult {
    const threats: ScriptThreat[] = [];

    // Check for data exfiltration
    if (this.detectExfiltration(scriptContent)) {
      threats.push({
        type: 'data_exfiltration',
        pattern: 'network_request',
        severity: 'high',
        description: 'Script makes network requests that could exfiltrate data',
      });
    }

    // Check for crypto mining
    if (this.detectCryptoMining(scriptContent)) {
      threats.push({
        type: 'crypto_mining',
        pattern: 'crypto_miner',
        severity: 'high',
        description: 'Script contains crypto mining code',
      });
    }

    // Check for backdoors
    if (this.detectBackdoor(scriptContent)) {
      threats.push({
        type: 'backdoor',
        pattern: 'reverse_shell',
        severity: 'critical',
        description: 'Script opens a backdoor or reverse shell',
      });
    }

    // Check for malicious downloads
    if (this.detectMaliciousDownload(scriptContent)) {
      threats.push({
        type: 'malicious_download',
        pattern: 'download_execute',
        severity: 'critical',
        description: 'Script downloads and executes code',
      });
    }

    // Check for privilege escalation
    if (this.detectPrivilegeEscalation(scriptContent)) {
      threats.push({
        type: 'privilege_escalation',
        pattern: 'sudo_usage',
        severity: 'high',
        description: 'Script attempts privilege escalation',
      });
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(threats);

    return {
      scriptName,
      scriptContent,
      isSuspicious: threats.length > 0,
      threats,
      riskScore,
    };
  }

  /**
   * Detect data exfiltration patterns
   */
  detectExfiltration(script: string): boolean {
    const patterns = [
      /curl\s+.*\|\s*bash/i,              // Pipe to bash
      /wget\s+.*\|\s*sh/i,                // Pipe to sh
      /fetch\(['"]http/i,                 // HTTP requests
      /axios\./i,                          // Axios requests
      /http\.request/i,                    // HTTP module
      /child_process\.exec.*curl/i,       // Execute curl
    ];

    return patterns.some((p) => p.test(script));
  }

  /**
   * Detect crypto mining
   */
  detectCryptoMining(script: string): boolean {
    const patterns = [
      /coinhive/i,
      /cryptonight/i,
      /monero/i,
      /xmrig/i,
      /stratum\+tcp/i,
    ];

    return patterns.some((p) => p.test(script));
  }

  /**
   * Detect backdoor patterns
   */
  private detectBackdoor(script: string): boolean {
    const patterns = [
      /nc\s+-l/i,                         // Netcat listener
      /\/bin\/sh\s+-i/i,                  // Interactive shell
      /bash\s+-i/i,                       // Interactive bash
      /python.*socket/i,                  // Python socket
    ];

    return patterns.some((p) => p.test(script));
  }

  /**
   * Detect malicious downloads
   */
  private detectMaliciousDownload(script: string): boolean {
    const patterns = [
      /curl.*\|\s*bash/i,
      /wget.*&&.*chmod\s*\+x/i,
      /download.*&&.*execute/i,
    ];

    return patterns.some((p) => p.test(script));
  }

  /**
   * Detect privilege escalation
   */
  private detectPrivilegeEscalation(script: string): boolean {
    const patterns = [
      /sudo\s+/i,
      /su\s+-/i,
      /chmod\s+777/i,
      /chown\s+root/i,
    ];

    return patterns.some((p) => p.test(script));
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(threats: ScriptThreat[]): number {
    const severityScores = {
      low: 25,
      medium: 50,
      high: 75,
      critical: 100,
    };

    if (threats.length === 0) return 0;

    const totalScore = threats.reduce((sum, threat) => {
      return sum + severityScores[threat.severity];
    }, 0);

    return Math.min(100, totalScore / threats.length);
  }
}

// Export singleton
export const scriptAnalyzer = new ScriptAnalyzer();
