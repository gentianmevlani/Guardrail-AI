#!/usr/bin/env node

/**
 * Authentication CLI
 * 
 * User registration and login
 */

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
║         🔐 guardrail AI - Authentication                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const command = process.argv[2];

  if (command === 'register') {
    await register();
  } else if (command === 'login') {
    await login();
  } else if (command === 'status') {
    await status();
  } else {
    console.log('Usage:');
    console.log('  guardrail auth register - Create new account');
    console.log('  guardrail auth login    - Sign in');
    console.log('  guardrail auth status  - Check auth status');
  }

  rl.close();
}

async function register() {
  console.log('\n📝 Create Account\n');

  const name = await question('Name: ');
  const email = await question('Email: ');
  const password = await question('Password: ');

  try {
    const user = await authSystem.register(email, password, name);
    console.log(`\n✅ Account created!\n`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Name: ${user.name}\n`);
  } catch (error) {
    console.error(`\n❌ Registration failed: ${error.message}\n`);
  }
}

async function login() {
  console.log('\n🔑 Sign In\n');

  const email = await question('Email: ');
  const password = await question('Password: ');

  try {
    const session = await authSystem.login(email, password);
    console.log(`\n✅ Logged in successfully!\n`);
    console.log(`   Session token: ${session.token.substring(0, 20)}...`);
    console.log(`   Expires: ${new Date(session.expiresAt).toLocaleString()}\n`);
    
    // Save token for future use
    const fs = require('fs');
    const path = require('path');
    const tokenPath = path.join(process.cwd(), '.guardrail', 'session.json');
    await fs.promises.mkdir(path.dirname(tokenPath), { recursive: true });
    await fs.promises.writeFile(tokenPath, JSON.stringify(session, null, 2));
  } catch (error) {
    console.error(`\n❌ Login failed: ${error.message}\n`);
  }
}

async function status() {
  const fs = require('fs');
  const path = require('path');
  const tokenPath = path.join(process.cwd(), '.guardrail', 'session.json');

  try {
    const session = JSON.parse(await fs.promises.readFile(tokenPath, 'utf8'));
    const user = await authSystem.verifySession(session.token);

    if (user) {
      console.log('\n✅ Authenticated\n');
      console.log(`   User: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Subscription: ${user.subscription.tier}\n`);
    } else {
      console.log('\n❌ Not authenticated\n');
    }
  } catch {
    console.log('\n❌ Not authenticated\n');
  }
}

main();

