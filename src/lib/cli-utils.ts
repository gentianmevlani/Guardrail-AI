/**
 * CLI Utilities
 * 
 * Progress bars, colored output, and better formatting for CLI
 */

export interface ProgressOptions {
  total: number;
  width?: number;
  complete?: string;
  incomplete?: string;
  showPercentage?: boolean;
  showCount?: boolean;
}

class CLIUtils {
  /**
   * Create a progress bar
   */
  createProgressBar(options: ProgressOptions): {
    update: (current: number) => void;
    complete: () => void;
  } {
    const {
      total,
      width = 40,
      complete = '█',
      incomplete = '░',
      showPercentage = true,
      showCount = true,
    } = options;

    let current = 0;

    const render = () => {
      const percentage = Math.min(100, Math.round((current / total) * 100));
      const filled = Math.round((width * current) / total);
      const empty = width - filled;

      const bar = complete.repeat(filled) + incomplete.repeat(empty);
      let output = `[${bar}]`;

      if (showPercentage) {
        output += ` ${percentage}%`;
      }

      if (showCount) {
        output += ` (${current}/${total})`;
      }

      process.stdout.write(`\r${output}`);
    };

    return {
      update: (newCurrent: number) => {
        current = newCurrent;
        render();
      },
      complete: () => {
        current = total;
        render();
        process.stdout.write('\n');
      },
    };
  }

  /**
   * Colored output (simple implementation without chalk)
   */
  colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  };

  /**
   * Colorize text
   */
  colorize(text: string, color: keyof CLIUtils['colors']): string {
    return `${this.colors[color]}${text}${this.colors.reset}`;
  }

  /**
   * Success message
   */
  success(message: string): void {
    console.log(`${this.colorize('✅', 'green')} ${message}`);
  }

  /**
   * Error message
   */
  error(message: string): void {
    console.error(`${this.colorize('❌', 'red')} ${message}`);
  }

  /**
   * Warning message
   */
  warning(message: string): void {
    console.warn(`${this.colorize('⚠️', 'yellow')} ${message}`);
  }

  /**
   * Info message
   */
  info(message: string): void {
    console.log(`${this.colorize('ℹ️', 'blue')} ${message}`);
  }

  /**
   * Section header
   */
  section(title: string): void {
    console.log(`\n${this.colorize('━'.repeat(60), 'cyan')}`);
    console.log(`${this.colorize(title, 'bright')}`);
    console.log(`${this.colorize('━'.repeat(60), 'cyan')}\n`);
  }

  /**
   * Table output
   */
  table(headers: string[], rows: string[][]): void {
    // Calculate column widths
    const widths = headers.map((header, i) => {
      const maxWidth = Math.max(
        header.length,
        ...rows.map(row => (row[i] || '').length)
      );
      return maxWidth + 2;
    });

    // Print header
    const headerRow = headers
      .map((header, i) => header.padEnd(widths[i]))
      .join(' | ');
    console.log(this.colorize(headerRow, 'bright'));
    console.log(this.colorize('-'.repeat(headerRow.length), 'dim'));

    // Print rows
    rows.forEach(row => {
      const rowStr = row
        .map((cell, i) => (cell || '').padEnd(widths[i]))
        .join(' | ');
      console.log(rowStr);
    });
  }

  /**
   * Spinner for async operations
   */
  createSpinner(message: string): {
    start: () => void;
    stop: (success?: boolean) => void;
    update: (newMessage: string) => void;
  } {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let frameIndex = 0;
    let interval: NodeJS.Timeout | null = null;
    let currentMessage = message;

    const render = () => {
      process.stdout.write(`\r${frames[frameIndex]} ${currentMessage}`);
      frameIndex = (frameIndex + 1) % frames.length;
    };

    return {
      start: () => {
        interval = setInterval(render, 100);
      },
      stop: (success = true) => {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        const icon = success ? '✅' : '❌';
        process.stdout.write(`\r${icon} ${currentMessage}\n`);
      },
      update: (newMessage: string) => {
        currentMessage = newMessage;
      },
    };
  }
}

export const cliUtils = new CLIUtils();

