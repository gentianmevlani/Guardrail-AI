/**
 * Route Integrity Orchestrator
 * 
 * Main entry point that coordinates all layers:
 * - Layer 1: AST + TypeChecker (static analysis)
 * - Layer 2: Build Truth (framework manifests)
 * - Layer 3: Reality Proof (Playwright crawl)
 * 
 * Supports three scan modes:
 * - guardrail scan: Layer 1 only (fast, actionable)
 * - guardrail scan --truth: Layer 1 + Layer 2 (CI/ship)
 * - guardrail scan --reality: Layer 1 + Layer 2 + Layer 3 (best-in-class)
 */

import * as path from 'path';
import {
  ProjectMap,
  PackageInfo,
  NavigationGraph,
  BuildManifest,
  CrawlResult,
  ExtractedLink,
  PlaceholderMatch,
  RouteIntegrityReport,
  LayerExecution,
  NormalizationConfig,
} from './types';
import { ProjectDiscovery, discoverProject } from './discovery/project-discovery';
import { RouteNormalizer, createNormalizer } from './normalization/route-normalizer';
import { NavigationGraphBuilder, createNavigationGraph } from './graph/navigation-graph';
import { FileScanner, createFileScanner } from './ast/file-scanner';
import { loadBuildManifest } from './truth/framework-adapters';
import { PlaywrightCrawler, createCrawler } from './reality/playwright-crawler';
import { VerdictEngine, createVerdictEngine } from './verdict/verdict-engine';
import { ReportGenerator, generateReports } from './reporting/report-generator';

export interface ScanOptions {
  projectPath: string;
  layers: {
    ast: boolean;
    truth: boolean;
    reality: boolean;
  };
  baseUrl?: string;
  outputDir?: string;
  verbose?: boolean;
  onProgress?: (phase: string, progress: number) => void;
}

export interface ScanResult {
  report: RouteIntegrityReport;
  outputPaths: {
    md: string;
    json: string;
    sarif: string;
  };
}

export class RouteIntegrityOrchestrator {
  private options: ScanOptions;
  private projectMap: ProjectMap | null = null;
  private normalizer: RouteNormalizer;
  private graphBuilder: NavigationGraphBuilder;
  private links: ExtractedLink[] = [];
  private placeholders: PlaceholderMatch[] = [];
  private manifest: BuildManifest | null = null;
  private crawlResults: CrawlResult[] = [];
  private layers: LayerExecution[] = [];
  private realitySniffFindings: any[] = [];

  constructor(options: ScanOptions) {
    this.options = {
      ...options,
      outputDir: options.outputDir || path.join(options.projectPath, '.guardrail'),
    };
    this.normalizer = createNormalizer();
    this.graphBuilder = createNavigationGraph();
  }

  async scan(): Promise<ScanResult> {
    const startTime = Date.now();

    this.progress('discovery', 0);
    this.projectMap = await discoverProject(this.options.projectPath);
    this.progress('discovery', 100);

    if (this.projectMap.packages.length === 0) {
      throw new Error('No frontend packages detected in project');
    }

    if (this.options.layers.ast) {
      await this.runAstLayer();
    }

    if (this.options.layers.truth) {
      await this.runTruthLayer();
    }

    if (this.options.layers.reality && this.options.baseUrl) {
      await this.runRealityLayer();
    }

    // Run Reality Sniff if enabled
    if (this.options.layers.realitySniff) {
      await this.runRealitySniffLayer();
    }

    const graph = this.graphBuilder.build();
    const report = this.buildReport(graph, startTime);
    const outputPaths = await generateReports(report, this.options.outputDir!);

    return { report, outputPaths };
  }

  private async runAstLayer(): Promise<void> {
    const layerStart = Date.now();
    let totalFindings = 0;

    this.progress('ast', 0);

    for (let i = 0; i < this.projectMap!.packages.length; i++) {
      const pkg = this.projectMap!.packages[i];
      const scanner = createFileScanner(pkg);
      const result = await scanner.scan();

      const fileEntries = Array.from(result.files.entries());
      for (const [filePath, fileCache] of fileEntries) {
        this.links.push(...fileCache.extractedLinks);
        this.placeholders.push(...fileCache.placeholders);

        const routePattern = this.inferRouteFromFile(filePath, pkg);
        if (routePattern) {
          const nodeId = this.graphBuilder.addRoute(routePattern, {
            type: 'file-route',
            file: filePath,
            line: 1,
            column: 1,
            framework: pkg.frameworkType,
          });

          for (const link of fileCache.extractedLinks) {
            this.graphBuilder.addExtractedLink(filePath, routePattern, link);
          }
        }
      }

      totalFindings += result.files.size;
      this.progress('ast', ((i + 1) / this.projectMap!.packages.length) * 100);
    }

    this.layers.push({
      layer: 'ast',
      executed: true,
      duration: Date.now() - layerStart,
      findings: totalFindings,
    });
  }

  private async runTruthLayer(): Promise<void> {
    const layerStart = Date.now();
    let totalFindings = 0;

    this.progress('truth', 0);

    for (let i = 0; i < this.projectMap!.packages.length; i++) {
      const pkg = this.projectMap!.packages[i];
      const pkgManifest = await loadBuildManifest(pkg);

      if (pkgManifest) {
        if (!this.manifest) {
          this.manifest = pkgManifest;
        } else {
          this.manifest.routes.push(...pkgManifest.routes);
          this.manifest.rewrites.push(...pkgManifest.rewrites);
          this.manifest.redirects.push(...pkgManifest.redirects);
        }

        this.normalizer.updateConfig({
          basePath: pkgManifest.basePath,
          trailingSlash: pkgManifest.trailingSlash ? 'always' : 'never',
          i18nLocales: pkgManifest.i18n?.locales || [],
          defaultLocale: pkgManifest.i18n?.defaultLocale || null,
        });

        for (const route of pkgManifest.routes) {
          this.graphBuilder.addRoute(route.pattern, {
            type: 'manifest-route',
            file: route.page,
            line: null,
            column: null,
            framework: pkg.frameworkType,
          }, {
            isApiRoute: route.page.includes('/api/'),
          });

          for (const prerendered of route.prerenderedPaths) {
            this.graphBuilder.addRoute(prerendered, {
              type: 'manifest-route',
              file: route.page,
              line: null,
              column: null,
              framework: pkg.frameworkType,
            });
          }
        }

        totalFindings += pkgManifest.routes.length;
      }

      this.progress('truth', ((i + 1) / this.projectMap!.packages.length) * 100);
    }

    this.layers.push({
      layer: 'truth',
      executed: true,
      duration: Date.now() - layerStart,
      findings: totalFindings,
    });
  }

  private async runRealityLayer(): Promise<void> {
    const layerStart = Date.now();

    this.progress('reality', 0);

    const seedUrls = this.getSeedUrls();
    const crawler = createCrawler({
      baseUrl: this.options.baseUrl!,
      config: {
        seedUrls,
        maxPages: 50,
        maxDepth: 4,
      },
      onProgress: (visited, total) => {
        this.progress('reality', (visited / total) * 100);
      },
    });

    try {
      this.crawlResults = await crawler.crawl();

      for (const result of this.crawlResults) {
        this.graphBuilder.addRoute(result.url, {
          type: 'discovered',
          file: null,
          line: null,
          column: null,
          framework: 'unknown',
        });

        for (const link of result.discoveredLinks) {
          this.graphBuilder.addEdge(
            `route_${result.url.replace(/[^a-zA-Z0-9]/g, '_')}`,
            link,
            {
              type: 'runtime-anchor',
              file: result.url,
              line: 0,
              column: 0,
              snippet: '',
              resolvedFrom: null,
            },
            'high',
            []
          );
        }
      }
    } catch (error) {
      console.error('Reality layer failed:', error);
    }

    this.layers.push({
      layer: 'reality',
      executed: true,
      duration: Date.now() - layerStart,
      findings: this.crawlResults.length,
    });
  }

  private async runRealitySniffLayer(): Promise<void> {
    const layerStart = Date.now();
    let totalFindings = 0;

    this.progress('reality-sniff', 0);

    try {
      const { scanRealitySniff } = await import('../reality-sniff/reality-sniff-scanner');
      
      const result = await scanRealitySniff({
        projectPath: this.options.projectPath,
        layers: {
          lexical: true,
          structural: true,
          runtime: false, // Runtime already covered by reality layer
        },
        verbose: this.options.verbose,
      });

      this.realitySniffFindings = result.findings;
      totalFindings = result.findings.length;

      // Add Reality Sniff blockers to ship blockers
      // This will be handled in buildReport
    } catch (error) {
      if (this.options.verbose) {
        console.warn('Reality Sniff layer failed:', error);
      }
    }

    this.progress('reality-sniff', 100);

    this.layers.push({
      layer: 'reality-sniff',
      executed: true,
      duration: Date.now() - layerStart,
      findings: totalFindings,
    });
  }

  private getSeedUrls(): string[] {
    const seeds = new Set<string>(['/']);

    for (const link of this.links) {
      if (link.confidence === 'high' && link.isLiteral && link.href.startsWith('/')) {
        seeds.add(link.href);
      }
    }

    if (this.manifest) {
      for (const route of this.manifest.routes) {
        if (!route.isDynamic) {
          seeds.add(route.pattern);
        }
        for (const prerendered of route.prerenderedPaths) {
          seeds.add(prerendered);
        }
      }
    }

    return Array.from(seeds).slice(0, 20);
  }

  private inferRouteFromFile(filePath: string, pkg: PackageInfo): string | null {
    const relativePath = path.relative(pkg.rootDir, filePath).replace(/\\/g, '/');

    const routeDirs = ['app', 'pages', 'src/app', 'src/pages', 'src/routes', 'routes'];
    
    for (const routeDir of routeDirs) {
      if (relativePath.startsWith(routeDir + '/')) {
        let routePath = relativePath.slice(routeDir.length);

        routePath = routePath
          .replace(/\/(page|route|index)\.(tsx?|jsx?|js)$/, '')
          .replace(/\.(tsx?|jsx?|js)$/, '')
          .replace(/\/index$/, '')
          .replace(/\([^)]+\)\//g, '')
          .replace(/@[^/]+\//g, '');

        routePath = this.normalizer.normalizeFileSystemPath(routePath).normalized;

        return routePath || '/';
      }
    }

    return null;
  }

  private buildReport(graph: NavigationGraph, startTime: number): RouteIntegrityReport {
    const verdictEngine = createVerdictEngine({
      graph,
      manifest: this.manifest,
      crawlResults: this.crawlResults,
      links: this.links,
      placeholders: this.placeholders,
      normalizer: this.normalizer,
    });

    const verdicts = verdictEngine.computeVerdicts();

    if (!this.options.layers.ast) {
      this.layers.push({ layer: 'ast', executed: false, duration: 0, findings: 0 });
    }
    if (!this.options.layers.truth) {
      this.layers.push({ layer: 'truth', executed: false, duration: 0, findings: 0 });
    }
    if (!this.options.layers.reality) {
      this.layers.push({ layer: 'reality', executed: false, duration: 0, findings: 0 });
    }
    if (!this.options.layers.realitySniff) {
      this.layers.push({ layer: 'reality-sniff', executed: false, duration: 0, findings: 0 });
    }

    // Merge Reality Sniff blockers into ship blockers
    const allShipBlockers = [...verdicts.shipBlockers];
    if (this.realitySniffFindings.length > 0) {
      const realitySniffBlockers = this.realitySniffFindings
        .filter(f => f.verdict === 'FAIL')
        .map(f => ({
          id: f.id,
          title: f.ruleName,
          description: f.message,
          severity: f.severity,
          file: f.file,
          line: f.line,
          column: f.column,
          fixSuggestion: f.fixSuggestion,
          category: 'reality-sniff',
          evidence: f.evidence,
        }));
      allShipBlockers.push(...realitySniffBlockers);
    }

    return {
      projectPath: this.options.projectPath,
      timestamp: new Date().toISOString(),
      packages: this.projectMap!.packages,
      graph,
      routeVerdicts: verdicts.routeVerdicts,
      linkVerdicts: verdicts.linkVerdicts,
      placeholders: this.placeholders,
      score: verdicts.score,
      shipBlockers: allShipBlockers,
      coverageMap: verdicts.coverageMap,
      executionTime: Date.now() - startTime,
      layers: this.layers,
      realitySniffFindings: this.realitySniffFindings,
    };
  }

  private progress(phase: string, percent: number): void {
    if (this.options.onProgress) {
      this.options.onProgress(phase, percent);
    }
    if (this.options.verbose) {
      console.log(`[${phase}] ${Math.round(percent)}%`);
    }
  }
}

export async function scanRouteIntegrity(options: ScanOptions): Promise<ScanResult> {
  const orchestrator = new RouteIntegrityOrchestrator(options);
  return orchestrator.scan();
}

export async function quickScan(projectPath: string): Promise<ScanResult> {
  return scanRouteIntegrity({
    projectPath,
    layers: { ast: true, truth: false, reality: false },
  });
}

export async function truthScan(projectPath: string): Promise<ScanResult> {
  return scanRouteIntegrity({
    projectPath,
    layers: { ast: true, truth: true, reality: false },
  });
}

export async function realityScan(projectPath: string, baseUrl: string): Promise<ScanResult> {
  return scanRouteIntegrity({
    projectPath,
    baseUrl,
    layers: { ast: true, truth: true, reality: true },
  });
}
