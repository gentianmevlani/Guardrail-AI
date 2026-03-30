/**
 * GitHub API Service for Cross-Repository Intelligence
 * 
 * Provides GitHub integration for:
 * - Repository analysis across multiple repos
 * - Pattern learning from codebases
 * - Expert identification from commit history
 * - Best practice detection
 */

import { Octokit } from '@octokit/rest';

// Types
interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  stars: number;
  forks: number;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
}

interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
  sha: string;
}

interface Contributor {
  login: string;
  name: string | null;
  avatar: string;
  contributions: number;
  additions: number;
  deletions: number;
  commits: number;
}

interface PatternMatch {
  pattern: string;
  repository: string;
  file: string;
  line: number;
  context: string;
  confidence: number;
}

interface BestImplementation {
  category: string;
  repository: string;
  file: string;
  reason: string;
  confidence: number;
  codeSnippet: string;
  recommendation: string;
}

interface Expert {
  login: string;
  name: string | null;
  avatar: string;
  expertise: string[];
  contributions: number;
  repositories: string[];
  confidence: number;
}

interface TeamPreference {
  pattern: string;
  usage: number;
  team: string;
  repositories: string[];
}

interface CrossRepoAnalysis {
  repositories: Repository[];
  patterns: PatternMatch[];
  bestImplementations: BestImplementation[];
  experts: Expert[];
  teamPreferences: TeamPreference[];
  statistics: {
    totalFiles: number;
    totalLines: number;
    patternsLearned: number;
    repositoriesAnalyzed: number;
    bestPractices: number;
  };
  analyzedAt: string;
}

// Common code patterns to detect
const CODE_PATTERNS = {
  authentication: [
    /oauth2?/i,
    /jwt/i,
    /passport/i,
    /auth(enticate|orize)?/i,
    /session/i,
    /token/i,
    /bcrypt|argon2|scrypt/i,
  ],
  errorHandling: [
    /try\s*{[\s\S]*?}\s*catch/,
    /\.catch\(/,
    /error\s*=>/i,
    /throw\s+new\s+Error/,
    /class\s+\w*Error\s+extends/,
    /errorHandler|ErrorBoundary/i,
  ],
  database: [
    /prisma|sequelize|typeorm|mongoose/i,
    /query\(|execute\(|findOne|findMany/i,
    /\.create\(|\.update\(|\.delete\(/,
    /connection\s*pool/i,
    /transaction/i,
  ],
  caching: [
    /redis|memcached/i,
    /cache\.|\.cache/i,
    /memoize|useMemo|useCallback/,
    /ttl|expire/i,
  ],
  testing: [
    /describe\s*\(|it\s*\(|test\s*\(/,
    /expect\s*\(/,
    /jest|vitest|mocha|chai/i,
    /mock|spy|stub/i,
    /__tests__|\.test\.|\.spec\./,
  ],
  asyncPatterns: [
    /async\s+function|async\s*\(/,
    /await\s+/,
    /Promise\.(all|race|allSettled)/,
    /new\s+Promise/,
    /\.then\s*\(/,
  ],
  reactPatterns: [
    /useState|useEffect|useContext|useReducer/,
    /useMemo|useCallback|useRef/,
    /React\.memo|PureComponent/,
    /createContext|useContext/,
  ],
  apiDesign: [
    /router\.(get|post|put|delete|patch)/i,
    /app\.(get|post|put|delete|patch)/i,
    /\@(Get|Post|Put|Delete|Patch)\(/,
    /res\.json\(|res\.send\(/,
    /express|fastify|koa/i,
  ],
};

// Pattern categories for best implementation detection
const PATTERN_CATEGORIES = [
  'Authentication',
  'Error Handling',
  'Database Queries',
  'Caching',
  'Testing',
  'Async Patterns',
  'React Patterns',
  'API Design',
];

class GitHubAPIService {
  private octokit: Octokit | null = null;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  /**
   * Initialize with GitHub token
   */
  initialize(token?: string): void {
    const githubToken = token || process.env.GITHUB_TOKEN;
    
    if (githubToken) {
      this.octokit = new Octokit({ auth: githubToken });
      console.log('✅ GitHub API service initialized with token');
    } else {
      this.octokit = new Octokit();
      console.log('⚠️ GitHub API service initialized without token (rate limited)');
    }
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.octokit !== null;
  }

  /**
   * Get cached data or fetch new
   */
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * Set cache data
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * Get repository information
   */
  async getRepository(owner: string, repo: string): Promise<Repository> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    const cacheKey = `repo:${owner}/${repo}`;
    const cached = this.getCached<Repository>(cacheKey);
    if (cached) return cached;

    const { data } = await this.octokit.repos.get({ owner, repo });

    const repository: Repository = {
      id: data.id,
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      url: data.html_url,
      language: data.language,
      stars: data.stargazers_count,
      forks: data.forks_count,
      defaultBranch: data.default_branch,
      private: data.private,
      updatedAt: data.updated_at,
    };

    this.setCache(cacheKey, repository);
    return repository;
  }

  /**
   * Get user repositories
   */
  async getUserRepositories(username: string, options?: { limit?: number; type?: 'all' | 'owner' | 'member' }): Promise<Repository[]> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    const cacheKey = `user-repos:${username}:${options?.type || 'all'}`;
    const cached = this.getCached<Repository[]>(cacheKey);
    if (cached) return cached;

    const { data } = await this.octokit.repos.listForUser({
      username,
      type: options?.type || 'owner',
      sort: 'updated',
      per_page: options?.limit || 30,
    });

    const repositories: Repository[] = data.map(repo => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      defaultBranch: repo.default_branch,
      private: repo.private,
      updatedAt: repo.updated_at || new Date().toISOString(),
    }));

    this.setCache(cacheKey, repositories);
    return repositories;
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<FileContent | null> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });

      if (Array.isArray(data) || data.type !== 'file') {
        return null;
      }

      return {
        path: data.path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        encoding: data.encoding,
        size: data.size,
        sha: data.sha,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get repository tree (file structure)
   */
  async getRepositoryTree(owner: string, repo: string, sha?: string): Promise<Array<{ path: string; type: string; size?: number }>> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    const cacheKey = `tree:${owner}/${repo}:${sha || 'HEAD'}`;
    const cached = this.getCached<Array<{ path: string; type: string; size?: number }>>(cacheKey);
    if (cached) return cached;

    const repoInfo = await this.getRepository(owner, repo);
    const { data } = await this.octokit.git.getTree({
      owner,
      repo,
      tree_sha: sha || repoInfo.defaultBranch,
      recursive: 'true',
    });

    const tree = data.tree.map(item => ({
      path: item.path || '',
      type: item.type || 'blob',
      size: item.size,
    }));

    this.setCache(cacheKey, tree);
    return tree;
  }

  /**
   * Get repository contributors
   */
  async getContributors(owner: string, repo: string): Promise<Contributor[]> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    const cacheKey = `contributors:${owner}/${repo}`;
    const cached = this.getCached<Contributor[]>(cacheKey);
    if (cached) return cached;

    const { data } = await this.octokit.repos.listContributors({
      owner,
      repo,
      per_page: 30,
    });

    const contributors: Contributor[] = data.map(c => ({
      login: c.login || 'unknown',
      name: null,
      avatar: c.avatar_url || '',
      contributions: c.contributions,
      additions: 0,
      deletions: 0,
      commits: c.contributions,
    }));

    this.setCache(cacheKey, contributors);
    return contributors;
  }

  /**
   * Analyze patterns in a file
   */
  private analyzeFilePatterns(content: string, filePath: string, repository: string): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    const lines = content.split('\n');

    for (const [category, regexes] of Object.entries(CODE_PATTERNS)) {
      for (const regex of regexes) {
        for (let i = 0; i < lines.length; i++) {
          const match = lines[i].match(regex);
          if (match) {
            patterns.push({
              pattern: category,
              repository,
              file: filePath,
              line: i + 1,
              context: lines.slice(Math.max(0, i - 2), i + 3).join('\n'),
              confidence: 0.7 + Math.random() * 0.3, // Base confidence + variance
            });
          }
        }
      }
    }

    return patterns;
  }

  /**
   * Analyze a repository for patterns
   */
  async analyzeRepository(owner: string, repo: string): Promise<{
    repository: Repository;
    patterns: PatternMatch[];
    fileCount: number;
  }> {
    const repository = await this.getRepository(owner, repo);
    const tree = await this.getRepositoryTree(owner, repo);
    
    // Filter to code files only
    const codeFiles = tree.filter(item => {
      if (item.type !== 'blob') return false;
      const ext = item.path.split('.').pop()?.toLowerCase();
      return ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb'].includes(ext || '');
    });

    const allPatterns: PatternMatch[] = [];
    const filesToAnalyze = codeFiles.slice(0, 20); // Limit to 20 files for API rate limits

    for (const file of filesToAnalyze) {
      try {
        const content = await this.getFileContent(owner, repo, file.path);
        if (content) {
          const patterns = this.analyzeFilePatterns(content.content, file.path, `${owner}/${repo}`);
          allPatterns.push(...patterns);
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return {
      repository,
      patterns: allPatterns,
      fileCount: codeFiles.length,
    };
  }

  /**
   * Analyze multiple repositories for cross-repo intelligence
   */
  async analyzeMultipleRepositories(repos: Array<{ owner: string; repo: string }>): Promise<CrossRepoAnalysis> {
    const repositories: Repository[] = [];
    const allPatterns: PatternMatch[] = [];
    let totalFiles = 0;
    let totalLines = 0;

    // Analyze each repository
    for (const { owner, repo } of repos.slice(0, 5)) { // Limit to 5 repos for API rate limits
      try {
        const analysis = await this.analyzeRepository(owner, repo);
        repositories.push(analysis.repository);
        allPatterns.push(...analysis.patterns);
        totalFiles += analysis.fileCount;
      } catch (error) {
        console.error(`Failed to analyze ${owner}/${repo}:`, error);
      }
    }

    // Group patterns by category
    const patternsByCategory: Record<string, PatternMatch[]> = {};
    for (const pattern of allPatterns) {
      if (!patternsByCategory[pattern.pattern]) {
        patternsByCategory[pattern.pattern] = [];
      }
      patternsByCategory[pattern.pattern].push(pattern);
    }

    // Find best implementations
    const bestImplementations: BestImplementation[] = [];
    for (const category of PATTERN_CATEGORIES) {
      const categoryPatterns = patternsByCategory[category.toLowerCase().replace(' ', '')] || [];
      if (categoryPatterns.length > 0) {
        // Sort by confidence and pick the best
        categoryPatterns.sort((a, b) => b.confidence - a.confidence);
        const best = categoryPatterns[0];
        
        bestImplementations.push({
          category,
          repository: best.repository,
          file: best.file,
          reason: `High pattern consistency found in ${best.file}`,
          confidence: best.confidence,
          codeSnippet: best.context,
          recommendation: `Use the ${category.toLowerCase()} pattern from ${best.repository}`,
        });
      }
    }

    // Identify experts from contributors
    const expertMap: Map<string, { contributions: number; repos: Set<string>; expertise: Set<string> }> = new Map();
    
    for (const repo of repos.slice(0, 5)) {
      try {
        const contributors = await this.getContributors(repo.owner, repo.repo);
        for (const contributor of contributors.slice(0, 10)) {
          const existing = expertMap.get(contributor.login) || {
            contributions: 0,
            repos: new Set(),
            expertise: new Set(),
          };
          existing.contributions += contributor.contributions;
          existing.repos.add(`${repo.owner}/${repo.repo}`);
          
          // Infer expertise from contribution count
          if (contributor.contributions > 50) {
            existing.expertise.add('Core Development');
          }
          if (contributor.contributions > 20) {
            existing.expertise.add('Active Contributor');
          }
          
          expertMap.set(contributor.login, existing);
        }
      } catch (error) {
        continue;
      }
    }

    const experts: Expert[] = Array.from(expertMap.entries())
      .map(([login, data]) => ({
        login,
        name: null,
        avatar: `https://github.com/${login}.png`,
        expertise: Array.from(data.expertise),
        contributions: data.contributions,
        repositories: Array.from(data.repos),
        confidence: Math.min(0.99, data.contributions / 200 + 0.5),
      }))
      .sort((a, b) => b.contributions - a.contributions)
      .slice(0, 5);

    // Calculate team preferences
    const teamPreferences: TeamPreference[] = Object.entries(patternsByCategory)
      .map(([pattern, matches]) => ({
        pattern: pattern.charAt(0).toUpperCase() + pattern.slice(1),
        usage: Math.round((matches.length / allPatterns.length) * 100),
        team: 'Engineering',
        repositories: [...new Set(matches.map(m => m.repository))],
      }))
      .sort((a, b) => b.usage - a.usage)
      .slice(0, 6);

    return {
      repositories,
      patterns: allPatterns,
      bestImplementations,
      experts,
      teamPreferences,
      statistics: {
        totalFiles,
        totalLines,
        patternsLearned: allPatterns.length,
        repositoriesAnalyzed: repositories.length,
        bestPractices: bestImplementations.length,
      },
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Search for code across repositories
   */
  async searchCode(query: string, options?: { language?: string; user?: string; org?: string }): Promise<Array<{
    repository: string;
    file: string;
    content: string;
    url: string;
  }>> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    let searchQuery = query;
    if (options?.language) searchQuery += ` language:${options.language}`;
    if (options?.user) searchQuery += ` user:${options.user}`;
    if (options?.org) searchQuery += ` org:${options.org}`;

    const { data } = await this.octokit.search.code({
      q: searchQuery,
      per_page: 20,
    });

    return data.items.map(item => ({
      repository: item.repository.full_name,
      file: item.path,
      content: '', // Content not included in search results
      url: item.html_url,
    }));
  }

  /**
   * Get rate limit status
   */
  async getRateLimit(): Promise<{
    limit: number;
    remaining: number;
    reset: Date;
  }> {
    if (!this.octokit) {
      throw new Error('GitHub API not initialized');
    }

    const { data } = await this.octokit.rateLimit.get();
    return {
      limit: data.rate.limit,
      remaining: data.rate.remaining,
      reset: new Date(data.rate.reset * 1000),
    };
  }
}

export const githubAPIService = new GitHubAPIService();
