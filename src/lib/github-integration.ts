/**
 * GitHub Integration
 * 
 * Connect with GitHub for repos, issues, PRs, etc.
 * 
 * @module github-integration
 * @example
 * ```typescript
 * const github = new GitHubIntegration();
 * github.authenticate('your-token');
 * const repos = await github.getRepos('username');
 * ```
 */

import type { GitHubRepoResponse, GitHubIssueResponse, GitHubPRResponse, GitHubSearchResult } from './types/github';

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  forks: number;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: string[];
  url: string;
}

export interface GitHubPR {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
}

export interface GitHubConfig {
  token: string;
  owner?: string;
  repo?: string;
}

class GitHubIntegration {
  private config: GitHubConfig | null = null;
  private baseURL = 'https://api.github.com';

  /**
   * Authenticate with GitHub
   */
  authenticate(token: string, owner?: string, repo?: string): void {
    this.config = {
      token,
      owner,
      repo,
    };
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.config !== null;
  }

  /**
   * Get repository information
   */
  async getRepo(owner: string, repo: string): Promise<GitHubRepo> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await this.apiRequest(`/repos/${owner}/${repo}`);
    
    return {
      id: response.id,
      name: response.name,
      fullName: response.full_name,
      description: response.description || '',
      url: response.html_url,
      language: response.language || 'Unknown',
      stars: response.stargazers_count,
      forks: response.forks_count,
    };
  }

  /**
   * List repositories
   */
  async listRepos(owner: string): Promise<GitHubRepo[]> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await this.apiRequest(`/users/${owner}/repos`);
    
    return (response as GitHubRepoResponse[]).map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || '',
      url: repo.html_url,
      language: repo.language || 'Unknown',
      stars: repo.stargazers_count,
      forks: repo.forks_count,
    }));
  }

  /**
   * Get issues
   */
  async getIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubIssue[]> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await this.apiRequest(`/repos/${owner}/${repo}/issues?state=${state}`);
    
    return (response as GitHubIssueResponse[]).map((issue) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body || '',
      state: issue.state,
      labels: issue.labels.map((l) => l.name),
      url: issue.html_url,
    }));
  }

  /**
   * Get pull requests
   */
  async getPRs(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open'): Promise<GitHubPR[]> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await this.apiRequest(`/repos/${owner}/${repo}/pulls?state=${state}`);
    
    return response.map((pr: any) => ({
      id: pr.id,
      number: pr.number,
      title: pr.title,
      body: pr.body || '',
      state: pr.state === 'closed' && pr.merged ? 'merged' : pr.state,
      url: pr.html_url,
    }));
  }

  /**
   * Create issue
   */
  async createIssue(owner: string, repo: string, title: string, body: string, labels: string[] = []): Promise<GitHubIssue> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await this.apiRequest(`/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      body: JSON.stringify({ title, body, labels }),
    });

    return {
      id: response.id,
      number: response.number,
      title: response.title,
      body: response.body || '',
      state: response.state,
      labels: response.labels.map((l: any) => l.name),
      url: response.html_url,
    };
  }

  /**
   * Get file content
   */
  async getFileContent(owner: string, repo: string, path: string): Promise<string> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    const response = await this.apiRequest(`/repos/${owner}/${repo}/contents/${path}`);
    
    // Decode base64 content
    if (response.content) {
      return Buffer.from(response.content, 'base64').toString('utf8');
    }
    
    throw new Error('File content not found');
  }

  /**
   * Search code
   */
  /**
   * Search code on GitHub
   * 
   * @param query - Search query
   * @param language - Optional language filter
   * @returns Array of search results
   */
  async searchCode(query: string, language?: string): Promise<GitHubSearchResult[]> {
    if (!this.config) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }

    let searchQuery = query;
    if (language) {
      searchQuery += ` language:${language}`;
    }

    const response = await this.apiRequest(`/search/code?q=${encodeURIComponent(searchQuery)}`);
    return response.items || [];
  }

  /**
   * Make API request
   */
  private async apiRequest(path: string, options: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.config) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseURL}${path}`;
    const headers: Record<string, string> = {
      'Authorization': `token ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'guardrail-AI',
      ...options.headers,
    };

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
    };

    if (options.body) {
      fetchOptions.body = options.body;
    }

    try {
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`GitHub API request failed: ${errorMessage}`);
    }
  }
}

export const githubIntegration = new GitHubIntegration();

