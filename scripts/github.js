#!/usr/bin/env node

/**
 * GitHub Integration
 * 
 * Connect and interact with GitHub
 */

const { githubIntegration } = require('../src/lib/github-integration.js');
const { authSystem } = require('../src/lib/auth-system.js');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║         🐙 guardrail AI - GitHub Integration                ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const command = process.argv[2];

  if (command === 'connect') {
    await connectGitHub();
  } else if (command === 'repos') {
    await listRepos();
  } else if (command === 'issues') {
    await listIssues();
  } else if (command === 'prs') {
    await listPRs();
  } else {
    console.log('Usage:');
    console.log('  guardrail github connect - Connect GitHub account');
    console.log('  guardrail github repos  - List repositories');
    console.log('  guardrail github issues - List issues');
    console.log('  guardrail github prs    - List pull requests');
  }

  rl.close();
}

async function connectGitHub() {
  console.log('\n🔗 Connect GitHub Account\n');
  console.log('You need a GitHub Personal Access Token.');
  console.log('Create one at: https://github.com/settings/tokens\n');

  const token = await question('GitHub Token: ');

  try {
    githubIntegration.authenticate(token);
    console.log('\n✅ GitHub connected!\n');
  } catch (error) {
    console.error(`\n❌ Failed to connect: ${error.message}\n`);
  }
}

async function listRepos() {
  if (!githubIntegration.isAuthenticated()) {
    console.log('\n❌ Not connected. Run "guardrail github connect" first.\n');
    return;
  }

  const owner = await question('Owner/Username: ');

  try {
    const repos = await githubIntegration.listRepos(owner);
    console.log(`\n📦 Repositories (${repos.length}):\n`);
    repos.forEach(repo => {
      console.log(`   • ${repo.fullName}`);
      console.log(`     ${repo.description || 'No description'}`);
      console.log(`     ⭐ ${repo.stars} | 🍴 ${repo.forks} | ${repo.language}`);
      console.log('');
    });
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
}

async function listIssues() {
  if (!githubIntegration.isAuthenticated()) {
    console.log('\n❌ Not connected. Run "guardrail github connect" first.\n');
    return;
  }

  const owner = await question('Owner: ');
  const repo = await question('Repository: ');

  try {
    const issues = await githubIntegration.getIssues(owner, repo);
    console.log(`\n📋 Issues (${issues.length}):\n`);
    issues.forEach(issue => {
      console.log(`   #${issue.number} ${issue.title}`);
      console.log(`     State: ${issue.state}`);
      if (issue.labels.length > 0) {
        console.log(`     Labels: ${issue.labels.join(', ')}`);
      }
      console.log('');
    });
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
}

async function listPRs() {
  if (!githubIntegration.isAuthenticated()) {
    console.log('\n❌ Not connected. Run "guardrail github connect" first.\n');
    return;
  }

  const owner = await question('Owner: ');
  const repo = await question('Repository: ');

  try {
    const prs = await githubIntegration.getPRs(owner, repo);
    console.log(`\n🔀 Pull Requests (${prs.length}):\n`);
    prs.forEach(pr => {
      console.log(`   #${pr.number} ${pr.title}`);
      console.log(`     State: ${pr.state}`);
      console.log('');
    });
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
  }
}

main();

