/**
 * Angular Deep Integration Adapter
 * 
 * Framework-specific optimizations and patterns for Angular
 */

import * as fs from 'fs';
import * as path from 'path';

export interface AngularAnalysis {
  modules: string[];
  components: Array<{
    name: string;
    selector: string;
    inputs: string[];
    outputs: string[];
  }>;
  services: string[];
  pipes: string[];
  directives: string[];
  guards: string[];
}

class AngularAdapter {
  /**
   * Analyze Angular codebase
   */
  async analyze(projectPath: string): Promise<AngularAnalysis> {
    const modules: string[] = [];
    const components: AngularAnalysis['components'] = [];
    const services: string[] = [];
    const pipes: string[] = [];
    const directives: string[] = [];
    const guards: string[] = [];

    // Find Angular files
    const tsFiles = await this.findTypeScriptFiles(projectPath);

    for (const file of tsFiles) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');

        // Extract modules
        if (/@NgModule/.test(content)) {
          const moduleMatch = content.match(/export\s+class\s+(\w+Module)/);
          if (moduleMatch) {
            modules.push(moduleMatch[1]);
          }
        }

        // Extract components
        if (/@Component/.test(content)) {
          const component = this.extractComponent(content);
          if (component) {
            components.push(component);
          }
        }

        // Extract services
        if (/@Injectable/.test(content)) {
          const serviceMatch = content.match(/export\s+class\s+(\w+Service)/);
          if (serviceMatch) {
            services.push(serviceMatch[1]);
          }
        }

        // Extract pipes
        if (/@Pipe/.test(content)) {
          const pipeMatch = content.match(/export\s+class\s+(\w+Pipe)/);
          if (pipeMatch) {
            pipes.push(pipeMatch[1]);
          }
        }

        // Extract directives
        if (/@Directive/.test(content)) {
          const directiveMatch = content.match(/export\s+class\s+(\w+Directive)/);
          if (directiveMatch) {
            directives.push(directiveMatch[1]);
          }
        }

        // Extract guards
        if (/CanActivate|CanDeactivate/.test(content)) {
          const guardMatch = content.match(/export\s+class\s+(\w+Guard)/);
          if (guardMatch) {
            guards.push(guardMatch[1]);
          }
        }
      } catch {
        // Error reading file
      }
    }

    return {
      modules,
      components,
      services,
      pipes,
      directives,
      guards,
    };
  }

  /**
   * Generate Angular-specific context
   */
  async generateContext(projectPath: string): Promise<string> {
    const analysis = await this.analyze(projectPath);

    return `# Angular Project Context

## Framework Information
- Modules: ${analysis.modules.length}
- Components: ${analysis.components.length}
- Services: ${analysis.services.length}
- Pipes: ${analysis.pipes.length}
- Directives: ${analysis.directives.length}
- Guards: ${analysis.guards.length}

## Available Services
${analysis.services.map(s => `- ${s}`).join('\n')}

## Component Selectors
${analysis.components.map(c => `- ${c.selector}: ${c.name}`).join('\n')}
`;
  }

  private extractComponent(code: string): AngularAnalysis['components'][0] | null {
    const nameMatch = code.match(/export\s+class\s+(\w+Component)/);
    if (!nameMatch) return null;

    const selectorMatch = code.match(/selector:\s*['"]([^'"]+)['"]/);
    const inputsMatch = code.match(/@Input\(\)\s+(\w+)/g);
    const outputsMatch = code.match(/@Output\(\)\s+(\w+)/g);

    return {
      name: nameMatch[1],
      selector: selectorMatch?.[1] || '',
      inputs: inputsMatch ? inputsMatch.map(i => i.match(/\w+/)![0]) : [],
      outputs: outputsMatch ? outputsMatch.map(o => o.match(/\w+/)![0]) : [],
    };
  }

  private async findTypeScriptFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findTypeScriptFiles(fullPath));
        } else if (item.isFile() && /\.ts$/.test(item.name) && !item.name.endsWith('.spec.ts')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', 'coverage'].includes(name);
  }
}

export const angularAdapter = new AngularAdapter();

