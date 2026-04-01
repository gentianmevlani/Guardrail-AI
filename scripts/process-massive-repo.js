#!/usr/bin/env node

/**
 * Massive Repository Processor CLI
 * 
 * Efficiently processes repositories with 1-2 million+ lines of code
 */

const { massiveRepoProcessor } = require('../src/lib/massive-repo-processor');
const { smartFileFilter } = require('../src/lib/smart-file-filter');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const projectPath = process.argv[2] || process.cwd();
  const resume = process.argv.includes('--resume');
  const gitTracked = process.argv.includes('--git-tracked');
  const recent = process.argv.find(arg => arg.startsWith('--recent='));

  cliUtils.section('🚀 Massive Repository Processor');

  try {
    cliUtils.info(`Processing repository: ${projectPath}`);
    cliUtils.info(`This may take a while for large repositories...\n`);

    // Smart file filtering
    cliUtils.info('Filtering files...');
    const { files, stats } = await smartFileFilter.filterFiles(projectPath, {
      gitTracked,
      recentlyModified: recent ? parseInt(recent.split('=')[1]) : undefined,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      languages: ['typescript', 'javascript'],
    });

    cliUtils.success(`Found ${files.length} files to process`);
    cliUtils.info(`Excluded: ${stats.excluded} files`);
    console.log(`  Reasons:`, stats.byReason);
    console.log('');

    // Progress tracking
    const progressBar = cliUtils.createProgressBar({
      total: files.length,
      showPercentage: true,
      showCount: true,
    });

    massiveRepoProcessor.on('progress', (progress) => {
      progressBar.update(progress.processedFiles);
      if (progress.currentFile) {
        process.stdout.write(`\n  Current: ${progress.currentFile}`);
      }
    });

    massiveRepoProcessor.on('memory-warning', (usage) => {
      cliUtils.warning(`Memory usage: ${usage.toFixed(2)}MB`);
    });

    // Process repository
    const result = await massiveRepoProcessor.processRepository(
      projectPath,
      async (file, content) => {
        // Your processing logic here
        return {
          file,
          lines: content.split('\n').length,
          size: content.length,
        };
      },
      {
        maxWorkers: 8,
        chunkSize: 100,
        resumeFrom: resume ? '.guardrail-checkpoint.json' : undefined,
        skipPatterns: [
          'node_modules/**',
          'dist/**',
          'build/**',
          '**/*.min.js',
        ],
      }
    );

    progressBar.complete();

    // Results
    cliUtils.section('Processing Complete');
    console.log(`Processed: ${result.processed} files`);
    console.log(`Skipped: ${result.skipped} files`);
    console.log(`Errors: ${result.errors}`);
    console.log(`Duration: ${(result.duration / 1000).toFixed(2)}s`);
    
    if (result.checkpoint) {
      cliUtils.info(`Checkpoint saved: ${result.checkpoint}`);
      cliUtils.info('Use --resume flag to continue from checkpoint');
    }

    cliUtils.success('Processing complete!');

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

