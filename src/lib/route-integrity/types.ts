/**
 * Route Integrity System - Core Types
 * 
 * Comprehensive type definitions for the navigation graph model,
 * route analysis, and verdict system.
 */

// ============================================================================
// FRAMEWORK & PROJECT TYPES
// ============================================================================

export type FrameworkType = 
  | 'next'
  | 'next-app'
  | 'next-pages'
  | 'remix'
  | 'react-router'
  | 'tanstack-router'
  | 'vite-spa'
  | 'gatsby'
  | 'astro'
  | 'nuxt'
  | 'sveltekit'
  | 'angular'
  | 'unknown';

export interface PackageInfo {
  name: string;
  frameworkType: FrameworkType;
  rootDir: string;
  tsconfigPath: string | null;
  buildOutputPath: string | null;
  entryPoints: string[];
  srcDir: string;
  routerType: 'file-based' | 'config-based' | 'hybrid' | 'unknown';
  hasAppRouter?: boolean;
  hasPagesRouter?: boolean;
}

export interface ProjectMap {
  rootDir: string;
  packages: PackageInfo[];
  isMonorepo: boolean;
  workspaceConfig: string | null;
  detectedAt: string;
  contentHash: string;
}

// ============================================================================
// ROUTE NORMALIZATION TYPES
// ============================================================================

export interface NormalizationConfig {
  trailingSlash: 'always' | 'never' | 'preserve';
  caseSensitive: boolean;
  basePath: string;
  i18nLocales: string[];
  defaultLocale: string | null;
}

export interface NormalizedRoute {
  raw: string;
  normalized: string;
  pattern: string;
  segments: RouteSegment[];
  hasParams: boolean;
  hasCatchAll: boolean;
  hasOptionalCatchAll: boolean;
  isIntercepting: boolean;
  routeGroup: string | null;
}

export interface RouteSegment {
  raw: string;
  normalized: string;
  type: 'static' | 'param' | 'catch-all' | 'optional-catch-all';
  paramName: string | null;
  isOptional: boolean;
}

// ============================================================================
// NAVIGATION GRAPH TYPES
// ============================================================================

export interface NavigationNode {
  id: string;
  pattern: string;
  concreteExamples: string[];
  source: RouteSource;
  metadata: NodeMetadata;
}

export interface RouteSource {
  type: 'file-route' | 'config-route' | 'manifest-route' | 'discovered';
  file: string | null;
  line: number | null;
  column: number | null;
  framework: FrameworkType;
}

export interface NodeMetadata {
  isLayout: boolean;
  isError: boolean;
  isLoading: boolean;
  isNotFound: boolean;
  hasGetServerSideProps: boolean;
  hasGetStaticProps: boolean;
  hasGetStaticPaths: boolean;
  generateStaticParams: boolean;
  isApiRoute: boolean;
  httpMethods: string[];
  middleware: string[];
}

export interface NavigationEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  targetPattern: string;
  targetLiteral: string | null;
  extraction: EdgeExtraction;
  confidence: 'high' | 'medium' | 'low';
  guards: EdgeGuard[];
}

export interface EdgeExtraction {
  type: ExtractionType;
  file: string;
  line: number;
  column: number;
  snippet: string;
  resolvedFrom: string | null;
}

export type ExtractionType = 
  | 'jsx-link'
  | 'jsx-navlink'
  | 'jsx-a-tag'
  | 'router-push'
  | 'router-replace'
  | 'router-navigate'
  | 'window-location'
  | 'config-route'
  | 'route-helper'
  | 'runtime-anchor';

export interface EdgeGuard {
  type: 'feature-flag' | 'auth-required' | 'role-check' | 'condition';
  expression: string;
  flagName: string | null;
}

export interface NavigationGraph {
  nodes: Map<string, NavigationNode>;
  edges: NavigationEdge[];
  entryPoints: string[];
  orphanNodes: string[];
  unreachableNodes: string[];
  metadata: GraphMetadata;
}

export interface GraphMetadata {
  totalRoutes: number;
  totalEdges: number;
  coveragePercent: number;
  clusters: RouteCluster[];
  crawledAt: string | null;
}

export interface RouteCluster {
  id: string;
  name: string;
  nodeIds: string[];
  isIsolated: boolean;
  requiresAuth: boolean;
}

// ============================================================================
// AST EXTRACTION TYPES
// ============================================================================

export interface ExtractedLink {
  type: ExtractionType;
  href: string;
  isLiteral: boolean;
  isDynamic: boolean;
  confidence: 'high' | 'medium' | 'low';
  location: SourceLocation;
  resolvedValue: string | null;
  templateParts: string[] | null;
  guards: EdgeGuard[];
}

export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

export interface ConstantResolution {
  identifier: string;
  value: string | null;
  isResolved: boolean;
  resolvedFrom: string | null;
  importPath: string | null;
}

export interface PlaceholderMatch {
  text: string;
  type: 'ui-visible' | 'comment' | 'variable-name' | 'string-literal';
  severity: 'high' | 'medium' | 'low';
  location: SourceLocation;
  context: string;
}

// ============================================================================
// BUILD TRUTH TYPES (FRAMEWORK MANIFESTS)
// ============================================================================

export interface BuildManifest {
  framework: FrameworkType;
  routes: ManifestRoute[];
  rewrites: RewriteRule[];
  redirects: RedirectRule[];
  basePath: string;
  i18n: I18nConfig | null;
  trailingSlash: boolean;
  buildTime: string;
}

export interface ManifestRoute {
  pattern: string;
  page: string;
  isStatic: boolean;
  isDynamic: boolean;
  prerenderedPaths: string[];
  dataRoute: string | null;
}

export interface RewriteRule {
  source: string;
  destination: string;
  permanent: boolean;
  basePath: boolean;
  locale: boolean;
}

export interface RedirectRule {
  source: string;
  destination: string;
  permanent: boolean;
  statusCode: number;
}

export interface I18nConfig {
  locales: string[];
  defaultLocale: string;
  localeDetection: boolean;
}

// ============================================================================
// PLAYWRIGHT CRAWL TYPES
// ============================================================================

export interface CrawlConfig {
  seedUrls: string[];
  maxDepth: number;
  maxPages: number;
  maxEdgesPerPage: number;
  followInternalLinksOnly: boolean;
  clickNavItems: boolean;
  blocklistPatterns: string[];
  authConfig: AuthConfig | null;
  screenshotOnFailure: boolean;
  timeout: number;
}

export interface AuthConfig {
  type: 'basic' | 'form' | 'cookie' | 'header';
  credentials: Record<string, string>;
  loginUrl: string | null;
  loginSelectors: Record<string, string>;
}

export interface CrawlResult {
  url: string;
  finalUrl: string;
  status: number;
  redirectChain: string[];
  consoleErrors: string[];
  networkErrors: NetworkError[];
  discoveredLinks: string[];
  placeholders: RuntimePlaceholder[];
  screenshot: string | null;
  loadTime: number;
}

export interface NetworkError {
  url: string;
  status: number;
  statusText: string;
  resourceType: string;
}

export interface RuntimePlaceholder {
  text: string;
  selector: string;
  isVisible: boolean;
  confidence: number;
}

// ============================================================================
// VERDICT TYPES
// ============================================================================

export type VerdictType = 
  | 'dead-runtime'
  | 'dead-static'
  | 'orphan'
  | 'dynamic-unresolved'
  | 'hidden-guarded'
  | 'dead-end'
  | 'healthy';

export interface RouteVerdict {
  nodeId: string;
  pattern: string;
  verdict: VerdictType;
  certainty: 'proven' | 'inferred' | 'suspected';
  evidence: VerdictEvidence[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export interface VerdictEvidence {
  type: string;
  description: string;
  source: string;
  data: Record<string, unknown>;
}

export interface LinkVerdict {
  edgeId: string;
  sourceFile: string;
  targetHref: string;
  verdict: VerdictType;
  certainty: 'proven' | 'inferred' | 'suspected';
  evidence: VerdictEvidence[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

// ============================================================================
// SCORING & REPORT TYPES
// ============================================================================

export interface RouteHealthScore {
  overall: number;
  breakdown: ScoreBreakdown;
  confidence: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface ScoreBreakdown {
  deadLinks: { count: number; penalty: number };
  orphanRoutes: { count: number; penalty: number };
  unresolvedDynamic: { count: number; penalty: number };
  runtimeFailures: { count: number; penalty: number };
  placeholders: { count: number; penalty: number };
}

export interface RouteIntegrityReport {
  projectPath: string;
  timestamp: string;
  packages: PackageInfo[];
  graph: NavigationGraph;
  routeVerdicts: RouteVerdict[];
  linkVerdicts: LinkVerdict[];
  placeholders: PlaceholderMatch[];
  score: RouteHealthScore;
  shipBlockers: ShipBlocker[];
  coverageMap: CoverageMap;
  executionTime: number;
  layers: LayerExecution[];
}

export interface ShipBlocker {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium';
  title: string;
  description: string;
  file: string | null;
  line: number | null;
  fixSuggestion: string | null;
}

export interface CoverageMap {
  totalShippedRoutes: number;
  reachableFromRoot: number;
  coveragePercent: number;
  isolatedClusters: RouteCluster[];
  unreachableRoutes: string[];
}

export interface LayerExecution {
  layer: 'ast' | 'truth' | 'reality';
  executed: boolean;
  duration: number;
  findings: number;
}

// ============================================================================
// CACHE TYPES
// ============================================================================

export interface FileCache {
  path: string;
  contentHash: string;
  extractedLinks: ExtractedLink[];
  placeholders: PlaceholderMatch[];
  lastParsed: string;
  mtime?: string; // File modification time for fast cache invalidation
}

export interface ProjectCache {
  projectMap: ProjectMap;
  fileCaches: Map<string, FileCache>;
  buildManifest: BuildManifest | null;
  lastCrawl: CrawlResult[] | null;
  savedAt: string;
}

// ============================================================================
// OUTPUT FORMAT TYPES
// ============================================================================

export interface SarifReport {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

export interface SarifRun {
  tool: { driver: SarifDriver };
  results: SarifResult[];
}

export interface SarifDriver {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifRule[];
}

export interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  defaultConfiguration: { level: string };
}

export interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: SarifLocation[];
}

export interface SarifLocation {
  physicalLocation: {
    artifactLocation: { uri: string };
    region: { startLine: number; startColumn: number };
  };
}
