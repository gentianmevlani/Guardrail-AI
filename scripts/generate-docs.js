#!/usr/bin/env node

/**
 * Documentation Generator CLI
 */

const { documentationGenerator } = require('../src/lib/documentation-generator');
const { cliUtils } = require('../src/lib/cli-utils');
const path = require('path');

async function main() {
  const filePath = process.argv[2];
  const projectPath = process.argv[3] || process.cwd();
  const format = process.argv[4] || 'markdown';
  const write = process.argv.includes('--write');

  if (!filePath) {
    cliUtils.error('Usage: generate-docs <file-path> [project-path] [format] [--write]');
    cliUtils.info('Format: markdown, jsdoc, tsdoc');
    process.exit(1);
  }

  cliUtils.section('📚 Documentation Generator');

  try {
    cliUtils.info(`Generating documentation for: ${filePath}`);
    cliUtils.info(`Format: ${format}\n`);

    const doc = await documentationGenerator.generate(filePath, projectPath, {
      format: format as any,
      includeExamples: true,
      includeAPI: true,
    });

    cliUtils.section('Generated Documentation');
    console.log(`Title: ${doc.title}`);
    console.log(`Description: ${doc.description}`);
    console.log(`Sections: ${doc.sections.length}`);
    console.log(`API Items: ${doc.api.length}\n`);

    for (const section of doc.sections) {
      console.log(`\n## ${section.title}`);
      console.log(section.content.substring(0, 200) + '...');
    }

    if (write) {
      const outputPath = await documentationGenerator.writeDocumentation(doc, undefined, format);
      cliUtils.success(`\nDocumentation written to: ${outputPath}`);
    } else {
      cliUtils.info('\nUse --write to save documentation');
    }

  } catch (error) {
    cliUtils.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();

