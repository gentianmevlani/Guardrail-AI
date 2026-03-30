#!/usr/bin/env node

/**
 * AI Code Explainer CLI
 * Explains any code in plain English
 */

const { aiCodeExplainer } = require('../src/lib/ai-code-explainer');
const fs = require('fs').promises;
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  try {
    switch (command) {
      case 'explain':
        const file = args[1];
        if (!file) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await explainFile(file, args[2] || 'intermediate');
        break;

      case 'diff':
        const file1 = args[1];
        const file2 = args[2];
        if (!file1 || !file2) {
          console.error('❌ Please provide two file paths to compare');
          process.exit(1);
        }
        await explainDiff(file1, file2);
        break;

      case 'ask':
        const codeFile = args[1];
        const question = args.slice(2).join(' ');
        if (!codeFile || !question) {
          console.error('❌ Usage: npm run explain ask <file> <question>');
          process.exit(1);
        }
        await askAboutCode(codeFile, question);
        break;

      case 'algorithm':
        const algoFile = args[1];
        if (!algoFile) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await explainAlgorithm(algoFile);
        break;

      default:
        console.error(`❌ Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function explainFile(file, level) {
  const fullPath = path.resolve(file);
  const code = await fs.readFile(fullPath, 'utf-8');

  console.log(`🤖 Explaining code from: ${file}\n`);

  const explanation = await aiCodeExplainer.explainCode({
    code,
    file: fullPath,
    experienceLevel: level,
  });

  console.log('📝 Summary:');
  console.log(`   ${explanation.summary}\n`);

  console.log('🎯 Purpose:');
  console.log(`   ${explanation.purpose}\n`);

  if (explanation.howItWorks.length > 0) {
    console.log('⚙️  How it works:');
    explanation.howItWorks.forEach(step => {
      console.log(`   ${step}`);
    });
    console.log('');
  }

  if (explanation.keyComponents.length > 0) {
    console.log('🔑 Key Components:');
    explanation.keyComponents.forEach(comp => {
      const icon = comp.importance === 'critical' ? '🔴' : comp.importance === 'important' ? '🟡' : '🟢';
      console.log(`   ${icon} ${comp.name}: ${comp.description}`);
    });
    console.log('');
  }

  if (explanation.edgeCases.length > 0) {
    console.log('⚠️  Edge Cases:');
    explanation.edgeCases.forEach(edge => {
      console.log(`   - ${edge}`);
    });
    console.log('');
  }

  if (explanation.potentialIssues && explanation.potentialIssues.length > 0) {
    console.log('🚨 Potential Issues:');
    explanation.potentialIssues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
    console.log('');
  }

  if (explanation.improvementSuggestions && explanation.improvementSuggestions.length > 0) {
    console.log('💡 Improvement Suggestions:');
    explanation.improvementSuggestions.forEach(suggestion => {
      console.log(`   - ${suggestion}`);
    });
  }
}

async function explainDiff(file1, file2) {
  const code1 = await fs.readFile(path.resolve(file1), 'utf-8');
  const code2 = await fs.readFile(path.resolve(file2), 'utf-8');

  console.log(`📊 Comparing ${file1} vs ${file2}\n`);

  const diff = await aiCodeExplainer.explainDiff(code1, code2);

  console.log('📝 What Changed:');
  console.log(`   ${diff.whatChanged}\n`);

  console.log('🤔 Why Changed:');
  console.log(`   ${diff.whyChanged}\n`);

  console.log('💥 Impact:');
  console.log(`   ${diff.impact}\n`);

  if (diff.risks.length > 0) {
    console.log('⚠️  Risks:');
    diff.risks.forEach(risk => console.log(`   - ${risk}`));
    console.log('');
  }

  if (diff.benefits.length > 0) {
    console.log('✅ Benefits:');
    diff.benefits.forEach(benefit => console.log(`   - ${benefit}`));
  }
}

async function askAboutCode(file, question) {
  const code = await fs.readFile(path.resolve(file), 'utf-8');

  console.log(`❓ Question: "${question}"\n`);

  const answer = await aiCodeExplainer.askAboutCode(code, question, {
    file: path.resolve(file),
  });

  console.log('💬 Answer:');
  console.log(`   ${answer.answer}`);
  console.log(`   Confidence: ${(answer.confidence * 100).toFixed(0)}%\n`);

  if (answer.relatedInformation.length > 0) {
    console.log('📚 Related Information:');
    answer.relatedInformation.forEach(info => console.log(`   - ${info}`));
    console.log('');
  }

  if (answer.suggestions.length > 0) {
    console.log('💡 Follow-up Questions:');
    answer.suggestions.forEach(suggestion => console.log(`   - ${suggestion}`));
  }
}

async function explainAlgorithm(file) {
  const code = await fs.readFile(path.resolve(file), 'utf-8');

  console.log(`🔬 Analyzing algorithm in: ${file}\n`);

  const algo = await aiCodeExplainer.explainAlgorithm(code);

  console.log('📋 Algorithm:');
  console.log(`   ${algo.algorithmName}\n`);

  console.log('⏱️  Time Complexity:');
  console.log(`   ${algo.timeComplexity}\n`);

  console.log('💾 Space Complexity:');
  console.log(`   ${algo.spaceComplexity}\n`);

  if (algo.stepByStep.length > 0) {
    console.log('📖 Step by Step:');
    algo.stepByStep.forEach(step => {
      console.log(`   ${step.step}. ${step.description}`);
      console.log(`      ${step.code}`);
    });
    console.log('');
  }

  if (algo.whenToUse.length > 0) {
    console.log('✅ When to Use:');
    algo.whenToUse.forEach(use => console.log(`   - ${use}`));
    console.log('');
  }

  if (algo.alternatives.length > 0) {
    console.log('🔄 Alternatives:');
    algo.alternatives.forEach(alt => console.log(`   - ${alt}`));
  }
}

function showHelp() {
  console.log(`
🤖 AI Code Explainer

Explains ANY code in plain English with context, intent, and business logic.

Commands:
  explain <file> [level]     Explain code in a file (level: beginner/intermediate/expert)
  diff <file1> <file2>       Explain what changed between two files
  ask <file> <question>      Ask a question about code
  algorithm <file>           Explain algorithm step-by-step
  help                       Show this help message

Examples:
  npm run explain explain src/api/users.ts
  npm run explain explain src/auth.ts beginner
  npm run explain diff old-file.js new-file.js
  npm run explain ask src/utils.ts "what does this function do?"
  npm run explain algorithm src/sort.ts

Features:
  ✅ Explains code at any experience level
  ✅ Understands context and business logic
  ✅ Identifies edge cases and issues
  ✅ Suggests improvements
  ✅ Answers specific questions about code
  ✅ Explains algorithms step-by-step

This is a UNIQUE feature - explains code like a senior developer would!
  `);
}

main().catch(console.error);
