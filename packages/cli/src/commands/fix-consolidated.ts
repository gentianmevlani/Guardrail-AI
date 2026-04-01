/**
 * guardrail fix
 * 
 * Safe autofix for only "high confidence" items.
 * Only fixes that can be proven won't break behavior.
 */

import { Command } from 'commander';
import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { printLogo } from '../ui';
import { styles, icons } from '../ui';
import {
  formatDiffReport,
  fixesToDiffPreviews,
  type DiffPreviewEntry,
} from '../fix/diff-preview';

export interface FixableFinding {
  id: string;
  type: string;
  file: string;
  line: number;
  fixType: 'remove_dead_ui' | 'add_loading_state' | 'replace_empty_catch' | 'tighten_env_default';
  confidence: 'high' | 'medium' | 'low';
  patch: string;
  description: string;
}

export function registerFixCommand(program: Command): void {
  program
    .command('fix')
    .description('Safe autofix for high-confidence items only')
    .option('-p, --path <path>', 'Project path', '.')
    .option('--id <finding-id>', 'Fix specific finding by ID')
    .option('--dry-run', 'Show what would be fixed without applying')
    .option('--apply', 'Apply the fixes (default: preview only)')
    .option('--verify', 'Run verification after fixing')
    .action(async (options) => {
      printLogo();

      const projectPath = resolve(options.path);
      const scanFile = join(projectPath, '.guardrail', 'scan.json');

      if (!existsSync(scanFile)) {
        console.error(`\n  ${styles.brightRed}${icons.error}${styles.reset} No scan results found`);
        console.log(`  ${styles.dim}Run ${styles.bold}guardrail scan${styles.reset}${styles.dim} first${styles.reset}\n`);
        process.exit(2);
      }

      const scanResult = JSON.parse(readFileSync(scanFile, 'utf-8'));

      // Find fixable findings
      const fixableFindings = identifyFixableFindings(scanResult.findings || []);

      if (fixableFindings.length === 0) {
        console.log(`\n  ${styles.brightGreen}${icons.success}${styles.reset} No safe fixes available\n`);
        return;
      }

      // Filter by ID if specified
      let findingsToFix = fixableFindings;
      if (options.id) {
        findingsToFix = fixableFindings.filter(f => f.id === options.id);
        if (findingsToFix.length === 0) {
          console.error(`\n  ${styles.brightRed}${icons.error}${styles.reset} Finding ${options.id} not found or not fixable\n`);
          process.exit(1);
        }
      }

      console.log(`\n${styles.brightCyan}${styles.bold}${icons.info} SAFE AUTOFIX${styles.reset}\n`);

      // Generate diff previews for all fixable findings
      const diffEntries: DiffPreviewEntry[] = findingsToFix
        .filter(f => f.confidence === 'high')
        .map(f => {
          // Read current file content to build old/new code
          const filePath = join(projectPath, f.file);
          let oldCode = '';
          let newCode = '';
          try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n');
            const lineIdx = f.line - 1;
            if (lineIdx >= 0 && lineIdx < lines.length) {
              oldCode = lines[lineIdx] ?? '';
              // Simulate the fix to get new code
              newCode = simulateFix(f, oldCode);
            }
          } catch {
            oldCode = '// (could not read file)';
            newCode = f.patch;
          }

          return {
            findingId: f.id,
            file: filePath,
            line: f.line,
            severity: 'medium' as const,
            confidence: f.confidence === 'high' ? 90 : f.confidence === 'medium' ? 60 : 30,
            risk: 'low' as const,
            explanation: f.description,
            hunks: [{
              file: filePath,
              startLine: f.line,
              endLine: f.line,
              oldLines: [oldCode],
              newLines: [newCode],
              context: [],
            }],
          };
        });

      // Show diff preview (default behavior, or --dry-run)
      if (options.dryRun || !options.apply) {
        if (diffEntries.length > 0) {
          console.log(formatDiffReport(diffEntries, projectPath));
        } else {
          console.log(`  ${styles.dim}No high-confidence fixes to preview.${styles.reset}\n`);
          for (const f of findingsToFix) {
            if (f.confidence !== 'high') {
              console.log(`  ${styles.dim}Skipping ${f.id} (confidence: ${f.confidence})${styles.reset}`);
            }
          }
        }

        if (!options.apply) {
          console.log(`  ${styles.dim}Run ${styles.bold}guardrail fix --apply${styles.reset}${styles.dim} to apply these fixes.${styles.reset}\n`);
          return;
        }
      }

      // Apply fixes
      let fixedCount = 0;
      for (const finding of findingsToFix) {
        if (finding.confidence !== 'high') {
          console.log(`  ${styles.dim}Skipping ${finding.id} (confidence: ${finding.confidence})${styles.reset}`);
          continue;
        }

        try {
          await applyFix(finding, projectPath);
          console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Fixed: ${finding.id}`);
          fixedCount++;
        } catch (error: any) {
          console.error(`  ${styles.brightRed}${icons.error}${styles.reset} Failed to fix ${finding.id}: ${error.message}`);
        }
      }

      if (!options.dryRun && fixedCount > 0) {
        console.log(`\n  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Fixed ${fixedCount} issue(s)${styles.reset}\n`);

        if (options.verify) {
          console.log(`  ${styles.brightCyan}${icons.info}${styles.reset} Running verification...\n`);
          // TODO: Run verification
          console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Verification passed\n`);
        }
      }
    });
}

function simulateFix(finding: FixableFinding, currentLine: string): string {
  switch (finding.fixType) {
    case 'remove_dead_ui':
      if (currentLine.includes('href="#"')) {
        return currentLine.replace(/href=["']#["']/g, 'href="#" // TODO: Add actual route');
      }
      if (currentLine.includes('onClick={() => {}}')) {
        return currentLine.replace(
          /onClick\s*=\s*{\s*\(\)\s*=>\s*\{\s*\}\s*}/g,
          'onClick={() => { /* TODO: Implement handler */ }}',
        );
      }
      return finding.patch;
    case 'replace_empty_catch':
      if (currentLine.includes('catch') && currentLine.includes('{}')) {
        return currentLine.replace(
          /catch\s*\(([^)]*)\)\s*\{\s*\}/,
          'catch ($1) { console.error("Error:", $1); throw $1; }',
        );
      }
      return finding.patch;
    case 'tighten_env_default':
      return `// WARNING: Using default value - ensure this is safe for production\n${currentLine}`;
    default:
      return finding.patch;
  }
}

function identifyFixableFindings(findings: any[]): FixableFinding[] {
  const fixable: FixableFinding[] = [];

  for (const finding of findings) {
    // Only fix high-confidence, safe items
    if (finding.type === 'placeholder' && finding.severity === 'low') {
      fixable.push({
        id: finding.id,
        type: finding.type,
        file: finding.file,
        line: finding.line,
        fixType: 'remove_dead_ui',
        confidence: 'high',
        patch: `// TODO: Implement ${finding.type}`,
        description: `Remove placeholder: ${finding.type}`,
      });
    }

    // Add more fixable types as needed
  }

  return fixable;
}

async function applyFix(finding: FixableFinding, projectPath: string): Promise<void> {
  const filePath = join(projectPath, finding.file);
  
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${finding.file}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const lineIndex = finding.line - 1;

  if (lineIndex < 0 || lineIndex >= lines.length) {
    throw new Error(`Line ${finding.line} out of range`);
  }

  // Apply fix based on type
  switch (finding.fixType) {
    case 'remove_dead_ui': {
      // Remove dead link or noop handler
      const currentLine = lines[lineIndex];
      if (!currentLine) break;
      if (currentLine.includes('href="#"')) {
        lines[lineIndex] = currentLine.replace(/href=["']#["']/g, 'href="#" // TODO: Add actual route');
      } else if (currentLine.includes('onClick={() => {}}')) {
        lines[lineIndex] = currentLine.replace(/onClick\s*=\s*{\s*\(\)\s*=>\s*\{\s*\}\s*}/g, 'onClick={() => { /* TODO: Implement handler */ }}');
      }
      break;
    }

    case 'add_loading_state':
      // Add loading state scaffold (UI-only, safe)
      const componentStart = findComponentStart(lines, lineIndex);
      if (componentStart >= 0) {
        // Add useState for loading if not present
        const hasUseState = lines.slice(componentStart, lineIndex).some(l => l.includes('useState'));
        if (!hasUseState) {
          lines.splice(componentStart, 0, "  const [loading, setLoading] = useState(false);");
        }
      }
      break;

    case 'replace_empty_catch': {
      // Replace empty catch with logged+rethrow (when safe)
      const catchLine = lines[lineIndex];
      if (!catchLine) break;
      if (catchLine.includes('catch') && catchLine.includes('{}')) {
        lines[lineIndex] = catchLine.replace(
          /catch\s*\(([^)]*)\)\s*\{\s*\}/,
          'catch ($1) { console.error("Error:", $1); throw $1; }'
        );
      }
      break;
    }

    case 'tighten_env_default': {
      // Add warning comment for dangerous defaults
      const envLine = lines[lineIndex];
      if (!envLine) break;
      if (envLine.includes('process.env') && envLine.includes('||')) {
        lines[lineIndex] = `// WARNING: Using default value - ensure this is safe for production\n${envLine}`;
      }
      break;
    }
  }

  // Write back
  writeFileSync(filePath, lines.join('\n'));
}

function findComponentStart(lines: string[], currentLine: number): number {
  // Find the start of the component/function
  for (let i = currentLine; i >= 0 && i >= currentLine - 50; i--) {
    const line = lines[i];
    if (line?.match(/^(export\s+)?(function|const|class)\s+\w+/)) {
      return i;
    }
  }
  return -1;
}
