import * as readline from 'readline';
import { FixPack } from './engine';

export interface SelectionResult {
  selectedPacks: FixPack[];
  cancelled: boolean;
}

export class InteractiveSelector {
  private isTTY: boolean;

  constructor() {
    this.isTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  }

  /**
   * Interactive checkbox selection for fix packs
   */
  async selectPacks(packs: FixPack[]): Promise<SelectionResult> {
    if (!this.isTTY) {
      // Non-interactive: select all by default
      return {
        selectedPacks: packs,
        cancelled: false,
      };
    }

    const selected = new Set<number>();
    let currentIndex = 0;

    // Initially select all packs
    packs.forEach((_, i) => selected.add(i));

    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const render = () => {
        console.clear();
        console.log('\x1b[1m\x1b[36mSelect Fix Packs to Apply\x1b[0m');
        console.log('\x1b[2m─────────────────────────────────────────────────────────\x1b[0m');
        console.log('');
        
        packs.forEach((pack, i) => {
          const isSelected = selected.has(i);
          const isCurrent = i === currentIndex;
          
          const checkbox = isSelected ? '\x1b[32m[✓]\x1b[0m' : '\x1b[31m[ ]\x1b[0m';
          const cursor = isCurrent ? '\x1b[36m❯\x1b[0m' : ' ';
          const riskColor = pack.estimatedRisk === 'high' ? '\x1b[31m' :
                           pack.estimatedRisk === 'medium' ? '\x1b[33m' : '\x1b[32m';
          
          console.log(`  ${cursor} ${checkbox} \x1b[1m${pack.name}\x1b[0m`);
          console.log(`      \x1b[2m${pack.description}\x1b[0m`);
          console.log(`      \x1b[2mFixes: ${pack.fixes.length} | Risk: ${riskColor}${pack.estimatedRisk}\x1b[0m | Confidence: ${(pack.confidence * 100).toFixed(0)}%`);
          console.log('');
        });
        
        console.log('\x1b[2m─────────────────────────────────────────────────────────\x1b[0m');
        console.log('\x1b[2mControls: ↑/↓ Navigate | Space Toggle | Enter Confirm | Q Quit\x1b[0m');
      };

      render();

      // Enable raw mode for key detection
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
      
      process.stdin.on('data', (key) => {
        const char = key.toString();
        
        if (char === '\u0003' || char.toLowerCase() === 'q') {
          // Ctrl+C or Q - quit
          if (process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
          }
          rl.close();
          resolve({
            selectedPacks: [],
            cancelled: true,
          });
        } else if (char === '\r' || char === '\n') {
          // Enter - confirm
          if (process.stdin.setRawMode) {
            process.stdin.setRawMode(false);
          }
          rl.close();
          const selectedPacks = packs.filter((_, i) => selected.has(i));
          resolve({
            selectedPacks,
            cancelled: false,
          });
        } else if (char === ' ') {
          // Space - toggle selection
          if (selected.has(currentIndex)) {
            selected.delete(currentIndex);
          } else {
            selected.add(currentIndex);
          }
          render();
        } else if (char === '\u001b[A') {
          // Up arrow
          currentIndex = Math.max(0, currentIndex - 1);
          render();
        } else if (char === '\u001b[B') {
          // Down arrow
          currentIndex = Math.min(packs.length - 1, currentIndex + 1);
          render();
        }
      });
    });
  }

  /**
   * Non-interactive pack selection by IDs
   */
  selectPacksByIds(packs: FixPack[], packIds: string[]): FixPack[] {
    if (packIds.length === 0) {
      return packs;
    }

    const idSet = new Set(packIds);
    return packs.filter(pack => idSet.has(pack.id));
  }

  /**
   * Confirm action with user
   */
  async confirm(message: string, defaultValue = true): Promise<boolean> {
    if (!this.isTTY) {
      return defaultValue;
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      const hint = defaultValue ? '[Y/n]' : '[y/N]';
      rl.question(`${message} ${hint}: `, (answer) => {
        rl.close();
        const lower = answer.toLowerCase().trim();
        if (lower === '') {
          resolve(defaultValue);
        } else {
          resolve(lower === 'y' || lower === 'yes');
        }
      });
    });
  }
}
