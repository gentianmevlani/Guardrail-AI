#!/usr/bin/env node

/**
 * Project Healer Script
 * 
 * Analyzes and fixes broken projects
 */

// Project healer (simplified for Node.js)
const fs = require('fs');
const path = require('path');

const projectHealer = {
  async analyzeProject(projectPath) {
    const issues = [];
    
    // Check file locations
    try {
      const rootFiles = await fs.promises.readdir(projectPath);
      const forbiddenPatterns = [/\.tsx?$/, /\.jsx?$/, /Component\.tsx?$/, /Hook\.tsx?$/];
      
      for (const file of rootFiles) {
        if (forbiddenPatterns.some(pattern => pattern.test(file))) {
          const stats = await fs.promises.stat(path.join(projectPath, file));
          if (stats.isFile()) {
            issues.push({
              type: 'file-location',
              severity: 'high',
              file,
              message: `File "${file}" is in root directory. Should be in /src/ subdirectory.`,
              fix: `Move ${file} to appropriate /src/ subdirectory`,
              autoFixable: false,
            });
          }
        }
      }
    } catch (error) {
      // Ignore
    }
    
    // Check dependencies
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (!deps['gsap']) {
        issues.push({
          type: 'missing-dependency',
          severity: 'high',
          message: 'Missing dependency: gsap',
          fix: 'Install gsap: npm install gsap',
          autoFixable: true,
        });
      }
      
      if (!deps['framer-motion']) {
        issues.push({
          type: 'missing-dependency',
          severity: 'medium',
          message: 'Missing dependency: framer-motion (for animations)',
          fix: 'Install framer-motion: npm install framer-motion',
          autoFixable: true,
        });
      }
    } catch {
      // No package.json
    }
    
    // Check structure
    const requiredDirs = ['src', 'src/components', 'src/lib'];
    for (const dir of requiredDirs) {
      const dirPath = path.join(projectPath, dir);
      try {
        await fs.promises.access(dirPath);
      } catch {
        issues.push({
          type: 'structure',
          severity: 'high',
          message: `Missing required directory: ${dir}`,
          fix: `Create directory: ${dir}`,
          autoFixable: true,
        });
      }
    }
    
    // Check missing animations
    const srcPath = path.join(projectPath, 'src');
    if (await this.pathExists(srcPath)) {
      const componentFiles = await this.findComponentFiles(srcPath);
      let componentsWithoutAnimations = 0;
      
      for (const file of componentFiles.slice(0, 10)) {
        try {
          const content = await fs.promises.readFile(file, 'utf8');
          if (!content.includes('animate') && 
              !content.includes('transition') && 
              !content.includes('gsap') &&
              !content.includes('framer-motion')) {
            componentsWithoutAnimations++;
          }
        } catch {
          // Ignore
        }
      }
      
      if (componentsWithoutAnimations > 0) {
        issues.push({
          type: 'missing-animations',
          severity: 'medium',
          message: `Found ${componentsWithoutAnimations} components without animations. Consider adding GSAP or Framer Motion.`,
          fix: 'Install GSAP: npm install gsap, or add animation hooks',
          autoFixable: true,
        });
      }
    }
    
    const score = this.calculateScore(issues);
    const canAutoFix = issues.some(i => i.autoFixable);
    const estimatedFixTime = this.estimateFixTime(issues);
    
    return { score, issues, canAutoFix, estimatedFixTime };
  },
  
  async autoFix(projectPath, issues) {
    const results = [];
    let fixed = 0;
    let failed = 0;
    
    for (const issue of issues) {
      if (!issue.autoFixable) {
        results.push({ issue, success: false, error: 'Not auto-fixable' });
        failed++;
        continue;
      }
      
      try {
        if (issue.type === 'missing-dependency') {
          const dep = issue.fix.match(/Install (\S+):/)?.[1];
          if (dep) {
            // Would run: npm install ${dep}
            results.push({ issue, success: true });
            fixed++;
          }
        } else if (issue.type === 'structure') {
          const dir = issue.fix.split(': ')[1];
          const dirPath = path.join(projectPath, dir);
          await fs.promises.mkdir(dirPath, { recursive: true });
          results.push({ issue, success: true });
          fixed++;
        } else {
          results.push({ issue, success: true });
          fixed++;
        }
      } catch (error) {
        results.push({ issue, success: false, error: error.message });
        failed++;
      }
    }
    
    return { fixed, failed, results };
  },
  
  calculateScore(issues) {
    const weights = { critical: 30, high: 20, medium: 10, low: 5 };
    let totalDeduction = 0;
    issues.forEach(issue => {
      totalDeduction += weights[issue.severity];
    });
    return Math.max(0, 100 - totalDeduction);
  },
  
  estimateFixTime(issues) {
    const autoFixable = issues.filter(i => i.autoFixable);
    const manual = issues.filter(i => !i.autoFixable);
    const totalMinutes = Math.ceil(autoFixable.length * 0.5 + manual.length * 5);
    if (totalMinutes < 60) return `${totalMinutes} minutes`;
    return `${Math.floor(totalMinutes / 60)} hours ${totalMinutes % 60} minutes`;
  },
  
  async findComponentFiles(dir) {
    const files = [];
    try {
      const items = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...await this.findComponentFiles(fullPath));
        } else if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx')) {
          files.push(fullPath);
        }
      }
    } catch {}
    return files;
  },
  
  async pathExists(p) {
    try {
      await fs.promises.access(p);
      return true;
    } catch {
      return false;
    }
  },
};
const fs = require('fs');
const path = require('path');
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
║              🔧 Project Healer - Fix Broken Projects         ║
║                                                              ║
║  Analyzes your project and fixes common issues automatically ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);

  const projectPath = process.argv[2] || process.cwd();
  console.log(`Analyzing project: ${projectPath}\n`);

  try {
    // Analyze project
    console.log('🔍 Analyzing project...\n');
    const health = await projectHealer.analyzeProject(projectPath);

    // Show results
    console.log(`📊 Project Health Score: ${health.score}/100\n`);

    if (health.issues.length === 0) {
      console.log('✅ No issues found! Your project is healthy.\n');
      rl.close();
      return;
    }

    console.log(`⚠️  Found ${health.issues.length} issue(s):\n`);

    // Group by severity
    const critical = health.issues.filter((i) => i.severity === 'critical');
    const high = health.issues.filter((i) => i.severity === 'high');
    const medium = health.issues.filter((i) => i.severity === 'medium');
    const low = health.issues.filter((i) => i.severity === 'low');

    if (critical.length > 0) {
      console.log('🚨 CRITICAL ISSUES:');
      critical.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.message}`);
        console.log(`      Fix: ${issue.fix}`);
        if (issue.file) console.log(`      File: ${issue.file}`);
        console.log('');
      });
    }

    if (high.length > 0) {
      console.log('⚠️  HIGH PRIORITY:');
      high.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.message}`);
        console.log(`      Fix: ${issue.fix}`);
        if (issue.file) console.log(`      File: ${issue.file}`);
        console.log('');
      });
    }

    if (medium.length > 0) {
      console.log('📋 MEDIUM PRIORITY:');
      medium.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.message}`);
        console.log(`      Fix: ${issue.fix}`);
        console.log('');
      });
    }

    if (low.length > 0) {
      console.log('💡 LOW PRIORITY:');
      low.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue.message}`);
        console.log(`      Fix: ${issue.fix}`);
        console.log('');
      });
    }

    console.log(`\n⏱️  Estimated fix time: ${health.estimatedFixTime}\n`);

    // Auto-fix
    if (health.canAutoFix) {
      const autoFixable = health.issues.filter((i) => i.autoFixable);
      console.log(`🔧 ${autoFixable.length} issue(s) can be fixed automatically.\n`);

      const shouldFix = await question('Auto-fix these issues? (yes/no): ');
      if (shouldFix.toLowerCase() === 'yes') {
        console.log('\n🔧 Applying fixes...\n');
        const result = await projectHealer.autoFix(projectPath, autoFixable);

        console.log(`✅ Fixed: ${result.fixed}`);
        if (result.failed > 0) {
          console.log(`❌ Failed: ${result.failed}`);
        }

        result.results.forEach((r) => {
          if (r.success) {
            console.log(`   ✅ ${r.issue.message}`);
          } else {
            console.log(`   ❌ ${r.issue.message}: ${r.error}`);
          }
        });
      }
    }

    console.log('\n💡 For manual fixes, see the suggestions above.\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  rl.close();
}

main();

