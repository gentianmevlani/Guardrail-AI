/**
 * GitHub API Type Definitions
 */

export interface GitHubAPIResponse {
  id: number;
  [key: string]: unknown;
}

export interface GitHubRepoResponse extends GitHubAPIResponse {
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
}

export interface GitHubIssueResponse extends GitHubAPIResponse {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  labels: Array<{ name: string }>;
  html_url: string;
}

export interface GitHubPRResponse extends GitHubAPIResponse {
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  html_url: string;
  labels: Array<{ name: string }>;
}

export interface GitHubSearchResult {
  name: string;
  path: string;
  html_url: string;
  repository: {
    full_name: string;
  };
  [key: string]: unknown;
}


