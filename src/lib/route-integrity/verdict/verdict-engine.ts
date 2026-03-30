/**
 * Phase 4: Verdict System (Enhanced for Low False Positive Rate)
 * 
 * Classifies findings by certainty:
 * - DEAD (proof): runtime 404 from Playwright crawl
 * - DEAD (static): literal link href has no matching route in manifest (LINKS ONLY, not routes)
 * - ORPHAN (truth): page route with no incoming navigation (excludes API, layouts, special files)
 * - DYNAMIC (review): unresolved/template href; needs human check
 * - HIDDEN (guarded): links/routes behind flag/auth; conditional reachability
 * - DEAD END (runtime): route loads but has no onward nav paths
 * 
 * FALSE POSITIVE PREVENTION:
 * - Routes that exist in filesystem are NEVER flagged as dead-static (only links can be dead)
 * - API routes, layouts, error pages, loading pages are excluded from orphan detection
 * - External links, anchor links, hash-only links are ignored
 * - Dynamic route segments are matched with patterns
 * - Next.js special files (opengraph, twitter, robots, sitemap) are excluded
 */

import {
  NavigationGraph,
  NavigationNode,
  NavigationEdge,
  BuildManifest,
  CrawlResult,
  ExtractedLink,
  PlaceholderMatch,
  RouteVerdict,
  LinkVerdict,
  VerdictType,
  VerdictEvidence,
  RouteHealthScore,
  ScoreBreakdown,
  ShipBlocker,
  CoverageMap,
} from '../types';
import { RouteNormalizer } from '../normalization/route-normalizer';

interface VerdictContext {
  graph: NavigationGraph;
  manifest: BuildManifest | null;
  crawlResults: CrawlResult[];
  links: ExtractedLink[];
  placeholders: PlaceholderMatch[];
  normalizer: RouteNormalizer;
}

interface VerdictResult {
  routeVerdicts: RouteVerdict[];
  linkVerdicts: LinkVerdict[];
  score: RouteHealthScore;
  shipBlockers: ShipBlocker[];
  coverageMap: CoverageMap;
}

const SCORE_WEIGHTS = {
  deadRuntime: 15,
  deadStatic: 10,
  orphan: 5,
  dynamicUnresolved: 2,
  hiddenGuarded: 1,
  deadEnd: 3,
  placeholderUI: 8,
  placeholderCode: 1,
};

// Files/patterns that should NEVER be flagged
const EXCLUDED_FILE_PATTERNS = [
  /layout\.(tsx?|jsx?)$/,
  /error\.(tsx?|jsx?)$/,
  /loading\.(tsx?|jsx?)$/,
  /not-found\.(tsx?|jsx?)$/,
  /template\.(tsx?|jsx?)$/,
  /default\.(tsx?|jsx?)$/,
  /route\.(tsx?|jsx?)$/,
  /opengraph-image\.(tsx?|jsx?|png|jpg)$/,
  /twitter-image\.(tsx?|jsx?|png|jpg)$/,
  /icon\.(tsx?|jsx?|png|ico)$/,
  /apple-icon\.(tsx?|jsx?|png)$/,
  /robots\.(tsx?|txt)$/,
  /sitemap\.(tsx?|xml)$/,
  /manifest\.(tsx?|json)$/,
  /_app\.(tsx?|jsx?)$/,
  /_document\.(tsx?|jsx?)$/,
  /_error\.(tsx?|jsx?)$/,
  /middleware\.(tsx?|jsx?)$/,
  /global-error\.(tsx?|jsx?)$/,
];

// Route patterns that should be excluded from orphan detection
const EXCLUDED_ROUTE_PATTERNS = [
  /^\/api\//,           // API routes - not navigable
  /^\/opengraph/,       // OpenGraph images
  /^\/twitter/,         // Twitter images
  /^\/_/,               // Next.js internal routes
  /\/robots(\.txt)?$/,  // robots.txt
  /\/sitemap(\.xml)?$/, // sitemap.xml
  /\/favicon/,          // favicons
  /\/manifest/,         // PWA manifest
];

// Links that should be ignored (not flagged as dead)
const IGNORED_LINK_PATTERNS = [
  /^https?:\/\//,       // External links
  /^mailto:/,           // Email links
  /^tel:/,              // Phone links
  /^#/,                 // Anchor-only links
  /^javascript:/,       // JavaScript links
  /^\$\{/,              // Unresolved template literals
  /^{{/,                // Template syntax
  /\[.*\]/,             // Contains unresolved dynamic segments like [id]
];

export class VerdictEngine {
  private context: VerdictContext;

  constructor(context: VerdictContext) {
    this.context = context;
  }

  computeVerdicts(): VerdictResult {
    const routeVerdicts = this.computeRouteVerdicts();
    const linkVerdicts = this.computeLinkVerdicts();
    const score = this.computeScore(routeVerdicts, linkVerdicts);
    const shipBlockers = this.identifyShipBlockers(routeVerdicts, linkVerdicts);
    const coverageMap = this.computeCoverageMap();

    return {
      routeVerdicts,
      linkVerdicts,
      score,
      shipBlockers,
      coverageMap,
    };
  }

  private computeRouteVerdicts(): RouteVerdict[] {
    const verdicts: RouteVerdict[] = [];
    const nodes = Array.from(this.context.graph.nodes.values());

    for (const node of nodes) {
      // Skip special Next.js files that are not navigable routes
      if (this.shouldExcludeRoute(node)) {
        continue;
      }

      const verdict = this.classifyRoute(node);
      verdicts.push(verdict);
    }

    return verdicts;
  }

  /**
   * Check if a route should be excluded from verdicts entirely
   * This prevents false positives for layouts, API routes, special files, etc.
   */
  private shouldExcludeRoute(node: NavigationNode): boolean {
    // Exclude layout, error, loading, not-found pages
    if (node.metadata.isLayout || node.metadata.isError || 
        node.metadata.isLoading || node.metadata.isNotFound) {
      return true;
    }

    // Exclude API routes (they're not navigable)
    if (node.metadata.isApiRoute) {
      return true;
    }

    // Check file patterns
    const sourceFile = node.source.file || '';
    for (const pattern of EXCLUDED_FILE_PATTERNS) {
      if (pattern.test(sourceFile)) {
        return true;
      }
    }

    // Check route patterns
    for (const pattern of EXCLUDED_ROUTE_PATTERNS) {
      if (pattern.test(node.pattern)) {
        return true;
      }
    }

    return false;
  }

  private classifyRoute(node: NavigationNode): RouteVerdict {
    const crawlResult = this.findCrawlResult(node.pattern);
    const incomingEdges = this.context.graph.edges.filter(e => e.targetNodeId === node.id);
    const outgoingEdges = this.context.graph.edges.filter(e => e.sourceNodeId === node.id);

    // DEAD-RUNTIME: Only if we have actual runtime proof from Playwright
    if (crawlResult && crawlResult.status >= 400) {
      return this.createVerdict(node, 'dead-runtime', 'proven', 'critical', [
        {
          type: 'runtime-404',
          description: `Route returned HTTP ${crawlResult.status}`,
          source: 'playwright-crawl',
          data: { status: crawlResult.status, url: crawlResult.url },
        },
      ]);
    }

    // DEAD-END: Route loads but has no outgoing navigation (only with runtime proof)
    if (crawlResult && crawlResult.status === 200 && outgoingEdges.length === 0 &&
        crawlResult.discoveredLinks.length === 0 && node.pattern !== '/') {
      return this.createVerdict(node, 'dead-end', 'proven', 'medium', [
        {
          type: 'dead-end',
          description: 'Route has no outgoing navigation links',
          source: 'playwright-crawl',
          data: { discoveredLinks: 0 },
        },
      ]);
    }

    // NOTE: We do NOT flag routes as dead-static anymore!
    // Routes exist in the filesystem, so they are valid.
    // Only LINKS can be dead (pointing to non-existent routes).

    // ORPHAN: Route has no incoming links (but only for page routes, not API/special files)
    const highConfidenceIncoming = incomingEdges.filter(e => e.confidence === 'high');
    if (highConfidenceIncoming.length === 0 && node.pattern !== '/') {
      // Check if this is a valid orphan candidate (page route, not special file)
      if (!this.isOrphanCandidate(node)) {
        // Not a valid orphan candidate, mark as healthy
        return this.createVerdict(node, 'healthy', 'proven', 'info', [
          {
            type: 'healthy',
            description: 'Special route (no incoming links expected)',
            source: 'analysis',
            data: {},
          },
        ]);
      }

      const guardedEdges = incomingEdges.filter(e => e.guards.length > 0);
      
      if (guardedEdges.length > 0) {
        return this.createVerdict(node, 'hidden-guarded', 'inferred', 'low', [
          {
            type: 'guarded-access',
            description: 'Route only reachable via guarded links',
            source: 'ast-analysis',
            data: { guards: guardedEdges.map(e => e.guards) },
          },
        ]);
      }

      // Only flag as orphan if it's a real page route with no incoming links
      return this.createVerdict(node, 'orphan', 'inferred', 'low', [
        {
          type: 'no-incoming-links',
          description: 'Page route has no incoming navigation links',
          source: 'navigation-graph',
          data: { incomingCount: incomingEdges.length },
        },
      ]);
    }

    return this.createVerdict(node, 'healthy', 'proven', 'info', [
      {
        type: 'healthy',
        description: 'Route is reachable and functioning',
        source: 'analysis',
        data: {},
      },
    ]);
  }

  /**
   * Check if a route is a valid candidate for orphan detection
   * Only real page routes should be flagged as orphans
   */
  private isOrphanCandidate(node: NavigationNode): boolean {
    const sourceFile = node.source.file || '';
    const pattern = node.pattern;

    // Must be from a page.tsx file (not layout, route, etc.)
    if (!sourceFile.includes('page.')) {
      return false;
    }

    // Exclude routes that typically don't need incoming links
    const excludedPatterns = [
      /^\/$/,                    // Home page (always reachable via direct URL)
      /^\/404$/,                 // 404 page
      /^\/500$/,                 // 500 page
      /^\/error/,                // Error pages
      /^\/login/,                // Auth pages are entry points
      /^\/signup/,               // Auth pages are entry points
      /^\/register/,             // Auth pages are entry points
      /^\/auth/,                 // Auth pages
      /^\/signin/,               // Auth pages
      /^\/forgot/,               // Auth pages
      /^\/reset/,                // Auth pages
      /^\/verify/,               // Verification pages
      /^\/callback/,             // OAuth callbacks
      /^\/share/,                // Share pages (accessed via external links)
      /^\/embed/,                // Embed pages
      /^\/preview/,              // Preview pages
      /^\/og/,                   // OpenGraph pages
      /^\/legal/,                // Legal pages (often accessed directly)
      /^\/terms/,                // Terms pages
      /^\/privacy/,              // Privacy pages
    ];

    for (const p of excludedPatterns) {
      if (p.test(pattern)) {
        return false;
      }
    }

    return true;
  }

  private computeLinkVerdicts(): LinkVerdict[] {
    const verdicts: LinkVerdict[] = [];

    for (const link of this.context.links) {
      // Skip links that should be ignored (external, mailto, etc.)
      if (this.shouldIgnoreLink(link)) {
        continue;
      }

      const verdict = this.classifyLink(link);
      verdicts.push(verdict);
    }

    return verdicts;
  }

  /**
   * Check if a link should be ignored entirely
   * External links, anchor links, etc. should not be flagged
   */
  private shouldIgnoreLink(link: ExtractedLink): boolean {
    const href = link.resolvedValue || link.href;

    // Check against ignored patterns
    for (const pattern of IGNORED_LINK_PATTERNS) {
      if (pattern.test(href)) {
        return true;
      }
    }

    // Ignore empty or whitespace-only hrefs
    if (!href || href.trim() === '') {
      return true;
    }

    // Ignore data: URLs
    if (href.startsWith('data:')) {
      return true;
    }

    // Ignore blob: URLs
    if (href.startsWith('blob:')) {
      return true;
    }

    return false;
  }

  private classifyLink(link: ExtractedLink): LinkVerdict {
    const targetHref = link.resolvedValue || link.href;
    const crawlResult = this.findCrawlResult(targetHref);

    // DEAD-RUNTIME: Only if we have actual runtime proof from Playwright
    if (crawlResult && crawlResult.status >= 400) {
      return this.createLinkVerdict(link, 'dead-runtime', 'proven', 'critical', [
        {
          type: 'runtime-404',
          description: `Link target returned HTTP ${crawlResult.status}`,
          source: 'playwright-crawl',
          data: { status: crawlResult.status, url: targetHref },
        },
      ]);
    }

    // DYNAMIC-UNRESOLVED: Link has dynamic parts that couldn't be resolved
    if (link.isDynamic && !link.isLiteral) {
      return this.createLinkVerdict(link, 'dynamic-unresolved', 'suspected', 'low', [
        {
          type: 'dynamic-href',
          description: 'Link href contains unresolved dynamic values',
          source: 'ast-analysis',
          data: { href: link.href, templateParts: link.templateParts },
        },
      ]);
    }

    // DEAD-STATIC: Literal link with no matching route
    // BUT only if we have a manifest AND the link is truly literal AND route matching fails
    if (link.isLiteral && this.context.manifest) {
      const normalizedHref = this.normalizeHref(targetHref);
      const hasRouteMatch = this.findManifestMatch(normalizedHref);
      const hasGraphMatch = this.findGraphMatch(normalizedHref);
      
      // Only flag as dead if BOTH manifest and graph checks fail
      // This reduces false positives significantly
      if (!hasRouteMatch && !hasGraphMatch) {
        // Additional check: make sure this isn't a hash link to an existing route
        if (!this.isHashLinkToValidRoute(targetHref)) {
          return this.createLinkVerdict(link, 'dead-static', 'inferred', 'high', [
            {
              type: 'no-route-match',
              description: 'Literal link href has no matching route in manifest',
              source: 'build-manifest',
              data: { href: targetHref },
            },
          ]);
        }
      }
    }

    // HIDDEN-GUARDED: Link behind a condition
    if (link.guards.length > 0) {
      return this.createLinkVerdict(link, 'hidden-guarded', 'proven', 'info', [
        {
          type: 'conditional-link',
          description: 'Link is conditionally rendered',
          source: 'ast-analysis',
          data: { guards: link.guards },
        },
      ]);
    }

    return this.createLinkVerdict(link, 'healthy', 'proven', 'info', [
      {
        type: 'healthy',
        description: 'Link target is valid',
        source: 'analysis',
        data: {},
      },
    ]);
  }

  /**
   * Normalize href for matching
   */
  private normalizeHref(href: string): string {
    // Remove hash
    const withoutHash = href.split('#')[0];
    // Remove query params
    const withoutQuery = withoutHash.split('?')[0];
    // Ensure leading slash
    const normalized = withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
    // Remove trailing slash (except for root)
    return normalized === '/' ? normalized : normalized.replace(/\/$/, '');
  }

  /**
   * Check if link is a hash link to a valid route (e.g., /about#team)
   */
  private isHashLinkToValidRoute(href: string): boolean {
    if (!href.includes('#')) return false;
    
    const basePath = href.split('#')[0];
    if (!basePath) return true; // Hash-only link like #section
    
    return this.findManifestMatch(basePath) || this.findGraphMatch(basePath);
  }

  /**
   * Check if there's a matching node in the navigation graph
   */
  private findGraphMatch(pattern: string): boolean {
    const normalizedPattern = this.normalizeHref(pattern);
    
    for (const node of Array.from(this.context.graph.nodes.values())) {
      // Direct match
      if (node.pattern === normalizedPattern) return true;
      
      // Try normalizer matching
      if (this.context.normalizer.matches(node.pattern, normalizedPattern)) {
        return true;
      }
      
      // Check concrete examples
      for (const example of node.concreteExamples || []) {
        if (example === normalizedPattern) return true;
      }
    }
    
    return false;
  }

  private createVerdict(
    node: NavigationNode,
    verdict: VerdictType,
    certainty: RouteVerdict['certainty'],
    severity: RouteVerdict['severity'],
    evidence: VerdictEvidence[]
  ): RouteVerdict {
    return {
      nodeId: node.id,
      pattern: node.pattern,
      verdict,
      certainty,
      severity,
      evidence,
    };
  }

  private createLinkVerdict(
    link: ExtractedLink,
    verdict: VerdictType,
    certainty: LinkVerdict['certainty'],
    severity: LinkVerdict['severity'],
    evidence: VerdictEvidence[]
  ): LinkVerdict {
    return {
      edgeId: `link_${link.location.file}_${link.location.line}`,
      sourceFile: link.location.file,
      targetHref: link.resolvedValue || link.href,
      verdict,
      certainty,
      severity,
      evidence,
    };
  }

  private findCrawlResult(pattern: string): CrawlResult | null {
    for (const result of this.context.crawlResults) {
      if (result.url === pattern || result.finalUrl === pattern) {
        return result;
      }

      if (this.context.normalizer.matches(result.url, pattern) ||
          this.context.normalizer.matches(result.finalUrl, pattern)) {
        return result;
      }
    }
    return null;
  }

  private findManifestMatch(pattern: string): boolean {
    if (!this.context.manifest) return true;

    for (const route of this.context.manifest.routes) {
      if (this.context.normalizer.matches(route.pattern, pattern)) {
        return true;
      }
      for (const prerendered of route.prerenderedPaths) {
        if (this.context.normalizer.matches(prerendered, pattern)) {
          return true;
        }
      }
    }

    for (const rewrite of this.context.manifest.rewrites) {
      if (this.context.normalizer.patternMatches(rewrite.source, pattern)) {
        return true;
      }
    }

    return false;
  }

  private computeScore(
    routeVerdicts: RouteVerdict[],
    linkVerdicts: LinkVerdict[]
  ): RouteHealthScore {
    let totalPenalty = 0;
    const breakdown: ScoreBreakdown = {
      deadLinks: { count: 0, penalty: 0 },
      orphanRoutes: { count: 0, penalty: 0 },
      unresolvedDynamic: { count: 0, penalty: 0 },
      runtimeFailures: { count: 0, penalty: 0 },
      placeholders: { count: 0, penalty: 0 },
    };

    for (const verdict of routeVerdicts) {
      switch (verdict.verdict) {
        case 'dead-runtime':
          breakdown.runtimeFailures.count++;
          breakdown.runtimeFailures.penalty += SCORE_WEIGHTS.deadRuntime;
          totalPenalty += SCORE_WEIGHTS.deadRuntime;
          break;
        case 'dead-static':
          breakdown.deadLinks.count++;
          breakdown.deadLinks.penalty += SCORE_WEIGHTS.deadStatic;
          totalPenalty += SCORE_WEIGHTS.deadStatic;
          break;
        case 'orphan':
          breakdown.orphanRoutes.count++;
          breakdown.orphanRoutes.penalty += SCORE_WEIGHTS.orphan;
          totalPenalty += SCORE_WEIGHTS.orphan;
          break;
        case 'dead-end':
          breakdown.deadLinks.count++;
          breakdown.deadLinks.penalty += SCORE_WEIGHTS.deadEnd;
          totalPenalty += SCORE_WEIGHTS.deadEnd;
          break;
      }
    }

    for (const verdict of linkVerdicts) {
      switch (verdict.verdict) {
        case 'dead-runtime':
          breakdown.runtimeFailures.count++;
          breakdown.runtimeFailures.penalty += SCORE_WEIGHTS.deadRuntime;
          totalPenalty += SCORE_WEIGHTS.deadRuntime;
          break;
        case 'dead-static':
          breakdown.deadLinks.count++;
          breakdown.deadLinks.penalty += SCORE_WEIGHTS.deadStatic;
          totalPenalty += SCORE_WEIGHTS.deadStatic;
          break;
        case 'dynamic-unresolved':
          breakdown.unresolvedDynamic.count++;
          breakdown.unresolvedDynamic.penalty += SCORE_WEIGHTS.dynamicUnresolved;
          totalPenalty += SCORE_WEIGHTS.dynamicUnresolved;
          break;
      }
    }

    for (const placeholder of this.context.placeholders) {
      breakdown.placeholders.count++;
      const weight = placeholder.type === 'ui-visible' 
        ? SCORE_WEIGHTS.placeholderUI 
        : SCORE_WEIGHTS.placeholderCode;
      breakdown.placeholders.penalty += weight;
      totalPenalty += weight;
    }

    const score = Math.max(0, Math.min(100, 100 - totalPenalty));
    const grade = this.computeGrade(score);
    const confidence = this.computeConfidence(routeVerdicts, linkVerdicts);

    return {
      overall: score,
      breakdown,
      confidence,
      grade,
    };
  }

  private computeGrade(score: number): RouteHealthScore['grade'] {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private computeConfidence(
    routeVerdicts: RouteVerdict[],
    linkVerdicts: LinkVerdict[]
  ): number {
    const allVerdicts = [...routeVerdicts, ...linkVerdicts];
    if (allVerdicts.length === 0) return 100;

    const provenCount = allVerdicts.filter(v => v.certainty === 'proven').length;
    const inferredCount = allVerdicts.filter(v => v.certainty === 'inferred').length;
    const suspectedCount = allVerdicts.filter(v => v.certainty === 'suspected').length;

    const weightedScore = (provenCount * 1.0 + inferredCount * 0.7 + suspectedCount * 0.4) 
                         / allVerdicts.length;

    return Math.round(weightedScore * 100);
  }

  /**
   * Get confidence score for a verdict based on its certainty
   * Confidence threshold: ≥0.8 for FAIL verdicts (blockers)
   */
  private getConfidenceForVerdict(certainty: RouteVerdict['certainty'] | LinkVerdict['certainty']): number {
    switch (certainty) {
      case 'proven': return 1.0;
      case 'inferred': return 0.7;
      case 'suspected': return 0.4;
      default: return 0.5;
    }
  }

  private identifyShipBlockers(
    routeVerdicts: RouteVerdict[],
    linkVerdicts: LinkVerdict[]
  ): ShipBlocker[] {
    const FAIL_CONFIDENCE_THRESHOLD = 0.8;
    const blockers: ShipBlocker[] = [];
    let blockerCounter = 0;
    const seenLinks = new Set<string>(); // Deduplicate by target href

    // Route blockers - only for PROVEN issues (runtime 404s) with high confidence
    for (const verdict of routeVerdicts) {
      const confidence = this.getConfidenceForVerdict(verdict.certainty);
      // Only include runtime-proven issues as blockers if confidence >= threshold
      if (verdict.verdict === 'dead-runtime' && verdict.certainty === 'proven' && confidence >= FAIL_CONFIDENCE_THRESHOLD) {
        const node = this.context.graph.nodes.get(verdict.nodeId);
        blockers.push({
          id: `blocker_${blockerCounter++}`,
          type: verdict.verdict,
          severity: 'critical',
          title: this.getBlockerTitle(verdict.verdict),
          description: verdict.evidence[0]?.description || 'Route returned error',
          file: node?.source.file || null,
          line: node?.source.line || null,
          fixSuggestion: this.getFixSuggestion(verdict.verdict),
        });
      }
    }

    // Link blockers - only for dead links with high confidence (≥0.8)
    for (const verdict of linkVerdicts) {
      // Skip if we've already seen this target href
      if (seenLinks.has(verdict.targetHref)) continue;
      
      const confidence = this.getConfidenceForVerdict(verdict.certainty);
      
      // Only include critical/high severity AND high confidence (≥0.8)
      if ((verdict.severity === 'critical' || verdict.severity === 'high') && confidence >= FAIL_CONFIDENCE_THRESHOLD) {
        // Runtime 404s are definite blockers (proven = 1.0 confidence)
        if (verdict.verdict === 'dead-runtime') {
          seenLinks.add(verdict.targetHref);
          blockers.push({
            id: `blocker_${blockerCounter++}`,
            type: verdict.verdict,
            severity: 'critical',
            title: 'Dead Link (Runtime 404)',
            description: `Link to ${verdict.targetHref} returned 404`,
            file: verdict.sourceFile,
            line: null,
            fixSuggestion: 'Create the missing route or update the link',
          });
        }
        // Static dead links - only if they look like real navigation links AND high confidence
        // Note: inferred certainty (0.7) is below threshold, so only proven (1.0) will pass
        else if (verdict.verdict === 'dead-static' && this.isLikelyRealDeadLink(verdict) && confidence >= FAIL_CONFIDENCE_THRESHOLD) {
          seenLinks.add(verdict.targetHref);
          blockers.push({
            id: `blocker_${blockerCounter++}`,
            type: verdict.verdict,
            severity: 'high',
            title: 'Dead Link (No Route)',
            description: `Link to ${verdict.targetHref} has no matching route`,
            file: verdict.sourceFile,
            line: null,
            fixSuggestion: this.getFixSuggestion(verdict.verdict),
          });
        }
      }
    }

    for (const placeholder of this.context.placeholders) {
      if (placeholder.severity === 'high') {
        blockers.push({
          id: `blocker_${blockerCounter++}`,
          type: 'placeholder',
          severity: 'high',
          title: 'Visible Placeholder Text',
          description: `"${placeholder.text.slice(0, 50)}..." visible in UI`,
          file: placeholder.location.file,
          line: placeholder.location.line,
          fixSuggestion: 'Replace placeholder text with actual content',
        });
      }
    }

    blockers.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2 };
      return (severityOrder[a.severity] || 3) - (severityOrder[b.severity] || 3);
    });

    return blockers.slice(0, 20);
  }

  /**
   * Check if a dead link verdict is likely a real issue vs false positive
   * This adds an extra layer of filtering to reduce noise
   */
  private isLikelyRealDeadLink(verdict: LinkVerdict): boolean {
    const href = verdict.targetHref;

    // Skip very short hrefs (likely placeholders or dynamic)
    if (href.length < 2) return false;

    // Skip hrefs that look like unresolved variables
    if (href.includes('${') || href.includes('{{') || href.includes('[')) {
      return false;
    }

    // Skip hrefs that are just punctuation or special chars
    if (/^[^a-zA-Z0-9]+$/.test(href)) return false;

    // Skip hrefs that look like they might be config/env values
    if (href.includes('process.env') || href.includes('import.meta')) {
      return false;
    }

    // Skip common patterns that are often false positives
    const falsePositivePatterns = [
      /^\/\//,              // Protocol-relative URLs
      /^\./,                // Relative paths like ./foo
      /^undefined$/,        // Undefined values
      /^null$/,             // Null values
      /^NaN$/,              // NaN values
      /^true$/,             // Boolean values
      /^false$/,            // Boolean values
      /\s/,                 // Contains whitespace (likely not a real URL)
    ];

    for (const pattern of falsePositivePatterns) {
      if (pattern.test(href)) return false;
    }

    // Must start with / to be a valid internal route
    if (!href.startsWith('/')) return false;

    // Must look like a reasonable route path
    // Valid: /dashboard, /user/profile, /api/v1/users
    // Invalid: /{{variable}}, /${id}
    if (!/^\/[a-zA-Z0-9\-_\/]+$/.test(href.split('?')[0].split('#')[0])) {
      return false;
    }

    return true;
  }

  private getBlockerTitle(verdict: VerdictType): string {
    switch (verdict) {
      case 'dead-runtime': return 'Runtime 404 Error';
      case 'dead-static': return 'Dead Link (No Route)';
      case 'orphan': return 'Orphan Route';
      case 'dead-end': return 'Dead End Page';
      default: return 'Route Issue';
    }
  }

  private getFixSuggestion(verdict: VerdictType): string {
    switch (verdict) {
      case 'dead-runtime':
        return 'Create the missing route or fix the redirect';
      case 'dead-static':
        return 'Update the link href or create the target route';
      case 'orphan':
        return 'Add navigation links to this route or remove it';
      case 'dead-end':
        return 'Add navigation links from this page';
      default:
        return 'Review and fix the issue';
    }
  }

  private computeCoverageMap(): CoverageMap {
    const allRoutes = Array.from(this.context.graph.nodes.values()).filter(
      n => !n.metadata.isLayout && !n.metadata.isError &&
           !n.metadata.isLoading && !n.metadata.isNotFound
    );

    const reachableFromRoot = allRoutes.length - this.context.graph.unreachableNodes.length;
    const coveragePercent = allRoutes.length > 0
      ? Math.round((reachableFromRoot / allRoutes.length) * 100)
      : 100;

    const isolatedClusters = this.context.graph.metadata.clusters.filter(c => c.isIsolated);
    const unreachableRoutes = this.context.graph.unreachableNodes.map(id => {
      const node = this.context.graph.nodes.get(id);
      return node?.pattern || id;
    });

    return {
      totalShippedRoutes: allRoutes.length,
      reachableFromRoot,
      coveragePercent,
      isolatedClusters,
      unreachableRoutes,
    };
  }
}

export function createVerdictEngine(context: VerdictContext): VerdictEngine {
  return new VerdictEngine(context);
}

export function computeVerdicts(context: VerdictContext): VerdictResult {
  const engine = new VerdictEngine(context);
  return engine.computeVerdicts();
}
