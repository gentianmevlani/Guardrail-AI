import { Octokit } from '@octokit/rest'

async function getAccessToken(): Promise<string> {
  // Use environment variable for GitHub token
  const token = process.env.GITHUB_ACCESS_TOKEN || process.env.GITHUB_TOKEN;
  
  if (!token) {
    throw new Error('GitHub not connected');
  }
  
  return token;
}

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

export async function listUserRepositories() {
  const client = await getUncachableGitHubClient();
  const { data } = await client.repos.listForAuthenticatedUser({
    sort: 'updated',
    per_page: 100,
  });
  return data;
}

export async function getRepository(owner: string, repo: string) {
  const client = await getUncachableGitHubClient();
  const { data } = await client.repos.get({ owner, repo });
  return data;
}

export async function getRepositoryContents(owner: string, repo: string, path: string = '') {
  const client = await getUncachableGitHubClient();
  const { data } = await client.repos.getContent({ owner, repo, path });
  return data;
}

export async function listBranches(owner: string, repo: string) {
  const client = await getUncachableGitHubClient();
  const { data } = await client.repos.listBranches({ owner, repo });
  return data;
}
