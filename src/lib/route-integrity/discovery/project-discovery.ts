/**
 * Phase 0.1: Project Discovery (Monorepo-grade)
 * 
 * Detects all frontend packages (Next, Remix, React Router, Vite SPA, etc.)
 * Per package, computes: framework type, root dir, tsconfig path, build output path, entry points
 * Caches results in .guardrail/cache/project-map.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  FrameworkType,
  PackageInfo,
  ProjectMap,
} from '../types';

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

export class ProjectDiscovery {
  private cacheDir: string;
  private cachePath: string;

  constructor(private projectRoot: string) {
    this.cacheDir = path.join(projectRoot, '.guardrail', 'cache');
    this.cachePath = path.join(this.cacheDir, 'project-map.json');
  }

  async discover(forceRefresh = false): Promise<ProjectMap> {
    const contentHash = await this.computeProjectHash();

    if (!forceRefresh) {
      const cached = this.loadCache();
      if (cached && cached.contentHash === contentHash) {
        return cached;
      }
    }

    const projectMap = await this.performDiscovery(contentHash);
    this.saveCache(projectMap);
    return projectMap;
  }

  private async performDiscovery(contentHash: string): Promise<ProjectMap> {
    const isMonorepo = await this.detectMonorepo();
    const workspaceConfig = await this.findWorkspaceConfig();
    const packages: PackageInfo[] = [];

    if (isMonorepo) {
      const workspaceDirs = await this.getWorkspaceDirectories();
      for (const dir of workspaceDirs) {
        const pkg = await this.analyzePackage(dir);
        if (pkg && this.isFrontendPackage(pkg)) {
          packages.push(pkg);
        }
      }
    } else {
      const pkg = await this.analyzePackage(this.projectRoot);
      if (pkg) {
        packages.push(pkg);
      }
    }

    return {
      rootDir: this.projectRoot,
      packages,
      isMonorepo,
      workspaceConfig,
      detectedAt: new Date().toISOString(),
      contentHash,
    };
  }

  private async detectMonorepo(): Promise<boolean> {
    const indicators = [
      'pnpm-workspace.yaml',
      'lerna.json',
      'nx.json',
      'turbo.json',
      'rush.json',
    ];

    for (const indicator of indicators) {
      if (await this.pathExists(path.join(this.projectRoot, indicator))) {
        return true;
      }
    }

    const pkgJson = await this.readPackageJson(this.projectRoot);
    if (pkgJson?.workspaces) {
      return true;
    }

    return false;
  }

  private async findWorkspaceConfig(): Promise<string | null> {
    const configs = [
      'pnpm-workspace.yaml',
      'lerna.json',
      'nx.json',
      'turbo.json',
      'package.json',
    ];

    for (const config of configs) {
      const configPath = path.join(this.projectRoot, config);
      if (await this.pathExists(configPath)) {
        return config;
      }
    }

    return null;
  }

  private async getWorkspaceDirectories(): Promise<string[]> {
    const dirs: string[] = [];

    const pnpmWorkspacePath = path.join(this.projectRoot, 'pnpm-workspace.yaml');
    if (await this.pathExists(pnpmWorkspacePath)) {
      const content = await fs.promises.readFile(pnpmWorkspacePath, 'utf8');
      const patterns = this.parsePnpmWorkspace(content);
      for (const pattern of patterns) {
        const matches = await this.globDirectories(pattern);
        dirs.push(...matches);
      }
      return dirs;
    }

    const pkgJson = await this.readPackageJson(this.projectRoot);
    if (pkgJson?.workspaces) {
      const patterns = Array.isArray(pkgJson.workspaces)
        ? pkgJson.workspaces
        : pkgJson.workspaces.packages || [];
      for (const pattern of patterns) {
        const matches = await this.globDirectories(pattern);
        dirs.push(...matches);
      }
      return dirs;
    }

    const commonDirs = ['apps', 'packages', 'libs', 'projects'];
    for (const dir of commonDirs) {
      const dirPath = path.join(this.projectRoot, dir);
      if (await this.pathExists(dirPath)) {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const pkgPath = path.join(dirPath, entry.name);
            if (await this.pathExists(path.join(pkgPath, 'package.json'))) {
              dirs.push(pkgPath);
            }
          }
        }
      }
    }

    return dirs;
  }

  private parsePnpmWorkspace(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n');
    let inPackages = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'packages:') {
        inPackages = true;
        continue;
      }
      if (inPackages && trimmed.startsWith('- ')) {
        const pattern = trimmed.slice(2).replace(/['"]/g, '');
        patterns.push(pattern);
      }
      if (inPackages && !trimmed.startsWith('-') && trimmed !== '') {
        inPackages = false;
      }
    }

    return patterns;
  }

  private async globDirectories(pattern: string): Promise<string[]> {
    const dirs: string[] = [];
    const basePath = this.projectRoot;

    if (pattern.includes('*')) {
      const parts = pattern.split('/');
      const fixedParts: string[] = [];
      let wildcardIndex = -1;

      for (let i = 0; i < parts.length; i++) {
        if (parts[i].includes('*')) {
          wildcardIndex = i;
          break;
        }
        fixedParts.push(parts[i]);
      }

      const searchDir = path.join(basePath, ...fixedParts);
      if (await this.pathExists(searchDir)) {
        const entries = await fs.promises.readdir(searchDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(searchDir, entry.name);
            if (wildcardIndex === parts.length - 1) {
              dirs.push(fullPath);
            } else {
              const remaining = parts.slice(wildcardIndex + 1).join('/');
              const subDirs = await this.globDirectories(
                path.join(entry.name, remaining)
              );
              dirs.push(...subDirs.map(d => path.join(searchDir, d)));
            }
          }
        }
      }
    } else {
      const fullPath = path.join(basePath, pattern);
      if (await this.pathExists(fullPath)) {
        dirs.push(fullPath);
      }
    }

    return dirs;
  }

  private async analyzePackage(packageDir: string): Promise<PackageInfo | null> {
    const pkgJson = await this.readPackageJson(packageDir);
    if (!pkgJson) {
      return null;
    }

    const frameworkType = await this.detectFrameworkType(packageDir, pkgJson);
    const tsconfigPath = await this.findTsConfig(packageDir);
    const buildOutputPath = await this.findBuildOutput(packageDir, frameworkType);
    const entryPoints = await this.findEntryPoints(packageDir, frameworkType);
    const srcDir = await this.findSrcDir(packageDir);
    const routerType = this.determineRouterType(frameworkType);

    const result: PackageInfo = {
      name: pkgJson.name || path.basename(packageDir),
      frameworkType,
      rootDir: packageDir,
      tsconfigPath,
      buildOutputPath,
      entryPoints,
      srcDir,
      routerType,
    };

    if (frameworkType === 'next' || frameworkType === 'next-app' || frameworkType === 'next-pages') {
      result.hasAppRouter = await this.pathExists(path.join(packageDir, 'app')) ||
                           await this.pathExists(path.join(packageDir, 'src', 'app'));
      result.hasPagesRouter = await this.pathExists(path.join(packageDir, 'pages')) ||
                              await this.pathExists(path.join(packageDir, 'src', 'pages'));
      
      if (result.hasAppRouter && result.hasPagesRouter) {
        result.frameworkType = 'next';
      } else if (result.hasAppRouter) {
        result.frameworkType = 'next-app';
      } else if (result.hasPagesRouter) {
        result.frameworkType = 'next-pages';
      }
    }

    return result;
  }

  private async detectFrameworkType(
    packageDir: string,
    pkgJson: PackageJson
  ): Promise<FrameworkType> {
    const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };

    if (deps['next']) {
      return 'next';
    }

    if (deps['@remix-run/react'] || deps['@remix-run/node']) {
      return 'remix';
    }

    if (deps['@tanstack/react-router'] || deps['@tanstack/router']) {
      return 'tanstack-router';
    }

    if (deps['react-router-dom'] || deps['react-router']) {
      return 'react-router';
    }

    if (deps['gatsby']) {
      return 'gatsby';
    }

    if (deps['astro']) {
      return 'astro';
    }

    if (deps['nuxt'] || deps['@nuxt/core']) {
      return 'nuxt';
    }

    if (deps['@sveltejs/kit']) {
      return 'sveltekit';
    }

    if (deps['@angular/core']) {
      return 'angular';
    }

    if (deps['vite'] && (deps['react'] || deps['vue'] || deps['svelte'])) {
      return 'vite-spa';
    }

    if (deps['react'] || deps['react-dom']) {
      return 'vite-spa';
    }

    return 'unknown';
  }

  private async findTsConfig(packageDir: string): Promise<string | null> {
    const candidates = [
      'tsconfig.json',
      'tsconfig.app.json',
      'tsconfig.build.json',
    ];

    for (const candidate of candidates) {
      const configPath = path.join(packageDir, candidate);
      if (await this.pathExists(configPath)) {
        return configPath;
      }
    }

    return null;
  }

  private async findBuildOutput(
    packageDir: string,
    framework: FrameworkType
  ): Promise<string | null> {
    const frameworkOutputs: Record<FrameworkType, string[]> = {
      'next': ['.next'],
      'next-app': ['.next'],
      'next-pages': ['.next'],
      'remix': ['build', '.remix'],
      'react-router': ['dist', 'build'],
      'tanstack-router': ['dist', 'build'],
      'vite-spa': ['dist'],
      'gatsby': ['.cache', 'public'],
      'astro': ['dist', '.astro'],
      'nuxt': ['.nuxt', '.output'],
      'sveltekit': ['.svelte-kit', 'build'],
      'angular': ['dist'],
      'unknown': ['dist', 'build'],
    };

    const candidates = frameworkOutputs[framework] || ['dist', 'build'];

    for (const candidate of candidates) {
      const outputPath = path.join(packageDir, candidate);
      if (await this.pathExists(outputPath)) {
        return outputPath;
      }
    }

    return null;
  }

  private async findEntryPoints(
    packageDir: string,
    framework: FrameworkType
  ): Promise<string[]> {
    const entryPoints: string[] = [];

    const frameworkEntries: Record<FrameworkType, string[]> = {
      'next': ['app/layout.tsx', 'app/page.tsx', 'pages/_app.tsx', 'pages/index.tsx'],
      'next-app': ['app/layout.tsx', 'app/page.tsx', 'src/app/layout.tsx', 'src/app/page.tsx'],
      'next-pages': ['pages/_app.tsx', 'pages/index.tsx', 'src/pages/_app.tsx', 'src/pages/index.tsx'],
      'remix': ['app/root.tsx', 'app/entry.client.tsx', 'app/entry.server.tsx'],
      'react-router': ['src/main.tsx', 'src/index.tsx', 'src/App.tsx'],
      'tanstack-router': ['src/main.tsx', 'src/routes/__root.tsx'],
      'vite-spa': ['src/main.tsx', 'src/main.jsx', 'src/index.tsx', 'src/App.tsx'],
      'gatsby': ['src/pages/index.tsx', 'gatsby-config.js'],
      'astro': ['src/pages/index.astro', 'astro.config.mjs'],
      'nuxt': ['app.vue', 'nuxt.config.ts', 'pages/index.vue'],
      'sveltekit': ['src/routes/+page.svelte', 'src/routes/+layout.svelte'],
      'angular': ['src/main.ts', 'src/app/app.component.ts'],
      'unknown': ['src/index.tsx', 'src/main.tsx', 'index.tsx'],
    };

    const candidates = frameworkEntries[framework] || frameworkEntries['unknown'];

    for (const candidate of candidates) {
      const entryPath = path.join(packageDir, candidate);
      if (await this.pathExists(entryPath)) {
        entryPoints.push(entryPath);
      }

      const jsVariant = candidate.replace('.tsx', '.jsx').replace('.ts', '.js');
      const jsPath = path.join(packageDir, jsVariant);
      if (jsVariant !== candidate && await this.pathExists(jsPath)) {
        entryPoints.push(jsPath);
      }
    }

    return entryPoints;
  }

  private async findSrcDir(packageDir: string): Promise<string> {
    const candidates = ['src', 'app', 'pages', 'lib'];
    
    for (const candidate of candidates) {
      const srcPath = path.join(packageDir, candidate);
      if (await this.pathExists(srcPath)) {
        return srcPath;
      }
    }

    return packageDir;
  }

  private determineRouterType(
    framework: FrameworkType
  ): 'file-based' | 'config-based' | 'hybrid' | 'unknown' {
    const fileBasedFrameworks: FrameworkType[] = [
      'next', 'next-app', 'next-pages', 'remix', 'astro', 'nuxt', 'sveltekit', 'gatsby'
    ];
    
    const configBasedFrameworks: FrameworkType[] = [
      'react-router', 'tanstack-router', 'angular'
    ];

    if (fileBasedFrameworks.includes(framework)) {
      return 'file-based';
    }

    if (configBasedFrameworks.includes(framework)) {
      return 'config-based';
    }

    return 'unknown';
  }

  private isFrontendPackage(pkg: PackageInfo): boolean {
    const frontendFrameworks: FrameworkType[] = [
      'next', 'next-app', 'next-pages', 'remix', 'react-router',
      'tanstack-router', 'vite-spa', 'gatsby', 'astro', 'nuxt',
      'sveltekit', 'angular'
    ];

    return frontendFrameworks.includes(pkg.frameworkType);
  }

  private async computeProjectHash(): Promise<string> {
    const hash = crypto.createHash('sha256');
    
    const pkgJsonPath = path.join(this.projectRoot, 'package.json');
    if (await this.pathExists(pkgJsonPath)) {
      const content = await fs.promises.readFile(pkgJsonPath, 'utf8');
      hash.update(content);
    }

    const lockFiles = ['pnpm-lock.yaml', 'yarn.lock', 'package-lock.json'];
    for (const lockFile of lockFiles) {
      const lockPath = path.join(this.projectRoot, lockFile);
      if (await this.pathExists(lockPath)) {
        const stat = await fs.promises.stat(lockPath);
        hash.update(`${lockFile}:${stat.mtime.getTime()}`);
        break;
      }
    }

    const configFiles = [
      'next.config.js', 'next.config.ts', 'next.config.mjs',
      'vite.config.ts', 'vite.config.js',
      'remix.config.js',
      'astro.config.mjs',
      'nuxt.config.ts',
      'svelte.config.js',
      'angular.json',
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(this.projectRoot, configFile);
      if (await this.pathExists(configPath)) {
        const stat = await fs.promises.stat(configPath);
        hash.update(`${configFile}:${stat.mtime.getTime()}`);
      }
    }

    return hash.digest('hex').slice(0, 16);
  }

  private loadCache(): ProjectMap | null {
    try {
      if (fs.existsSync(this.cachePath)) {
        const content = fs.readFileSync(this.cachePath, 'utf8');
        return JSON.parse(content) as ProjectMap;
      }
    } catch {
      // Cache invalid or corrupted
    }
    return null;
  }

  private saveCache(projectMap: ProjectMap): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(projectMap, null, 2));
    } catch {
      // Failed to save cache - non-fatal
    }
  }

  private async readPackageJson(dir: string): Promise<PackageJson | null> {
    try {
      const pkgPath = path.join(dir, 'package.json');
      const content = await fs.promises.readFile(pkgPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export async function discoverProject(projectRoot: string, forceRefresh = false): Promise<ProjectMap> {
  const discovery = new ProjectDiscovery(projectRoot);
  return discovery.discover(forceRefresh);
}
