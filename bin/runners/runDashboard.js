const path = require("path");
const { withErrorHandling, createUserError } = require("./lib/error-handler");
const {
  printBanner,
  printCommandHeader,
  colors: c,
  createSpinner,
  typewriter,
  rainbowText,
  drawChart,
  createBox,
  prompt,
  showMenu,
  formatNumber,
  statusIcon,
  progressBar,
  gradientText
} = require("./cli-utils");

/**
 * Clean and simple dashboard
 */
async function runDashboard(args) {
  // Clear screen first
  process.stdout.write('\x1b[2J\x1b[H');
  
  printBanner();
  printCommandHeader("DASHBOARD", "Real-time Monitoring");
  
  console.log();
  console.log(`${c.dim}Monitoring system metrics...${c.reset}`);
  console.log(`${c.dim}Press Ctrl+C to exit${c.reset}\n`);
  
  // Simulate a scanning process with clean output
  const spinner = createSpinner('Scanning project', 'dots');
  spinner.start();
  
  let progress = 0;
  const totalSteps = 20;
  
  const interval = setInterval(() => {
    progress++;
    
    // Update progress
    if (progress % 5 === 0) {
      spinner.succeed(`Scanned ${formatNumber(progress * 50)} files`);
      const newSpinner = createSpinner('Analyzing', 'pulse');
      newSpinner.start();
      
      setTimeout(() => {
        newSpinner.succeed('Analysis complete');
      }, 500);
    }
    
    if (progress >= totalSteps) {
      clearInterval(interval);
      showFinalReport();
    }
  }, 300);
  
  // Handle exit
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log(`\n${c.yellow}Dashboard stopped.${c.reset}\n`);
    process.exit(0);
  });
  
  // Keep running
  return new Promise(() => {});
}

/**
 * Show final report with clean layout
 */
function showFinalReport() {
  console.log();
  printCommandHeader("REPORT", "Scan Results");
  
  // Summary cards
  console.log();
  console.log(`${c.green}┌─ Files Scanned ─────────┐${c.reset}`);
  console.log(`${c.green}│${c.reset} ${c.bold}${formatNumber(1000)}${c.reset} ${c.green}│${c.reset}`);
  console.log(`${c.green}└─────────────────────────┘${c.reset}`);
  
  console.log(`  ${c.yellow}┌─ Issues Found ──────────┐${c.reset}`);
  console.log(`  ${c.yellow}│${c.reset} ${c.bold}${formatNumber(23)}${c.reset} ${c.yellow}│${c.reset}`);
  console.log(`  ${c.yellow}└─────────────────────────┘${c.reset}`);
  
  console.log(`    ${c.red}┌─ Critical ─────────────┐${c.reset}`);
  console.log(`    ${c.red}│${c.reset} ${c.bold}${formatNumber(5)}${c.reset} ${c.red}│${c.reset}`);
  console.log(`    ${c.red}└─────────────────────────┘${c.reset}`);
  
  console.log();
  
  // Simple chart
  console.log(`${c.cyan}Severity Distribution:${c.reset}\n`);
  
  const data = [5, 12, 8, 15, 7];
  const labels = ['Critical', 'High', 'Medium', 'Low', 'Info'];
  
  // Simple horizontal bars
  labels.forEach((label, i) => {
    const value = data[i];
    const barLength = Math.min(value * 2, 40);
    const color = value > 10 ? c.red : value > 5 ? c.yellow : c.green;
    
    console.log(`${label.padEnd(10)} ${color}${'█'.repeat(barLength)}${c.reset} ${value}`);
  });
  
  console.log();
  console.log(`${c.green}✅ Scan completed successfully!${c.reset}\n`);
  
  process.exit(0);
}

/**
 * Interactive demo of terminal features
 */
async function runDemo(args) {
  process.stdout.write('\x1b[2J\x1b[H');
  
  printBanner();
  printCommandHeader("DEMO", "Terminal Features Showcase");
  
  // Typewriter effect
  await typewriter(`${c.cyan}Initializing demo...${c.reset}`, 30);
  
  // Rainbow text
  console.log(`\n${rainbowText('✨ Beautiful Terminal Graphics ✨')}\n`);
  
  // Show different features
  console.log(`${c.bold}Available Features:${c.reset}\n`);
  
  const features = [
    { name: 'Rich Colors', desc: 'Full ANSI color support', icon: '🎨' },
    { name: 'Progress Bars', desc: 'Visual progress indicators', icon: '📊' },
    { name: 'ASCII Art', desc: 'Beautiful text graphics', icon: '🎭' },
    { name: 'Interactive UI', desc: 'User-friendly prompts', icon: '🎮' },
    { name: 'Data Viz', desc: 'Charts and graphs', icon: '📈' },
  ];
  
  features.forEach((feature, i) => {
    console.log(`  ${c.cyan}${i + 1}.${c.reset} ${feature.icon} ${c.bold}${feature.name}${c.reset}`);
    console.log(`     ${c.dim}${feature.desc}${c.reset}\n`);
  });
  
  // Show a progress bar animation
  console.log(`${c.yellow}Loading example...${c.reset}\n`);
  
  for (let i = 0; i <= 100; i += 10) {
    const bar = progressBar(i, 100, 30);
    process.stdout.write(`\r  ${bar} ${i}%`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n\n${c.green}✨ Demo complete!${c.reset}\n`);
  console.log(`${c.dim}Try 'guardrail dashboard' for live monitoring.${c.reset}\n`);
}

// Export with error handling
module.exports = {
  runDashboard: withErrorHandling(runDashboard, "Dashboard failed"),
  runDemo: withErrorHandling(runDemo, "Demo failed"),
};
