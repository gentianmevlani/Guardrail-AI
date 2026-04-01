#!/usr/bin/env node

/**
 * Natural Language Code Search CLI
 * Search your codebase by describing what the code does
 */

const { naturalLanguageSearch } = require('../src/lib/natural-language-search');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  const projectPath = process.cwd();

  try {
    switch (command) {
      case 'index':
        await indexCodebase(projectPath);
        break;

      case 'search':
        const query = args.slice(1).join(' ');
        if (!query) {
          console.error('❌ Please provide a search query');
          process.exit(1);
        }
        await searchCodebase(query, projectPath);
        break;

      case 'similar':
        const snippetFile = args[1];
        if (!snippetFile) {
          console.error('❌ Please provide a file path');
          process.exit(1);
        }
        await findSimilarCode(snippetFile, projectPath);
        break;

      case 'stats':
        showStats();
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

async function indexCodebase(projectPath) {
  console.log('🔍 Indexing codebase for natural language search...');
  console.log(`📁 Project: ${projectPath}\n`);

  const startTime = Date.now();
  await naturalLanguageSearch.indexCodebase(projectPath);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✅ Indexing complete in ${duration}s`);
  
  const stats = naturalLanguageSearch.getStats();
  console.log(`\n📊 Indexed ${stats.totalBlocks} code blocks:`);
  console.log(`   - Functions: ${stats.byType.function || 0}`);
  console.log(`   - Classes: ${stats.byType.class || 0}`);
  console.log(`   - Methods: ${stats.byType.method || 0}`);
  console.log(`   - Components: ${stats.byType.component || 0}`);
}

async function searchCodebase(query, projectPath) {
  console.log(`🔍 Searching for: "${query}"\n`);

  const results = await naturalLanguageSearch.search(query, 10);

  if (results.length === 0) {
    console.log('❌ No results found. Try indexing first with: npm run nl-search index');
    return;
  }

  console.log(`✅ Found ${results.length} results:\n`);

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.file}:${result.lineStart}`);
    console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    if (result.functionName) {
      console.log(`   Function: ${result.functionName}`);
    }
    console.log(`   ${result.description}`);
    console.log('');
  });
}

async function findSimilarCode(snippetFile, projectPath) {
  const fs = require('fs').promises;
  const fullPath = path.resolve(snippetFile);

  console.log(`🔍 Finding code similar to: ${snippetFile}\n`);

  const snippet = await fs.readFile(fullPath, 'utf-8');
  const results = await naturalLanguageSearch.findSimilarCode(snippet, 10);

  if (results.length === 0) {
    console.log('❌ No similar code found');
    return;
  }

  console.log(`✅ Found ${results.length} similar code blocks:\n`);

  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.file}:${result.lineStart}`);
    console.log(`   Similarity: ${(result.similarity * 100).toFixed(1)}%`);
    if (result.functionName) {
      console.log(`   Function: ${result.functionName}`);
    }
    console.log('');
  });
}

function showStats() {
  const stats = naturalLanguageSearch.getStats();
  
  console.log('📊 Natural Language Search Statistics\n');
  console.log(`Total indexed blocks: ${stats.totalBlocks}`);
  console.log('\nBy type:');
  Object.entries(stats.byType).forEach(([type, count]) => {
    console.log(`  - ${type}: ${count}`);
  });
  console.log('\nTop 10 files by blocks:');
  const sortedFiles = Object.entries(stats.byFile)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedFiles.forEach(([file, count]) => {
    console.log(`  - ${file}: ${count} blocks`);
  });
}

function showHelp() {
  console.log(`
🔍 Natural Language Code Search

Revolutionary code search that understands what your code DOES, not just keywords.

Commands:
  index              Index your codebase for natural language search
  search <query>     Search by describing what the code does
  similar <file>     Find code similar to a given file
  stats              Show indexing statistics
  help               Show this help message

Examples:
  npm run nl-search index
  npm run nl-search search "function that validates email addresses"
  npm run nl-search search "code that handles payment processing"
  npm run nl-search similar ./src/lib/auth.ts
  npm run nl-search stats

Features:
  ✅ Search by description, not keywords
  ✅ Find similar code across your project
  ✅ Context-aware results
  ✅ Semantic understanding
  ✅ Works with multiple languages

This is a UNIQUE feature - no other tool can do semantic code search like this!
  `);
}

main().catch(console.error);
