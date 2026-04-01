#!/usr/bin/env node

/**
 * AI Code Review CLI
 */

const { aiCodeReviewer } = require('../src/lib/ai-code-reviewer');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const filePath = process.argv[2];
  const projectPath = process.argv[3] || process.cwd();
  const focus = process.argv[4] || 'all';
  const strictness = process.argv[5] || 'moderate';

  if (!filePath) {
    cliUtils.error('Usage: review-code <file-path> [project-path] [focus] [strictness]');
    cliUtils.info('Focus: all, security, performance, quality');
    cliUtils.info('Strictness: strict, moderate, lenient');
    process.exit(1);
  }

  cliUtils.section('🔍 AI Code Review');

  try {
    cliUtils.info(`Reviewing: ${filePath}`);
    cliUtils.info(`Project: ${projectPath}\n`);

    const review = await aiCodeReviewer.review(filePath, projectPath, {
      focus: focus as any,
      strictness: strictness as any,
    });

    cliUtils.section('Review Results');
    console.log(`Overall Score: ${review.overallScore}/100`);
    console.log(`Confidence: ${(review.confidence * 100).toFixed(0)}%`);
    console.log(`Time: ${review.timeToReview.toFixed(2)}s`);
    console.log(`Comments: ${review.comments.length}\n`);

    if (review.comments.length === 0) {
      cliUtils.success('✅ No issues found!');
      return;
    }

    // Group by type
    const byType = new Map<string, typeof review.comments>();
    for (const comment of review.comments) {
      if (!byType.has(comment.type)) {
        byType.set(comment.type, []);
      }
      byType.get(comment.type)!.push(comment);
    }

    // Show comments
    for (const [type, comments] of byType.entries()) {
      cliUtils.section(`${type.toUpperCase()} (${comments.length})`);

      for (const comment of comments) {
        const color = comment.severity === 'critical' ? 'red' :
                     comment.severity === 'high' ? 'yellow' :
                     comment.severity === 'medium' ? 'blue' : 'gray';
        console.log(`\n${cliUtils.colorize(`[${comment.severity.toUpperCase()}]`, color)} Line ${comment.line}`);
        console.log(`  ${comment.message}`);
        if (comment.suggestion) {
          console.log(`  💡 ${comment.suggestion}`);
        }
        if (comment.code) {
          console.log(`  Code: ${comment.code.substring(0, 50)}...`);
        }
      }
    }

    if (review.recommendations.length > 0) {
      cliUtils.section('Recommendations');
      review.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    cliUtils.success('\nReview complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

