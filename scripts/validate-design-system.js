#!/usr/bin/env node

/**
 * Design System Validator Script
 * 
 * Validates all components against the locked design system
 * Prevents inconsistent designs
 */

// Design validator (simplified for Node.js)
const designValidator = {
  validateComponent(filePath) {
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return { valid: false, issues: [{ severity: 'error', file: filePath, message: 'File not found', suggestion: 'Check file path' }], score: 0 };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];
    const colorPatterns = [/#[0-9A-Fa-f]{6}/g, /#[0-9A-Fa-f]{3}/g, /rgb\([^)]+\)/g, /rgba\([^)]+\)/g, /color:\s*['"](#[0-9A-Fa-f]{3,6}|rgb|rgba)/gi];
    lines.forEach((line, index) => {
      colorPatterns.forEach((pattern) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            issues.push({ severity: 'error', file: filePath, line: index + 1, message: `Hardcoded color: ${match}`, suggestion: 'Use design tokens' });
          });
        }
      });
    });
    const spacingPatterns = [/(?:padding|margin|gap|top|right|bottom|left):\s*\d+px/gi, /(?:padding|margin|gap|top|right|bottom|left):\s*\d+rem/gi];
    lines.forEach((line, index) => {
      spacingPatterns.forEach((pattern) => {
        const matches = line.match(pattern);
        if (matches) {
          matches.forEach((match) => {
            issues.push({ severity: 'warning', file: filePath, line: index + 1, message: `Hardcoded spacing: ${match}`, suggestion: 'Use design tokens' });
          });
        }
      });
    });
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;
    const score = Math.max(0, 100 - (errorCount * 20) - (warningCount * 5));
    return { valid: errorCount === 0, issues, score };
  },
  validateDirectory(dirPath) {
    const fs = require('fs');
    const path = require('path');
    const allIssues = [];
    let totalScore = 0;
    let fileCount = 0;
    function findFiles(dir) {
      const files = [];
      if (!fs.existsSync(dir)) return files;
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...findFiles(fullPath));
        } else if (item.name.endsWith('.tsx') || item.name.endsWith('.jsx') || item.name.endsWith('.ts') || item.name.endsWith('.js')) {
          files.push(fullPath);
        }
      }
      return files;
    }
    const files = findFiles(dirPath);
    files.forEach((file) => {
      const result = this.validateComponent(file);
      allIssues.push(...result.issues);
      totalScore += result.score;
      fileCount++;
    });
    const avgScore = fileCount > 0 ? Math.round(totalScore / fileCount) : 0;
    return { valid: allIssues.filter((i) => i.severity === 'error').length === 0, issues: allIssues, score: avgScore };
  },
  generateReport(result) {
    let report = `# Design System Validation Report\n\n**Overall Score: ${result.score}/100**\n\n`;
    if (result.valid) {
      report += `✅ **All components are consistent!**\n\n`;
    } else {
      report += `❌ **Found ${result.issues.length} issue(s)**\n\n`;
    }
    if (result.issues.length > 0) {
      const errors = result.issues.filter((i) => i.severity === 'error');
      const warnings = result.issues.filter((i) => i.severity === 'warning');
      if (errors.length > 0) {
        report += `### Errors (${errors.length})\n\n`;
        errors.forEach((issue, index) => {
          report += `${index + 1}. **${issue.file}${issue.line ? `:${issue.line}` : ''}**\n   ${issue.message}\n   💡 ${issue.suggestion}\n\n`;
        });
      }
      if (warnings.length > 0) {
        report += `### Warnings (${warnings.length})\n\n`;
        warnings.forEach((issue, index) => {
          report += `${index + 1}. **${issue.file}${issue.line ? `:${issue.line}` : ''}**\n   ${issue.message}\n\n`;
        });
      }
    }
    return report;
  },
};
const fs = require('fs');
const path = require('path');

function main() {
  console.log('🎨 Validating design system consistency...\n');

  const projectRoot = process.cwd();
  const componentsDir = path.join(projectRoot, 'src', 'components');
  const featuresDir = path.join(projectRoot, 'src', 'features');

  // Check if design system is locked
  const lockFile = path.join(projectRoot, '.design-system-lock.json');
  if (!fs.existsSync(lockFile)) {
    console.log('⚠️  No design system lock found.');
    console.log('   Run "npm run design-system" to create and lock a design system.\n');
    process.exit(1);
  }

  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
  console.log(`🔒 Design system locked: ${lock.theme}\n`);

  // Validate components
  const results = [];

  if (fs.existsSync(componentsDir)) {
    const result = designValidator.validateDirectory(componentsDir);
    results.push({ dir: 'components', ...result });
  }

  if (fs.existsSync(featuresDir)) {
    const result = designValidator.validateDirectory(featuresDir);
    results.push({ dir: 'features', ...result });
  }

  if (results.length === 0) {
    console.log('✅ No components found to validate.\n');
    process.exit(0);
  }

  // Aggregate results
  const allIssues = results.flatMap((r) => r.issues);
  const totalScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const hasErrors = allIssues.some((i) => i.severity === 'error');

  // Print summary
  console.log('📊 Validation Results:\n');
  results.forEach((result) => {
    console.log(`  ${result.dir}/:`);
    console.log(`    Score: ${result.score}/100`);
    console.log(`    Issues: ${result.issues.length}`);
    console.log(`    Errors: ${result.issues.filter((i) => i.severity === 'error').length}`);
    console.log(`    Warnings: ${result.issues.filter((i) => i.severity === 'warning').length}\n`);
  });

  console.log(`Overall Score: ${Math.round(totalScore)}/100\n`);

  // Print issues
  if (allIssues.length > 0) {
    const errors = allIssues.filter((i) => i.severity === 'error');
    const warnings = allIssues.filter((i) => i.severity === 'warning');

    if (errors.length > 0) {
      console.log('❌ Errors:\n');
      errors.slice(0, 10).forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        console.log(`     ${issue.message}`);
        console.log(`     💡 ${issue.suggestion}\n`);
      });
      if (errors.length > 10) {
        console.log(`  ... and ${errors.length - 10} more errors\n`);
      }
    }

    if (warnings.length > 0) {
      console.log('⚠️  Warnings:\n');
      warnings.slice(0, 5).forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.file}${issue.line ? `:${issue.line}` : ''}`);
        console.log(`     ${issue.message}\n`);
      });
      if (warnings.length > 5) {
        console.log(`  ... and ${warnings.length - 5} more warnings\n`);
      }
    }

    // Generate report file
    const report = designValidator.generateReport({
      valid: !hasErrors,
      issues: allIssues,
      score: Math.round(totalScore),
    });

    fs.writeFileSync(
      path.join(projectRoot, 'design-system-validation-report.md'),
      report
    );
    console.log('📄 Full report saved to: design-system-validation-report.md\n');
  }

  if (hasErrors) {
    console.log('❌ Validation failed. Fix errors to ensure design consistency.\n');
    process.exit(1);
  } else if (allIssues.length > 0) {
    console.log('⚠️  Validation passed with warnings. Consider fixing warnings for better consistency.\n');
    process.exit(0);
  } else {
    console.log('✅ All components are consistent with the design system!\n');
    process.exit(0);
  }
}

main();

