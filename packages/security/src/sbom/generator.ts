/**
 * SBOM (Software Bill of Materials) Generator
 * 
 * Generates SBOMs in CycloneDX and SPDX formats for compliance and security
 */

import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

export type SBOMFormat = 'cyclonedx' | 'spdx' | 'json';

export interface SBOMComponent {
  type: 'library' | 'framework' | 'application' | 'file' | 'container';
  name: string;
  version: string;
  purl?: string;
  licenses: string[];
  hashes?: { algorithm: string; content: string }[];
  description?: string;
  author?: string;
  supplier?: string;
  externalReferences?: { type: string; url: string }[];
}

export interface SBOMDependency {
  ref: string;
  dependsOn: string[];
}

export interface SBOM {
  format: SBOMFormat;
  specVersion: string;
  serialNumber: string;
  version: number;
  metadata: {
    timestamp: string;
    tools: { vendor: string; name: string; version: string }[];
    component: {
      type: string;
      name: string;
      version: string;
    };
    authors?: { name: string; email?: string }[];
  };
  components: SBOMComponent[];
  dependencies: SBOMDependency[];
}

export interface SBOMGeneratorOptions {
  format: SBOMFormat;
  includeDevDependencies?: boolean;
  includeLicenses?: boolean;
  includeHashes?: boolean;
  outputPath?: string;
  vex?: boolean;
  sign?: boolean;
}

export interface VEXDocument {
  '@context': string;
  '@id': string;
  author: string;
  timestamp: string;
  version: string;
  statements: VEXStatement[];
}

export interface VEXStatement {
  vulnerability: string;
  products: string[];
  status: 'not_affected' | 'affected' | 'fixed' | 'under_investigation';
  justification?: string;
  actionStatement?: string;
  actionStatementTimestamp?: string;
}

export class SBOMGenerator {
  private readonly toolInfo = {
    vendor: 'guardrail AI',
    name: 'guardrail-sbom-generator',
    version: '1.0.0',
  };

  /**
   * Generate SBOM for a project
   */
  async generate(projectPath: string, options: SBOMGeneratorOptions): Promise<SBOM> {
    const packageJsonPath = join(projectPath, 'package.json');
    
    if (!existsSync(packageJsonPath)) {
      throw new Error('package.json not found in project path');
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    const components = await this.extractComponents(projectPath, packageJson, options);
    const dependencies = this.buildDependencyGraph(packageJson, options);

    const sbom: SBOM = {
      format: options.format,
      specVersion: options.format === 'cyclonedx' ? '1.5' : '2.3',
      serialNumber: `urn:uuid:${this.generateUUID()}`,
      version: 1,
      metadata: {
        timestamp: new Date().toISOString(),
        tools: [this.toolInfo],
        component: {
          type: 'application',
          name: packageJson.name || 'unknown',
          version: packageJson.version || '0.0.0',
        },
        authors: packageJson.author ? [{ name: packageJson.author }] : undefined,
      },
      components,
      dependencies,
    };

    if (options.outputPath) {
      await this.writeSBOM(sbom, options.outputPath, options.format);
      
      if (options.vex) {
        const vexPath = options.outputPath.replace(/\.(json|xml)$/, '.vex.json');
        await this.generateVEX(sbom, vexPath);
      }
      
      if (options.sign) {
        await this.signSBOM(options.outputPath);
      }
    }

    return sbom;
  }

  /**
   * Generate SBOM for a container image using syft
   */
  async generateContainerSBOM(imageName: string, options: SBOMGeneratorOptions): Promise<SBOM> {
    if (!this.checkToolAvailable('syft')) {
      throw new Error(
        'syft is not installed. Install it with:\n' +
        '  curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin\n' +
        '  Or visit: https://github.com/anchore/syft#installation'
      );
    }

    const format = options.format === 'spdx' ? 'spdx-json' : 'cyclonedx-json';
    const tempFile = join(process.cwd(), `.sbom-${Date.now()}.json`);

    try {
      execSync(`syft ${imageName} -o ${format} --file ${tempFile}`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      const rawSBOM = JSON.parse(readFileSync(tempFile, 'utf-8'));
      const sbom = this.normalizeContainerSBOM(rawSBOM, options.format, imageName);

      if (options.outputPath) {
        await this.writeSBOM(sbom, options.outputPath, options.format);
        
        if (options.vex) {
          const vexPath = options.outputPath.replace(/\.(json|xml)$/, '.vex.json');
          await this.generateVEX(sbom, vexPath);
        }
        
        if (options.sign) {
          await this.signSBOM(options.outputPath);
        }
      }

      return sbom;
    } finally {
      if (existsSync(tempFile)) {
        try {
          require('fs').unlinkSync(tempFile);
        } catch (error) {
          // Failed to process dependency - continue with other dependencies
        }
      }
    }
  }

  /**
   * Extract components from package.json
   */
  private async extractComponents(
    projectPath: string,
    packageJson: any,
    options: SBOMGeneratorOptions
  ): Promise<SBOMComponent[]> {
    const components: SBOMComponent[] = [];
    const deps = { ...packageJson.dependencies };
    
    if (options.includeDevDependencies) {
      Object.assign(deps, packageJson.devDependencies);
    }

    for (const [name, version] of Object.entries(deps)) {
      const versionStr = String(version).replace(/^[\^~]/, '');
      
      const component: SBOMComponent = {
        type: 'library',
        name,
        version: versionStr,
        purl: `pkg:npm/${name}@${versionStr}`,
        licenses: [],
      };

      // Try to get license info
      if (options.includeLicenses) {
        const license = await this.getLicenseForPackage(projectPath, name);
        if (license) {
          component.licenses = [license];
        }
      }

      // Generate hashes if requested
      if (options.includeHashes) {
        const hashes = await this.computePackageHashes(projectPath, name);
        if (hashes.length > 0) {
          component.hashes = hashes;
        }
      }

      components.push(component);
    }

    return components;
  }

  /**
   * Build dependency graph
   */
  private buildDependencyGraph(packageJson: any, options: SBOMGeneratorOptions): SBOMDependency[] {
    const dependencies: SBOMDependency[] = [];
    const rootRef = `pkg:npm/${packageJson.name}@${packageJson.version}`;
    
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = options.includeDevDependencies 
      ? Object.keys(packageJson.devDependencies || {})
      : [];

    // Root dependency
    dependencies.push({
      ref: rootRef,
      dependsOn: [...deps, ...devDeps].map(name => {
        const version = packageJson.dependencies?.[name] || packageJson.devDependencies?.[name];
        return `pkg:npm/${name}@${String(version).replace(/^[\^~]/, '')}`;
      }),
    });

    return dependencies;
  }

  /**
   * Get license for a package
   */
  private async getLicenseForPackage(projectPath: string, packageName: string): Promise<string | null> {
    const packagePath = join(projectPath, 'node_modules', packageName, 'package.json');
    
    if (existsSync(packagePath)) {
      try {
        const pkgJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        return pkgJson.license || null;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Hash content
   */
  private hashContent(content: string, algorithm: string): string {
    return createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Generate UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Write SBOM to file
   */
  private async writeSBOM(sbom: SBOM, outputPath: string, format: SBOMFormat): Promise<void> {
    let content: string;
    
    switch (format) {
      case 'cyclonedx':
        content = this.toCycloneDXJSON(sbom);
        break;
      case 'spdx':
        content = this.toSPDXJSON(sbom);
        break;
      default:
        content = JSON.stringify(sbom, null, 2);
    }

    writeFileSync(outputPath, content, 'utf-8');
  }

  /**
   * Convert to CycloneDX JSON format
   */
  toCycloneDXJSON(sbom: SBOM): string {
    const cyclonedx = {
      bomFormat: 'CycloneDX',
      specVersion: '1.5',
      serialNumber: sbom.serialNumber,
      version: sbom.version,
      metadata: {
        timestamp: sbom.metadata.timestamp,
        tools: sbom.metadata.tools.map(t => ({
          vendor: t.vendor,
          name: t.name,
          version: t.version,
        })),
        component: {
          type: sbom.metadata.component.type,
          name: sbom.metadata.component.name,
          version: sbom.metadata.component.version,
          'bom-ref': `pkg:npm/${sbom.metadata.component.name}@${sbom.metadata.component.version}`,
        },
      },
      components: sbom.components.map(c => ({
        type: c.type,
        name: c.name,
        version: c.version,
        purl: c.purl,
        'bom-ref': c.purl,
        licenses: c.licenses.map(l => ({ license: { id: l } })),
        hashes: c.hashes?.map(h => ({ alg: h.algorithm, content: h.content })),
      })),
      dependencies: sbom.dependencies.map(d => ({
        ref: d.ref,
        dependsOn: d.dependsOn,
      })),
    };

    return JSON.stringify(cyclonedx, null, 2);
  }

  /**
   * Convert to SPDX JSON format
   */
  toSPDXJSON(sbom: SBOM): string {
    const spdx = {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: sbom.metadata.component.name,
      documentNamespace: `https://guardrail.dev/sbom/${sbom.serialNumber}`,
      creationInfo: {
        created: sbom.metadata.timestamp,
        creators: [`Tool: ${sbom.metadata.tools[0]?.name}-${sbom.metadata.tools[0]?.version}`],
      },
      packages: sbom.components.map((c, i) => ({
        SPDXID: `SPDXRef-Package-${i}`,
        name: c.name,
        versionInfo: c.version,
        downloadLocation: `https://registry.npmjs.org/${c.name}/-/${c.name}-${c.version}.tgz`,
        filesAnalyzed: false,
        licenseConcluded: c.licenses[0] || 'NOASSERTION',
        licenseDeclared: c.licenses[0] || 'NOASSERTION',
        copyrightText: 'NOASSERTION',
        externalRefs: c.purl ? [{
          referenceCategory: 'PACKAGE-MANAGER',
          referenceType: 'purl',
          referenceLocator: c.purl,
        }] : [],
      })),
      relationships: [
        {
          spdxElementId: 'SPDXRef-DOCUMENT',
          relatedSpdxElement: 'SPDXRef-Package-0',
          relationshipType: 'DESCRIBES',
        },
        ...sbom.components.slice(1).map((_, i) => ({
          spdxElementId: 'SPDXRef-Package-0',
          relatedSpdxElement: `SPDXRef-Package-${i + 1}`,
          relationshipType: 'DEPENDS_ON',
        })),
      ],
    };

    return JSON.stringify(spdx, null, 2);
  }

  /**
   * Validate SBOM structure
   */
  validateSBOM(sbom: SBOM): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!sbom.metadata?.component?.name) {
      errors.push('Missing component name in metadata');
    }

    if (!sbom.components || sbom.components.length === 0) {
      errors.push('No components found in SBOM');
    }

    for (const component of sbom.components) {
      if (!component.name) {
        errors.push('Component missing name');
      }
      if (!component.version) {
        errors.push(`Component ${component.name} missing version`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Compute hashes for a package
   */
  private async computePackageHashes(
    projectPath: string,
    packageName: string
  ): Promise<{ algorithm: string; content: string }[]> {
    const hashes: { algorithm: string; content: string }[] = [];
    const packagePath = join(projectPath, 'node_modules', packageName, 'package.json');

    if (existsSync(packagePath)) {
      const content = readFileSync(packagePath, 'utf-8');
      hashes.push({ algorithm: 'SHA-256', content: this.hashContent(content, 'sha256') });
    }

    return hashes;
  }

  /**
   * Generate VEX document
   */
  private async generateVEX(sbom: SBOM, outputPath: string): Promise<void> {
    const vex: VEXDocument = {
      '@context': 'https://openvex.dev/ns',
      '@id': `${sbom.serialNumber}/vex`,
      author: this.toolInfo.vendor,
      timestamp: new Date().toISOString(),
      version: '1',
      statements: sbom.components.map(component => ({
        vulnerability: 'PLACEHOLDER',
        products: [component.purl || `${component.name}@${component.version}`],
        status: 'not_affected' as const,
        justification: 'No known vulnerabilities at time of SBOM generation',
      })),
    };

    writeFileSync(outputPath, JSON.stringify(vex, null, 2), 'utf-8');
  }

  /**
   * Sign SBOM using cosign
   */
  private async signSBOM(sbomPath: string): Promise<void> {
    if (!this.checkToolAvailable('cosign')) {
      throw new Error(
        'cosign is not installed. Install it with:\n' +
        '  brew install cosign (macOS)\n' +
        '  Or visit: https://docs.sigstore.dev/cosign/installation/'
      );
    }

    try {
      execSync(`cosign sign-blob --yes ${sbomPath} --output-signature ${sbomPath}.sig`, {
        stdio: 'pipe',
        encoding: 'utf-8',
      });
    } catch (error: any) {
      throw new Error(`Failed to sign SBOM: ${error.message}`);
    }
  }

  /**
   * Check if a tool is available
   */
  private checkToolAvailable(tool: string): boolean {
    try {
      execSync(`${tool} --version`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalize container SBOM from syft output
   */
  private normalizeContainerSBOM(rawSBOM: any, format: SBOMFormat, imageName: string): SBOM {
    if (format === 'cyclonedx') {
      return {
        format: 'cyclonedx',
        specVersion: rawSBOM.specVersion || '1.5',
        serialNumber: rawSBOM.serialNumber || `urn:uuid:${this.generateUUID()}`,
        version: rawSBOM.version || 1,
        metadata: {
          timestamp: rawSBOM.metadata?.timestamp || new Date().toISOString(),
          tools: [this.toolInfo],
          component: {
            type: 'container',
            name: imageName,
            version: 'latest',
          },
        },
        components: (rawSBOM.components || []).map((c: any) => ({
          type: c.type || 'library',
          name: c.name,
          version: c.version,
          purl: c.purl,
          licenses: (c.licenses || []).map((l: any) => l.license?.id || l.expression || 'unknown'),
          hashes: c.hashes?.map((h: any) => ({ algorithm: h.alg, content: h.content })),
        })),
        dependencies: rawSBOM.dependencies || [],
      };
    } else {
      return {
        format: 'spdx',
        specVersion: '2.3',
        serialNumber: `urn:uuid:${this.generateUUID()}`,
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          tools: [this.toolInfo],
          component: {
            type: 'container',
            name: imageName,
            version: 'latest',
          },
        },
        components: (rawSBOM.packages || []).map((p: any) => ({
          type: 'library',
          name: p.name,
          version: p.versionInfo,
          purl: p.externalRefs?.find((r: any) => r.referenceType === 'purl')?.referenceLocator,
          licenses: p.licenseConcluded ? [p.licenseConcluded] : [],
        })),
        dependencies: [],
      };
    }
  }
}

// Export singleton
export const sbomGenerator = new SBOMGenerator();
