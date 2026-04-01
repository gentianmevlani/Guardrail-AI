#!/usr/bin/env node

/**
 * Fix catch (error: any) patterns to use proper error handling
 * This is a helper script to identify and suggest fixes
 */

const fs = require('fs');
const path = require('path');

function fixCatchAny(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern: catch (error: any)
  const catchAnyPattern = /catch\s*\(\s*error\s*:\s*any\s*\)/g;
  if (catchAnyPattern.test(content)) {
    content = content.replace(catchAnyPattern, 'catch (error)');
    modified = true;
  }

  // Pattern: catch (error: any) with error.message usage
  const lines = content.split('\n');
  const newLines = lines.map((line, index) => {
    if (line.includes('catch (error)') && index < lines.length - 1) {
      const nextLine = lines[index + 1];
      if (nextLine.includes('error.message') && !nextLine.includes('error instanceof Error')) {
        // Check if we need to add error handling
        return line;
      }
    }
    return line;
  });

  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }

  return false;
}

// Find all TypeScript files
function findTSFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.includes('node_modules') && !entry.name.includes('__tests__')) {
      findTSFiles(fullPath, files);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

const files = findTSFiles(path.join(process.cwd(), 'src'));
let fixed = 0;

files.forEach(file => {
  if (fixCatchAny(file)) {
    console.log(`Fixed: ${path.relative(process.cwd(), file)}`);
    fixed++;
  }
});

console.log(`\n✅ Fixed ${fixed} files`);


