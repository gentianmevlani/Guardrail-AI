/**
 * Phase 3: Reality Proof - Playwright Crawler
 * 
 * Proves route integrity through runtime verification:
 * - Crawls with BFS from seed routes
 * - Captures HTTP status, redirects, console errors, network 404s
 * - Detects runtime placeholders in rendered DOM
 * - Smart crawling with depth/page limits and blocklist
 */

import {
  CrawlConfig,
  CrawlResult,
  RuntimePlaceholder,
  NetworkError,
  AuthConfig,
} from '../types';

const DEFAULT_CONFIG: CrawlConfig = {
  seedUrls: ['/'],
  maxDepth: 5,
  maxPages: 100,
  maxEdgesPerPage: 50,
  followInternalLinksOnly: true,
  clickNavItems: true,
  blocklistPatterns: [
    '/logout',
    '/signout',
    '/delete',
    '/remove',
    '/api/',
    '/_next/',
    '/static/',
    '.pdf',
    '.zip',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.ico',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ],
  authConfig: null,
  screenshotOnFailure: true,
  timeout: 30000,
};

const PLACEHOLDER_SELECTORS = [
  '[data-placeholder]',
  '[data-coming-soon]',
  '.coming-soon',
  '.placeholder',
  '.wip',
  '.under-construction',
  '.not-implemented',
];

const PLACEHOLDER_TEXT_PATTERNS = [
  /coming\s*soon/i,
  /not\s*implemented/i,
  /under\s*construction/i,
  /work\s*in\s*progress/i,
  /placeholder/i,
  /todo/i,
  /tbd/i,
  /lorem\s*ipsum/i,
  /feature\s*not\s*available/i,
  /page\s*not\s*found/i,
];

export interface CrawlerOptions {
  baseUrl: string;
  config?: Partial<CrawlConfig>;
  onProgress?: (visited: number, total: number) => void;
}

export class PlaywrightCrawler {
  private config: CrawlConfig;
  private baseUrl: string;
  private visited: Set<string> = new Set();
  private results: Map<string, CrawlResult> = new Map();
  private queue: { url: string; depth: number }[] = [];
  private browser: any = null;
  private context: any = null;
  private onProgress?: (visited: number, total: number) => void;

  constructor(options: CrawlerOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.onProgress = options.onProgress;
  }

  async crawl(): Promise<CrawlResult[]> {
    const playwright = await this.loadPlaywright();
    if (!playwright) {
      throw new Error('Playwright is not available. Install with: npm install @playwright/test');
    }

    try {
      this.browser = await playwright.chromium.launch({
        headless: true,
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'guardrail-Crawler/1.0',
      });

      if (this.config.authConfig) {
        await this.performAuth(this.config.authConfig);
      }

      for (const seedUrl of this.config.seedUrls) {
        this.queue.push({ url: this.normalizeUrl(seedUrl), depth: 0 });
      }

      while (this.queue.length > 0 && this.visited.size < this.config.maxPages) {
        const { url, depth } = this.queue.shift()!;

        if (this.visited.has(url)) continue;
        if (depth > this.config.maxDepth) continue;
        if (this.isBlocked(url)) continue;

        this.visited.add(url);

        const result = await this.crawlPage(url, depth);
        this.results.set(url, result);

        if (this.onProgress) {
          this.onProgress(this.visited.size, this.config.maxPages);
        }
      }

      return Array.from(this.results.values());
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  private async loadPlaywright(): Promise<any> {
    try {
      return require('@playwright/test');
    } catch {
      try {
        return require('playwright');
      } catch {
        return null;
      }
    }
  }

  private async performAuth(authConfig: AuthConfig): Promise<void> {
    if (!this.context) return;

    const page = await this.context.newPage();

    try {
      switch (authConfig.type) {
        case 'form':
          if (authConfig.loginUrl) {
            await page.goto(`${this.baseUrl}${authConfig.loginUrl}`);
            
            if (authConfig.loginSelectors.username && authConfig.credentials.username) {
              await page.fill(authConfig.loginSelectors.username, authConfig.credentials.username);
            }
            if (authConfig.loginSelectors.password && authConfig.credentials.password) {
              await page.fill(authConfig.loginSelectors.password, authConfig.credentials.password);
            }
            if (authConfig.loginSelectors.submit) {
              await page.click(authConfig.loginSelectors.submit);
              await page.waitForNavigation({ waitUntil: 'networkidle' });
            }
          }
          break;

        case 'cookie':
          const cookies = Object.entries(authConfig.credentials).map(([name, value]) => ({
            name,
            value,
            domain: new URL(this.baseUrl).hostname,
            path: '/',
          }));
          await this.context.addCookies(cookies);
          break;

        case 'header':
          await this.context.setExtraHTTPHeaders(authConfig.credentials);
          break;

        case 'basic':
          await this.context.setExtraHTTPHeaders({
            'Authorization': `Basic ${Buffer.from(
              `${authConfig.credentials.username}:${authConfig.credentials.password}`
            ).toString('base64')}`,
          });
          break;
      }
    } finally {
      await page.close();
    }
  }

  private async crawlPage(url: string, depth: number): Promise<CrawlResult> {
    const page = await this.context.newPage();
    const consoleErrors: string[] = [];
    const networkErrors: NetworkError[] = [];
    const redirectChain: string[] = [];
    let finalUrl = url;
    let status = 0;
    let screenshot: string | null = null;
    const startTime = Date.now();

    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('response', (response: any) => {
      const respUrl = response.url();
      const respStatus = response.status();

      if (respStatus >= 400) {
        networkErrors.push({
          url: respUrl,
          status: respStatus,
          statusText: response.statusText(),
          resourceType: response.request().resourceType(),
        });
      }
    });

    try {
      const response = await page.goto(`${this.baseUrl}${url}`, {
        waitUntil: 'networkidle',
        timeout: this.config.timeout,
      });

      if (response) {
        status = response.status();
        finalUrl = new URL(response.url()).pathname;

        const redirects = response.request().redirectedFrom();
        let current = redirects;
        while (current) {
          redirectChain.unshift(new URL(current.url()).pathname);
          current = current.redirectedFrom();
        }
      }

      const discoveredLinks = await this.extractLinks(page);

      for (const link of discoveredLinks.slice(0, this.config.maxEdgesPerPage)) {
        if (!this.visited.has(link) && !this.isBlocked(link)) {
          this.queue.push({ url: link, depth: depth + 1 });
        }
      }

      if (this.config.clickNavItems) {
        await this.clickNavigation(page);
      }

      const placeholders = await this.detectPlaceholders(page);

      if (this.config.screenshotOnFailure && (status >= 400 || placeholders.length > 0)) {
        const buffer = await page.screenshot({ type: 'png' });
        screenshot = buffer.toString('base64');
      }

      return {
        url,
        finalUrl,
        status,
        redirectChain,
        consoleErrors,
        networkErrors,
        discoveredLinks,
        placeholders,
        screenshot,
        loadTime: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        url,
        finalUrl: url,
        status: 0,
        redirectChain: [],
        consoleErrors: [error.message || 'Unknown error'],
        networkErrors: [],
        discoveredLinks: [],
        placeholders: [],
        screenshot: null,
        loadTime: Date.now() - startTime,
      };
    } finally {
      await page.close();
    }
  }

  private async extractLinks(page: any): Promise<string[]> {
    const links: string[] = [];

    try {
      const hrefs = await page.$$eval('a[href]', (elements: any[]) =>
        elements.map((el: any) => el.getAttribute('href')).filter(Boolean)
      );

      for (const href of hrefs) {
        const normalized = this.normalizeUrl(href);
        if (normalized && this.isInternalLink(normalized)) {
          links.push(normalized);
        }
      }
    } catch {
      // Failed to extract links
    }

    return Array.from(new Set(links));
  }

  private async clickNavigation(page: any): Promise<void> {
    const navSelectors = [
      'nav a',
      'header a',
      '[role="navigation"] a',
      '.nav a',
      '.navbar a',
      '.sidebar a',
      '.menu a',
    ];

    for (const selector of navSelectors) {
      try {
        const navLinks = await page.$$(selector);
        for (const link of navLinks.slice(0, 10)) {
          const href = await link.getAttribute('href');
          if (href) {
            const normalized = this.normalizeUrl(href);
            if (normalized && this.isInternalLink(normalized) && !this.visited.has(normalized)) {
              this.queue.push({ url: normalized, depth: 1 });
            }
          }
        }
      } catch {
        // Selector not found
      }
    }
  }

  private async detectPlaceholders(page: any): Promise<RuntimePlaceholder[]> {
    const placeholders: RuntimePlaceholder[] = [];

    for (const selector of PLACEHOLDER_SELECTORS) {
      try {
        const elements = await page.$$(selector);
        for (const element of elements) {
          const text = await element.textContent();
          const isVisible = await element.isVisible();

          if (text) {
            placeholders.push({
              text: text.trim().slice(0, 200),
              selector,
              isVisible,
              confidence: 0.9,
            });
          }
        }
      } catch {
        // Selector not found
      }
    }

    try {
      const bodyText = await page.textContent('body');
      for (const pattern of PLACEHOLDER_TEXT_PATTERNS) {
        const match = bodyText.match(pattern);
        if (match) {
          const elements = await page.$$(`text=${match[0]}`);
          for (const element of elements.slice(0, 3)) {
            const isVisible = await element.isVisible();
            const boundingBox = await element.boundingBox();

            if (isVisible && boundingBox && boundingBox.width > 50) {
              placeholders.push({
                text: match[0],
                selector: `text="${match[0]}"`,
                isVisible: true,
                confidence: 0.7,
              });
            }
          }
        }
      }
    } catch {
      // Failed to check text content
    }

    return placeholders;
  }

  private normalizeUrl(href: string): string {
    if (!href) return '';

    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') ||
        href.startsWith('javascript:') || href.startsWith('data:')) {
      return '';
    }

    try {
      if (href.startsWith('http://') || href.startsWith('https://')) {
        const url = new URL(href);
        const baseHost = new URL(this.baseUrl).hostname;
        if (url.hostname !== baseHost) {
          return '';
        }
        return url.pathname;
      }

      if (href.startsWith('/')) {
        return href.split('?')[0].split('#')[0];
      }

      return '';
    } catch {
      return '';
    }
  }

  private isInternalLink(url: string): boolean {
    return url.startsWith('/') && !url.startsWith('//');
  }

  private isBlocked(url: string): boolean {
    const normalizedUrl = url.toLowerCase();
    return this.config.blocklistPatterns.some(pattern => {
      if (pattern.startsWith('.')) {
        return normalizedUrl.endsWith(pattern);
      }
      return normalizedUrl.includes(pattern.toLowerCase());
    });
  }

  getResults(): CrawlResult[] {
    return Array.from(this.results.values());
  }

  getVisitedUrls(): string[] {
    return Array.from(this.visited);
  }

  getFailedUrls(): CrawlResult[] {
    return Array.from(this.results.values()).filter(r => r.status >= 400 || r.status === 0);
  }

  getPlaceholderPages(): CrawlResult[] {
    return Array.from(this.results.values()).filter(r => r.placeholders.length > 0);
  }

  getDeadEndPages(): CrawlResult[] {
    return Array.from(this.results.values()).filter(r => 
      r.status === 200 && r.discoveredLinks.length === 0
    );
  }
}

export function createCrawler(options: CrawlerOptions): PlaywrightCrawler {
  return new PlaywrightCrawler(options);
}

export async function crawlSite(
  baseUrl: string,
  config?: Partial<CrawlConfig>
): Promise<CrawlResult[]> {
  const crawler = new PlaywrightCrawler({ baseUrl, config });
  return crawler.crawl();
}

export async function verifySingleRoute(
  baseUrl: string,
  route: string
): Promise<CrawlResult> {
  const crawler = new PlaywrightCrawler({
    baseUrl,
    config: {
      seedUrls: [route],
      maxDepth: 0,
      maxPages: 1,
    },
  });

  const results = await crawler.crawl();
  return results[0] || {
    url: route,
    finalUrl: route,
    status: 0,
    redirectChain: [],
    consoleErrors: ['Failed to crawl'],
    networkErrors: [],
    discoveredLinks: [],
    placeholders: [],
    screenshot: null,
    loadTime: 0,
  };
}
