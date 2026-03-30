/**
 * Vue/Nuxt Deep Integration Adapter
 * 
 * Framework-specific optimizations and patterns for Vue
 */

import * as fs from 'fs';
import * as path from 'path';

export interface VueAnalysis {
  components: Array<{
    name: string;
    type: 'options' | 'composition';
    props: string[];
    emits: string[];
    composables: string[];
  }>;
  composables: string[];
  stores: string[];
  patterns: Array<{
    type: string;
    name: string;
    file: string;
  }>;
}

class VueAdapter {
  /**
   * Analyze Vue codebase
   */
  async analyze(projectPath: string): Promise<VueAnalysis> {
    const components: VueAnalysis['components'] = [];
    const composables: string[] = [];
    const stores: string[] = [];

    // Find Vue files
    const vueFiles = await this.findVueFiles(projectPath);

    for (const file of vueFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Extract components
        const fileComponents = this.extractComponents(content, file);
        components.push(...fileComponents);

        // Extract composables
        const fileComposables = this.extractComposables(content);
        composables.push(...fileComposables);

        // Extract stores
        const fileStores = this.extractStores(content);
        stores.push(...fileStores);
      } catch {
        // Error reading file
      }
    }

    return {
      components,
      composables: [...new Set(composables)],
      stores: [...new Set(stores)],
      patterns: this.extractPatterns(components),
    };
  }

  /**
   * Generate Vue-specific context
   */
  async generateContext(projectPath: string): Promise<string> {
    const analysis = await this.analyze(projectPath);

    return `# Vue/Nuxt Project Context

## Framework Information
- Vue Components: ${analysis.components.length}
- Composables: ${analysis.composables.length}
- Stores: ${analysis.stores.length}

## Component Types
- Options API: ${analysis.components.filter(c => c.type === 'options').length}
- Composition API: ${analysis.components.filter(c => c.type === 'composition').length}

## Available Composables
${analysis.composables.map(c => `- ${c}`).join('\n')}

## Store Patterns
${analysis.stores.map(s => `- ${s}`).join('\n')}
`;
  }

  private extractComponents(code: string, file: string): VueAnalysis['components'] {
    const components: VueAnalysis['components'] = [];

    // Options API
    if (/export default\s*\{/.test(code)) {
      const nameMatch = code.match(/name:\s*['"]([^'"]+)['"]/);
      const propsMatch = code.match(/props:\s*\[([^\]]+)\]/);
      const emitsMatch = code.match(/emits:\s*\[([^\]]+)\]/);

      components.push({
        name: nameMatch?.[1] || path.basename(file, '.vue'),
        type: 'options',
        props: propsMatch ? propsMatch[1].split(',').map(p => p.trim().replace(/['"]/g, '')) : [],
        emits: emitsMatch ? emitsMatch[1].split(',').map(e => e.trim().replace(/['"]/g, '')) : [],
        composables: [],
      });
    }

    // Composition API
    if (/<script\s+setup/.test(code)) {
      const composables = this.extractComposables(code);
      const propsMatch = code.match(/defineProps<\{([^}]+)\}>/);
      const emitsMatch = code.match(/defineEmits<\{([^}]+)\}>/);

      components.push({
        name: path.basename(file, '.vue'),
        type: 'composition',
        props: propsMatch ? propsMatch[1].split(',').map(p => p.trim().split(':')[0]) : [],
        emits: emitsMatch ? emitsMatch[1].split(',').map(e => e.trim().split(':')[0]) : [],
        composables,
      });
    }

    return components;
  }

  private extractComposables(code: string): string[] {
    const composables: string[] = [];
    const composableRegex = /(?:import|use)\s+(\w+)\s+from\s+['"]@\/composables/gi;
    let match;
    while ((match = composableRegex.exec(code)) !== null) {
      composables.push(match[1]);
    }
    return composables;
  }

  private extractStores(code: string): string[] {
    const stores: string[] = [];
    const storeRegex = /(?:use|import)\s+(\w+Store)\s+from/gi;
    let match;
    while ((match = storeRegex.exec(code)) !== null) {
      stores.push(match[1]);
    }
    return stores;
  }

  private extractPatterns(components: VueAnalysis['components']): VueAnalysis['patterns'] {
    return components.map(c => ({
      type: c.type,
      name: c.name,
      file: c.name,
    }));
  }

  private async findVueFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findVueFiles(fullPath));
        } else if (item.isFile() && /\.vue$/.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.nuxt', 'coverage'].includes(name);
  }
}

export const vueAdapter = new VueAdapter();

