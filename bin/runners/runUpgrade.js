/**
 * guardrail upgrade - Subscription Management CLI
 * 
 * Allows users to view their current tier, check usage, and upgrade.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { entitlements, TIER_CONFIG, getCurrentTier, getUsageSummary } = require("./lib/entitlements");

// ANSI color codes
const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
};

const PRICING_URL = "https://guardrailai.dev/pricing";
const CHECKOUT_URL = "https://guardrailai.dev/checkout";

function parseArgs(args) {
  const opts = {
    status: false,
    tier: null,
    help: false,
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--status" || arg === "-s" || arg === "status") {
      opts.status = true;
    } else if (arg === "--tier" || arg === "-t") {
      opts.tier = args[++i];
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    } else if (!arg.startsWith("-") && !opts.tier) {
      // Positional argument for tier
      if (["starter", "pro", "compliance", "enterprise"].includes(arg)) {
        opts.tier = arg;
      }
    }
  }
  
  return opts;
}

function printHelp() {
  console.log(`
${c.bold}${c.cyan}guardrail upgrade${c.reset} - Manage your subscription

${c.bold}USAGE:${c.reset}
  guardrail upgrade              Show current tier and usage
  guardrail upgrade status       Same as above
  guardrail upgrade <tier>       Upgrade to specified tier
  guardrail upgrade --tier pro   Upgrade to Pro tier

${c.bold}TIERS:${c.reset}
  ${c.dim}free${c.reset}         $0/mo     Basic scans, 10/month
  ${c.green}starter${c.reset}      $29/mo    Reality Mode, 100 scans/month
  ${c.cyan}pro${c.reset}          $99/mo    AI Agent, Autopilot, MCP access
  ${c.magenta}compliance${c.reset}   $199/mo   SOC2, HIPAA, GDPR, PCI frameworks
  ${c.yellow}enterprise${c.reset}   Custom    Unlimited, dedicated support

${c.bold}OPTIONS:${c.reset}
  --status, -s   Show current status and usage
  --tier, -t     Specify tier to upgrade to
  --help, -h     Show this help

${c.bold}EXAMPLES:${c.reset}
  guardrail upgrade              # Show current plan
  guardrail upgrade pro          # Upgrade to Pro
  guardrail upgrade compliance   # Upgrade to Compliance
`);
}

function formatPrice(price) {
  if (price === 0) return "Free";
  return `$${price}/mo`;
}

function getTierIcon(tier) {
  const icons = {
    free: "📦",
    starter: "🚀",
    pro: "⚡",
    compliance: "🛡️",
    enterprise: "🏢",
    unlimited: "∞",
  };
  return icons[tier] || "📦";
}

function getTierColor(tier) {
  const colors = {
    free: c.dim,
    starter: c.green,
    pro: c.cyan,
    compliance: c.magenta,
    enterprise: c.yellow,
    unlimited: c.bold,
  };
  return colors[tier] || c.reset;
}

async function printStatus() {
  const tier = await getCurrentTier();
  const config = TIER_CONFIG[tier];
  const usage = await entitlements.getUsage();
  
  console.log(`
${c.bold}╔════════════════════════════════════════════════════════════╗
║  ${c.cyan}guardrail SUBSCRIPTION${c.reset}${c.bold}                                   ║
╚════════════════════════════════════════════════════════════╝${c.reset}
`);
  
  // Current tier
  const tierColor = getTierColor(tier);
  const tierIcon = getTierIcon(tier);
  console.log(`  ${c.bold}Current Plan:${c.reset} ${tierColor}${tierIcon} ${config.name}${c.reset} (${formatPrice(config.price)})`);
  console.log();
  
  // Usage bars
  console.log(`  ${c.bold}Usage This Month:${c.reset}`);
  console.log(`  ${"─".repeat(50)}`);
  
  const formatUsageBar = (current, limit, label) => {
    if (limit === Infinity) {
      return `  ${label.padEnd(16)} ${c.green}${current}${c.reset} ${c.dim}(unlimited)${c.reset}`;
    }
    const pct = Math.round((current / limit) * 100);
    const filled = Math.min(20, Math.round((pct / 100) * 20));
    const empty = 20 - filled;
    const color = pct >= 90 ? c.red : pct >= 70 ? c.yellow : c.green;
    const bar = `${color}${"█".repeat(filled)}${c.dim}${"░".repeat(empty)}${c.reset}`;
    return `  ${label.padEnd(16)} ${bar} ${color}${current}/${limit}${c.reset} (${pct}%)`;
  };
  
  console.log(formatUsageBar(usage.usage.scans || 0, config.limits.scansPerMonth, "Scans"));
  console.log(formatUsageBar(usage.usage.realityRuns || 0, config.limits.realityRunsPerMonth, "Reality Runs"));
  console.log(formatUsageBar(usage.usage.aiAgentRuns || 0, config.limits.aiAgentRunsPerMonth, "AI Agent Runs"));
  console.log(`  ${"─".repeat(50)}`);
  console.log(`  ${c.dim}Period: ${usage.periodStart.split('T')[0]} to ${usage.periodEnd.split('T')[0]}${c.reset}`);
  console.log();
  
  // Features
  console.log(`  ${c.bold}Available Features:${c.reset}`);
  const featureGroups = {
    core: ["scan", "gate", "ship", "context", "badge"],
    premium: ["fix", "reality", "ai-agent", "autopilot", "mcp"],
    compliance: ["compliance:soc2", "compliance:hipaa", "compliance:gdpr", "compliance:pci"],
  };
  
  for (const feature of config.features.slice(0, 10)) {
    const icon = config.features.includes(feature) ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
    console.log(`    ${icon} ${feature}`);
  }
  if (config.features.length > 10) {
    console.log(`    ${c.dim}... and ${config.features.length - 10} more${c.reset}`);
  }
  console.log();
  
  // Upgrade prompt (if not on highest tier)
  if (tier !== "enterprise" && tier !== "unlimited") {
    const nextTier = config.upsell.nextTier;
    const nextConfig = TIER_CONFIG[nextTier];
    
    console.log(`  ${c.bold}${c.yellow}⚡ Upgrade Available:${c.reset}`);
    console.log(`  ${config.upsell.message}`);
    console.log();
    console.log(`  ${c.cyan}→ guardrail upgrade ${nextTier}${c.reset}`);
    console.log(`  ${c.cyan}→ ${PRICING_URL}${c.reset}`);
  }
  
  console.log();
}

function printTierComparison() {
  console.log(`
${c.bold}╔════════════════════════════════════════════════════════════╗
║  ${c.cyan}guardrail PRICING${c.reset}${c.bold}                                        ║
╚════════════════════════════════════════════════════════════╝${c.reset}
`);
  
  const tiers = ["free", "starter", "pro", "compliance", "enterprise"];
  
  for (const tier of tiers) {
    const config = TIER_CONFIG[tier];
    const color = getTierColor(tier);
    const icon = getTierIcon(tier);
    
    console.log(`  ${color}${c.bold}${icon} ${config.name.toUpperCase()}${c.reset} - ${formatPrice(config.price)}`);
    console.log(`  ${"─".repeat(40)}`);
    
    // Limits
    const limits = config.limits;
    console.log(`  Scans:        ${limits.scansPerMonth === Infinity ? "Unlimited" : limits.scansPerMonth}/month`);
    console.log(`  Reality Runs: ${limits.realityRunsPerMonth === Infinity ? "Unlimited" : limits.realityRunsPerMonth}/month`);
    console.log(`  AI Agent:     ${limits.aiAgentRunsPerMonth === Infinity ? "Unlimited" : limits.aiAgentRunsPerMonth}/month`);
    console.log(`  Projects:     ${limits.projects === Infinity ? "Unlimited" : limits.projects}`);
    
    // Key features
    console.log(`  ${c.dim}Key features:${c.reset}`);
    const keyFeatures = config.features.filter(f => !f.includes(":")).slice(0, 5);
    for (const f of keyFeatures) {
      console.log(`    ${c.green}✓${c.reset} ${f}`);
    }
    
    console.log();
  }
  
  console.log(`  ${c.cyan}→ ${PRICING_URL}${c.reset}`);
  console.log();
}

async function initiateUpgrade(targetTier) {
  const currentTier = await getCurrentTier();
  const currentConfig = TIER_CONFIG[currentTier];
  const targetConfig = TIER_CONFIG[targetTier];
  
  if (!targetConfig) {
    console.error(`\n  ${c.red}❌ Invalid tier: ${targetTier}${c.reset}`);
    console.log(`\n  Valid tiers: starter, pro, compliance, enterprise\n`);
    return 1;
  }
  
  // Check if already on this tier or higher
  const tierOrder = ["free", "starter", "pro", "compliance", "enterprise", "unlimited"];
  const currentIndex = tierOrder.indexOf(currentTier);
  const targetIndex = tierOrder.indexOf(targetTier);
  
  if (targetIndex <= currentIndex) {
    console.log(`\n  ${c.yellow}ℹ️  You're already on ${currentConfig.name} tier (or higher)${c.reset}`);
    console.log(`\n  Current: ${currentConfig.name} ($${currentConfig.price}/mo)`);
    console.log(`  Target:  ${targetConfig.name} ($${targetConfig.price}/mo)`);
    console.log(`\n  ${c.dim}To downgrade, please visit ${PRICING_URL}${c.reset}\n`);
    return 0;
  }
  
  const targetColor = getTierColor(targetTier);
  const targetIcon = getTierIcon(targetTier);
  
  console.log(`
${c.bold}╔════════════════════════════════════════════════════════════╗
║  ${c.cyan}UPGRADE TO ${targetConfig.name.toUpperCase()}${c.reset}${c.bold}                                       ║
╚════════════════════════════════════════════════════════════╝${c.reset}

  ${c.bold}From:${c.reset} ${currentConfig.name} (${formatPrice(currentConfig.price)})
  ${c.bold}To:${c.reset}   ${targetColor}${targetIcon} ${targetConfig.name}${c.reset} (${formatPrice(targetConfig.price)})

  ${c.bold}What you'll get:${c.reset}
`);
  
  // Show features difference
  const newFeatures = targetConfig.features.filter(f => !currentConfig.features.includes(f));
  for (const feature of newFeatures.slice(0, 8)) {
    console.log(`    ${c.green}+ ${feature}${c.reset}`);
  }
  if (newFeatures.length > 8) {
    console.log(`    ${c.dim}... and ${newFeatures.length - 8} more features${c.reset}`);
  }
  
  console.log(`
  ${c.bold}New Limits:${c.reset}
    Scans:        ${targetConfig.limits.scansPerMonth === Infinity ? "Unlimited" : targetConfig.limits.scansPerMonth}/month
    Reality Runs: ${targetConfig.limits.realityRunsPerMonth === Infinity ? "Unlimited" : targetConfig.limits.realityRunsPerMonth}/month
    AI Agent:     ${targetConfig.limits.aiAgentRunsPerMonth === Infinity ? "Unlimited" : targetConfig.limits.aiAgentRunsPerMonth}/month
`);
  
  // Generate checkout URL
  const checkoutUrl = `${CHECKOUT_URL}?tier=${targetTier}&from=cli`;
  
  console.log(`  ${c.bold}${c.green}Complete your upgrade:${c.reset}`);
  console.log(`  ${c.cyan}→ ${checkoutUrl}${c.reset}`);
  console.log();
  
  // Try to open browser
  try {
    const open = process.platform === "win32" ? "start" : process.platform === "darwin" ? "open" : "xdg-open";
    require("child_process").exec(`${open} "${checkoutUrl}"`);
    console.log(`  ${c.dim}Opening browser...${c.reset}`);
  } catch {
    // Couldn't open browser, that's okay
  }
  
  console.log();
  return 0;
}

async function runUpgrade(args) {
  const opts = parseArgs(args);
  
  if (opts.help) {
    printHelp();
    return 0;
  }
  
  // If tier specified, initiate upgrade
  if (opts.tier) {
    return await initiateUpgrade(opts.tier);
  }
  
  // Default: show status
  await printStatus();
  
  // Also show tier comparison
  printTierComparison();
  
  return 0;
}

module.exports = { runUpgrade };
