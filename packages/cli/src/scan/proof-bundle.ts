/**
 * Proof Bundle Generator
 * 
 * Creates zip file with traces/HAR/screenshots/log excerpts
 */

import { existsSync, readFileSync, createWriteStream } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';

export interface ProofBundle {
  path: string;
  includes: string[];
  metadata: {
    scanId: string;
    timestamp: string;
    verdict: 'PASS' | 'FAIL' | 'WARN';
    findings: number;
  };
}

export class ProofBundleGenerator {
  /**
   * Create proof bundle zip file
   */
  async createBundle(
    artifactsDir: string,
    scanResult: any,
    proofGraph: any,
    deadUI: any,
    playwright: any
  ): Promise<ProofBundle | null> {
    // Only create bundle if there are failures
    if (scanResult.verdict === 'PASS' && deadUI.findings.length === 0 && playwright.passed) {
      return null;
    }

    const bundlePath = join(artifactsDir, 'proofbundle.zip');
    const includes: string[] = [];

    // Collect all artifacts
    const artifacts: Array<{ path: string; content: string | Buffer }> = [];

    // Add scan.json
    const scanFile = join(dirname(artifactsDir), 'scan.json');
    if (existsSync(scanFile)) {
      artifacts.push({
        path: 'scan.json',
        content: readFileSync(scanFile, 'utf-8'),
      });
      includes.push('scan.json');
    }

    // Add proof.json
    const proofFile = join(dirname(artifactsDir), 'proof.json');
    if (existsSync(proofFile)) {
      artifacts.push({
        path: 'proof.json',
        content: readFileSync(proofFile, 'utf-8'),
      });
      includes.push('proof.json');
    }

    // Add dead-ui.json
    if (deadUI.findings.length > 0) {
      artifacts.push({
        path: 'dead-ui.json',
        content: JSON.stringify(deadUI, null, 2),
      });
      includes.push('dead-ui.json');
    }

    // Add Playwright traces
    if (playwright.traces && playwright.traces.length > 0) {
      playwright.traces.forEach((trace: string, index: number) => {
        if (existsSync(trace)) {
          const traceName = `trace-${index}.zip`;
          artifacts.push({
            path: traceName,
            content: readFileSync(trace),
          });
          includes.push(traceName);
        }
      });
    }

    // Add screenshots
    if (playwright.failures) {
      playwright.failures.forEach((failure: any, index: number) => {
        if (failure.screenshot && existsSync(failure.screenshot)) {
          const screenshotName = `screenshot-${index}.png`;
          artifacts.push({
            path: screenshotName,
            content: readFileSync(failure.screenshot),
          });
          includes.push(screenshotName);
        }
      });
    }

    // Create manifest
    const manifest = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      scanId: scanResult.timestamp || Date.now().toString(),
      verdict: scanResult.verdict,
      findings: {
        scan: scanResult.summary?.totalFindings || 0,
        deadUI: deadUI.summary?.total || 0,
        playwright: playwright.summary?.failed || 0,
      },
      includes,
    };

    artifacts.push({
      path: 'manifest.json',
      content: JSON.stringify(manifest, null, 2),
    });
    includes.push('manifest.json');

    // Create zip file
    try {
      // Try to use archiver if available
      const archiver = await this.getArchiver();
      if (archiver) {
        await this.createZipWithArchiver(bundlePath, artifacts);
      } else {
        // Fallback: create tar or just list files
        await this.createBundleManifest(bundlePath, artifacts, manifest);
      }
    } catch (error: any) {
      // If zip creation fails, create a manifest file instead
      await this.createBundleManifest(bundlePath.replace('.zip', '.json'), artifacts, manifest);
      return {
        path: bundlePath.replace('.zip', '.json'),
        includes,
        metadata: {
          scanId: manifest.scanId,
          timestamp: manifest.timestamp,
          verdict: manifest.verdict as any,
          findings: manifest.findings.scan + manifest.findings.deadUI + manifest.findings.playwright,
        },
      };
    }

    return {
      path: bundlePath,
      includes,
      metadata: {
        scanId: manifest.scanId,
        timestamp: manifest.timestamp,
        verdict: manifest.verdict as any,
        findings: manifest.findings.scan + manifest.findings.deadUI + manifest.findings.playwright,
      },
    };
  }

  private async getArchiver(): Promise<any> {
    try {
      return await import('archiver');
    } catch {
      return null;
    }
  }

  private async createZipWithArchiver(bundlePath: string, artifacts: Array<{ path: string; content: string | Buffer }>): Promise<void> {
    const archiver = await this.getArchiver();
    if (!archiver) return;

    return new Promise((resolve, reject) => {
      const output = createWriteStream(bundlePath);
      const archive = archiver.default('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', reject);

      archive.pipe(output);

      artifacts.forEach(artifact => {
        archive.append(artifact.content, { name: artifact.path });
      });

      archive.finalize();
    });
  }

  private async createBundleManifest(
    manifestPath: string,
    artifacts: Array<{ path: string; content: string | Buffer }>,
    manifest: any
  ): Promise<void> {
    const manifestContent = {
      ...manifest,
      artifacts: artifacts.map(a => ({
        path: a.path,
        size: Buffer.isBuffer(a.content) ? a.content.length : Buffer.byteLength(a.content, 'utf-8'),
        hash: createHash('sha256').update(a.content).digest('hex').substring(0, 16),
      })),
    };

    const { writeFileSync } = await import('fs');
    writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
  }
}
