#!/usr/bin/env node

/**
 * Validate AI-Generated Code
 * 
 * Checks generated code for hallucinations and verifies against codebase
 */

const { codeGenerationValidator } = require('../src/lib/code-generation-validator');
const { cliUtils } = require('../src/lib/cli-utils');
const fs = require('fs');
const path = require('path');

async function main() {
  const codeFile = process.argv[2];
  const projectPath = process.argv[3] || process.cwd();
  const fix = process.argv.includes('--fix');

  if (!codeFile) {
    cliUtils.error('Usage: validate-generation <code-file> [project-path] [--fix]');
    process.exit(1);
  }

  cliUtils.section('🔍 AI Code Generation Validator');

  try {
    // Read generated code
    const generatedCode = await fs.promises.readFile(codeFile, 'utf8');
    const context = {
      file: codeFile,
      purpose: 'Code generation validation',
    };

    cliUtils.info(`Validating code from: ${codeFile}`);
    cliUtils.info(`Project: ${projectPath}\n`);

    if (fix) {
      // Validate and fix
      const result = await codeGenerationValidator.validateAndFix(
        generatedCode,
        projectPath,
        context
      );

      cliUtils.section('Validation Results');
      console.log(`Hallucination Score: ${result.validation.hallucinationScore}/100`);
      console.log(`Verification Score: ${result.validation.verificationScore}/100`);
      console.log(`Confidence: ${(result.validation.confidence * 100).toFixed(0)}%`);
      console.log(`Can Use: ${result.validation.canUse ? '✅ Yes' : '❌ No'}\n`);

      if (result.changes.length > 0) {
        cliUtils.section('Auto-Fixes Applied');
        result.changes.forEach((change, i) => {
          console.log(`${i + 1}. ${change.type}: ${change.description}`);
        });

        // Save fixed code
        const fixedFile = codeFile.replace(/\.(ts|tsx|js|jsx)$/, '.fixed.$1');
        await fs.promises.writeFile(fixedFile, result.fixed);
        cliUtils.success(`Fixed code saved to: ${fixedFile}`);
      }

      if (result.validation.issues.length > 0) {
        cliUtils.section('Issues Found');
        result.validation.issues.forEach((issue, i) => {
          const color = issue.severity === 'critical' ? 'red' :
                       issue.severity === 'high' ? 'yellow' : 'blue';
          console.log(`\n${i + 1}. ${cliUtils.colorize(`[${issue.severity.toUpperCase()}]`, color)} ${issue.type}`);
          console.log(`   ${issue.message}`);
          if (issue.fix) {
            console.log(`   Fix: ${issue.fix}`);
          }
        });
      }
    } else {
      // Just validate
      const validation = await codeGenerationValidator.validate(
        generatedCode,
        projectPath,
        context
      );

      cliUtils.section('Validation Results');
      console.log(`Hallucination Score: ${validation.hallucinationScore}/100`);
      console.log(`Verification Score: ${validation.verificationScore}/100`);
      console.log(`Confidence: ${(validation.confidence * 100).toFixed(0)}%`);
      console.log(`Can Use: ${validation.canUse ? '✅ Yes' : '❌ No'}`);
      console.log(`Is Valid: ${validation.isValid ? '✅ Yes' : '❌ No'}\n`);

      if (validation.issues.length > 0) {
        cliUtils.section('Issues Found');
        validation.issues.forEach((issue, i) => {
          const color = issue.severity === 'critical' ? 'red' :
                       issue.severity === 'high' ? 'yellow' : 'blue';
          console.log(`\n${i + 1}. ${cliUtils.colorize(`[${issue.severity.toUpperCase()}]`, color)} ${issue.type}`);
          console.log(`   ${issue.message}`);
          if (issue.fix) {
            console.log(`   Fix: ${issue.fix}`);
          }
        });
      }

      if (validation.recommendations.length > 0) {
        cliUtils.section('Recommendations');
        validation.recommendations.forEach(rec => {
          console.log(`  • ${rec}`);
        });
      }
    }

    cliUtils.success('\nValidation complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

