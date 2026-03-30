/**
 * Platform Plugin System
 * 
 * Integrations for Netlify, Supabase, Vercel, and more
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PlatformPlugin {
  name: string;
  platform: 'netlify' | 'supabase' | 'vercel' | 'railway' | 'render' | 'fly' | 'cloudflare';
  config: {
    files: Array<{ path: string; content: string; description: string }>;
    envVars: string[];
    scripts: Record<string, string>;
  };
  install: (projectPath: string) => Promise<void>;
  validate: (projectPath: string) => Promise<boolean>;
}

class PlatformPluginManager {
  private plugins: Map<string, PlatformPlugin> = new Map();

  constructor() {
    this.registerPlugins();
  }

  /**
   * Register all platform plugins
   */
  private registerPlugins() {
    // Netlify plugin
    this.plugins.set('netlify', {
      name: 'Netlify',
      platform: 'netlify',
      config: {
        files: [
          {
            path: 'netlify.toml',
            content: this.getNetlifyConfig(),
            description: 'Netlify configuration',
          },
          {
            path: '.netlify/plugins/guardrails',
            content: this.getNetlifyPlugin(),
            description: 'Netlify plugin for guardrails',
          },
        ],
        envVars: ['NETLIFY_SITE_ID', 'NETLIFY_AUTH_TOKEN'],
        scripts: {
          'deploy': 'netlify deploy',
          'deploy:prod': 'netlify deploy --prod',
        },
      },
      install: async (projectPath: string) => {
        await this.installNetlify(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'netlify.toml'));
      },
    });

    // Supabase plugin
    this.plugins.set('supabase', {
      name: 'Supabase',
      platform: 'supabase',
      config: {
        files: [
          {
            path: 'supabase/config.toml',
            content: this.getSupabaseConfig(),
            description: 'Supabase configuration',
          },
          {
            path: 'supabase/functions/guardrails',
            content: this.getSupabaseFunction(),
            description: 'Supabase Edge Function for guardrails',
          },
        ],
        envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_KEY'],
        scripts: {
          'supabase:start': 'supabase start',
          'supabase:deploy': 'supabase db push',
        },
      },
      install: async (projectPath: string) => {
        await this.installSupabase(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'supabase', 'config.toml'));
      },
    });

    // Vercel plugin
    this.plugins.set('vercel', {
      name: 'Vercel',
      platform: 'vercel',
      config: {
        files: [
          {
            path: 'vercel.json',
            content: this.getVercelConfig(),
            description: 'Vercel configuration',
          },
          {
            path: '.vercel/plugins/guardrails',
            content: this.getVercelPlugin(),
            description: 'Vercel plugin for guardrails',
          },
        ],
        envVars: ['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'],
        scripts: {
          'deploy': 'vercel',
          'deploy:prod': 'vercel --prod',
        },
      },
      install: async (projectPath: string) => {
        await this.installVercel(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'vercel.json'));
      },
    });

    // Railway plugin
    this.plugins.set('railway', {
      name: 'Railway',
      platform: 'railway',
      config: {
        files: [
          {
            path: 'railway.json',
            content: this.getRailwayConfig(),
            description: 'Railway configuration',
          },
        ],
        envVars: ['RAILWAY_TOKEN', 'RAILWAY_PROJECT_ID'],
        scripts: {
          'deploy': 'railway up',
        },
      },
      install: async (projectPath: string) => {
        await this.installRailway(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'railway.json'));
      },
    });

    // Render plugin
    this.plugins.set('render', {
      name: 'Render',
      platform: 'render',
      config: {
        files: [
          {
            path: 'render.yaml',
            content: this.getRenderConfig(),
            description: 'Render configuration',
          },
        ],
        envVars: ['RENDER_API_KEY'],
        scripts: {},
      },
      install: async (projectPath: string) => {
        await this.installRender(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'render.yaml'));
      },
    });

    // Fly.io plugin
    this.plugins.set('fly', {
      name: 'Fly.io',
      platform: 'fly',
      config: {
        files: [
          {
            path: 'fly.toml',
            content: this.getFlyConfig(),
            description: 'Fly.io configuration',
          },
        ],
        envVars: ['FLY_API_TOKEN'],
        scripts: {
          'deploy': 'flyctl deploy',
        },
      },
      install: async (projectPath: string) => {
        await this.installFly(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'fly.toml'));
      },
    });

    // Cloudflare Pages plugin
    this.plugins.set('cloudflare', {
      name: 'Cloudflare Pages',
      platform: 'cloudflare',
      config: {
        files: [
          {
            path: '_redirects',
            content: this.getCloudflareRedirects(),
            description: 'Cloudflare Pages redirects',
          },
          {
            path: 'wrangler.toml',
            content: this.getCloudflareConfig(),
            description: 'Cloudflare Workers configuration',
          },
        ],
        envVars: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
        scripts: {
          'deploy': 'wrangler pages deploy',
        },
      },
      install: async (projectPath: string) => {
        await this.installCloudflare(projectPath);
      },
      validate: async (projectPath: string) => {
        return await this.pathExists(path.join(projectPath, 'wrangler.toml'));
      },
    });
  }

  /**
   * Get all available plugins
   */
  getPlugins(): PlatformPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): PlatformPlugin | undefined {
    return this.plugins.get(name.toLowerCase());
  }

  /**
   * Detect platform from project
   */
  async detectPlatform(projectPath: string): Promise<string[]> {
    const detected: string[] = [];

    for (const [name, plugin] of this.plugins.entries()) {
      if (await plugin.validate(projectPath)) {
        detected.push(name);
      }
    }

    return detected;
  }

  /**
   * Install plugin
   */
  async installPlugin(name: string, projectPath: string): Promise<void> {
    const plugin = this.plugins.get(name.toLowerCase());
    if (!plugin) {
      throw new Error(`Plugin not found: ${name}`);
    }

    await plugin.install(projectPath);
  }

  // Platform-specific installers
  private async installNetlify(projectPath: string): Promise<void> {
    const netlifyToml = path.join(projectPath, 'netlify.toml');
    await fs.promises.writeFile(netlifyToml, this.getNetlifyConfig());

    const pluginDir = path.join(projectPath, '.netlify', 'plugins', 'guardrails');
    await fs.promises.mkdir(pluginDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(pluginDir, 'index.js'),
      this.getNetlifyPlugin()
    );
  }

  private async installSupabase(projectPath: string): Promise<void> {
    const supabaseDir = path.join(projectPath, 'supabase');
    await fs.promises.mkdir(supabaseDir, { recursive: true });
    
    await fs.promises.writeFile(
      path.join(supabaseDir, 'config.toml'),
      this.getSupabaseConfig()
    );

    const functionsDir = path.join(supabaseDir, 'functions', 'guardrails');
    await fs.promises.mkdir(functionsDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(functionsDir, 'index.ts'),
      this.getSupabaseFunction()
    );
  }

  private async installVercel(projectPath: string): Promise<void> {
    const vercelJson = path.join(projectPath, 'vercel.json');
    await fs.promises.writeFile(vercelJson, this.getVercelConfig());

    const pluginDir = path.join(projectPath, '.vercel', 'plugins', 'guardrails');
    await fs.promises.mkdir(pluginDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(pluginDir, 'index.js'),
      this.getVercelPlugin()
    );
  }

  private async installRailway(projectPath: string): Promise<void> {
    const railwayJson = path.join(projectPath, 'railway.json');
    await fs.promises.writeFile(railwayJson, this.getRailwayConfig());
  }

  private async installRender(projectPath: string): Promise<void> {
    const renderYaml = path.join(projectPath, 'render.yaml');
    await fs.promises.writeFile(renderYaml, this.getRenderConfig());
  }

  private async installFly(projectPath: string): Promise<void> {
    const flyToml = path.join(projectPath, 'fly.toml');
    await fs.promises.writeFile(flyToml, this.getFlyConfig());
  }

  private async installCloudflare(projectPath: string): Promise<void> {
    const wranglerToml = path.join(projectPath, 'wrangler.toml');
    await fs.promises.writeFile(wranglerToml, this.getCloudflareConfig());

    const publicDir = path.join(projectPath, 'public');
    await fs.promises.mkdir(publicDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(publicDir, '_redirects'),
      this.getCloudflareRedirects()
    );
  }

  // Configuration generators
  private getNetlifyConfig(): string {
    return `# Netlify Configuration
# Generated by AI Agent Guardrails

[build]
  command = "npm run build"
  publish = ".next/out"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[build.environment]
  NODE_VERSION = "18"

# Guardrails integration
[[plugins]]
  package = "./.netlify/plugins/guardrails"

[functions]
  directory = "netlify/functions"
`;
  }

  private getNetlifyPlugin(): string {
    return `/**
 * Netlify Plugin for AI Agent Guardrails
 */

module.exports = {
  onPreBuild: async ({ utils }) => {
    console.log('🛡️ Running guardrails validation...');
    const { execSync } = require('child_process');
    try {
      execSync('npm run validate', { stdio: 'inherit' });
      console.log('✅ Guardrails check passed');
    } catch (error) {
      utils.build.failBuild('Guardrails validation failed');
    }
  },
  onPostBuild: async ({ utils }) => {
    console.log('✨ Running polish check...');
    const { execSync } = require('child_process');
    try {
      execSync('npm run polish -- --check-only', { stdio: 'inherit' });
    } catch (error) {
      console.warn('⚠️ Polish check found issues');
    }
  },
};
`;
  }

  private getSupabaseConfig(): string {
    return `# Supabase Configuration
# Generated by AI Agent Guardrails

project_id = "your-project-id"

[api]
  enabled = true
  port = 54321
  schemas = ["public", "storage", "graphql_public"]
  extra_search_path = ["public", "extensions"]

[db]
  port = 54322
  major_version = 15

[studio]
  enabled = true
  port = 54323

[auth]
  enabled = true
  site_url = "http://localhost:3000"
  additional_redirect_urls = ["https://your-domain.com"]
`;
  }

  private getSupabaseFunction(): string {
    return `/**
 * Supabase Edge Function for AI Agent Guardrails
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  const { method, url } = req;
  
  if (method === 'GET' && url.includes('/guardrails/health')) {
    return new Response(
      JSON.stringify({ status: 'healthy', service: 'guardrails' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (method === 'POST' && url.includes('/guardrails/validate')) {
    // Validation logic
    return new Response(
      JSON.stringify({ valid: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response('Not Found', { status: 404 });
});
`;
  }

  private getVercelConfig(): string {
    return JSON.stringify({
      version: 2,
      buildCommand: 'npm run build',
      outputDirectory: '.next',
      installCommand: 'npm install',
      framework: 'nextjs',
      rewrites: [
        { source: '/(.*)', destination: '/$1' },
      ],
      headers: [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-XSS-Protection', value: '1; mode=block' },
          ],
        },
      ],
      functions: {
        'api/**/*.ts': {
          runtime: 'nodejs18.x',
        },
      },
    }, null, 2);
  }

  private getVercelPlugin(): string {
    return `/**
 * Vercel Plugin for AI Agent Guardrails
 */

module.exports = {
  async build(context) {
    const { execSync } = require('child_process');
    
    console.log('🛡️ Running guardrails validation...');
    try {
      execSync('npm run validate', { stdio: 'inherit' });
      console.log('✅ Guardrails check passed');
    } catch (error) {
      throw new Error('Guardrails validation failed');
    }
  },
};
`;
  }

  private getRailwayConfig(): string {
    return JSON.stringify({
      build: {
        builder: 'NIXPACKS',
        buildCommand: 'npm run build',
      },
      deploy: {
        startCommand: 'npm start',
        restartPolicyType: 'ON_FAILURE',
        restartPolicyMaxRetries: 10,
      },
    }, null, 2);
  }

  private getRenderConfig(): string {
    return `# Render Configuration
# Generated by AI Agent Guardrails

services:
  - type: web
    name: guardrails-app
    env: node
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
`;
  }

  private getFlyConfig(): string {
    return `# Fly.io Configuration
# Generated by AI Agent Guardrails

app = "your-app-name"
primary_region = "iad"

[build]

[env]
  NODE_ENV = "production"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

[[services]]
  protocol = "tcp"
  internal_port = 3000
`;
  }

  private getCloudflareConfig(): string {
    return `# Cloudflare Workers/Pages Configuration
# Generated by AI Agent Guardrails

name = "guardrails-app"
compatibility_date = "2024-01-01"

[env.production]
  name = "guardrails-app-prod"

[build]
  command = "npm run build"
  cwd = "."
`;
  }

  private getCloudflareRedirects(): string {
    return `# Cloudflare Pages Redirects
# Generated by AI Agent Guardrails

/api/*  /api/:splat  200
`;
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  }
}

export const platformPluginManager = new PlatformPluginManager();

