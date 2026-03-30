/**
 * Unit tests for enterprise SBOM generator
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SBOMGenerator, VEXDocument } from './generator';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';

describe('SBOMGenerator - Enterprise Features', () => {
  let generator: SBOMGenerator;
  let testDir: string;

  beforeEach(() => {
    generator = new SBOMGenerator();
    testDir = join(process.cwd(), '.test-sbom-' + Date.now());
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Hash Verification', () => {
    it('should compute SHA-256 hashes for package.json', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const nodeModulesDir = join(testDir, 'node_modules', 'lodash');
      mkdirSync(nodeModulesDir, { recursive: true });
      writeFileSync(
        join(nodeModulesDir, 'package.json'),
        JSON.stringify({ name: 'lodash', version: '4.17.21', license: 'MIT' }, null, 2)
      );

      const sbom = await generator.generate(testDir, {
        format: 'cyclonedx',
        includeHashes: true,
        includeLicenses: true,
      });

      expect(sbom.components.length).toBeGreaterThan(0);
      const lodashComponent = sbom.components.find(c => c.name === 'lodash');
      expect(lodashComponent).toBeDefined();
      expect(lodashComponent?.hashes).toBeDefined();
      expect(lodashComponent?.hashes?.length).toBeGreaterThan(0);
      expect(lodashComponent?.hashes?.[0].algorithm).toBe('SHA-256');
      expect(lodashComponent?.hashes?.[0].content).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should not include hashes when includeHashes is false', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'express': '^4.18.0',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const sbom = await generator.generate(testDir, {
        format: 'cyclonedx',
        includeHashes: false,
      });

      expect(sbom.components.length).toBeGreaterThan(0);
      const component = sbom.components[0];
      expect(component.hashes).toBeUndefined();
    });

    it('should handle missing node_modules gracefully', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'missing-package': '^1.0.0',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const sbom = await generator.generate(testDir, {
        format: 'cyclonedx',
        includeHashes: true,
      });

      expect(sbom.components.length).toBeGreaterThan(0);
      const component = sbom.components.find(c => c.name === 'missing-package');
      expect(component).toBeDefined();
      expect(component?.hashes).toBeUndefined();
    });
  });

  describe('VEX Document Generation', () => {
    it('should generate VEX document with correct schema', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'axios': '^1.0.0',
          'express': '^4.18.0',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const outputPath = join(testDir, 'sbom.json');
      const sbom = await generator.generate(testDir, {
        format: 'cyclonedx',
        outputPath,
        vex: true,
      });

      const vexPath = join(testDir, 'sbom.vex.json');
      expect(existsSync(vexPath)).toBe(true);

      const vexContent = require('fs').readFileSync(vexPath, 'utf-8');
      const vex: VEXDocument = JSON.parse(vexContent);

      expect(vex['@context']).toBe('https://openvex.dev/ns');
      expect(vex['@id']).toContain(sbom.serialNumber);
      expect(vex.author).toBe('guardrail AI');
      expect(vex.version).toBe('1');
      expect(vex.statements).toBeDefined();
      expect(vex.statements.length).toBe(sbom.components.length);
    });

    it('should create VEX statements for each component', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const outputPath = join(testDir, 'sbom.json');
      await generator.generate(testDir, {
        format: 'cyclonedx',
        outputPath,
        vex: true,
      });

      const vexPath = join(testDir, 'sbom.vex.json');
      const vexContent = require('fs').readFileSync(vexPath, 'utf-8');
      const vex: VEXDocument = JSON.parse(vexContent);

      const lodashStatement = vex.statements.find(s => 
        s.products.some(p => p.includes('lodash'))
      );

      expect(lodashStatement).toBeDefined();
      expect(lodashStatement?.status).toBe('not_affected');
      expect(lodashStatement?.justification).toBeDefined();
    });

    it('should not generate VEX when vex option is false', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const outputPath = join(testDir, 'sbom.json');
      await generator.generate(testDir, {
        format: 'cyclonedx',
        outputPath,
        vex: false,
      });

      const vexPath = join(testDir, 'sbom.vex.json');
      expect(existsSync(vexPath)).toBe(false);
    });
  });

  describe('SBOM Signing', () => {
    it('should throw error when cosign is not available', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {},
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const outputPath = join(testDir, 'sbom.json');

      await expect(
        generator.generate(testDir, {
          format: 'cyclonedx',
          outputPath,
          sign: true,
        })
      ).rejects.toThrow(/cosign is not installed/);
    });
  });

  describe('Container SBOM', () => {
    it('should throw error when syft is not available', async () => {
      await expect(
        generator.generateContainerSBOM('nginx:latest', {
          format: 'cyclonedx',
        })
      ).rejects.toThrow(/syft is not installed/);
    });

    it('should provide installation instructions for syft', async () => {
      try {
        await generator.generateContainerSBOM('alpine:latest', {
          format: 'cyclonedx',
        });
      } catch (error: any) {
        expect(error.message).toContain('curl -sSfL');
        expect(error.message).toContain('anchore/syft');
      }
    });
  });

  describe('CycloneDX Format with Hashes', () => {
    it('should include hashes in CycloneDX output', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const nodeModulesDir = join(testDir, 'node_modules', 'react');
      mkdirSync(nodeModulesDir, { recursive: true });
      writeFileSync(
        join(nodeModulesDir, 'package.json'),
        JSON.stringify({ name: 'react', version: '18.0.0', license: 'MIT' }, null, 2)
      );

      const sbom = await generator.generate(testDir, {
        format: 'cyclonedx',
        includeHashes: true,
        includeLicenses: true,
      });

      const cyclonedxJson = generator.toCycloneDXJSON(sbom);
      const parsed = JSON.parse(cyclonedxJson);

      expect(parsed.bomFormat).toBe('CycloneDX');
      expect(parsed.specVersion).toBe('1.5');

      const reactComponent = parsed.components.find((c: any) => c.name === 'react');
      expect(reactComponent).toBeDefined();
      expect(reactComponent.hashes).toBeDefined();
      expect(reactComponent.hashes.length).toBeGreaterThan(0);
      expect(reactComponent.hashes[0].alg).toBe('SHA-256');
    });
  });

  describe('SPDX Format', () => {
    it('should generate valid SPDX 2.3 format', async () => {
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        dependencies: {
          'typescript': '^5.0.0',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const sbom = await generator.generate(testDir, {
        format: 'spdx',
      });

      const spdxJson = generator.toSPDXJSON(sbom);
      const parsed = JSON.parse(spdxJson);

      expect(parsed.spdxVersion).toBe('SPDX-2.3');
      expect(parsed.dataLicense).toBe('CC0-1.0');
      expect(parsed.SPDXID).toBe('SPDXRef-DOCUMENT');
      expect(parsed.packages).toBeDefined();
      expect(parsed.relationships).toBeDefined();
    });
  });

  describe('Hash Computation', () => {
    it('should compute consistent SHA-256 hashes', () => {
      const content = 'test content for hashing';
      const hash1 = (generator as any).hashContent(content, 'sha256');
      const hash2 = (generator as any).hashContent(content, 'sha256');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should compute different hashes for different content', () => {
      const content1 = 'content one';
      const content2 = 'content two';
      const hash1 = (generator as any).hashContent(content1, 'sha256');
      const hash2 = (generator as any).hashContent(content2, 'sha256');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('SBOM Validation', () => {
    it('should validate SBOM with all required fields', async () => {
      const packageJson = {
        name: 'valid-project',
        version: '1.0.0',
        dependencies: {
          'lodash': '^4.17.21',
        },
      };

      writeFileSync(join(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const sbom = await generator.generate(testDir, {
        format: 'cyclonedx',
      });

      const validation = generator.validateSBOM(sbom);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });
});
