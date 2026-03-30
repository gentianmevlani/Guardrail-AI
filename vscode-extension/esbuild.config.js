// @ts-check
const esbuild = require('esbuild');
const path = require('path');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
  entryPoints: ['./src/extension.ts'],
  bundle: true,
  outfile: './dist/extension.js',
  external: ['vscode'], // VS Code API is provided at runtime
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  metafile: true,
  
  // Keep class names for better error messages
  keepNames: true,
  
  // Define for dead code elimination
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"',
  },
  
  // Resolve aliases
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
  
  plugins: [
    // Bundle size analyzer
    {
      name: 'bundle-analyzer',
      setup(build) {
        build.onEnd(async (result) => {
          if (result.metafile) {
            const analysis = await esbuild.analyzeMetafile(result.metafile, {
              verbose: false,
            });
            
            // Calculate total size
            const outputs = result.metafile.outputs;
            let totalSize = 0;
            for (const [file, data] of Object.entries(outputs)) {
              totalSize += data.bytes;
            }
            
            console.log(`\n📦 Bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
            
            if (!production) {
              console.log('\nTop modules by size:');
              console.log(analysis.split('\n').slice(0, 15).join('\n'));
            }
          }
        });
      },
    },
    
    // Watch mode logging
    {
      name: 'watch-logger',
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length > 0) {
            console.error(`❌ Build failed with ${result.errors.length} errors`);
          } else {
            const time = new Date().toLocaleTimeString();
            console.log(`✅ [${time}] Build succeeded`);
          }
        });
      },
    },
  ],
  
  // Log level
  logLevel: 'info',
};

/** @type {esbuild.BuildOptions} */
const webviewConfig = {
  entryPoints: ['./src/webview/index.tsx'],
  bundle: true,
  outfile: './dist/webview.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  sourcemap: !production,
  minify: production,
  treeShaking: true,
  
  // External CDN dependencies (loaded via script tags in webview HTML)
  external: [],
  
  define: {
    'process.env.NODE_ENV': production ? '"production"' : '"development"',
  },
  
  loader: {
    '.svg': 'dataurl',
    '.png': 'dataurl',
  },
};

async function build() {
  try {
    if (watch) {
      // Watch mode
      const extensionCtx = await esbuild.context(extensionConfig);
      await extensionCtx.watch();
      console.log('👀 Watching for changes...\n');
    } else {
      // Single build
      console.log(production ? '🚀 Production build...' : '🔧 Development build...');
      
      const start = Date.now();
      await esbuild.build(extensionConfig);
      
      // Only build webview if entry exists
      const fs = require('fs');
      if (fs.existsSync('./src/webview/index.tsx')) {
        await esbuild.build(webviewConfig);
      }
      
      console.log(`\n✨ Done in ${Date.now() - start}ms`);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

build();
