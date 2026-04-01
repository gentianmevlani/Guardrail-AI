/**
 * Framework Detection Module
 * Detects project type by inspecting package.json and file structure
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

export type DetectedFramework =
  | 'nextjs'
  | 'express'
  | 'nestjs'
  | 'fastify'
  | 'remix'
  | 'vite-react'
  | 'unknown';

export interface FrameworkDetectionResult {
  framework: DetectedFramework;
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  recommendedScans: string[];
  scanDescription: string;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

function loadPackageJson(projectPath: string): PackageJson | null {
  const packageJsonPath = join(projectPath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  } catch {
    return null;
  }
}

function hasDependency(pkg: PackageJson | null, depName: string): boolean {
  if (!pkg) return false;
  return Boolean(pkg.dependencies?.[depName] || pkg.devDependencies?.[depName]);
}

function hasFile(projectPath: string, ...patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const dir = join(projectPath, pattern.split('/')[0] || '.');
      const filePattern = pattern.split('/').pop()?.replace('*', '') || '';
      try {
        const files = readdirSync(dir);
        if (files.some(f => f.includes(filePattern.replace('*', '')))) {
          return true;
        }
      } catch {
        continue;
      }
    } else {
      if (existsSync(join(projectPath, pattern))) {
        return true;
      }
    }
  }
  return false;
}

function hasDirectory(projectPath: string, dirName: string): boolean {
  const dirPath = join(projectPath, dirName);
  try {
    return existsSync(dirPath) && statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function hasFilePattern(projectPath: string, dir: string, pattern: RegExp): boolean {
  const dirPath = join(projectPath, dir);
  if (!existsSync(dirPath)) return false;
  try {
    const files = readdirSync(dirPath);
    return files.some(f => pattern.test(f));
  } catch {
    return false;
  }
}

function detectNextJS(projectPath: string, pkg: PackageJson | null): FrameworkDetectionResult | null {
  const signals: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (hasDependency(pkg, 'next')) {
    signals.push('next dependency found in package.json');
    confidence = 'high';
  }

  if (hasFile(projectPath, 'next.config.js', 'next.config.mjs', 'next.config.ts')) {
    signals.push('next.config.* file found');
    confidence = 'high';
  }

  if (hasDirectory(projectPath, 'app') && hasFile(projectPath, 'app/layout.tsx', 'app/layout.js', 'app/page.tsx', 'app/page.js')) {
    signals.push('Next.js app directory structure detected');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (hasDirectory(projectPath, 'pages')) {
    const pagesPath = join(projectPath, 'pages');
    try {
      const files = readdirSync(pagesPath);
      if (files.some(f => f.endsWith('.tsx') || f.endsWith('.jsx') || f === '_app.js' || f === '_app.tsx')) {
        signals.push('Next.js pages directory structure detected');
        if (confidence !== 'high') confidence = 'medium';
      }
    } catch (error) {
      // Failed to detect framework - continue with default setup
    }
  }

  if (signals.length === 0) return null;

  return {
    framework: 'nextjs',
    confidence,
    signals,
    recommendedScans: ['secrets', 'vuln', 'ship', 'reality'],
    scanDescription: 'Full-stack scanning: secrets detection, dependency vulnerabilities, ship readiness, and reality mode for auth/dashboard flows',
  };
}

function detectExpress(projectPath: string, pkg: PackageJson | null): FrameworkDetectionResult | null {
  const signals: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (hasDependency(pkg, 'express')) {
    signals.push('express dependency found in package.json');
    confidence = 'high';
  }

  if (hasFilePattern(projectPath, 'src', /^(server|app|index)\.(ts|js)$/)) {
    signals.push('src/server.* or src/app.* pattern detected');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (hasFilePattern(projectPath, '.', /^(server|app)\.(ts|js)$/)) {
    signals.push('Root server.* or app.* file detected');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (hasDirectory(projectPath, 'routes') || hasDirectory(projectPath, 'src/routes')) {
    signals.push('routes directory detected');
    if (confidence !== 'high') confidence = 'low';
  }

  if (signals.length === 0) return null;

  return {
    framework: 'express',
    confidence,
    signals,
    recommendedScans: ['secrets', 'vuln', 'ship', 'compliance'],
    scanDescription: 'API-focused scanning: secrets detection, dependency vulnerabilities, ship readiness, and compliance checks for logging/rate limits',
  };
}

function detectNestJS(projectPath: string, pkg: PackageJson | null): FrameworkDetectionResult | null {
  const signals: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (hasDependency(pkg, '@nestjs/core')) {
    signals.push('@nestjs/core dependency found');
    confidence = 'high';
  }

  if (hasDependency(pkg, '@nestjs/common')) {
    signals.push('@nestjs/common dependency found');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (hasFile(projectPath, 'nest-cli.json')) {
    signals.push('nest-cli.json configuration found');
    confidence = 'high';
  }

  if (hasFilePattern(projectPath, 'src', /\.module\.ts$/)) {
    signals.push('NestJS module files detected');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (signals.length === 0) return null;

  return {
    framework: 'nestjs',
    confidence,
    signals,
    recommendedScans: ['secrets', 'vuln', 'ship', 'compliance'],
    scanDescription: 'Enterprise API scanning: secrets detection, dependency vulnerabilities, ship readiness, and compliance checks for decorators/guards',
  };
}

function detectFastify(projectPath: string, pkg: PackageJson | null): FrameworkDetectionResult | null {
  const signals: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (hasDependency(pkg, 'fastify')) {
    signals.push('fastify dependency found in package.json');
    confidence = 'high';
  }

  if (hasDependency(pkg, '@fastify/autoload') || hasDependency(pkg, 'fastify-plugin')) {
    signals.push('Fastify ecosystem packages detected');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (signals.length === 0) return null;

  return {
    framework: 'fastify',
    confidence,
    signals,
    recommendedScans: ['secrets', 'vuln', 'ship', 'compliance'],
    scanDescription: 'High-performance API scanning: secrets detection, dependency vulnerabilities, ship readiness, and compliance checks',
  };
}

function detectRemix(projectPath: string, pkg: PackageJson | null): FrameworkDetectionResult | null {
  const signals: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  if (hasDependency(pkg, '@remix-run/node') || hasDependency(pkg, '@remix-run/react')) {
    signals.push('@remix-run packages found in package.json');
    confidence = 'high';
  }

  if (hasFile(projectPath, 'remix.config.js', 'remix.config.ts')) {
    signals.push('remix.config.* file found');
    confidence = 'high';
  }

  if (hasDirectory(projectPath, 'app/routes')) {
    signals.push('Remix app/routes directory structure detected');
    if (confidence !== 'high') confidence = 'medium';
  }

  if (signals.length === 0) return null;

  return {
    framework: 'remix',
    confidence,
    signals,
    recommendedScans: ['secrets', 'vuln', 'ship', 'reality'],
    scanDescription: 'Full-stack scanning: secrets detection, dependency vulnerabilities, ship readiness, and reality mode for form/loader flows',
  };
}

function detectViteReact(projectPath: string, pkg: PackageJson | null): FrameworkDetectionResult | null {
  const signals: string[] = [];
  let confidence: 'high' | 'medium' | 'low' = 'low';

  const hasVite = hasDependency(pkg, 'vite');
  const hasReact = hasDependency(pkg, 'react') || hasDependency(pkg, 'react-dom');

  if (hasVite && hasReact) {
    signals.push('vite + react dependencies found');
    confidence = 'high';
  }

  if (hasFile(projectPath, 'vite.config.ts', 'vite.config.js', 'vite.config.mjs')) {
    signals.push('vite.config.* file found');
    if (hasReact) {
      confidence = 'high';
    } else if (confidence !== 'high') {
      confidence = 'medium';
    }
  }

  if (hasDependency(pkg, '@vitejs/plugin-react') || hasDependency(pkg, '@vitejs/plugin-react-swc')) {
    signals.push('Vite React plugin detected');
    confidence = 'high';
  }

  if (signals.length === 0) return null;

  return {
    framework: 'vite-react',
    confidence,
    signals,
    recommendedScans: ['secrets', 'vuln', 'ship'],
    scanDescription: 'Frontend scanning: secrets detection in client code, dependency vulnerabilities, and ship readiness checks',
  };
}

export function detectFramework(projectPath: string): FrameworkDetectionResult {
  const pkg = loadPackageJson(projectPath);

  const detectors = [
    detectNextJS,
    detectNestJS,
    detectRemix,
    detectFastify,
    detectExpress,
    detectViteReact,
  ];

  let bestMatch: FrameworkDetectionResult | null = null;
  const confidenceOrder = { high: 3, medium: 2, low: 1 };

  for (const detector of detectors) {
    const result = detector(projectPath, pkg);
    if (result) {
      if (!bestMatch || confidenceOrder[result.confidence] > confidenceOrder[bestMatch.confidence]) {
        bestMatch = result;
      }
      if (result.confidence === 'high') {
        break;
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  return {
    framework: 'unknown',
    confidence: 'low',
    signals: ['No specific framework detected'],
    recommendedScans: ['secrets', 'vuln'],
    scanDescription: 'Basic scanning: secrets detection and dependency vulnerability checks',
  };
}

export function formatFrameworkName(framework: DetectedFramework): string {
  const names: Record<DetectedFramework, string> = {
    nextjs: 'Next.js',
    express: 'Express.js',
    nestjs: 'NestJS',
    fastify: 'Fastify',
    remix: 'Remix',
    'vite-react': 'Vite + React',
    unknown: 'Unknown',
  };
  return names[framework];
}
