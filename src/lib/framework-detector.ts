/**
 * Framework Detector
 * 
 * Detects frameworks, libraries, and project structure
 * Unique: Deep integration with framework-specific patterns
 */

import * as fs from 'fs';
import * as path from 'path';

export interface FrameworkInfo {
  name: string;
  version?: string;
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop';
  detected: boolean;
  confidence: number; // 0-1
  patterns: string[];
  configFiles: string[];
  dependencies: string[];
}

export interface ProjectStructure {
  frameworks: FrameworkInfo[];
  architecture: 'monolith' | 'microservices' | 'modular' | 'serverless';
  languages: string[];
  buildTools: string[];
  testFrameworks: string[];
  packageManagers: string[];
}

class FrameworkDetector {
  /**
   * Detect all frameworks in project
   */
  async detect(projectPath: string): Promise<ProjectStructure> {
    const frameworks: FrameworkInfo[] = [];

    // Read package.json
    const pkgPath = path.join(projectPath, 'package.json');
    let dependencies: Record<string, string> = {};
    let devDependencies: Record<string, string> = {};

    if (await this.pathExists(pkgPath)) {
      try {
        const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
        dependencies = pkg.dependencies || {};
        devDependencies = pkg.devDependencies || {};
      } catch {
        // Error reading package.json
      }
    }

    const allDeps = { ...dependencies, ...devDependencies };

    // Detect frontend frameworks
    const react = await this.detectReact(projectPath, allDeps);
    if (react.detected) frameworks.push(react);

    const vue = await this.detectVue(projectPath, allDeps);
    if (vue.detected) frameworks.push(vue);

    const angular = await this.detectAngular(projectPath, allDeps);
    if (angular.detected) frameworks.push(angular);

    const svelte = await this.detectSvelte(projectPath, allDeps);
    if (svelte.detected) frameworks.push(svelte);

    // Detect backend frameworks
    const express = await this.detectExpress(projectPath, allDeps);
    if (express.detected) frameworks.push(express);

    const fastify = await this.detectFastify(projectPath, allDeps);
    if (fastify.detected) frameworks.push(fastify);

    const nest = await this.detectNest(projectPath, allDeps);
    if (nest.detected) frameworks.push(nest);

    // Detect fullstack
    const nextjs = await this.detectNextJS(projectPath, allDeps);
    if (nextjs.detected) frameworks.push(nextjs);

    const nuxt = await this.detectNuxt(projectPath, allDeps);
    if (nuxt.detected) frameworks.push(nuxt);

    const remix = await this.detectRemix(projectPath, allDeps);
    if (remix.detected) frameworks.push(remix);

    // Detect Python frameworks
    const django = await this.detectDjango(projectPath);
    if (django.detected) frameworks.push(django);

    const flask = await this.detectFlask(projectPath);
    if (flask.detected) frameworks.push(flask);

    const fastapi = await this.detectFastAPI(projectPath);
    if (fastapi.detected) frameworks.push(fastapi);

    // Detect languages
    const languages = this.detectLanguages(projectPath, allDeps);

    // Detect build tools
    const buildTools = this.detectBuildTools(projectPath, allDeps);

    // Detect test frameworks
    const testFrameworks = this.detectTestFrameworks(allDeps);

    // Detect package managers
    const packageManagers = this.detectPackageManagers(projectPath);

    // Detect architecture
    const architecture = await this.detectArchitecture(projectPath, frameworks);

    return {
      frameworks,
      architecture,
      languages,
      buildTools,
      testFrameworks,
      packageManagers,
    };
  }

  /**
   * Detect React
   */
  private async detectReact(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.react || !!deps['react-dom'];
    const version = deps.react || deps['react-dom'];
    
    const configFiles: string[] = [];
    if (await this.pathExists(path.join(projectPath, 'vite.config.ts'))) {
      configFiles.push('vite.config.ts');
    }
    if (await this.pathExists(path.join(projectPath, 'webpack.config.js'))) {
      configFiles.push('webpack.config.js');
    }

    const patterns: string[] = [];
    if (detected) {
      const files = await this.findFiles(projectPath, /\.(tsx|jsx)$/);
      if (files.length > 0) {
        patterns.push('React components');
      }
    }

    return {
      name: 'React',
      version,
      type: 'frontend',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns,
      configFiles,
      dependencies: detected ? ['react', 'react-dom'] : [],
    };
  }

  /**
   * Detect Next.js
   */
  private async detectNextJS(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.next;
    const version = deps.next;

    const configFiles: string[] = [];
    if (await this.pathExists(path.join(projectPath, 'next.config.js'))) {
      configFiles.push('next.config.js');
    }
    if (await this.pathExists(path.join(projectPath, 'next.config.ts'))) {
      configFiles.push('next.config.ts');
    }

    const patterns: string[] = [];
    if (detected) {
      if (await this.pathExists(path.join(projectPath, 'app'))) {
        patterns.push('App Router');
      }
      if (await this.pathExists(path.join(projectPath, 'pages'))) {
        patterns.push('Pages Router');
      }
    }

    return {
      name: 'Next.js',
      version,
      type: 'fullstack',
      detected,
      confidence: detected ? 0.98 : 0,
      patterns,
      configFiles,
      dependencies: detected ? ['next'] : [],
    };
  }

  /**
   * Detect Vue
   */
  private async detectVue(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.vue;
    const version = deps.vue;

    const configFiles: string[] = [];
    if (await this.pathExists(path.join(projectPath, 'vite.config.ts'))) {
      configFiles.push('vite.config.ts');
    }
    if (await this.pathExists(path.join(projectPath, 'vue.config.js'))) {
      configFiles.push('vue.config.js');
    }

    return {
      name: 'Vue',
      version,
      type: 'frontend',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns: detected ? ['Vue components'] : [],
      configFiles,
      dependencies: detected ? ['vue'] : [],
    };
  }

  /**
   * Detect Nuxt
   */
  private async detectNuxt(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.nuxt || !!deps['@nuxt/core'];
    const version = deps.nuxt || deps['@nuxt/core'];

    const configFiles: string[] = [];
    if (await this.pathExists(path.join(projectPath, 'nuxt.config.ts'))) {
      configFiles.push('nuxt.config.ts');
    }

    return {
      name: 'Nuxt',
      version,
      type: 'fullstack',
      detected,
      confidence: detected ? 0.98 : 0,
      patterns: detected ? ['Nuxt pages', 'Nuxt components'] : [],
      configFiles,
      dependencies: detected ? ['nuxt'] : [],
    };
  }

  /**
   * Detect Angular
   */
  private async detectAngular(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps['@angular/core'];
    const version = deps['@angular/core'];

    const configFiles: string[] = [];
    if (await this.pathExists(path.join(projectPath, 'angular.json'))) {
      configFiles.push('angular.json');
    }
    if (await this.pathExists(path.join(projectPath, 'tsconfig.json'))) {
      configFiles.push('tsconfig.json');
    }

    return {
      name: 'Angular',
      version,
      type: 'frontend',
      detected,
      confidence: detected ? 0.98 : 0,
      patterns: detected ? ['Angular modules', 'Angular components'] : [],
      configFiles,
      dependencies: detected ? ['@angular/core'] : [],
    };
  }

  /**
   * Detect Svelte
   */
  private async detectSvelte(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.svelte;
    const version = deps.svelte;

    return {
      name: 'Svelte',
      version,
      type: 'frontend',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns: detected ? ['Svelte components'] : [],
      configFiles: [],
      dependencies: detected ? ['svelte'] : [],
    };
  }

  /**
   * Detect Express
   */
  private async detectExpress(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.express;
    const version = deps.express;

    const patterns: string[] = [];
    if (detected) {
      const files = await this.findFiles(projectPath, /(?:server|app|index)\.(ts|js)$/);
      if (files.length > 0) {
        patterns.push('Express routes');
      }
    }

    return {
      name: 'Express',
      version,
      type: 'backend',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns,
      configFiles: [],
      dependencies: detected ? ['express'] : [],
    };
  }

  /**
   * Detect Fastify
   */
  private async detectFastify(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps.fastify;
    const version = deps.fastify;

    return {
      name: 'Fastify',
      version,
      type: 'backend',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns: detected ? ['Fastify routes'] : [],
      configFiles: [],
      dependencies: detected ? ['fastify'] : [],
    };
  }

  /**
   * Detect NestJS
   */
  private async detectNest(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps['@nestjs/core'];
    const version = deps['@nestjs/core'];

    const patterns: string[] = [];
    if (detected) {
      if (await this.pathExists(path.join(projectPath, 'src', 'modules'))) {
        patterns.push('NestJS modules');
      }
      if (await this.pathExists(path.join(projectPath, 'src', 'controllers'))) {
        patterns.push('NestJS controllers');
      }
    }

    return {
      name: 'NestJS',
      version,
      type: 'backend',
      detected,
      confidence: detected ? 0.98 : 0,
      patterns,
      configFiles: [],
      dependencies: detected ? ['@nestjs/core'] : [],
    };
  }

  /**
   * Detect Remix
   */
  private async detectRemix(
    projectPath: string,
    deps: Record<string, string>
  ): Promise<FrameworkInfo> {
    const detected = !!deps['@remix-run/node'] || !!deps['@remix-run/react'];
    const version = deps['@remix-run/node'] || deps['@remix-run/react'];

    return {
      name: 'Remix',
      version,
      type: 'fullstack',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns: detected ? ['Remix routes'] : [],
      configFiles: [],
      dependencies: detected ? ['@remix-run/react'] : [],
    };
  }

  /**
   * Detect Django
   */
  private async detectDjango(projectPath: string): Promise<FrameworkInfo> {
    const detected = await this.pathExists(path.join(projectPath, 'manage.py')) ||
                    await this.pathExists(path.join(projectPath, 'requirements.txt')) &&
                    (await this.fileContains(path.join(projectPath, 'requirements.txt'), 'django'));

    return {
      name: 'Django',
      type: 'backend',
      detected,
      confidence: detected ? 0.95 : 0,
      patterns: detected ? ['Django apps', 'Django models'] : [],
      configFiles: detected ? ['manage.py', 'settings.py'] : [],
      dependencies: [],
    };
  }

  /**
   * Detect Flask
   */
  private async detectFlask(projectPath: string): Promise<FrameworkInfo> {
    const detected = await this.pathExists(path.join(projectPath, 'requirements.txt')) &&
                    (await this.fileContains(path.join(projectPath, 'requirements.txt'), 'flask'));

    return {
      name: 'Flask',
      type: 'backend',
      detected,
      confidence: detected ? 0.9 : 0,
      patterns: detected ? ['Flask routes'] : [],
      configFiles: [],
      dependencies: [],
    };
  }

  /**
   * Detect FastAPI
   */
  private async detectFastAPI(projectPath: string): Promise<FrameworkInfo> {
    const detected = await this.pathExists(path.join(projectPath, 'requirements.txt')) &&
                    (await this.fileContains(path.join(projectPath, 'requirements.txt'), 'fastapi'));

    return {
      name: 'FastAPI',
      type: 'backend',
      detected,
      confidence: detected ? 0.9 : 0,
      patterns: detected ? ['FastAPI routes'] : [],
      configFiles: [],
      dependencies: [],
    };
  }

  /**
   * Detect languages
   */
  private detectLanguages(
    projectPath: string,
    deps: Record<string, string>
  ): string[] {
    const languages: string[] = [];

    if (deps.typescript || await this.pathExists(path.join(projectPath, 'tsconfig.json'))) {
      languages.push('TypeScript');
    }
    if (await this.findFiles(projectPath, /\.js$/).then(f => f.length > 0)) {
      languages.push('JavaScript');
    }
    if (await this.findFiles(projectPath, /\.py$/).then(f => f.length > 0)) {
      languages.push('Python');
    }
    if (await this.findFiles(projectPath, /\.rs$/).then(f => f.length > 0)) {
      languages.push('Rust');
    }
    if (await this.findFiles(projectPath, /\.go$/).then(f => f.length > 0)) {
      languages.push('Go');
    }

    return languages;
  }

  /**
   * Detect build tools
   */
  private detectBuildTools(
    projectPath: string,
    deps: Record<string, string>
  ): string[] {
    const tools: string[] = [];

    if (deps.vite) tools.push('Vite');
    if (deps.webpack) tools.push('Webpack');
    if (deps['@vitejs/plugin-react']) tools.push('Vite React Plugin');
    if (deps.turbopack) tools.push('Turbopack');
    if (await this.pathExists(path.join(projectPath, 'rollup.config.js'))) {
      tools.push('Rollup');
    }

    return tools;
  }

  /**
   * Detect test frameworks
   */
  private detectTestFrameworks(deps: Record<string, string>): string[] {
    const frameworks: string[] = [];

    if (deps.jest) frameworks.push('Jest');
    if (deps.vitest) frameworks.push('Vitest');
    if (deps.mocha) frameworks.push('Mocha');
    if (deps.jasmine) frameworks.push('Jasmine');
    if (deps['@testing-library/react']) frameworks.push('React Testing Library');
    if (deps['@testing-library/vue']) frameworks.push('Vue Testing Library');
    if (deps.cypress) frameworks.push('Cypress');
    if (deps.playwright) frameworks.push('Playwright');

    return frameworks;
  }

  /**
   * Detect package managers
   */
  private detectPackageManagers(projectPath: string): string[] {
    const managers: string[] = [];

    if (await this.pathExists(path.join(projectPath, 'package-lock.json'))) {
      managers.push('npm');
    }
    if (await this.pathExists(path.join(projectPath, 'yarn.lock'))) {
      managers.push('yarn');
    }
    if (await this.pathExists(path.join(projectPath, 'pnpm-lock.yaml'))) {
      managers.push('pnpm');
    }
    if (await this.pathExists(path.join(projectPath, 'requirements.txt'))) {
      managers.push('pip');
    }
    if (await this.pathExists(path.join(projectPath, 'poetry.lock'))) {
      managers.push('poetry');
    }

    return managers;
  }

  /**
   * Detect architecture
   */
  private async detectArchitecture(
    projectPath: string,
    frameworks: FrameworkInfo[]
  ): Promise<ProjectStructure['architecture']> {
    // Check for microservices indicators
    if (await this.pathExists(path.join(projectPath, 'services'))) {
      return 'microservices';
    }

    // Check for serverless
    if (await this.pathExists(path.join(projectPath, 'serverless.yml')) ||
        await this.pathExists(path.join(projectPath, '.serverless'))) {
      return 'serverless';
    }

    // Check for modular structure
    if (await this.pathExists(path.join(projectPath, 'packages')) ||
        await this.pathExists(path.join(projectPath, 'modules'))) {
      return 'modular';
    }

    return 'monolith';
  }

  // Helper methods
  private async findFiles(dir: string, pattern: RegExp): Promise<string[]> {
    const files: string[] = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !this.shouldIgnore(item.name)) {
          files.push(...await this.findFiles(fullPath, pattern));
        } else if (item.isFile() && pattern.test(item.name)) {
          files.push(fullPath);
        }
      }
    } catch {
      // Error reading directory
    }
    return files;
  }

  private shouldIgnore(name: string): boolean {
    return ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', 'venv', '.venv'].includes(name);
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async fileContains(filePath: string, text: string): Promise<boolean> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      return content.includes(text);
    } catch {
      return false;
    }
  }
}

export const frameworkDetector = new FrameworkDetector();

