#!/usr/bin/env tsx
/**
 * Project Discovery (0.1)
 * 
 * Detect all frontend packages in monorepo
 * Per package, compute:
 * - framework type
 * - root dir
 * - tsconfig path
 * - build output path
 * - entry points
 * 
 * Cache results in .guardrail/cache/project-map.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface ProjectInfo {
  framework: 'nextjs' | 'remix' | 'react-router' | 'vite-spa' | 'vite-ssr' | 'unknown';
  rootDir: string;
  tsconfigPath: string | null;
  buildOutputPath: string | null;
  entryPoints: string[];
  packageJsonPath: string | null;
  hasAppRouter: boolean;
  hasPagesRouter: boolean;
  basePath: string;
  i18n: {
    locales: string[];
    defaultLocale: string;
  } | null;
  trailingSlash: boolean;
}

export interface ProjectMap {
  version: string;
  timestamp: string;
  projects: Record<string, ProjectInfo>;
}

const FRAMEWORK_INDICATORS = {
  nextjs: {
    deps: ['next'],
    configFiles: ['next.config.js', 'next.config.ts', 'next.config.mjs'],
    structure: ['app', 'pages'],
  },
  remix: {
    deps: ['@remix-run/node', '@remix-run/react'],
    configFiles: ['remix.config.js', 'remix.config.ts'],
    structure: ['app/routes'],
  },
  'react-router': {
    deps: ['react-router-dom', 'react-router'],
    configFiles: [],
    structure: ['src/routes', 'src/pages'],
  },
  'vite-spa': {
    deps: ['vite'],
    configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'],
    structure: ['src/main', 'src/App'],
  },
  'vite-ssr': {
    deps: ['vite', 'vite-plugin-ssr'],
    configFiles: ['vite.config.js', 'vite.config.ts'],
    structure: ['src/pages'],
  },
};

export async function discoverProjects(projectRoot: string): Promise<ProjectMap> {
  const projects: Record<string, ProjectInfo> = {};
  const cachePath = path.join(projectRoot, '.guardrail', 'cache', 'project-map.json');
  
  // Ensure cache directory exists
  const cacheDir = path.dirname(cachePath);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  // Check cache first
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      // TODO: Validate cache freshness (check file hashes)
      // For now, always regenerate
    } catch {
      // Invalid cache, regenerate
    }
  }
  
  // Find all package.json files (monorepo detection)
  const packageJsonFiles = await glob('**/package.json', {
    cwd: projectRoot,
    ignore: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'],
    absolute: true,
  });
  
  for (const pkgPath of packageJsonFiles) {
    const pkgDir = path.dirname(pkgPath);
    const relativePath = path.relative(projectRoot, pkgDir);
    const projectKey = relativePath || 'root';
    
    try {
      const pkgContent = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      
      // Detect framework
      let framework: ProjectInfo['framework'] = 'unknown';
      for (const [fw, indicators] of Object.entries(FRAMEWORK_INDICATORS)) {
        const hasDep = indicators.deps.some(dep => deps[dep]);
        const hasConfig = indicators.configFiles.some(config => 
          fs.existsSync(path.join(pkgDir, config))
        );
        const hasStructure = indicators.structure.some(struct => {
          const structPath = path.join(pkgDir, struct);
          return fs.existsSync(structPath) || fs.existsSync(path.join(pkgDir, 'src', struct));
        });
        
        if (hasDep || (hasConfig && hasStructure)) {
          framework = fw as ProjectInfo['framework'];
          break;
        }
      }
      
      // Skip if not a frontend project
      if (framework === 'unknown' && !deps.react && !deps.vue && !deps.svelte) {
        continue;
      }
      
      // Find tsconfig
      const tsconfigPaths = [
        path.join(pkgDir, 'tsconfig.json'),
        path.join(pkgDir, 'tsconfig.app.json'),
        path.join(pkgDir, 'tsconfig.base.json'),
      ];
      const tsconfigPath = tsconfigPaths.find(p => fs.existsSync(p)) || null;
      
      // Determine build output path
      let buildOutputPath: string | null = null;
      if (framework === 'nextjs') {
        buildOutputPath = path.join(pkgDir, '.next');
      } else if (framework === 'vite-spa' || framework === 'vite-ssr') {
        buildOutputPath = path.join(pkgDir, 'dist');
      } else if (pkg.scripts?.build) {
        // Try to infer from build script
        const buildMatch = pkg.scripts.build.match(/--outDir\s+(\S+)/);
        if (buildMatch) {
          buildOutputPath = path.join(pkgDir, buildMatch[1]);
        } else {
          buildOutputPath = path.join(pkgDir, 'dist');
        }
      }
      
      // Find entry points
      const entryPoints: string[] = [];
      if (framework === 'nextjs') {
        const appDir = path.join(pkgDir, 'app');
        const pagesDir = path.join(pkgDir, 'pages');
        const srcAppDir = path.join(pkgDir, 'src', 'app');
        const srcPagesDir = path.join(pkgDir, 'src', 'pages');
        
        if (fs.existsSync(appDir) || fs.existsSync(srcAppDir)) {
          entryPoints.push('app');
        }
        if (fs.existsSync(pagesDir) || fs.existsSync(srcPagesDir)) {
          entryPoints.push('pages');
        }
      } else {
        // Look for main entry points
        const mainEntry = pkg.main || 'src/main.tsx' || 'src/main.ts' || 'src/index.tsx' || 'src/index.ts';
        const mainPath = path.join(pkgDir, mainEntry);
        if (fs.existsSync(mainPath)) {
          entryPoints.push(mainEntry);
        }
      }
      
      // Check for Next.js App Router
      const hasAppRouter = fs.existsSync(path.join(pkgDir, 'app')) || 
                          fs.existsSync(path.join(pkgDir, 'src', 'app'));
      const hasPagesRouter = fs.existsSync(path.join(pkgDir, 'pages')) || 
                            fs.existsSync(path.join(pkgDir, 'src', 'pages'));
      
      // Read Next.js config for basePath, i18n, trailingSlash
      let basePath = '';
      let i18n: ProjectInfo['i18n'] = null;
      let trailingSlash = false;
      
      if (framework === 'nextjs') {
        const nextConfigPaths = [
          path.join(pkgDir, 'next.config.js'),
          path.join(pkgDir, 'next.config.ts'),
          path.join(pkgDir, 'next.config.mjs'),
        ];
        
        for (const configPath of nextConfigPaths) {
          if (fs.existsSync(configPath)) {
            try {
              // Simple regex extraction (full eval would be better but risky)
              const configContent = fs.readFileSync(configPath, 'utf8');
              const basePathMatch = configContent.match(/basePath:\s*['"]([^'"]+)['"]/);
              if (basePathMatch) basePath = basePathMatch[1];
              
              const trailingSlashMatch = configContent.match(/trailingSlash:\s*(true|false)/);
              if (trailingSlashMatch) trailingSlash = trailingSlashMatch[1] === 'true';
              
              // i18n is more complex, would need proper parsing
              // For now, skip
            } catch {
              // Config parse failed, use defaults
            }
            break;
          }
        }
      }
      
      projects[projectKey] = {
        framework,
        rootDir: pkgDir,
        tsconfigPath,
        buildOutputPath,
        entryPoints,
        packageJsonPath: pkgPath,
        hasAppRouter,
        hasPagesRouter,
        basePath,
        i18n,
        trailingSlash,
      };
    } catch (err) {
      console.warn(`Failed to process ${pkgPath}:`, err);
    }
  }
  
  const projectMap: ProjectMap = {
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    projects,
  };
  
  // Write cache
  fs.writeFileSync(cachePath, JSON.stringify(projectMap, null, 2));
  
  return projectMap;
}

// CLI execution
if (require.main === module) {
  const projectRoot = process.argv[2] || process.cwd();
  discoverProjects(projectRoot)
    .then(map => {
      console.log(JSON.stringify(map, null, 2));
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

