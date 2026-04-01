#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function rewriteRuntimeImports(js, bundlesPath = './bundles') {
  // Rewrite workspace package imports to use bundled versions
  // Exact package requires: require("@guardrail/security") or require('@guardrail/security')
  js = js.replace(
    new RegExp('require\\(("|\')@guardrail/security\\1\\)', 'g'),
    `require('${bundlesPath}/guardrail-security')`
  );
  js = js.replace(
    new RegExp('require\\(("|\')@guardrail/core\\1\\)', 'g'),
    `require('${bundlesPath}/guardrail-core')`
  );
  js = js.replace(
    new RegExp('require\\(("|\')@guardrail/ship\\1\\)', 'g'),
    `require('${bundlesPath}/guardrail-ship')`
  );

  // Subpath requires: require("@guardrail/security/...")
  // For subpaths, we'll use the main bundle (they should export subpaths)
  js = js.replace(
    new RegExp('require\\(("|\')@guardrail/security/([^"\']+)\\1\\)', 'g'),
    (_m, _q, subpath) => {
      // Try to require from bundle, fallback to main export
      return `require('${bundlesPath}/guardrail-security')`;
    }
  );
  js = js.replace(
    new RegExp('require\\(("|\')@guardrail/core/([^"\']+)\\1\\)', 'g'),
    (_m, _q, subpath) => `require('${bundlesPath}/guardrail-core')`
  );
  js = js.replace(
    new RegExp('require\\(("|\')@guardrail/ship/([^"\']+)\\1\\)', 'g'),
    (_m, _q, subpath) => `require('${bundlesPath}/guardrail-ship')`
  );

  return js;
}

const files = walk(distDir).filter((p) => p.endsWith('.js'));
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Calculate relative path from this file to bundles directory
  const fileDir = path.dirname(file);
  const relativeToDist = path.relative(fileDir, distDir);
  let bundlesPath = path.join(relativeToDist, 'bundles').replace(/\\/g, '/');
  
  // Ensure path starts with ./ if it's a relative path
  if (!bundlesPath.startsWith('.')) {
    bundlesPath = './' + bundlesPath;
  }
  // Normalize: if path is empty or just '.', use './bundles'
  if (bundlesPath === '.' || bundlesPath === './') {
    bundlesPath = './bundles';
  }
  
  // Rewrite imports with correct relative path
  const next = rewriteRuntimeImports(content, bundlesPath);
  if (next !== content) {
    fs.writeFileSync(file, next);
  }
}

// Ensure the entrypoint has a shebang so npm doesn't strip the bin mapping.
const indexPath = path.join(distDir, 'index.js');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  if (!content.startsWith('#!/usr/bin/env node')) {
    fs.writeFileSync(indexPath, `#!/usr/bin/env node\n${content}`);
  }
}

console.log('Fixed runtime imports in dist output');
