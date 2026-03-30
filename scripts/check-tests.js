const { execSync } = require('child_process');

console.log('Checking TypeScript compilation...\n');

try {
  // Try to compile TypeScript to see actual errors
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
} catch (error) {
  console.log('\nTypeScript compilation failed. See errors above.');
}
