#!/usr/bin/env node

/**
 * Auto-Grow Script
 * 
 * Automatically adds features as your project grows
 * Detects when to add error boundaries, 404s, breadcrumbs, etc.
 */

// Project growth manager (simplified for Node.js)
const fs = require('fs');
const path = require('path');

const projectGrowthManager = {
  async checkGrowth(projectPath) {
    const features = [];
    
    // Check for error boundary
    const hasReact = await this.hasPackage(projectPath, 'react');
    const hasErrorBoundary = await this.pathExists(path.join(projectPath, 'src', 'components', 'ErrorBoundary.tsx'));
    if (hasReact && !hasErrorBoundary) {
      features.push({
        name: 'Error Boundary',
        description: 'Add error boundary for React error handling',
        priority: 10,
      });
    }
    
    // Check for 404 page
    const hasRouter = await this.hasPackage(projectPath, 'next') || await this.hasPackage(projectPath, 'react-router-dom');
    const has404 = await this.pathExists(path.join(projectPath, 'src', 'pages', 'NotFound.tsx')) ||
                   await this.pathExists(path.join(projectPath, 'src', 'app', 'not-found.tsx'));
    if (hasRouter && !has404) {
      features.push({
        name: '404 Page',
        description: 'Add custom 404 not found page',
        priority: 9,
      });
    }
    
    // Check for breadcrumbs
    const routeCount = await this.countRoutes(projectPath);
    const hasBreadcrumbs = await this.pathExists(path.join(projectPath, 'src', 'components', 'Breadcrumbs.tsx'));
    if (routeCount >= 3 && !hasBreadcrumbs) {
      features.push({
        name: 'Breadcrumbs',
        description: 'Add breadcrumb navigation component',
        priority: 8,
      });
    }
    
    // Check for loading states
    const hasApiCalls = await this.hasApiCalls(projectPath);
    const hasLoading = await this.pathExists(path.join(projectPath, 'src', 'components', 'LoadingState.tsx'));
    if (hasApiCalls && !hasLoading) {
      features.push({
        name: 'Loading States',
        description: 'Add loading state components',
        priority: 7,
      });
    }
    
    // Check for empty states
    const hasLists = await this.hasListComponents(projectPath);
    const hasEmpty = await this.pathExists(path.join(projectPath, 'src', 'components', 'EmptyState.tsx'));
    if (hasLists && !hasEmpty) {
      features.push({
        name: 'Empty States',
        description: 'Add empty state components',
        priority: 6,
      });
    }
    
    return features.sort((a, b) => b.priority - a.priority);
  },
  
  async autoGrow(projectPath) {
    const features = await this.checkGrowth(projectPath);
    const installed = [];
    const failed = [];
    
    for (const feature of features) {
      try {
        await this.installFeature(projectPath, feature.name);
        installed.push(feature.name);
      } catch (error) {
        failed.push({ feature: feature.name, error: error.message });
      }
    }
    
    return { installed, failed };
  },
  
  async installFeature(projectPath, featureName) {
    const kitDir = __dirname.replace(/scripts$/, '');
    const templatesDir = path.join(kitDir, 'templates');
    
    switch (featureName) {
      case 'Error Boundary':
        await this.copyFile(
          path.join(templatesDir, 'components', 'ErrorBoundary.tsx'),
          path.join(projectPath, 'src', 'components', 'ErrorBoundary.tsx')
        );
        await this.copyFile(
          path.join(templatesDir, 'components', 'ErrorBoundary.css'),
          path.join(projectPath, 'src', 'components', 'ErrorBoundary.css')
        );
        break;
      case '404 Page':
        await this.copyFile(
          path.join(templatesDir, 'pages', 'NotFound.tsx'),
          path.join(projectPath, 'src', 'pages', 'NotFound.tsx')
        );
        await this.copyFile(
          path.join(templatesDir, 'pages', 'NotFound.css'),
          path.join(projectPath, 'src', 'pages', 'NotFound.css')
        );
        break;
      case 'Breadcrumbs':
        await this.copyFile(
          path.join(templatesDir, 'components', 'Breadcrumbs.tsx'),
          path.join(projectPath, 'src', 'components', 'Breadcrumbs.tsx')
        );
        await this.copyFile(
          path.join(templatesDir, 'components', 'Breadcrumbs.css'),
          path.join(projectPath, 'src', 'components', 'Breadcrumbs.css')
        );
        break;
      case 'Loading States':
        await this.copyFile(
          path.join(templatesDir, 'components', 'LoadingState.tsx'),
          path.join(projectPath, 'src', 'components', 'LoadingState.tsx')
        );
        await this.copyFile(
          path.join(templatesDir, 'components', 'LoadingState.css'),
          path.join(projectPath, 'src', 'components', 'LoadingState.css')
        );
        break;
      case 'Empty States':
        await this.copyFile(
          path.join(templatesDir, 'components', 'EmptyState.tsx'),
          path.join(projectPath, 'src', 'components', 'EmptyState.tsx')
        );
        await this.copyFile(
          path.join(templatesDir, 'components', 'EmptyState.css'),
          path.join(projectPath, 'src', 'components', 'EmptyState.css')
        );
        break;
    }
  },
  
  async hasPackage(projectPath, pkg) {
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const pkgJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
      const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
      return !!deps[pkg];
    } catch {
      return false;
    }
  },
  
  async pathExists(p) {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  },
  
  async countRoutes(projectPath) {
    let count = 0;
    const appPath = path.join(projectPath, 'src', 'app');
    const pagesPath = path.join(projectPath, 'src', 'pages');
    
    async function findRoutes(dir) {
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            await findRoutes(fullPath);
          } else if (item.name === 'page.tsx' || item.name === 'page.jsx') {
            count++;
          }
        }
      } catch {}
    }
    
    if (await this.pathExists(appPath)) await findRoutes(appPath);
    if (await this.pathExists(pagesPath)) await findRoutes(pagesPath);
    return count;
  },
  
  async hasApiCalls(projectPath) {
    const srcPath = path.join(projectPath, 'src');
    if (!await this.pathExists(srcPath)) return false;
    
    async function findFiles(dir) {
      const files = [];
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...await findFiles(fullPath));
          } else if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
            files.push(fullPath);
          }
        }
      } catch {}
      return files;
    }
    
    const files = await findFiles(srcPath);
    for (const file of files.slice(0, 10)) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes('fetch(') || content.includes('axios.') || content.includes('api.')) {
          return true;
        }
      } catch {}
    }
    return false;
  },
  
  async hasListComponents(projectPath) {
    const srcPath = path.join(projectPath, 'src');
    if (!await this.pathExists(srcPath)) return false;
    
    async function findFiles(dir) {
      const files = [];
      try {
        const items = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(dir, item.name);
          if (item.isDirectory()) {
            files.push(...await findFiles(fullPath));
          } else if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
            files.push(fullPath);
          }
        }
      } catch {}
      return files;
    }
    
    const files = await findFiles(srcPath);
    for (const file of files) {
      try {
        const content = await fs.promises.readFile(file, 'utf8');
        if (content.includes('.map(') && content.includes('key=')) {
          return true;
        }
      } catch {}
    }
    return false;
  },
  
  async copyFile(source, target) {
    const targetDir = path.dirname(target);
    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.copyFile(source, target);
  },
};
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
║            🌱 Auto-Grow - Add Features Automatically        ║
║                                                              ║
║  Detects when your project needs error boundaries, 404s,     ║
║  breadcrumbs, loading states, and more - adds them!         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Analyzing project: ${projectPath}\n`);

  try {
    // Check what features should be added
    console.log('🔍 Checking what features your project needs...\n');
    const featuresToAdd = await projectGrowthManager.checkGrowth(projectPath);

    if (featuresToAdd.length === 0) {
      console.log('✅ Your project already has all recommended features!\n');
      rl.close();
      return;
    }

    console.log(`📋 Found ${featuresToAdd.length} feature(s) to add:\n`);

    featuresToAdd.forEach((feature, index) => {
      console.log(`${index + 1}. ${feature.name}`);
      console.log(`   ${feature.description}`);
      console.log(`   Priority: ${feature.priority}/10\n`);
    });

    const shouldInstall = await question('Install these features automatically? (yes/no): ');
    if (shouldInstall.toLowerCase() !== 'yes') {
      console.log('\n❌ Cancelled\n');
      rl.close();
      return;
    }

    console.log('\n🌱 Installing features...\n');
    const result = await projectGrowthManager.autoGrow(projectPath);

    if (result.installed.length > 0) {
      console.log('✅ Installed features:\n');
      result.installed.forEach((name) => {
        console.log(`   ✅ ${name}`);
      });
      console.log('');
    }

    if (result.failed.length > 0) {
      console.log('❌ Failed to install:\n');
      result.failed.forEach(({ feature, error }) => {
        console.log(`   ❌ ${feature}: ${error}`);
      });
      console.log('');
    }

    console.log('💡 Next steps:');
    console.log('   1. Review the new components');
    console.log('   2. Integrate them into your app');
    console.log('   3. Customize as needed\n');

    console.log('✅ Auto-grow complete!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

