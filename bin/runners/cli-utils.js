// ═══════════════════════════════════════════════════════════════════════════
// guardrail CLI UTILS - Professional Terminal Styling
// ═══════════════════════════════════════════════════════════════════════════

// ANSI color codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  // Colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m',
};

// ASCII Art Banner
const BANNER = `
${c.brightCyan}  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ ██████╗  █████╗ ██╗██╗     
  ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗██╔══██╗██╔══██╗██║██║     
  ██║  ███╗██║   ██║███████║██████╔╝██║  ██║██████╔╝███████║██║██║     
  ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║██╔══██╗██╔══██║██║██║     
  ╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝██║  ██║██║  ██║██║███████╗
   ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝${c.reset}
${c.dim}                     AI-Native Code Security Platform${c.reset}
`;

// Compact Banner for subcommands
const COMPACT_BANNER = `${c.cyan}╔══════════════════════════════════════════════════════════════╗${c.reset}
${c.cyan}║${c.reset} ${c.bold}guardrail CLI${c.reset} ${c.dim}— Professional Code Security & Analysis${c.reset} ${c.cyan}║${c.reset}
${c.cyan}╚══════════════════════════════════════════════════════════════╝${c.reset}
`;

// Box drawing utilities
const BOX_WIDTH = 61;

function box(title, color = c.cyan, width = BOX_WIDTH) {
  const padding = Math.max(0, width - title.length - 2);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return (
    `${color}┌${'─'.repeat(width)}┐${c.reset}\n` +
    `${color}│${c.reset}${c.bold}${' '.repeat(leftPad)}${title}${' '.repeat(rightPad)}${c.reset}${color}│${c.reset}\n` +
    `${color}└${'─'.repeat(width)}┘${c.reset}`
  );
}

function doubleBox(title, color = c.cyan, width = BOX_WIDTH) {
  const padding = Math.max(0, width - title.length - 2);
  const leftPad = Math.floor(padding / 2);
  const rightPad = padding - leftPad;
  return (
    `${color}╔${'═'.repeat(width)}╗${c.reset}\n` +
    `${color}║${c.reset}${c.bold}${' '.repeat(leftPad)}${title}${' '.repeat(rightPad)}${c.reset}${color}║${c.reset}\n` +
    `${color}╚${'═'.repeat(width)}╝${c.reset}`
  );
}

// Progress indicators
function spinner() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  return () => frames[i++ % frames.length];
}

function progressBar(current, total, width = 20, color = c.cyan) {
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(empty)}${c.reset}`;
}

// Status indicators
function statusIcon(status) {
  const icons = {
    success: `${c.green}✓${c.reset}`,
    error: `${c.red}✗${c.reset}`,
    warning: `${c.yellow}⚠${c.reset}`,
    info: `${c.blue}ℹ${c.reset}`,
    loading: `${c.dim}○${c.reset}`,
    pending: `${c.yellow}⏳${c.reset}`,
  };
  return icons[status] || '?';
}

// Severity bars for visual representation
function severityBar(count, color, max = 10) {
  const filled = Math.min(count, max);
  return `${color}${'█'.repeat(filled)}${c.dim}${'░'.repeat(max - filled)}${c.reset}`;
}

// Text formatting
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatBytes(bytes) {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Header printing functions
function printBanner() {
  console.log(BANNER);
}

function printCompactBanner() {
  console.log(COMPACT_BANNER);
}

function printCommandHeader(command, description) {
  console.log();
  console.log(doubleBox(command.toUpperCase(), c.cyan));
  console.log(`${c.dim}  ${description}${c.reset}`);
  console.log();
}

function printSectionHeader(title) {
  console.log();
  console.log(`${c.cyan}┌─ ${c.bold}${title}${c.reset}${c.cyan} ──────────────────────────────────────────────┐${c.reset}`);
}

function printSectionFooter() {
  console.log(`${c.cyan}└─────────────────────────────────────────────────────────────┘${c.reset}`);
  console.log();
}

// List formatting
function printListItem(icon, text, indent = 0) {
  const spaces = ' '.repeat(indent * 2);
  console.log(`${spaces}${icon} ${text}`);
}

function printBulletedList(items, bullet = '•') {
  items.forEach(item => {
    console.log(`  ${c.dim}${bullet}${c.reset} ${item}`);
  });
}

// Table formatting
function printTable(headers, rows) {
  const colWidths = headers.map(h => h.length);
  
  // Calculate column widths
  rows.forEach(row => {
    row.forEach((cell, i) => {
      colWidths[i] = Math.max(colWidths[i], cell.length);
    });
  });
  
  // Print header
  const headerRow = headers.map((h, i) => 
    `${c.bold}${h.padEnd(colWidths[i])}${c.reset}`
  ).join(' │ ');
  const separator = colWidths.map(w => '─'.repeat(w)).join('─┼─');
  
  console.log(`${c.cyan}┌${colWidths.map(w => '─'.repeat(w)).join('─┬─')}┐${c.reset}`);
  console.log(`${c.cyan}│${c.reset} ${headerRow} ${c.cyan}│${c.reset}`);
  console.log(`${c.cyan}├${separator}┤${c.reset}`);
  
  // Print rows
  rows.forEach(row => {
    const rowStr = row.map((cell, i) => 
      cell.padEnd(colWidths[i])
    ).join(' │ ');
    console.log(`${c.cyan}│${c.reset} ${rowStr} ${c.cyan}│${c.reset}`);
  });
  
  console.log(`${c.cyan}└${colWidths.map(w => '─'.repeat(w)).join('─┴─')}┘${c.reset}`);
}

// Highlighting
function highlight(text, color = c.yellow) {
  return `${color}${text}${c.reset}`;
}

function highlightCode(code) {
  return `${c.cyan}${code}${c.reset}`;
}

function highlightPath(path) {
  return `${c.blue}${path}${c.reset}`;
}

// Error formatting
function printError(message, details = null) {
  console.log();
  console.log(`${c.bgRed}${c.white}  ERROR  ${c.reset}`);
  console.log(`${c.red}  ✗ ${message}${c.reset}`);
  if (details) {
    console.log(`${c.dim}    ${details}${c.reset}`);
  }
  console.log();
}

function printWarning(message) {
  console.log(`${c.yellow}  ⚠ ${message}${c.reset}`);
}

function printSuccess(message) {
  console.log(`${c.green}  ✓ ${message}${c.reset}`);
}

// Animated loading
function printLoading(message, duration = 1000) {
  const spin = spinner();
  const interval = setInterval(() => {
    process.stdout.write(`\r${c.dim}${spin()} ${message}...${c.reset}`);
  }, 100);
  
  setTimeout(() => {
    clearInterval(interval);
    process.stdout.write(`\r${c.green}✓${c.reset} ${message}\n`);
  }, duration);
}

// Summary cards
function printSummaryCard(title, value, unit = '', color = c.cyan) {
  console.log(`${color}┌─ ${title} ──────────────┐${c.reset}`);
  console.log(`${color}│${c.reset} ${c.bold}${value}${c.reset}${c.dim}${unit}${c.reset} ${color}│${c.reset}`);
  console.log(`${color}└─────────────────────┘${c.reset}`);
}

// Gradient text effect (simulated with colors)
function gradientText(text, colors = [c.cyan, c.blue, c.cyan]) {
  const chunkSize = Math.ceil(text.length / colors.length);
  let result = '';
  
  colors.forEach((color, i) => {
    const start = i * chunkSize;
    const end = start + chunkSize;
    const chunk = text.slice(start, end);
    result += color + chunk;
  });
  
  return result + c.reset;
}

// Multi-bar progress container
function createMultiBar() {
  // Simplified implementation
  return {
    create: (total, startValue, payload) => ({
      update: (current, payload) => {
        const percentage = Math.round((current / total) * 100);
        const bar = '█'.repeat(Math.round(percentage / 5)) + '░'.repeat(20 - Math.round(percentage / 5));
        process.stdout.write(`\r[${bar}] ${percentage}%`);
      }
    })
  };
}

// Animated typing effect
async function typewriter(text, speed = 50) {
  for (let i = 0; i < text.length; i++) {
    process.stdout.write(text[i]);
    await new Promise(resolve => setTimeout(resolve, speed));
  }
  console.log();
}

// Rainbow gradient text
function rainbowText(text) {
  const colors = [c.red, c.yellow, c.green, c.cyan, c.blue, c.magenta];
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += colors[i % colors.length] + text[i];
  }
  return result + c.reset;
}

// Terminal sparkle effect
function sparkle(text) {
  const sparkles = ['✨', '⭐', '💫', '🌟'];
  return `${sparkles[Math.floor(Math.random() * sparkles.length)]} ${text} ${sparkles[Math.floor(Math.random() * sparkles.length)]}`;
}

// Create a beautiful box with multiple styles
function createBox(content, style = 'single') {
  const styles = {
    single: { topLeft: '┌', topRight: '┐', bottomLeft: '└', bottomRight: '┘', horizontal: '─', vertical: '│' },
    double: { topLeft: '╔', topRight: '╗', bottomLeft: '╚', bottomRight: '╝', horizontal: '═', vertical: '║' },
    round: { topLeft: '╭', topRight: '╮', bottomLeft: '╰', bottomRight: '╯', horizontal: '─', vertical: '│' },
    bold: { topLeft: '┏', topRight: '┓', bottomLeft: '┗', bottomRight: '┛', horizontal: '━', vertical: '┃' },
  };
  
  const s = styles[style] || styles.single;
  const lines = content.split('\n');
  
  // Calculate width considering ANSI codes
  let maxWidth = 0;
  for (const line of lines) {
    const stripped = stripAnsi(line);
    maxWidth = Math.max(maxWidth, stripped.length);
  }
  
  // Ensure minimum width
  maxWidth = Math.max(maxWidth, 30);
  
  let box = s.topLeft + s.horizontal.repeat(maxWidth + 4) + s.topRight + '\n';
  
  for (const line of lines) {
    const stripped = stripAnsi(line);
    const padding = maxWidth - stripped.length;
    box += s.vertical + ' ' + line + ' '.repeat(padding) + ' ' + s.vertical + '\n';
  }
  
  box += s.bottomLeft + s.horizontal.repeat(maxWidth + 4) + s.bottomRight;
  
  return box;
}

// Strip ANSI codes for width calculation
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Interactive prompt
async function prompt(message) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`${c.cyan}?${c.reset} ${message} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// List selector
async function selectList(items, message = 'Select an item:') {
  console.log(`${c.cyan}?${c.reset} ${message}`);
  items.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ${item}`);
  });
  
  const answer = await prompt('Enter number:');
  const index = parseInt(answer) - 1;
  return items[index] || null;
}

// Animation frames
const animations = {
  loading: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  success: ['✓', '✓', '✓'],
  error: ['✗', '✗', '✗'],
  dots: ['⠁', '⠂', '⠄', '⠂'],
  pulse: ['●', '○', '●', '○'],
};

// Animated progress
function showProgress(current, total, message = 'Processing') {
  const percentage = Math.round((current / total) * 100);
  const barLength = 30;
  const filled = Math.round((barLength * percentage) / 100);
  const empty = barLength - filled;
  
  const bar = c.green('█'.repeat(filled)) + c.gray('░'.repeat(empty));
  const animation = animations.loading[current % animations.loading.length];
  
  process.stdout.write(`\r${c.cyan}${animation}${c.reset} ${message} [${bar}] ${percentage}%`);
  
  if (current === total) {
    console.log();
  }
}

// Heat map visualization
function drawHeatMap(data, labels) {
  const heatColors = [
    c.bgBlue, c.bgCyan, c.bgGreen, c.bgYellow, c.bgRed
  ];
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  let output = '\n';
  for (let i = 0; i < data.length; i++) {
    const value = data[i];
    const normalized = (value - min) / range;
    const colorIndex = Math.floor(normalized * (heatColors.length - 1));
    const color = heatColors[colorIndex];
    
    const bar = ' '.repeat(Math.round(normalized * 20));
    output += `${labels[i].padEnd(15)} ${color}${bar}${c.reset} ${value}\n`;
  }
  
  return output;
}

// ASCII chart
function drawChart(data, width = 50, height = 10) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const chart = [];
  
  for (let y = height; y >= 0; y--) {
    let line = '';
    const threshold = min + (range * y) / height;
    
    for (let x = 0; x < data.length; x++) {
      if (data[x] >= threshold) {
        line += '█';
      } else if (x > 0 && data[x - 1] >= threshold && data[x] < threshold) {
        line += '▄';
      } else if (x > 0 && data[x - 1] < threshold && data[x] >= threshold) {
        line += '▀';
      } else {
        line += ' ';
      }
    }
    
    const label = threshold.toFixed(0).padStart(8);
    chart.push(`${c.dim}${label}${c.reset} │${c.cyan}${line}${c.reset}`);
  }
  
  chart.push(''.padStart(9) + '└' + '─'.repeat(data.length));
  
  return '\n' + chart.join('\n') + '\n';
}

// Terminal column layout
function createColumns(columns, gap = 4) {
  const terminalWidth = process.stdout.columns || 80;
  const columnWidth = Math.floor((terminalWidth - gap * (columns.length - 1)) / columns.length);
  
  const rows = Math.max(...columns.map(col => col.length));
  let output = '';
  
  for (let row = 0; row < rows; row++) {
    const line = [];
    for (let col = 0; col < columns.length; col++) {
      const cell = columns[col][row] || '';
      line.push(cell.padEnd(columnWidth));
    }
    output += line.join(' '.repeat(gap)) + '\n';
  }
  
  return output;
}

// Interactive menu
async function showMenu(title, options) {
  console.log(`\n${c.bold}${c.underline}${title}${c.reset}\n`);
  
  for (let i = 0; i < options.length; i++) {
    const option = options[i];
    const icon = option.icon || '•';
    console.log(`  ${c.cyan}${i + 1}.${c.reset} ${icon} ${option.title}`);
    if (option.description) {
      console.log(`    ${c.dim}${option.description}${c.reset}`);
    }
  }
  
  console.log();
  const choice = await prompt('Enter your choice:');
  const index = parseInt(choice) - 1;
  
  if (options[index]) {
    return options[index];
  }
  
  return null;
}

// Status widget
function createStatusWidget(title, status, details = {}) {
  const statusColors = {
    online: c.green,
    offline: c.red,
    warning: c.yellow,
    pending: c.blue,
  };
  
  const color = statusColors[status] || c.white;
  const icon = status === 'online' ? '●' : status === 'offline' ? '●' : '○';
  
  let widget = `${color}${icon} ${title}${c.reset}\n`;
  
  Object.entries(details).forEach(([key, value]) => {
    widget += `  ${c.dim}${key}:${c.reset} ${value}\n`;
  });
  
  return createBox(widget.trim(), 'round');
}

// Tree view
function drawTree(data, prefix = '', isLast = true) {
  const connector = isLast ? '└── ' : '├── ';
  const extension = isLast ? '    ' : '│   ';
  
  let output = prefix + connector + data.name + '\n';
  
  if (data.children) {
    data.children.forEach((child, idx) => {
      const isLastChild = idx === data.children.length - 1;
      output += drawTree(child, prefix + extension, isLastChild);
    });
  }
  
  return output;
}

// Advanced spinner styles
function createSpinner(text, style = 'dots') {
  const spinnerStyles = {
    dots: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] },
    line: { interval: 130, frames: ['-', '\\', '|', '/'] },
    pipe: { interval: 100, frames: ['┤', '┘', '┴', '└', '├', '┌', '┬', '┐'] },
    star: { interval: 70, frames: ['✶', '✸', '✹', '✺', '✹', '✷'] },
    arrow: { interval: 80, frames: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'] },
    bounce: { interval: 120, frames: ['⠁', '⠂', '⠄', '⠂'] },
    pulse: { interval: 80, frames: ['●', '○', '●', '○'] },
    matrix: { interval: 70, frames: ['╱', '╲', '╳', '╲', '╱'] },
  };
  
  const config = spinnerStyles[style] || spinnerStyles.dots;
  let current = 0;
  let interval = null;
  const stop = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };
  
  return {
    start: () => {
      interval = setInterval(() => {
        process.stdout.write(`\r${config.frames[current]} ${text}`);
        current = (current + 1) % config.frames.length;
      }, config.interval);
    },
    stop: stop,
    succeed: (message) => {
      stop();
      process.stdout.write(`\r${c.green}✓${c.reset} ${message || text}\n`);
    },
    fail: (message) => {
      stop();
      process.stdout.write(`\r${c.red}✗${c.reset} ${message || text}\n`);
    }
  };
}

// Advanced terminal features
const readline = require('readline');
const { Writable } = require('stream');

/**
 * Interactive CLI with real-time input
 */
class InteractiveCLI {
  constructor() {
    this.interface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });
  }

  /**
   * Create an interactive prompt with auto-completion
   */
  async promptWithAutoComplete(message, suggestions = []) {
    return new Promise((resolve) => {
      let input = '';
      
      this.interface.question(`${c.cyan}?${c.reset} ${message} `, (answer) => {
        resolve(answer.trim());
      });

      // Enable tab completion
      this.interface.on('TAB', () => {
        const matches = suggestions.filter(s => s.startsWith(input));
        if (matches.length === 1) {
          this.interface.write(matches[0].slice(input.length));
          input = matches[0];
        }
      });
    });
  }

  /**
   * Multi-select with checkboxes
   */
  async multiSelect(items, message = 'Select items:') {
    const selected = new Set();
    
    console.log(`${c.cyan}?${c.reset} ${message}`);
    console.log(`${c.dim}Use space to toggle, enter to confirm${c.reset}\n`);
    
    // Display items with checkboxes
    const display = () => {
      console.clear();
      console.log(`${c.cyan}?${c.reset} ${message}\n`);
      
      items.forEach((item, idx) => {
        const checked = selected.has(idx) ? '☑' : '☐';
        console.log(`  ${checked} ${idx + 1}. ${item}`);
      });
    };
    
    display();
    
    return new Promise((resolve) => {
      this.interface.input.on('keypress', (str, key) => {
        if (key.name === 'escape') {
          this.interface.close();
          resolve([]);
        } else if (key.name === 'return') {
          this.interface.close();
          resolve(Array.from(selected).map(i => items[i]));
        } else if (key.name >= '1' && key.name <= '9') {
          const idx = parseInt(key.name) - 1;
          if (idx < items.length) {
            if (selected.has(idx)) {
              selected.delete(idx);
            } else {
              selected.add(idx);
            }
            display();
          }
        }
      });
    });
  }

  close() {
    this.interface.close();
  }
}

/**
 * Real-time terminal dashboard
 */
class TerminalDashboard {
  constructor() {
    this.widgets = new Map();
    this.updateInterval = null;
  }

  /**
   * Add a widget to the dashboard
   */
  addWidget(name, widget) {
    this.widgets.set(name, widget);
  }

  /**
   * Start rendering the dashboard
   */
  start(interval = 1000) {
    const render = () => {
      // Clear screen more thoroughly
      process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
      
      // Print banner only once at the top
      printBanner();
      console.log();
      
      // Simple vertical layout instead of columns
      const widgetEntries = Array.from(this.widgets.entries());
      
      // Display widgets side by side in a row
      const widget1 = widgetEntries[0] ? widgetEntries[0][1].render().split('\n') : [];
      const widget2 = widgetEntries[1] ? widgetEntries[1][1].render().split('\n') : [];
      const widget3 = widgetEntries[2] ? widgetEntries[2][1].render().split('\n') : [];
      
      // Find the maximum height
      const maxHeight = Math.max(widget1.length, widget2.length, widget3.length);
      
      // Print widgets side by side
      for (let i = 0; i < maxHeight; i++) {
        const line1 = widget1[i] || ' '.repeat(40);
        const line2 = widget2[i] || ' '.repeat(40);
        const line3 = widget3[i] || ' '.repeat(40);
        console.log(line1 + '  ' + line2 + '  ' + line3);
      }
    };

    render();
    this.updateInterval = setInterval(render, interval);
  }

  /**
   * Stop the dashboard
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

/**
 * Widget base class for dashboard
 */
class Widget {
  constructor(title, data) {
    this.title = title;
    this.data = data;
  }

  render() {
    return createBox(`${this.title}\n${this.formatData()}`, 'round');
  }

  formatData() {
    return JSON.stringify(this.data, null, 2);
  }
}

/**
 * Progress ring widget
 */
class ProgressRing extends Widget {
  constructor(title, value, max = 100) {
    super(title, { value, max });
    this.value = value;
    this.max = max;
  }

  render() {
    const percentage = Math.round((this.value / this.max) * 100);
    const bar = this.drawProgressBar(percentage);
    
    return createBox(
      `${c.bold}${this.title}${c.reset}\n\n` +
      `${bar}\n\n` +
      `${c.cyan}${percentage}%${c.reset} (${this.value}/${this.max})`,
      'round'
    );
  }

  drawProgressBar(percentage) {
    const width = 30;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    let bar = '';
    for (let i = 0; i < width; i++) {
      if (i < filled) {
        if (percentage < 30) bar += c.red + '█';
        else if (percentage < 70) bar += c.yellow + '█';
        else bar += c.green + '█';
      } else {
        bar += c.dim + '░';
      }
    }
    
    return bar + c.reset;
  }
}

/**
 * Sparkline chart widget
 */
class Sparkline extends Widget {
  constructor(title, data) {
    super(title, data);
  }

  render() {
    const sparkline = this.drawSparkline(this.data);
    const min = Math.min(...this.data);
    const max = Math.max(...this.data);
    
    return createBox(
      `${c.bold}${this.title}${c.reset}\n\n` +
      `${sparkline}\n\n` +
      `${c.dim}Min: ${min}  Max: ${max}${c.reset}`,
      'round'
    );
  }

  drawSparkline(data) {
    const blocks = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    return data.map(value => {
      const normalized = (value - min) / range;
      const index = Math.floor(normalized * (blocks.length - 1));
      return c.cyan + blocks[index];
    }).join('');
  }
}

/**
 * Terminal pager for long content
 */
class TerminalPager {
  constructor(content, linesPerPage = 20) {
    this.content = content.split('\n');
    this.linesPerPage = linesPerPage;
    this.currentPage = 0;
    this.totalPages = Math.ceil(this.content.length / linesPerPage);
  }

  async show() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const display = () => {
      console.clear();
      const start = this.currentPage * this.linesPerPage;
      const end = start + this.linesPerPage;
      const page = this.content.slice(start, end);
      
      console.log(page.join('\n'));
      console.log();
      console.log(`${c.dim}Page ${this.currentPage + 1}/${this.totalPages}${c.reset}`);
      console.log(`${c.dim}Controls: n-next, p-prev, q-quit${c.reset}`);
    };

    display();

    for await (const line of rl) {
      switch (line.trim()) {
        case 'n':
          if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            display();
          }
          break;
        case 'p':
          if (this.currentPage > 0) {
            this.currentPage--;
            display();
          }
          break;
        case 'q':
          rl.close();
          return;
      }
    }
  }
}

/**
 * Real-time log viewer with filtering
 */
class LogViewer {
  constructor() {
    this.logs = [];
    this.filters = [];
    this.maxLogs = 1000;
  }

  addLog(level, message, timestamp = new Date()) {
    const log = {
      level,
      message,
      timestamp: timestamp.toISOString()
    };
    
    this.logs.push(log);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  addFilter(pattern) {
    this.filters.push(new RegExp(pattern, 'i'));
  }

  clearFilters() {
    this.filters = [];
  }

  display() {
    const filtered = this.logs.filter(log => {
      return this.filters.length === 0 || 
        this.filters.some(regex => regex.test(log.message));
    });

    console.clear();
    printBanner();
    console.log(`${c.bold}Log Viewer${c.reset}`);
    if (this.filters.length > 0) {
      console.log(`${c.dim}Filters: ${this.filters.map(f => f.source).join(', ')}${c.reset}`);
    }
    console.log();

    filtered.slice(-50).forEach(log => {
      const time = new Date(log.timestamp).toLocaleTimeString();
      const levelColor = {
        ERROR: c.red,
        WARN: c.yellow,
        INFO: c.blue,
        DEBUG: c.dim
      }[log.level] || c.white;

      console.log(`${c.dim}${time}${c.reset} ${levelColor}${log.level.padEnd(5)}${c.reset} ${log.message}`);
    });
  }
}

/**
 * ASCII art generator for metrics
 */
function drawMetricGauge(value, max, label, width = 30) {
  const percentage = (value / max) * 100;
  const filled = Math.round((percentage / 100) * width);
  
  let gauge = '';
  for (let i = 0; i < width; i++) {
    if (i < filled) {
      if (percentage < 30) gauge += c.red + '█';
      else if (percentage < 70) gauge += c.yellow + '█';
      else gauge += c.green + '█';
    } else {
      gauge += c.dim + '░';
    }
  }
  
  return `${label}\n${gauge}${c.reset} ${percentage.toFixed(1)}%`;
}

/**
 * Terminal animation system
 */
class TerminalAnimation {
  constructor(frames, interval = 100) {
    this.frames = frames;
    this.interval = interval;
    this.current = 0;
    this.running = false;
    this.timer = null;
  }

  start() {
    this.running = true;
    this.timer = setInterval(() => {
      process.stdout.write(`\r${this.frames[this.current]}`);
      this.current = (this.current + 1) % this.frames.length;
    }, this.interval);
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

/**
 * Rich text formatting with markup
 */
function richText(text) {
  // Simple markup parser
  const markup = {
    '**': (content) => c.bold + content + c.reset,
    '*': (content) => c.italic + content + c.reset,
    '`': (content) => c.cyan + content + c.reset,
    '__': (content) => c.underline + content + c.reset,
    '~~': (content) => c.strikethrough + content + c.reset,
  };

  let result = text;
  
  Object.entries(markup).forEach(([tag, formatter]) => {
    const regex = new RegExp(`\\${tag}([^\\${tag}]+)\\${tag}`, 'g');
    result = result.replace(regex, formatter);
  });

  return result;
}

/**
 * Export all advanced features
 */
module.exports = {
  // Original exports
  colors: c,
  printBanner,
  printCompactBanner,
  printCommandHeader,
  printSectionHeader,
  printSectionFooter,
  printListItem,
  printBulletedList,
  printTable,
  highlight,
  highlightCode,
  highlightPath,
  printError,
  printWarning,
  printSuccess,
  printSummaryCard,
  gradientText,
  formatNumber,
  formatBytes,
  statusIcon,
  progressBar,
  
  // Advanced features
  InteractiveCLI,
  TerminalDashboard,
  Widget,
  ProgressRing,
  Sparkline,
  TerminalPager,
  LogViewer,
  drawMetricGauge,
  TerminalAnimation,
  richText,
  createSpinner,
  createMultiBar,
  typewriter,
  rainbowText,
  sparkle,
  createBox,
  prompt,
  selectList,
  animations,
  showProgress,
  drawHeatMap,
  drawChart,
  createColumns,
  showMenu,
  createStatusWidget,
  drawTree,
  stripAnsi,
};
