#!/usr/bin/env node

/**
 * Bundle Analysis Script
 * 
 * Analyzes bundle size and provides recommendations for optimization
 * Usage: node scripts/analyze-bundle.js
 */

const fs = require('fs');
const path = require('path');
const { gzipSync } = require('zlib');

// Bundle size thresholds (in bytes)
const THRESHOLDS = {
  TOTAL_BUNDLE: 244000, // 244KB (recommended by Next.js)
  CHUNK_SIZE: 100000,   // 100KB per chunk
  FIRST_LOAD: 150000,   // 150KB for first load JS
};

// Common heavy libraries and their alternatives
const HEAVY_LIBRARIES = {
  'three': {
    size: '~600KB',
    alternatives: ['Dynamic import', 'Use only needed modules'],
    description: '3D graphics library'
  },
  'framer-motion': {
    size: '~100KB', 
    alternatives: ['CSS animations', 'Import specific components'],
    description: 'Animation library'
  },
  'date-fns': {
    size: '~75KB',
    alternatives: ['Import specific functions', 'Native Date API'],
    description: 'Date utility library'
  },
  'lodash': {
    size: '~70KB',
    alternatives: ['Import specific functions', 'Native JS methods'],
    description: 'Utility library'
  },
  'gsap': {
    size: '~80KB',
    alternatives: ['CSS animations', 'Framer Motion'],
    description: 'Animation library'
  }
};

function analyzeBundle() {
  console.log('🔍 Analyzing bundle size...\n');

  try {
    // Read the build output
    const buildManifestPath = path.join(process.cwd(), '.next/build-manifest.json');
    const manifestsPath = path.join(process.cwd(), '.next/manifest.json');

    if (!fs.existsSync(buildManifestPath)) {
      console.error('❌ Build manifest not found. Run `npm run build` first.');
      process.exit(1);
    }

    const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
    const manifests = fs.existsSync(manifestsPath) 
      ? JSON.parse(fs.readFileSync(manifestsPath, 'utf8')) 
      : {};

    // Analyze pages
    let totalSize = 0;
    let firstLoadJS = 0;
    const pageAnalysis = [];

    for (const [page, files] of Object.entries(buildManifest.pages)) {
      let pageSize = 0;
      const pageFiles = [];

      for (const file of files) {
        const filePath = path.join('.next', file);
        if (fs.existsSync(filePath)) {
          const fileContent = fs.readFileSync(filePath);
          const fileSize = fileContent.length;
          const gzippedSize = gzipSync(fileContent).length;
          
          pageSize += fileSize;
          pageFiles.push({
            file,
            size: fileSize,
            gzippedSize,
            sizeKB: (fileSize / 1024).toFixed(2),
            gzippedKB: (gzippedSize / 1024).toFixed(2)
          });
        }
      }

      totalSize += pageSize;
      
      // Calculate first load JS (shared chunks + page specific)
      if (page === '/_app' || page === '/') {
        firstLoadJS = pageSize;
      }

      pageAnalysis.push({
        page,
        size: pageSize,
        sizeKB: (pageSize / 1024).toFixed(2),
        files: pageFiles
      });
    }

    // Sort pages by size
    pageAnalysis.sort((a, b) => b.size - a.size);

    // Print analysis
    console.log('📊 Bundle Size Analysis\n');
    console.log(`Total bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
    console.log(`First load JS: ${(firstLoadJS / 1024).toFixed(2)} KB\n`);

    // Check thresholds
    console.log('🚦 Threshold Analysis\n');
    
    if (totalSize > THRESHOLDS.TOTAL_BUNDLE) {
      console.log(`❌ Total bundle exceeds ${(THRESHOLDS.TOTAL_BUNDLE / 1024).toFixed(0)}KB`);
    } else {
      console.log(`✅ Total bundle within limit`);
    }

    if (firstLoadJS > THRESHOLDS.FIRST_LOAD) {
      console.log(`❌ First load JS exceeds ${(THRESHOLDS.FIRST_LOAD / 1024).toFixed(0)}KB`);
    } else {
      console.log(`✅ First load JS within limit`);
    }

    console.log('\n📈 Page Breakdown\n');
    pageAnalysis.slice(0, 10).forEach(({ page, sizeKB, files }) => {
      console.log(`${page}: ${sizeKB} KB`);
      files.forEach(({ file, sizeKB, gzippedKB }) => {
        console.log(`  └─ ${file}: ${sizeKB} KB (${gzippedKB} KB gzipped)`);
      });
    });

    // Analyze package.json for heavy libraries
    console.log('\n📦 Heavy Library Analysis\n');
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = packageJson.dependencies || {};
      
      Object.keys(HEAVY_LIBRARIES).forEach(lib => {
        if (dependencies[lib]) {
          const info = HEAVY_LIBRARIES[lib];
          console.log(`⚠️  ${lib} (${info.size})`);
          console.log(`   Description: ${info.description}`);
          console.log(`   Alternatives: ${info.alternatives.join(', ')}`);
          console.log('');
        }
      });
    }

    // Recommendations
    console.log('💡 Optimization Recommendations\n');
    
    if (totalSize > THRESHOLDS.TOTAL_BUNDLE) {
      console.log('1. Reduce total bundle size:');
      console.log('   - Use dynamic imports for heavy components');
      console.log('   - Remove unused dependencies');
      console.log('   - Implement code splitting');
      console.log('');
    }

    if (firstLoadJS > THRESHOLDS.FIRST_LOAD) {
      console.log('2. Reduce first load JS:');
      console.log('   - Defer non-critical JavaScript');
      console.log('   - Use loading states for heavy components');
      console.log('   - Implement progressive loading');
      console.log('');
    }

    console.log('3. General optimizations:');
    console.log('   - Enable compression (gzip/brotli)');
    console.log('   - Use CDN for static assets');
    console.log('   - Implement proper caching headers');
    console.log('   - Optimize images with next/image');
    console.log('   - Use tree-shaking for libraries');

  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
    process.exit(1);
  }
}

// Run the analysis
analyzeBundle();
