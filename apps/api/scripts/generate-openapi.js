#!/usr/bin/env node

/**
 * Generate OpenAPI specification file
 */

const fs = require('fs');
const path = require('path');

async function generateOpenAPISpec() {
  try {
    // Import the server
    const { buildServer } = require('./dist/server.js');
    
    // Build the server
    const fastify = await buildServer();
    
    // Generate the OpenAPI specification
    const spec = fastify.swagger();
    
    // Write to file
    const outputPath = path.join(__dirname, '..', 'docs', 'openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(spec, null, 2));
    
    console.log('✅ OpenAPI specification generated successfully!');
    console.log(`📄 Location: ${outputPath}`);
    
    // Close the server
    await fastify.close();
  } catch (error) {
    console.error('❌ Failed to generate OpenAPI spec:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  generateOpenAPISpec();
}

module.exports = { generateOpenAPISpec };
