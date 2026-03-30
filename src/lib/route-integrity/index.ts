/**
 * Route Integrity System - Main Export
 * 
 * Comprehensive route analysis for frontend applications:
 * - Project discovery (monorepo-grade)
 * - Canonical route normalization
 * - Navigation graph model
 * - AST + TypeChecker analysis
 * - Build manifest truth
 * - Playwright reality proof
 * - Verdict system with scoring
 * - Multi-format reporting
 */

export * from './types';

export { 
  ProjectDiscovery, 
  discoverProject 
} from './discovery/project-discovery';

export { 
  RouteNormalizer, 
  createNormalizer, 
  normalizeRoute, 
  normalizeFileRoute, 
  routesMatch 
} from './normalization/route-normalizer';

export { 
  NavigationGraphBuilder, 
  createNavigationGraph, 
  mergeGraphs, 
  computeNavigationCoverage 
} from './graph/navigation-graph';

export { 
  LinkExtractor, 
  createLinkExtractor, 
  extractLinksFromFile 
} from './ast/link-extractor';

export { 
  FileScanner, 
  createFileScanner, 
  scanPackage 
} from './ast/file-scanner';

export { 
  loadBuildManifest,
  NextJsAdapter,
  createNextAdapter,
  ReactRouterAdapter,
  createReactRouterAdapter,
  getAdapter,
} from './truth/framework-adapters';

export { 
  PlaywrightCrawler, 
  createCrawler, 
  crawlSite, 
  verifySingleRoute 
} from './reality/playwright-crawler';

export { 
  VerdictEngine, 
  createVerdictEngine, 
  computeVerdicts 
} from './verdict/verdict-engine';

export { 
  ReportGenerator, 
  createReportGenerator, 
  generateReports 
} from './reporting/report-generator';

export { 
  RouteIntegrityOrchestrator, 
  scanRouteIntegrity, 
  quickScan, 
  truthScan, 
  realityScan 
} from './orchestrator';

export type { ScanOptions, ScanResult } from './orchestrator';
