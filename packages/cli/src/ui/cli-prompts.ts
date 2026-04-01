import * as readline from 'readline';
import { box, icons, style, styles } from './cli-styles';

interface KeypressKey {
  name?: string;
  ctrl?: boolean;
}

export async function promptSelect<T extends string>(
  message: string,
  choices: { name: string; value: T; badge?: string }[]
): Promise<T> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    let selectedIndex = 0;

    const renderMenu = () => {
      console.clear();
      console.log('');
      console.log(`  ${styles.brightCyan}${styles.bold}?${styles.reset} ${styles.bold}${message}${styles.reset}`);
      console.log(`  ${styles.dim}${box.teeLeft}${box.horizontal.repeat(50)}${styles.reset}`);

      choices.forEach((choice, i) => {
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? `${styles.brightCyan}${styles.bold}❯${styles.reset}` : ' ';
        const badge = choice.badge ? ` ${choice.badge}` : '';
        const color = isSelected ? styles.brightWhite : styles.dim;
        console.log(`  ${styles.dim}${box.vertical}${styles.reset}  ${prefix} ${color}${choice.name}${badge}${styles.reset}`);
      });

      console.log(`  ${styles.dim}${box.bottomLeft}${box.horizontal.repeat(50)}${styles.reset}`);
      console.log('');
      console.log(`  ${styles.dim}Use ↑↓ arrows to move, Enter to select${styles.reset}`);
    };

    renderMenu();

    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    const onKeyPress = (_str: string, key: KeypressKey) => {
      if (key.name === 'up') {
        selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : choices.length - 1;
        renderMenu();
      } else if (key.name === 'down') {
        selectedIndex = selectedIndex < choices.length - 1 ? selectedIndex + 1 : 0;
        renderMenu();
      } else if (key.name === 'return' || key.name === 'enter') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKeyPress);
        rl.close();
<<<<<<< HEAD
        const picked = choices[selectedIndex] ?? choices[0];
        if (picked === undefined) {
          throw new Error('promptSelect: empty choices');
        }
        resolve(picked.value);
=======
        resolve(choices[selectedIndex].value);
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
      } else if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKeyPress);
        rl.close();
        process.exit(0);
      }
    };

    process.stdin.on('keypress', onKeyPress);
  });
}

export async function promptInput(message: string, defaultValue?: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const def = defaultValue ? `${styles.dim}(default: ${defaultValue})${styles.reset}` : '';
    console.log('');
    console.log(`  ${styles.brightCyan}${styles.bold}?${styles.reset} ${styles.bold}${message}${styles.reset} ${def}`);

    rl.question(`  ${styles.brightCyan}❯${styles.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

export async function promptConfirm(message: string, defaultValue = true): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const hint = defaultValue
      ? `${styles.brightGreen}Y${styles.reset}${styles.dim}/${styles.reset}n`
      : `y${styles.dim}/${styles.reset}${styles.brightRed}N${styles.reset}`;
    console.log('');

    rl.question(
      `  ${styles.brightCyan}${styles.bold}?${styles.reset} ${styles.bold}${message}${styles.reset} ${styles.dim}[${hint}${styles.dim}]${styles.reset}: `,
      (answer) => {
        rl.close();
        const lower = answer.toLowerCase().trim();
        if (lower === '') resolve(defaultValue);
        else resolve(lower === 'y' || lower === 'yes');
      }
    );
  });
}

export async function promptPassword(message: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    console.log('');
    console.log(`  ${styles.brightCyan}${styles.bold}🔐${styles.reset} ${styles.bold}${message}${styles.reset}`);

    rl.question(`  ${styles.brightCyan}❯${styles.reset} `, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

export function printScanSummary(
  type: string,
  stats: { high?: number; medium?: number; low?: number; total?: number }
): void {
  const { high = 0, medium = 0, low = 0, total = 0 } = stats;

  console.log('');
  console.log(`  ${styles.cyan}${box.topLeft}${box.horizontal.repeat(50)}${box.topRight}${styles.reset}`);
  console.log(
    `  ${styles.cyan}${box.vertical}${styles.reset} ${style.title(`📊 ${type.toUpperCase()} SCAN RESULTS`)}${' '.repeat(Math.max(0, 50 - type.length - 20))}${styles.cyan}${box.vertical}${styles.reset}`
  );
  console.log(`  ${styles.cyan}${box.teeLeft}${box.horizontal.repeat(50)}${box.teeRight}${styles.reset}`);

  if (total === 0) {
    console.log(
      `  ${styles.cyan}${box.vertical}${styles.reset}  ${styles.brightGreen}${styles.bold}${icons.success} No issues found!${styles.reset}${' '.repeat(30)}${styles.cyan}${box.vertical}${styles.reset}`
    );
  } else {
    console.log(
      `  ${styles.cyan}${box.vertical}${styles.reset}  ${styles.brightRed}${icons.block}${styles.reset} HIGH    ${styles.bold}${high}${styles.reset}${' '.repeat(35)}${styles.cyan}${box.vertical}${styles.reset}`
    );
    console.log(
      `  ${styles.cyan}${box.vertical}${styles.reset}  ${styles.brightYellow}${icons.block}${styles.reset} MEDIUM  ${styles.bold}${medium}${styles.reset}${' '.repeat(35)}${styles.cyan}${box.vertical}${styles.reset}`
    );
    console.log(
      `  ${styles.cyan}${box.vertical}${styles.reset}  ${styles.brightBlue}${icons.block}${styles.reset} LOW     ${styles.bold}${low}${styles.reset}${' '.repeat(35)}${styles.cyan}${box.vertical}${styles.reset}`
    );
    console.log(`  ${styles.cyan}${box.teeLeft}${box.horizontal.repeat(50)}${box.teeRight}${styles.reset}`);
    console.log(
      `  ${styles.cyan}${box.vertical}${styles.reset}  ${styles.bold}TOTAL${styles.reset}   ${total}${' '.repeat(37)}${styles.cyan}${box.vertical}${styles.reset}`
    );
  }

  console.log(`  ${styles.cyan}${box.bottomLeft}${box.horizontal.repeat(50)}${box.bottomRight}${styles.reset}`);
  console.log('');
}
