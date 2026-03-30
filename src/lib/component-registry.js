/**
 * Component Registry
 * 
 * Tracks React components and their usage
 */

const fs = require('fs');
const path = require('path');

class ComponentRegistry {
  constructor(projectPath = process.cwd()) {
    this.projectPath = projectPath;
    this.registryPath = path.join(projectPath, '.guardrail', 'component-registry.json');
    this.registry = this.loadRegistry();
  }

  /**
   * Register a component
   */
  registerComponent(name, filePath, props = [], exports = [], imports = []) {
    const existing = this.registry.components.find(
      c => c.name === name && c.filePath === filePath
    );

    const component = {
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
  recordUsage(componentName, usedInFile) {
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
  getComponents() {
    return this.registry.components;
  }

  /**
   * Find component by name
   */
  findComponent(name) {
    return this.registry.components.find(c => c.name === name);
  }

  /**
   * Get unused components
   */
  getUnusedComponents() {
    return this.registry.components.filter(c => c.usedIn.length === 0);
  }

  // Private methods
  loadRegistry() {
    try {
      if (fs.existsSync(this.registryPath)) {
        const data = JSON.parse(fs.readFileSync(this.registryPath, 'utf8'));
        return data;
      }
    } catch {}

    return {
      components: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  saveRegistry() {
    try {
      const dir = path.dirname(this.registryPath);
      fs.mkdirSync(dir, { recursive: true });
      this.registry.lastUpdated = new Date().toISOString();
      fs.writeFileSync(this.registryPath, JSON.stringify(this.registry, null, 2));
    } catch (error) {
      console.error('Failed to save component registry:', error);
    }
  }

  generateId() {
    return `component-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = { componentRegistry: new ComponentRegistry() };

