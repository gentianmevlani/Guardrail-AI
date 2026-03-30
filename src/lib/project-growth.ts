/**
 * Project Growth System
 * 
 * Automatically adds features as projects grow
 * Detects when to add error boundaries, 404s, breadcrumbs, etc.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface GrowthFeature {
  name: string;
  description: string;
  trigger: (projectPath: string) => Promise<boolean>;
  install: (projectPath: string) => Promise<void>;
  priority: number;
}

class ProjectGrowthManager {
  private features: GrowthFeature[] = [];

  constructor() {
    this.registerFeatures();
  }

  /**
   * Register all growth features
   */
  private registerFeatures() {
    this.features = [
      {
        name: 'Error Boundary',
        description: 'Add error boundary for React error handling',
        trigger: async (projectPath) => {
          // Trigger when React is detected
          const packageJsonPath = path.join(projectPath, 'package.json');
          if (!await this.pathExists(packageJsonPath)) return false;
          const pkg = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          return !!deps['react'] && !await this.hasErrorBoundary(projectPath);
        },
        install: async (projectPath) => {
          await this.copyTemplate(projectPath, 'ErrorBoundary.tsx', 'src/components');
          await this.copyTemplate(projectPath, 'ErrorBoundary.css', 'src/components');
        },
        priority: 10,
      },
      {
        name: '404 Page',
        description: 'Add custom 404 not found page',
        trigger: async (projectPath) => {
          // Trigger when Next.js or React Router is detected
          const packageJsonPath = path.join(projectPath, 'package.json');
          if (!await this.pathExists(packageJsonPath)) return false;
          const pkg = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          const hasRouter = !!(deps['next'] || deps['react-router-dom']);
          return hasRouter && !await this.has404Page(projectPath);
        },
        install: async (projectPath) => {
          await this.copyTemplate(projectPath, 'NotFound.tsx', 'src/pages');
          await this.copyTemplate(projectPath, 'NotFound.css', 'src/pages');
        },
        priority: 9,
      },
      {
        name: 'Breadcrumbs',
        description: 'Add breadcrumb navigation component',
        trigger: async (projectPath) => {
          // Trigger when multiple routes exist
          const routes = await this.countRoutes(projectPath);
          return routes >= 3 && !await this.hasBreadcrumbs(projectPath);
        },
        install: async (projectPath) => {
          await this.copyTemplate(projectPath, 'Breadcrumbs.tsx', 'src/components');
          await this.copyTemplate(projectPath, 'Breadcrumbs.css', 'src/components');
        },
        priority: 8,
      },
      {
        name: 'Loading States',
        description: 'Add loading state components',
        trigger: async (projectPath) => {
          // Trigger when API calls are detected
          const hasApiCalls = await this.hasApiCalls(projectPath);
          return hasApiCalls && !await this.hasLoadingStates(projectPath);
        },
        install: async (projectPath) => {
          await this.copyTemplate(projectPath, 'LoadingState.tsx', 'src/components');
          await this.copyTemplate(projectPath, 'LoadingState.css', 'src/components');
        },
        priority: 7,
      },
      {
        name: 'Empty States',
        description: 'Add empty state components',
        trigger: async (projectPath) => {
          // Trigger when list components exist
          const hasLists = await this.hasListComponents(projectPath);
          return hasLists && !await this.hasEmptyStates(projectPath);
        },
        install: async (projectPath) => {
          await this.copyTemplate(projectPath, 'EmptyState.tsx', 'src/components');
          await this.copyTemplate(projectPath, 'EmptyState.css', 'src/components');
        },
        priority: 6,
      },
    ];
  }

  /**
   * Check what features should be added
   */
  async checkGrowth(projectPath: string): Promise<GrowthFeature[]> {
    const featuresToAdd: GrowthFeature[] = [];

    for (const feature of this.features) {
      if (await feature.trigger(projectPath)) {
        featuresToAdd.push(feature);
      }
    }

    // Sort by priority
    return featuresToAdd.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Auto-install growth features
   */
  async autoGrow(projectPath: string): Promise<{
    installed: string[];
    failed: Array<{ feature: string; error: string }>;
  }> {
    const featuresToAdd = await this.checkGrowth(projectPath);
    const installed: string[] = [];
    const failed: Array<{ feature: string; error: string }> = [];

    for (const feature of featuresToAdd) {
      try {
        await feature.install(projectPath);
        installed.push(feature.name);
      } catch (error) {
        failed.push({
          feature: feature.name,
          error: (error as Error).message,
        });
      }
    }

    return { installed, failed };
  }

  // Helper methods
  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async hasErrorBoundary(projectPath: string): Promise<boolean> {
    const errorBoundaryPath = path.join(projectPath, 'src', 'components', 'ErrorBoundary.tsx');
    return await this.pathExists(errorBoundaryPath);
  }

  private async has404Page(projectPath: string): Promise<boolean> {
    const notFoundPath = path.join(projectPath, 'src', 'pages', 'NotFound.tsx');
    const notFoundNextPath = path.join(projectPath, 'src', 'app', 'not-found.tsx');
    return await this.pathExists(notFoundPath) || await this.pathExists(notFoundNextPath);
  }

  private async hasBreadcrumbs(projectPath: string): Promise<boolean> {
    const breadcrumbsPath = path.join(projectPath, 'src', 'components', 'Breadcrumbs.tsx');
    return await this.pathExists(breadcrumbsPath);
  }

  private async hasLoadingStates(projectPath: string): Promise<boolean> {
    const loadingPath = path.join(projectPath, 'src', 'components', 'LoadingState.tsx');
    return await this.pathExists(loadingPath);
  }

  private async hasEmptyStates(projectPath: string): Promise<boolean> {
    const emptyStatePath = path.join(projectPath, 'src', 'components', 'EmptyState.tsx');
    return await this.pathExists(emptyStatePath);
  }

  private async countRoutes(projectPath: string): Promise<number> {
    // Count route files
    const appPath = path.join(projectPath, 'src', 'app');
    const pagesPath = path.join(projectPath, 'src', 'pages');
    
    let count = 0;
    
    if (await this.pathExists(appPath)) {
      const files = await this.findRouteFiles(appPath);
      count += files.length;
    }
    
    if (await this.pathExists(pagesPath)) {
      const files = await this.findRouteFiles(pagesPath);
      count += files.length;
    }
    
    return count;
  }

  private async findRouteFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...await this.findRouteFiles(fullPath));
        } else if (item.name === 'page.tsx' || item.name === 'page.jsx' || item.name.endsWith('.page.tsx')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return files;
  }

  private async hasApiCalls(projectPath: string): Promise<boolean> {
    const srcPath = path.join(projectPath, 'src');
    if (!await this.pathExists(srcPath)) return false;
    
    const files = await this.findComponentFiles(srcPath);
    for (const file of files.slice(0, 10)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes('fetch(') || content.includes('axios.') || content.includes('api.')) {
          return true;
        }
      } catch (error) {
      // Failed to process - continue with other operations
    }
    }
    return false;
  }

  private async hasListComponents(projectPath: string): Promise<boolean> {
    const srcPath = path.join(projectPath, 'src');
    if (!await this.pathExists(srcPath)) return false;
    
    const files = await this.findComponentFiles(srcPath);
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes('.map(') && content.includes('key=')) {
          return true;
        }
      } catch (error) {
      // Failed to process - continue with other operations
    }
    }
    return false;
  }

  private async findComponentFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...await this.findComponentFiles(fullPath));
        } else if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Failed to process - continue with other operations
    }
    return files;
  }

  private async copyTemplate(projectPath: string, templateName: string, targetDir: string): Promise<void> {
    const kitDir = path.dirname(path.dirname(__dirname));
    const templatePath = path.join(kitDir, 'templates', 'components', templateName);
    const targetPath = path.join(projectPath, targetDir, templateName);
    
    if (!await this.pathExists(templatePath)) {
      // Try pages directory
      const pagesTemplatePath = path.join(kitDir, 'templates', 'pages', templateName);
      if (await this.pathExists(pagesTemplatePath)) {
        const targetDirPath = path.dirname(targetPath);
        await fs.promises.mkdir(targetDirPath, { recursive: true });
        await fs.promises.copyFile(pagesTemplatePath, targetPath);
        return;
      }
      throw new Error(`Template not found: ${templateName}`);
    }
    
    const targetDirPath = path.dirname(targetPath);
    await fs.promises.mkdir(targetDirPath, { recursive: true });
    await fs.promises.copyFile(templatePath, targetPath);
  }
}

export const projectGrowthManager = new ProjectGrowthManager();

