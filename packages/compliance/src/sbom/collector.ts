/**
 * SBOM Dependency Collector
 *
 * Reads package manifests and lockfiles to enumerate components.
 * Supports npm, yarn, and pnpm.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { SBOMComponent, LicenseInfo, ComponentHash } from './types';

interface PackageLockDep {
  version: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  dependencies?: Record<string, PackageLockDep>;
}

interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  license?: string | { type?: string; url?: string };
  author?: string | { name?: string; email?: string };
  repository?: string | { type?: string; url?: string };
  homepage?: string;
  bugs?: string | { url?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Build a Package URL for npm packages
 */
export function buildPurl(name: string, version: string): string {
  // Handle scoped packages: @scope/name -> pkg:npm/%40scope/name@version
  const encodedName = name.startsWith('@')
    ? `%40${name.slice(1)}`
    : name;
  return `pkg:npm/${encodedName}@${version}`;
}

/**
 * Parse integrity hash from lockfile (e.g., "sha512-abc123...")
 */
function parseIntegrity(integrity: string | undefined): ComponentHash[] {
  if (!integrity) return [];

  const hashes: ComponentHash[] = [];
  const parts = integrity.split(' ');

  for (const part of parts) {
    const [algo, hash] = part.split('-', 2);
    if (!algo || !hash) continue;

    const algoMap: Record<string, ComponentHash['algorithm']> = {
      'sha512': 'SHA-512',
      'sha384': 'SHA-384',
      'sha256': 'SHA-256',
      'sha1': 'SHA-1',
      'md5': 'MD5',
    };

    const mapped = algoMap[algo.toLowerCase()];
    if (mapped) {
      // Convert base64 to hex
      const hexHash = Buffer.from(hash, 'base64').toString('hex');
      hashes.push({ algorithm: mapped, value: hexHash });
    }
  }

  return hashes;
}

/**
 * Read license information from a package's directory
 */
function readPackageLicense(pkgPath: string): LicenseInfo[] {
  try {
    const pkgJsonPath = path.join(pkgPath, 'package.json');
    if (!fs.existsSync(pkgJsonPath)) return [];

    const pkgJson: PackageJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
    const licenses: LicenseInfo[] = [];

    if (typeof pkgJson.license === 'string') {
      // Handle SPDX expression: "MIT OR Apache-2.0"
      const ids = pkgJson.license.split(/\s+OR\s+/);
      for (const id of ids) {
        licenses.push({ id: id.trim() });
      }
    } else if (pkgJson.license && typeof pkgJson.license === 'object') {
      licenses.push({
        id: pkgJson.license.type,
        url: pkgJson.license.url,
      });
    }

    return licenses;
  } catch {
    return [];
  }
}

/**
 * Collect components from package-lock.json (npm)
 */
export function collectFromNpmLockfile(
  projectPath: string,
  options: { includeDevDependencies?: boolean; includeHashes?: boolean; includeLicenses?: boolean } = {}
): SBOMComponent[] {
  const lockfilePath = path.join(projectPath, 'package-lock.json');
  if (!fs.existsSync(lockfilePath)) return [];

  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
  const components: SBOMComponent[] = [];
  const seen = new Set<string>();

  // npm lockfile v2/v3 uses "packages" key
  const packages = lockfile.packages || {};

  for (const [pkgPath, info] of Object.entries(packages) as Array<[string, unknown]>) {
    // Skip root package
    if (pkgPath === '') continue;

    const pkgInfo = info as unknown as PackageLockDep & { name?: string; license?: string; integrity?: string };

    // Skip dev dependencies if not requested
    if (pkgInfo.dev && !options.includeDevDependencies) continue;

    // Extract package name from path: "node_modules/@scope/name" -> "@scope/name"
    const name = pkgInfo.name || pkgPath.replace(/^.*node_modules\//, '');
    const version = pkgInfo.version;

    if (!name || !version) continue;

    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const component: SBOMComponent = {
      name,
      version,
      type: 'library',
      purl: buildPurl(name, version),
      scope: pkgInfo.dev ? 'optional' : 'required',
    };

    if (options.includeHashes) {
      component.hashes = parseIntegrity(pkgInfo.resolved ? undefined : pkgInfo.integrity);
    }

    if (options.includeLicenses) {
      const fullPkgPath = path.join(projectPath, pkgPath);
      component.licenses = readPackageLicense(fullPkgPath);
      if (component.licenses.length > 0 && component.licenses[0]?.id) {
        component.license = component.licenses[0].id;
      }
    }

    components.push(component);
  }

  // Fallback: parse top-level dependencies from lockfile v1
  if (components.length === 0 && lockfile.dependencies) {
    collectFromLockfileV1(
      lockfile.dependencies,
      components,
      seen,
      projectPath,
      options
    );
  }

  return components;
}

function collectFromLockfileV1(
  deps: Record<string, PackageLockDep>,
  components: SBOMComponent[],
  seen: Set<string>,
  projectPath: string,
  options: { includeDevDependencies?: boolean; includeHashes?: boolean; includeLicenses?: boolean }
): void {
  for (const [name, info] of Object.entries(deps)) {
    if (info.dev && !options.includeDevDependencies) continue;

    const key = `${name}@${info.version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const component: SBOMComponent = {
      name,
      version: info.version,
      type: 'library',
      purl: buildPurl(name, info.version),
      scope: info.dev ? 'optional' : 'required',
    };

    if (options.includeHashes) {
      component.hashes = parseIntegrity(info.integrity);
    }

    components.push(component);

    // Recurse into nested dependencies
    if (info.dependencies) {
      collectFromLockfileV1(info.dependencies, components, seen, projectPath, options);
    }
  }
}

/**
 * Collect components from pnpm-lock.yaml
 */
export function collectFromPnpmLockfile(
  projectPath: string,
  options: { includeDevDependencies?: boolean; includeLicenses?: boolean } = {}
): SBOMComponent[] {
  const lockfilePath = path.join(projectPath, 'pnpm-lock.yaml');
  if (!fs.existsSync(lockfilePath)) return [];

  // Simple YAML line parser for pnpm-lock.yaml packages section
  const content = fs.readFileSync(lockfilePath, 'utf8');
  const components: SBOMComponent[] = [];
  const seen = new Set<string>();

  // Parse package entries: "/@scope/name@version:" or "/name@version:"
  const packagePattern = /^\s{2}'?([/@\w.-]+)@([\d.]+(?:-[\w.]+)?)'?:/gm;
  let match;

  while ((match = packagePattern.exec(content)) !== null) {
    const name = match[1];
    const version = match[2];
    if (!name || !version) continue;

    const key = `${name}@${version}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const component: SBOMComponent = {
      name,
      version,
      type: 'library',
      purl: buildPurl(name, version),
      scope: 'required',
    };

    if (options.includeLicenses) {
      const pkgDir = path.join(projectPath, 'node_modules', name);
      component.licenses = readPackageLicense(pkgDir);
      if (component.licenses.length > 0 && component.licenses[0]?.id) {
        component.license = component.licenses[0].id;
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Collect components from package.json dependencies (fallback)
 */
export function collectFromPackageJson(
  projectPath: string,
  options: { includeDevDependencies?: boolean; includeLicenses?: boolean } = {}
): SBOMComponent[] {
  const pkgJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return [];

  const pkgJson: PackageJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const components: SBOMComponent[] = [];
  const seen = new Set<string>();

  const depSources: Array<[Record<string, string> | undefined, 'required' | 'optional']> = [
    [pkgJson.dependencies, 'required'],
    [pkgJson.peerDependencies, 'required'],
  ];

  if (options.includeDevDependencies) {
    depSources.push([pkgJson.devDependencies, 'optional']);
  }

  for (const [deps, scope] of depSources) {
    if (!deps) continue;

    for (const [name, versionRange] of Object.entries(deps)) {
      // Try to resolve actual version from node_modules
      const resolvedVersion = resolveInstalledVersion(projectPath, name) || versionRange.replace(/^[\^~>=<]+/, '');

      const key = `${name}@${resolvedVersion}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const component: SBOMComponent = {
        name,
        version: resolvedVersion,
        type: 'library',
        purl: buildPurl(name, resolvedVersion),
        scope,
      };

      if (options.includeLicenses) {
        const pkgDir = path.join(projectPath, 'node_modules', name);
        component.licenses = readPackageLicense(pkgDir);
        if (component.licenses.length > 0 && component.licenses[0]?.id) {
          component.license = component.licenses[0].id;
        }
      }

      components.push(component);
    }
  }

  return components;
}

/**
 * Resolve installed version from node_modules
 */
function resolveInstalledVersion(projectPath: string, packageName: string): string | null {
  try {
    const pkgJsonPath = path.join(projectPath, 'node_modules', packageName, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      return pkg.version || null;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Get root project info from package.json
 */
export function getRootComponent(projectPath: string): SBOMComponent | null {
  const pkgJsonPath = path.join(projectPath, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return null;

  try {
    const pkg: PackageJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

    const component: SBOMComponent = {
      name: pkg.name || path.basename(projectPath),
      version: pkg.version || '0.0.0',
      type: 'application',
      description: pkg.description,
    };

    if (typeof pkg.license === 'string') {
      component.license = pkg.license;
    }

    if (typeof pkg.author === 'string') {
      component.author = pkg.author;
    } else if (pkg.author && typeof pkg.author === 'object') {
      component.author = pkg.author.name;
    }

    // External references
    const refs: SBOMComponent['externalReferences'] = [];
    if (typeof pkg.repository === 'string') {
      refs.push({ type: 'vcs', url: pkg.repository });
    } else if (pkg.repository?.url) {
      refs.push({ type: 'vcs', url: pkg.repository.url });
    }
    if (pkg.homepage) {
      refs.push({ type: 'website', url: pkg.homepage });
    }
    if (refs.length > 0) {
      component.externalReferences = refs;
    }

    return component;
  } catch {
    return null;
  }
}

/**
 * Detect which package managers are in use
 */
export function detectPackageManagers(projectPath: string): ('npm' | 'yarn' | 'pnpm')[] {
  const managers: ('npm' | 'yarn' | 'pnpm')[] = [];

  if (fs.existsSync(path.join(projectPath, 'pnpm-lock.yaml'))) {
    managers.push('pnpm');
  }
  if (fs.existsSync(path.join(projectPath, 'yarn.lock'))) {
    managers.push('yarn');
  }
  if (fs.existsSync(path.join(projectPath, 'package-lock.json'))) {
    managers.push('npm');
  }

  // Fallback to npm if package.json exists but no lockfile
  if (managers.length === 0 && fs.existsSync(path.join(projectPath, 'package.json'))) {
    managers.push('npm');
  }

  return managers;
}
