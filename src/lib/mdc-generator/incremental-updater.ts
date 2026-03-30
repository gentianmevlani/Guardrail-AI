/**
 * Incremental MDC Updater
 * 
 * Only updates MDC files that have changed, preserving manual edits
 * and detecting what needs regeneration.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { MDCSpecification } from './mdc-generator';

export interface FileHash {
  file: string;
  hash: string;
  lastModified: string;
}

export interface UpdatePlan {
  toRegenerate: string[];
  toUpdate: string[];
  toCreate: string[];
  unchanged: string[];
}

export class IncrementalMDCUpdater {
  private hashFile: string;
  private projectPath: string;

  constructor(projectPath: string, outputDir: string) {
    this.projectPath = projectPath;
    this.hashFile = path.join(outputDir, '.mdc-hashes.json');
  }

  /**
   * Check what needs updating
   */
  async planUpdate(
    currentSpecs: MDCSpecification[],
    sourceFiles: string[]
  ): Promise<UpdatePlan> {
    const existingHashes = await this.loadHashes();
    const currentHashes = await this.calculateHashes(sourceFiles);
    const existingSpecs = await this.loadExistingSpecs();

    const toRegenerate: string[] = [];
    const toUpdate: string[] = [];
    const toCreate: string[] = [];
    const unchanged: string[] = [];

    // Check each specification
    for (const spec of currentSpecs) {
      const existingSpec = existingSpecs.find(s => s.fileName === spec.fileName);
      
      if (!existingSpec) {
        // New specification
        toCreate.push(spec.fileName);
        continue;
      }

      // Check if any related files changed
      const relatedFilesChanged = spec.relatedFiles.some(file => {
        const oldHash = existingHashes.find(h => h.file === file);
        const newHash = currentHashes.find(h => h.file === file);
        
        if (!oldHash || !newHash) return true;
        return oldHash.hash !== newHash.hash;
      });

      if (relatedFilesChanged) {
        // Check if manual edits exist (hash mismatch but file exists)
        const specPath = path.join(path.dirname(this.hashFile), spec.fileName);
        const hasManualEdits = await this.hasManualEdits(specPath, existingSpec);
        
        if (hasManualEdits) {
          toUpdate.push(spec.fileName); // Update, preserving structure
        } else {
          toRegenerate.push(spec.fileName); // Full regeneration
        }
      } else {
        unchanged.push(spec.fileName);
      }
    }

    return { toRegenerate, toUpdate, toCreate, unchanged };
  }

  /**
   * Save current hashes
   */
  async saveHashes(hashes: FileHash[]): Promise<void> {
    await fs.writeFile(this.hashFile, JSON.stringify(hashes, null, 2), 'utf8');
  }

  /**
   * Load existing hashes
   */
  private async loadHashes(): Promise<FileHash[]> {
    try {
      const content = await fs.readFile(this.hashFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  /**
   * Calculate hashes for source files
   */
  private async calculateHashes(sourceFiles: string[]): Promise<FileHash[]> {
    const hashes: FileHash[] = [];

    for (const file of sourceFiles) {
      try {
        const content = await fs.readFile(file, 'utf8');
        const stats = await fs.stat(file);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        
        hashes.push({
          file: path.relative(this.projectPath, file),
          hash,
          lastModified: stats.mtime.toISOString(),
        });
      } catch {
        // Skip files that can't be read
      }
    }

    return hashes;
  }

  /**
   * Load existing specifications
   */
  private async loadExistingSpecs(): Promise<MDCSpecification[]> {
    const indexPath = path.join(path.dirname(this.hashFile), 'specifications.json');
    
    try {
      const content = await fs.readFile(indexPath, 'utf8');
      const index = JSON.parse(content);
      
      // Load full spec files
      const specs: MDCSpecification[] = [];
      for (const item of index) {
        const specPath = path.join(path.dirname(indexPath), item.fileName);
        try {
          const specContent = await fs.readFile(specPath, 'utf8');
          const spec = this.parseMDCFile(specContent, item);
          if (spec) specs.push(spec);
        } catch {
          // Skip if can't read
        }
      }
      
      return specs;
    } catch {
      return [];
    }
  }

  /**
   * Parse MDC file back to specification (partial)
   */
  private parseMDCFile(content: string, metadata: any): MDCSpecification | null {
    try {
      // Extract frontmatter
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!frontmatterMatch) return null;

      const frontmatter = frontmatterMatch[1];
      const descriptionMatch = frontmatter.match(/description:\s*(.+)/);
      const categoryMatch = frontmatter.match(/category:\s*(.+)/);
      const importanceMatch = frontmatter.match(/importance:\s*(\d+)/);

      return {
        fileName: metadata.fileName,
        title: metadata.title || '',
        description: descriptionMatch ? descriptionMatch[1].trim() : metadata.description,
        category: (categoryMatch ? categoryMatch[1].trim() : metadata.category) as any,
        importanceScore: importanceMatch ? parseInt(importanceMatch[1]) : metadata.importanceScore,
        relatedFiles: [],
        dependencies: [],
        components: [],
        patterns: [],
        relationships: [],
        codeExamples: [],
        metadata: {
          generatedAt: metadata.generatedAt || new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
          confidence: 0,
        },
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if file has manual edits
   */
  private async hasManualEdits(filePath: string, existingSpec: MDCSpecification): Promise<boolean> {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      // Check for manual edits by looking for markers or non-standard structure
      // Simple heuristic: if structure differs significantly from generated format
      const hasCustomSections = content.includes('<!-- MANUAL') || 
                                content.includes('## Custom') ||
                                content.split('##').length > 5; // More sections than auto-generated
      
      return hasCustomSections;
    } catch {
      return false;
    }
  }
}

