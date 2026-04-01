/**
 * Component Registry
 * 
 * Tracks React components and their usage
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Component {
  id: string;
  name: string;
  filePath: string;
  props: string[];
  exports: string[];
  imports: string[];
  usedIn: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentRegistry {
  components: Component[];
  lastUpdated: string;
}

class ComponentRegistry {
  private registry: ComponentRegistry;
  private registryPath: string;
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    this.projectPath = projectPath;
    this.registryPath = path.join(projectPath, '.guardrail', 'component-registry.json');
    this.registry = this.loadRegistry();
  }

  /**
   * Register a component
   */
  registerComponent(
    name: string,
    filePath: string,
    props: string[] = [],
    exports: string[] = [],
    imports: string[] = []
  ): Component {
    const existing = this.registry.components.find(
      c => c.name === name && c.filePath === filePath
    );

    const component: Component = {
      id: existing?.id || this.generateId(),
      name,
      filePath: path.relative(this.projectPath, filePath),
      props,
      exports,
      imports,
      usedIn: existing?.usedIn || [],
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      const index = this.registry.components.indexOf(existing);
      this.registry.components[index] = component;
    } else {
      this.registry.components.push(component);
    }

    this.saveRegistry();
    return component;
  }

  /**
   * Record component usage
   */
  recordUsage(componentName: string, usedInFile: string): void {
    const component = this.registry.components.find(c => c.name === componentName);
    if (component) {
      const relativePath = path.relative(this.projectPath, usedInFile);
      if (!component.usedIn.includes(relativePath)) {
        component.usedIn.push(relativePath);
        component.updatedAt = new Date().toISOString();
        this.saveRegistry();
      }
    }
  }

  /**
   * Get all components
   */
  getComponents(): Component[] {
    return this.registry.components;
  }

  /**
   * Find component by name
   */
  findComponent(name: string): Component | undefined {
    return this.registry.components.find(c => c.name === name);
  }

  /**
   * Get unused components
   */
  getUnusedComponents(): Component[] {
    return this.registry.components.filter(c => c.usedIn.length === 0);
  }

  // Private methods
  private loadRegistry(): ComponentRegistry {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        return data;
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }

    return {
      components: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  private saveRegistry(): void {
    try {
      const dir = path.dirname(this.registryPath);
      fs.mkdirSync(dir, { recursive: true });
      this.registry.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    } catch (error) {
      console.error('Failed to save component registry:', error);
    }
  }

  private generateId(): string {
    return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const componentRegistry = new ComponentRegistry();

