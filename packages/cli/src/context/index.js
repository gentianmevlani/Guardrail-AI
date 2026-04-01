/**
 * guardrail Context Generator v3.0 - AI Memory & Shared Context Engine
 * 
 * Modular architecture for AI context generation across multiple platforms.
 * 
 * @module context
 */

const fs = require("fs");
const path = require("path");

// Import modules
const { analyzeProject, findFilesRecursive } = require("./analyzer");
const { detectPatterns, detectAntiPatterns } = require("./patterns");
const { loadMemory, saveMemory, learnFromProject, getRecommendations, initializeMemory, GUARDRAIL_HOME } = require("./memory");
const { trackInsight, getInsightsSummary } = require("./insights");
const { detectMonorepo } = require("./monorepo");
const { loadSnapshot, saveSnapshot, generateContextDiff, saveDiffReport } = require("./context-diff");
const { generatePrunedContext, getContextForFile, pruneContext } = require("./context-pruner");
const { generateDependencyGraph, buildDependencyGraph, generateMermaidDiagram, generateHtmlVisualization } = require("./dependency-graph");
const { generateGitContext, getGitContext } = require("./git-context");
const { extractAPIContracts, generateAPIContext } = require("./api-contracts");
const { analyzeTeamConventions, generateTeamReport } = require("./team-conventions");
const { buildSearchIndex, saveSearchIndex, loadSearchIndex, semanticSearch, generateSearchReport } = require("./semantic-search");
const { scanProject, generateSecurityReport } = require("./security-scanner");
const { decomposeTask, generateDecompositionReport } = require("./ai-task-decomposer");
const { registerRepository, createGroup, getSharedArtifacts, generateFederatedContext, findRelatedRepositories, syncFederation, generateFederationReport } = require("./multi-repo-federation");
const { registerSharedContext } = require("./shared");

// Import CLI utilities for professional styling
const {
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
} = require("../cli-utils");

// Platform generators
const { generateCursorRules, generateCursorModularRules } = require("./generators/cursor");
const { generateWindsurfRules } = require("./generators/windsurf");
const { generateCopilotInstructions } = require("./generators/copilot");
const { generateClaudeConfig } = require("./generators/claude");
const { generateCodexConfig } = require("./generators/codex");
const { generateContextJson } = require("./generators/mcp");
const { generateContextMd, generateContextMdFromTruthpack } = require("./generators/inject");

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const opts = {
    path: ".",
    platform: "all",
    watch: false,
    verbose: false,
    help: false,
    diff: false,
    prune: false,
    maxTokens: 8000,
    currentFile: "",
    task: "general",
    json: false,
    search: "",
    scan: false,
    decompose: "",
    federate: false,
    inject: false,
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") opts.help = true;
    if (a.startsWith("--path=")) opts.path = a.split("=")[1];
    if (a === "--path" || a === "-p") opts.path = args[++i];
    if (a.startsWith("--platform=")) opts.platform = a.split("=")[1];
    if (a === "--platform") opts.platform = args[++i];
    if (a === "--watch" || a === "-w") opts.watch = true;
    if (a === "--verbose" || a === "-v") opts.verbose = true;
    if (a === "--diff" || a === "-d") opts.diff = true;
    if (a === "--prune") opts.prune = true;
    if (a === "--json" || a === "-j") opts.json = true;
    if (a === "--scan" || a === "-s") opts.scan = true;
    if (a === "--federate" || a === "-f") opts.federate = true;
    if (a === "--inject" || a === "-i") opts.inject = true;
    if (a.startsWith("--max-tokens=")) opts.maxTokens = parseInt(a.split("=")[1]);
    if (a.startsWith("--file=")) opts.currentFile = a.split("=")[1];
    if (a.startsWith("--task=")) opts.task = a.split("=")[1];
    if (a.startsWith("--search=")) opts.search = a.split("=")[1];
    if (a.startsWith("--decompose=")) opts.decompose = a.split("=")[1];
    if (["cursor", "windsurf", "copilot", "claude", "codex"].includes(a)) {
      opts.platform = a;
    }
  }
  return opts;
}

/**
 * Print help message
 */
function printHelp() {
  console.log();
  printBanner();
  printCommandHeader("CONTEXT", "AI Memory & Shared Context Engine v3.1");
  
  console.log(`${c.yellow}USAGE${c.reset}`);
  console.log(`  ${c.cyan}guardrail context${c.reset} ${c.dim}[options]${c.reset}`);
  console.log(`  ${c.cyan}guardrail context cursor${c.reset}      ${c.dim}# Generate Cursor rules only${c.reset}`);
  console.log(`  ${c.cyan}guardrail context windsurf${c.reset}    ${c.dim}# Generate Windsurf rules only${c.reset}`);
  console.log(`  ${c.cyan}guardrail context codex${c.reset}       ${c.dim}# Generate Codex/ChatGPT rules${c.reset}`);
  console.log();
  
  console.log(`${c.yellow}OPTIONS${c.reset}`);
  const options = [
    ['--platform <name>', 'Platform: cursor, windsurf, copilot, claude, codex, all'],
    ['--path <dir>', 'Project directory (default: current)'],
    ['--watch', 'Watch for changes and regenerate'],
    ['--verbose', 'Show detailed output'],
    ['--diff', 'Show changes since last generation'],
    ['--prune', 'Generate pruned context (reduced tokens)'],
    ['--max-tokens <n>', 'Max tokens for pruned context (default: 8000)'],
    ['--file <path>', 'Current file for context relevance'],
    ['--task <type>', 'Task type: general, api, utility, component'],
    ['--json', 'Output JSON for CI/programmatic use'],
    ['--search <query>', 'Semantic code search'],
    ['--scan', 'Security scan for secrets and vulnerabilities'],
    ['--decompose <task>', 'AI task decomposition for smart context'],
    ['--inject', 'Generate .guardrail/context.md for AI consumption'],
    ['--federate', 'Multi-repo context federation'],
    ['--help', 'Show this help'],
  ];
  
  printTable(['Option', 'Description'], options);
  console.log();
  
  console.log(`${c.yellow}SUPPORTED PLATFORMS${c.reset}`);
  console.log();
  const platforms = [
    ['Cursor', '.cursorrules, .cursor/rules/*.mdc'],
    ['Windsurf', '.windsurf/rules/*.md'],
    ['Copilot', '.github/copilot-instructions.md'],
    ['Claude Code', '.claude/project-context.md, .claude/mcp-config.json'],
    ['Codex/ChatGPT', '.codex-instructions.md'],
    ['MCP (Universal)', '.guardrail/context.json, .guardrail/memory.json'],
  ];
  
  printTable(['Platform', 'Generated Files'], platforms);
  console.log();
  
  console.log(`${gradientText('v3.1 FEATURES', [c.cyan, c.blue, c.magenta])}${c.reset}`);
  console.log();
  
  const features = [
    {
      icon: '🧠',
      title: 'Self-Learning AI Memory',
      items: [
        '• Learns from all your projects',
        '• Recommends patterns you use frequently',
        '• Stored in ~/.guardrail/global-memory.json',
      ]
    },
    {
      icon: '🔍',
      title: 'Semantic Code Search',
      items: [
        '• Natural language code search',
        '• TF-IDF vectorization for accuracy',
        '• Ranked results with similarity scores',
      ]
    },
    {
      icon: '🔒',
      title: 'Security Scanner',
      items: [
        '• Detect secrets and API keys',
        '• Find vulnerabilities before production',
        '• Detailed security reports',
      ]
    },
    {
      icon: '🎯',
      title: 'AI Task Decomposition',
      items: [
        '• Smart context selection for tasks',
        '• Token estimation to stay under limits',
        '• Implementation recommendations',
      ]
    },
    {
      icon: '🌐',
      title: 'Multi-Repo Federation',
      items: [
        '• Unify context across repositories',
        '• Detect shared components and patterns',
        '• Cross-project knowledge sharing',
      ]
    },
  ];
  
  features.forEach(feature => {
    console.log(`${c.magenta}${feature.icon} ${feature.title}${c.reset}`);
    feature.items.forEach(item => {
      console.log(`  ${c.dim}${item}${c.reset}`);
    });
    console.log();
  });
  
  console.log(`${c.yellow}EXAMPLES${c.reset}`);
  console.log();
  const examples = [
    ['guardrail context', 'Generate all rules files'],
    ['guardrail context cursor', 'Cursor only'],
    ['guardrail context codex', 'Codex/ChatGPT only'],
    ['guardrail context --watch', 'Watch mode - auto-regenerate'],
    ['guardrail context --diff', 'Show changes since last generation'],
    ['guardrail context --prune', 'Generate reduced context for tokens'],
    ['guardrail context --file src/App.tsx --prune', 'Context for specific file'],
    ['guardrail context --search "auth hook"', 'Semantic code search'],
    ['guardrail context --scan', 'Security scan'],
    ['guardrail context --decompose "create user profile"', 'AI task analysis'],
    ['guardrail context --inject', 'Generate AI context.md (AI Feedback Loop)'],
    ['guardrail context --federate', 'Multi-repo federation'],
  ];
  
  examples.forEach(([cmd, desc]) => {
    console.log(`  ${c.cyan}${cmd}${c.reset}`);
    console.log(`    ${c.dim}${desc}${c.reset}`);
    console.log();
  });
}

/**
 * Write all generated files to disk
 */
function writeFiles(projectPath, platform, analysis, verbose) {
  const written = [];

  // Cursor files
  if (platform === "all" || platform === "cursor") {
    const cursorRules = generateCursorRules(analysis);
    fs.writeFileSync(path.join(projectPath, ".cursorrules"), cursorRules);
    written.push(".cursorrules");

    const cursorDir = path.join(projectPath, ".cursor", "rules");
    fs.mkdirSync(cursorDir, { recursive: true });
    
    const modularRules = generateCursorModularRules(analysis);
    for (const [name, content] of Object.entries(modularRules)) {
      fs.writeFileSync(path.join(cursorDir, `${name}.mdc`), content);
      written.push(`.cursor/rules/${name}.mdc`);
    }
  }

  // Windsurf files
  if (platform === "all" || platform === "windsurf") {
    const windsurfDir = path.join(projectPath, ".windsurf", "rules");
    fs.mkdirSync(windsurfDir, { recursive: true });

    const windsurfRules = generateWindsurfRules(analysis);
    for (const [name, content] of Object.entries(windsurfRules)) {
      fs.writeFileSync(path.join(windsurfDir, `${name}.md`), content);
      written.push(`.windsurf/rules/${name}.md`);
    }
  }

  // Copilot instructions
  if (platform === "all" || platform === "copilot") {
    const githubDir = path.join(projectPath, ".github");
    fs.mkdirSync(githubDir, { recursive: true });

    const copilotInstructions = generateCopilotInstructions(analysis);
    fs.writeFileSync(path.join(githubDir, "copilot-instructions.md"), copilotInstructions);
    written.push(".github/copilot-instructions.md");
  }

  // Claude Desktop config
  if (platform === "all" || platform === "claude") {
    const claudeDir = path.join(projectPath, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });

    const { config, instructions } = generateClaudeConfig(analysis, projectPath);
    fs.writeFileSync(path.join(claudeDir, "mcp-config.json"), JSON.stringify(config, null, 2));
    fs.writeFileSync(path.join(claudeDir, "project-context.md"), instructions);
    written.push(".claude/mcp-config.json");
    written.push(".claude/project-context.md");
  }

  // Codex / ChatGPT instructions
  if (platform === "all" || platform === "codex") {
    const codexConfig = generateCodexConfig(analysis, projectPath);
    fs.writeFileSync(path.join(projectPath, ".codex-instructions.md"), codexConfig);
    written.push(".codex-instructions.md");
  }

  // Universal context (always generated)
  const guardrailDir = path.join(projectPath, ".guardrail");
  fs.mkdirSync(guardrailDir, { recursive: true });

  const contextJson = generateContextJson(analysis, projectPath);
  fs.writeFileSync(path.join(guardrailDir, "context.json"), contextJson);
  written.push(".guardrail/context.json");

  fs.writeFileSync(path.join(guardrailDir, "project-map.json"), JSON.stringify(analysis, null, 2));
  written.push(".guardrail/project-map.json");

  // Generate AI memory file
  const memory = learnFromProject(projectPath, analysis);
  const projectId = Object.keys(memory.projects).find(k => memory.projects[k].path === projectPath);
  fs.writeFileSync(path.join(guardrailDir, "memory.json"), JSON.stringify({
    projectMemory: memory.projects[projectId] || {},
    globalPatterns: memory.patterns,
    recommendations: getRecommendations(analysis),
    lastUpdated: new Date().toISOString(),
  }, null, 2));
  written.push(".guardrail/memory.json");

  // Generate insights file
  const insights = trackInsight(projectPath, "context_generated", {
    files: analysis.stats?.totalFiles || 0,
    components: analysis.components?.length || 0,
    platform: platform,
  });
  const insightsSummary = getInsightsSummary();
  fs.writeFileSync(path.join(guardrailDir, "insights.json"), JSON.stringify({
    session: insights.sessions?.slice(-1)[0] || {},
    summary: insightsSummary,
    lastUpdated: new Date().toISOString(),
  }, null, 2));
  written.push(".guardrail/insights.json");

  // Register in shared context
  registerSharedContext(projectPath, analysis);

  return written;
}

/**
 * Watch mode - regenerate on file changes
 */
function startWatchMode(projectPath, platform, verbose) {
  console.log(`${c.cyan}👁 Watch mode enabled${c.reset} - regenerating on file changes\n`);
  console.log(`${c.dim}Watching: ${projectPath}${c.reset}`);
  console.log(`${c.dim}Press Ctrl+C to stop${c.reset}\n`);

  let debounceTimer = null;
  const watchDirs = ["src", "app", "pages", "components", "lib", "server"];
  
  const regenerate = () => {
    console.log(`\n${c.yellow}⟳ Change detected, regenerating...${c.reset}\n`);
    try {
      const analysis = analyzeProject(projectPath);
      writeFiles(projectPath, platform, analysis, verbose);
      console.log(`${c.green}✓ Rules regenerated${c.reset} at ${new Date().toLocaleTimeString()}\n`);
    } catch (err) {
      console.log(`${c.red}✗ Regeneration failed:${c.reset} ${err.message}\n`);
    }
  };

  for (const dir of watchDirs) {
    const watchPath = path.join(projectPath, dir);
    if (fs.existsSync(watchPath)) {
      try {
        fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename && (filename.endsWith(".ts") || filename.endsWith(".tsx") || filename.endsWith(".js") || filename.endsWith(".jsx"))) {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(regenerate, 500);
          }
        });
        console.log(`${c.dim}  Watching: ${dir}/${c.reset}`);
      } catch {}
    }
  }

  process.on("SIGINT", () => {
    console.log(`\n${c.cyan}Watch mode stopped${c.reset}\n`);
    process.exit(0);
  });

  setInterval(() => {}, 1000);
}

/**
 * Main entry point
 */
async function runContext(args) {
  const opts = parseArgs(args);

  if (opts.help) {
    printHelp();
    return 0;
  }

  const projectPath = path.resolve(opts.path);

  // Handle inject mode — generate .guardrail/context.md
  if (opts.inject) {
    printBanner();
    printCommandHeader("CONTEXT INJECTION", "AI Feedback Loop — Verified Truth for AI Tools");
    console.log(`${c.dim}Generating context.md for AI consumption...${c.reset}\n`);

    // Try truthpack-based generation first (richer data)
    let contextMd = generateContextMdFromTruthpack(projectPath);

    if (!contextMd) {
      // Fall back to analysis-based generation
      console.log(`${c.dim}No truthpack found. Analyzing project...${c.reset}\n`);
      const analysis = analyzeProject(projectPath);
      contextMd = generateContextMd(analysis, projectPath);
    }

    // Write the file
    const guardrailDir = path.join(projectPath, ".guardrail");
    if (!fs.existsSync(guardrailDir)) {
      fs.mkdirSync(guardrailDir, { recursive: true });
    }
    const outputPath = path.join(guardrailDir, "context.md");
    fs.writeFileSync(outputPath, contextMd);

    const lineCount = contextMd.split("\n").length;
    const sizeKb = (Buffer.byteLength(contextMd) / 1024).toFixed(1);

    printSectionHeader('CONTEXT INJECTION COMPLETE');
    console.log(`${c.green}✓ Generated${c.reset} ${highlightPath('.guardrail/context.md')}`);
    console.log(`${c.dim}  ${lineCount} lines, ${sizeKb} KB${c.reset}\n`);

    console.log(`${c.bold}How to use:${c.reset}\n`);
    console.log(`  ${c.cyan}Cursor/Windsurf:${c.reset} AI will auto-read from .guardrail/context.md`);
    console.log(`  ${c.cyan}Claude Code:${c.reset}     Add to CLAUDE.md or reference via MCP`);
    console.log(`  ${c.cyan}Copilot:${c.reset}         Copy to .github/copilot-instructions.md`);
    console.log(`  ${c.cyan}MCP Server:${c.reset}      Use ${highlightCode('guardrail.inject')} tool for live injection\n`);

    console.log(`${c.magenta}The AI Feedback Loop:${c.reset}`);
    console.log(`  ${c.dim}1.${c.reset} ${highlightCode('guardrail context --inject')} → generates truth`);
    console.log(`  ${c.dim}2.${c.reset} AI reads truth → writes correct code`);
    console.log(`  ${c.dim}3.${c.reset} ${highlightCode('guardrail scan')} → verifies code`);
    console.log(`  ${c.dim}4.${c.reset} Violations feed back → AI learns what to avoid\n`);

    return 0;
  }

  // Handle search mode first (before any other output)
  if (opts.search) {
    printBanner();
    printCommandHeader("SEMANTIC SEARCH", "Natural Language Code Search");
    console.log(`${c.dim}Query:${c.reset} ${highlightCode(`"${opts.search}"`)}\n`);
    
    console.log(`${c.dim}🔍 Building search index...${c.reset}`, '\r');
    let searchIndex = loadSearchIndex(projectPath);
    if (!searchIndex) {
      console.log(`${c.yellow}🔍 Building search index...${c.reset}`, '\r');
      searchIndex = buildSearchIndex(projectPath);
      saveSearchIndex(projectPath, searchIndex);
      console.log(`${c.green}✓ Search index built${c.reset}     \n`);
    } else {
      console.log(`${c.green}✓ Search index loaded${c.reset}    \n`);
    }
    
    console.log(`${c.dim}🔍 Searching code...${c.reset}`, '\r');
    const results = semanticSearch(searchIndex, opts.search, 10);
    console.log(`${c.green}✓ Search complete${c.reset}        \n`);
    
    if (results.length === 0) {
      console.log(`${c.yellow}⚠ No results found for "${opts.search}"${c.reset}\n`);
    } else {
      console.log(`${c.green}Found ${formatNumber(results.length)} results:${c.reset}\n`);
      
      printTable(['File', 'Lines', 'Match', 'Type'], 
        results.map(r => [
          highlightPath(r.file),
          `${r.startLine}-${r.endLine}`,
          `${(r.similarity * 100).toFixed(1)}%`,
          r.type || 'code'
        ])
      );
      
      // Save report
      const report = generateSearchReport(results, opts.search);
      const reportFile = path.join(projectPath, ".guardrail", "search-report.md");
      fs.writeFileSync(reportFile, report);
      console.log(`\n${c.dim}📄 Full report saved to:${c.reset} ${highlightPath(reportFile)}\n`);
    }
    
    return 0;
  }

  // Handle scan mode
  if (opts.scan) {
    printBanner();
    printCommandHeader("SECURITY SCAN", "Detect Secrets & Vulnerabilities");
    console.log(`${c.dim}Scanning project for security issues...${c.reset}\n`);
    
    const scanResults = scanProject(projectPath);
    
    printSectionHeader('SCAN RESULTS');
    console.log(`${c.dim}Files Scanned:${c.reset} ${formatNumber(scanResults.stats.totalFiles)}`);
    console.log(`${c.dim}Critical Issues:${c.reset} ${c.red}${scanResults.stats.criticalIssues}${c.reset}`);
    console.log(`${c.dim}High Issues:${c.reset} ${c.yellow}${scanResults.stats.highIssues}${c.reset}`);
    console.log(`${c.dim}Medium Issues:${c.reset} ${scanResults.stats.mediumIssues}`);
    console.log(`${c.dim}Secrets Found:${c.reset} ${scanResults.secrets.length}`);
    console.log(`${c.dim}Vulnerabilities:${c.reset} ${scanResults.vulnerabilities.length}\n`);
    
    if (scanResults.secrets.length > 0 || scanResults.vulnerabilities.length > 0) {
      console.log(`${c.bgRed}${c.white}  ⚠ SECURITY ISSUES DETECTED  ${c.reset}\n`);
      
      // Show critical issues
      const criticalIssues = [...scanResults.secrets, ...scanResults.vulnerabilities]
        .filter(i => i.severity === "critical" || i.severity === "high")
        .slice(0, 5);
      
      console.log(`${c.bold}Critical Issues:${c.reset}\n`);
      criticalIssues.forEach((issue, idx) => {
        const severityColor = issue.severity === 'critical' ? c.red : c.yellow;
        console.log(`${idx + 1}. ${severityColor}${issue.type}${c.reset} in ${highlightPath(issue.file)}:${issue.line}`);
        if (issue.description) {
          console.log(`   ${c.dim}${issue.description}${c.reset}`);
        }
      });
      
      // Save report
      const report = generateSecurityReport(scanResults);
      const reportFile = path.join(projectPath, ".guardrail", "security-report.md");
      fs.writeFileSync(reportFile, report);
      console.log(`\n${c.dim}📄 Full report saved to:${c.reset} ${highlightPath(reportFile)}\n`);
    } else {
      console.log(`${c.bgGreen}${c.black}  ✓ NO SECURITY ISSUES FOUND  ${c.reset}\n`);
    }
    
    return 0;
  }

  // Handle decompose mode
  if (opts.decompose) {
    printBanner();
    printCommandHeader("AI TASK DECOMPOSITION", "Smart Context Selection");
    console.log(`${c.dim}Task:${c.reset} ${highlightCode(`"${opts.decompose}"`)}\n`);
    
    console.log(`${c.dim}🧠 Analyzing task...${c.reset}`, '\r');
    const plan = decomposeTask(opts.decompose, projectPath);
    console.log(`${c.green}✓ Task analyzed${c.reset}       \n`);
    
    printSectionHeader('TASK ANALYSIS');
    console.log(`${c.dim}Task Type:${c.reset} ${highlight(plan.taskType)}`);
    console.log(`${c.dim}Search Query:${c.reset} ${highlightCode(`"${plan.searchQuery}"`)}`);
    console.log(`${c.dim}Context Files:${c.reset} ${formatNumber(plan.context.files.length)}`);
    console.log(`${c.dim}Estimated Tokens:${c.reset} ${formatNumber(plan.context.totalTokens)}\n`);
    
    if (plan.context.files.length > 0) {
      console.log(`${c.bold}Selected Context:${c.reset}\n`);
      printTable(['File', 'Tokens', 'Relevance'], 
        plan.context.files.slice(0, 10).map(f => [
          highlightPath(f.file),
          formatNumber(f.tokens),
          `${(f.relevance * 100).toFixed(1)}%`
        ])
      );
      if (plan.context.files.length > 10) {
        console.log(`${c.dim}... and ${plan.context.files.length - 10} more files${c.reset}\n`);
      }
    }
    
    if (plan.recommendations.length > 0) {
      console.log(`${c.bold}Recommendations:${c.reset}\n`);
      plan.recommendations.forEach((rec, idx) => {
        console.log(`${idx + 1}. ${c.cyan}•${c.reset} ${rec}`);
      });
      console.log();
    }
    
    // Save report
    const report = generateDecompositionReport(plan);
    const reportFile = path.join(projectPath, ".guardrail", "task-decomposition.md");
    fs.writeFileSync(reportFile, report);
    console.log(`${c.dim}📄 Full report saved to:${c.reset} ${highlightPath(reportFile)}\n`);
    
    return 0;
  }

  // Handle federation mode
  if (opts.federate) {
    printBanner();
    printCommandHeader("MULTI-REPO FEDERATION", "Cross-Repository Context");
    console.log(`${c.dim}Initializing federation...${c.reset}\n`);
    
    // Register current repo
    console.log(`${c.dim}📋 Registering repository...${c.reset}`, '\r');
    const repoInfo = registerRepository(projectPath);
    console.log(`${c.green}✓ Repository registered${c.reset}   \n`);
    console.log(`${c.dim}Name:${c.reset} ${highlight(repoInfo.name || repoInfo.id)}\n`);
    
    // Find related repos
    console.log(`${c.dim}🔍 Finding related repositories...${c.reset}`, '\r');
    const related = findRelatedRepositories(projectPath, 5);
    console.log(`${c.green}✓ Found ${related.length} related repos${c.reset}\n`);
    
    if (related.length > 0) {
      console.log(`${c.bold}Related Repositories:${c.reset}\n`);
      printTable(['Repository', 'Framework', 'Similarity'], 
        related.map(r => [
          highlight(r.name || r.id),
          r.framework || "Unknown",
          `${(r.similarity * 100).toFixed(0)}%`
        ])
      );
    }
    
    // Generate federated context
    console.log(`\n${c.dim}🌐 Generating federated context...${c.reset}`, '\r');
    const federated = generateFederatedContext();
    console.log(`${c.green}✓ Federation complete${c.reset}      \n`);
    
    printSectionHeader('FEDERATION SUMMARY');
    console.log(`${c.dim}Total Repositories:${c.reset} ${formatNumber(federated.stats.totalRepos)}`);
    console.log(`${c.dim}Shared Components:${c.reset} ${formatNumber(federated.stats.sharedComponents)}`);
    console.log(`${c.dim}Shared Hooks:${c.reset} ${formatNumber(federated.stats.sharedHooks)}`);
    console.log(`${c.dim}Shared Patterns:${c.reset} ${formatNumber(federated.stats.sharedPatterns)}\n`);
    
    // Save report
    const report = generateFederationReport(federated);
    const reportFile = path.join(projectPath, ".guardrail", "federation-report.md");
    fs.writeFileSync(reportFile, report);
    console.log(`${c.dim}📄 Full report saved to:${c.reset} ${highlightPath(reportFile)}\n`);
    
    return 0;
  }

  // Default context generation
  printBanner();
  printCommandHeader("CONTEXT", "AI Memory & Shared Context Engine");
  console.log(`${c.dim}Analyzing project:${c.reset} ${highlightPath(projectPath)}\n`);

  // Handle diff mode
  if (opts.diff) {
    const previous = loadSnapshot(projectPath);
    if (!previous) {
      console.log(`${c.yellow}No previous context generation found.${c.reset}\n`);
      console.log(`Run ${c.cyan}guardrail context${c.reset} first to generate baseline.\n`);
      return 1;
    }
    
    console.log(`${c.dim}Loading previous context...${c.reset}\n`);
    const analysis = analyzeProject(projectPath);
    const diff = generateContextDiff(previous, analysis);
    
    console.log(`${c.green}Context Changes:${c.reset}\n`);
    console.log(`- Total Changes: ${diff.summary.totalChanges}`);
    console.log(`- Additions: ${diff.summary.additions}`);
    console.log(`- Removals: ${diff.summary.removals}`);
    console.log(`- Breaking Changes: ${diff.summary.breakingChanges}\n`);
    
    if (diff.summary.totalChanges > 0) {
      console.log(`${c.yellow}Changes detected:${c.reset}\n`);
      for (const change of diff.changes.added.slice(0, 10)) {
        console.log(`  ${c.green}+${c.reset} ${change.type}: ${change.name}`);
      }
      for (const change of diff.changes.removed.slice(0, 10)) {
        console.log(`  ${c.red}-${c.reset} ${change.type}: ${change.name}`);
      }
      
      const reportFile = saveDiffReport(projectPath, diff);
      console.log(`\n${c.dim}Full report saved to: ${reportFile}${c.reset}\n`);
    } else {
      console.log(`${c.green}No changes detected since last generation.${c.reset}\n`);
    }
    
    return 0;
  }

  // Handle prune mode
  if (opts.prune) {
    console.log(`${c.dim}Analyzing project for pruning...${c.reset}\n`);
    const analysis = analyzeProject(projectPath);
    
    const pruned = opts.currentFile 
      ? getContextForFile(path.join(projectPath, opts.currentFile), analysis)
      : pruneContext(analysis, {
          maxTokens: opts.maxTokens,
          task: opts.task,
        });
    
    console.log(`${c.green}Pruned Context Generated:${c.reset}\n`);
    console.log(`- Total Files: ${pruned.totalCount || 0}`);
    console.log(`- Included Files: ${pruned.includedCount || 0}`);
    console.log(`- Pruned Files: ${pruned.pruned || 0}`);
    console.log(`- Estimated Tokens: ${pruned.totalTokens || 0} / ${pruned.maxTokens || opts.maxTokens}\n`);
    
    console.log(`${c.dim}Top files by relevance:${c.reset}\n`);
    for (const file of pruned.files.slice(0, 10)) {
      console.log(`  ${c.cyan}•${c.reset} ${file.path} (score: ${file.score}, tokens: ${file.tokens})`);
    }
    
    // Save pruned context
    const guardrailDir = path.join(projectPath, ".guardrail");
    if (!fs.existsSync(guardrailDir)) {
      fs.mkdirSync(guardrailDir, { recursive: true });
    }
    
    const outputPath = path.join(guardrailDir, "context-pruned.json");
    const outputData = opts.currentFile ? pruned : generatePrunedContext(analysis, {
      maxTokens: opts.maxTokens,
      task: opts.task,
    });
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`\n${c.dim}Saved to: .guardrail/context-pruned.json${c.reset}\n`);
    
    return 0;
  }

  // Handle search mode first (before any other output)
  if (opts.search) {
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
  ${c.bold}guardrail CONTEXT v3.0${c.reset} - Semantic Code Search
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);
    console.log(`${c.dim}Searching code...${c.reset}\n`);
    
    let searchIndex = loadSearchIndex(projectPath);
    if (!searchIndex) {
      console.log(`${c.yellow}Building search index...${c.reset}\n`);
      searchIndex = buildSearchIndex(projectPath);
      saveSearchIndex(projectPath, searchIndex);
    }
    
    const results = semanticSearch(searchIndex, opts.search, 10);
    
    if (results.length === 0) {
      console.log(`${c.yellow}No results found for "${opts.search}"${c.reset}\n`);
    } else {
      console.log(`${c.green}Found ${results.length} results:${c.reset}\n`);
      for (const result of results) {
        console.log(`  ${c.cyan}•${c.reset} ${result.file}:${result.startLine}-${result.endLine} (${(result.similarity * 100).toFixed(1)}% match)`);
        console.log(`    ${c.dim}${result.type}${c.reset}`);
      }
      
      // Save report
      const report = generateSearchReport(results, opts.search);
      const reportFile = path.join(projectPath, ".guardrail", "search-report.md");
      fs.writeFileSync(reportFile, report);
      console.log(`\n${c.dim}Full report saved to: ${reportFile}${c.reset}\n`);
    }
    
    return 0;
  }

  // Handle scan mode
  if (opts.scan) {
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
  ${c.bold}guardrail CONTEXT v3.0${c.reset} - Security Scanner
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);
    console.log(`${c.dim}Scanning for security issues...${c.reset}\n`);
    
    const scanResults = scanProject(projectPath);
    
    console.log(`${c.green}Security Scan Results:${c.reset}\n`);
    console.log(`- Files Scanned: ${scanResults.stats.totalFiles}`);
    console.log(`- Critical Issues: ${scanResults.stats.criticalIssues}`);
    console.log(`- High Issues: ${scanResults.stats.highIssues}`);
    console.log(`- Medium Issues: ${scanResults.stats.mediumIssues}`);
    console.log(`- Secrets Found: ${scanResults.secrets.length}`);
    console.log(`- Vulnerabilities: ${scanResults.vulnerabilities.length}\n`);
    
    if (scanResults.secrets.length > 0 || scanResults.vulnerabilities.length > 0) {
      console.log(`${c.red}⚠ Security issues detected!${c.reset}\n`);
      
      // Show critical issues
      const criticalIssues = [...scanResults.secrets, ...scanResults.vulnerabilities]
        .filter(i => i.severity === "critical" || i.severity === "high")
        .slice(0, 5);
      
      for (const issue of criticalIssues) {
        console.log(`  ${c.red}•${c.reset} ${issue.type} in ${issue.file}:${issue.line}`);
      }
      
      // Save report
      const report = generateSecurityReport(scanResults);
      const reportFile = path.join(projectPath, ".guardrail", "security-report.md");
      fs.writeFileSync(reportFile, report);
      console.log(`\n${c.dim}Full report saved to: ${reportFile}${c.reset}\n`);
    } else {
      console.log(`${c.green}✅ No security issues found!${c.reset}\n`);
    }
    
    return 0;
  }

  // Handle decompose mode
  if (opts.decompose) {
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
  ${c.bold}guardrail CONTEXT v3.0${c.reset} - AI Task Decomposition
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);
    console.log(`${c.dim}Decomposing task...${c.reset}\n`);
    
    const plan = decomposeTask(opts.decompose, projectPath);
    
    console.log(`${c.green}Task Analysis:${c.reset}\n`);
    console.log(`- Task Type: ${plan.taskType}`);
    console.log(`- Search Query: "${plan.searchQuery}"`);
    console.log(`- Context Files: ${plan.context.files.length}`);
    console.log(`- Estimated Tokens: ${plan.context.totalTokens}\n`);
    
    if (plan.context.files.length > 0) {
      console.log(`${c.dim}Selected Context:${c.reset}\n`);
      for (const file of plan.context.files.slice(0, 5)) {
        console.log(`  ${c.cyan}•${c.reset} ${file.file} (${file.tokens} tokens)`);
      }
    }
    
    if (plan.recommendations.length > 0) {
      console.log(`\n${c.magenta}Recommendations:${c.reset}\n`);
      for (const rec of plan.recommendations) {
        console.log(`  • ${rec}`);
      }
    }
    
    // Save report
    const report = generateDecompositionReport(plan);
    const reportFile = path.join(projectPath, ".guardrail", "task-decomposition.md");
    fs.writeFileSync(reportFile, report);
    console.log(`\n${c.dim}Full report saved to: ${reportFile}${c.reset}\n`);
    
    return 0;
  }

  // Handle federation mode
  if (opts.federate) {
    console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
  ${c.bold}guardrail CONTEXT v3.0${c.reset} - Multi-Repo Federation
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);
    console.log(`${c.dim}Initializing federation...${c.reset}\n`);
    
    // Register current repo
    const repoInfo = registerRepository(projectPath);
    console.log(`${c.green}Registered repository:${c.reset} ${repoInfo.name || repoInfo.id}\n`);
    
    // Find related repos
    const related = findRelatedRepositories(projectPath, 5);
    if (related.length > 0) {
      console.log(`${c.cyan}Related repositories:${c.reset}\n`);
      for (const repo of related) {
        console.log(`  • ${repo.name || repo.id} (${repo.framework || "Unknown"}) - ${(repo.similarity * 100).toFixed(0)}% similar`);
      }
    }
    
    // Generate federated context
    const federated = generateFederatedContext();
    console.log(`\n${c.green}Federation Summary:${c.reset}\n`);
    console.log(`- Total Repositories: ${federated.stats.totalRepos}`);
    console.log(`- Shared Components: ${federated.stats.sharedComponents}`);
    console.log(`- Shared Hooks: ${federated.stats.sharedHooks}`);
    console.log(`- Shared Patterns: ${federated.stats.sharedPatterns}\n`);
    
    // Save report
    const report = generateFederationReport(federated);
    const reportFile = path.join(projectPath, ".guardrail", "federation-report.md");
    fs.writeFileSync(reportFile, report);
    console.log(`${c.dim}Full report saved to: ${reportFile}${c.reset}\n`);
    
    return 0;
  }

  // Default header for other modes
  console.log(`
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
  ${c.bold}guardrail CONTEXT v3.0${c.reset} - AI Memory & Shared Context Engine
${c.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c.reset}
`);

  // Analyze project
  const analysis = analyzeProject(projectPath);
  const p = analysis.patterns || {};

  // Display analysis - Basic info
  printSectionHeader('PROJECT ANALYSIS');
  console.log(`${c.dim}Project:${c.reset} ${highlight(analysis.name)}`);
  console.log(`${c.dim}Framework:${c.reset} ${analysis.framework || "Unknown"}`);
  console.log(`${c.dim}Language:${c.reset} ${analysis.language || "JavaScript"}`);
  console.log(`${c.dim}Architecture:${c.reset} ${analysis.architecture}`);
  
  const s = analysis.stats || {};
  if (s.totalFiles) {
    console.log(`${c.dim}Size:${c.reset} ${formatNumber(s.totalFiles)} files, ~${formatNumber(Math.round(s.totalLines / 1000))}k lines`);
  }
  
  // Structure
  console.log(`\n${c.blue}Structure:${c.reset}`);
  console.log(`  ${c.dim}Directories:${c.reset} ${analysis.directories.length} | ${c.dim}Components:${c.reset} ${analysis.components.length} | ${c.dim}API Routes:${c.reset} ${analysis.apiRoutes.length} | ${c.dim}Models:${c.reset} ${analysis.models.length}`);
  
  const t = analysis.types || {};
  if (t.interfaces?.length || t.types?.length) {
    console.log(`  ${c.dim}Interfaces:${c.reset} ${t.interfaces?.length || 0} | ${c.dim}Types:${c.reset} ${t.types?.length || 0} | ${c.dim}Enums:${c.reset} ${t.enums?.length || 0}`);
  }

  const env = analysis.envVars || {};
  if (env.variables?.length) {
    console.log(`  ${c.dim}Env Vars:${c.reset} ${env.variables.length} detected`);
  }
  
  // Patterns
  if (p.hooks?.length || p.stateManagement || p.dataFetching?.length || p.styling?.length) {
    console.log(`\n${c.magenta}Patterns Detected:${c.reset}`);
    if (p.hooks?.length) console.log(`  ${c.dim}Custom Hooks:${c.reset} ${p.hooks.length} (${p.hooks.slice(0, 3).join(", ")}${p.hooks.length > 3 ? "..." : ""})`);
    if (p.stateManagement) console.log(`  ${c.dim}State:${c.reset} ${p.stateManagement}`);
    if (p.dataFetching?.length) console.log(`  ${c.dim}Data Fetching:${c.reset} ${p.dataFetching.join(", ")}`);
    if (p.styling?.length) console.log(`  ${c.dim}Styling:${c.reset} ${p.styling.join(", ")}`);
    if (p.validation) console.log(`  ${c.dim}Validation:${c.reset} ${p.validation}`);
    if (p.authentication) console.log(`  ${c.dim}Auth:${c.reset} ${p.authentication}`);
    if (p.testing?.length) console.log(`  ${c.dim}Testing:${c.reset} ${p.testing.join(", ")}`);
  }

  // Anti-patterns
  if (p.antiPatterns?.length > 0) {
    console.log(`\n${c.yellow}⚠ Anti-Patterns Found:${c.reset}`);
    for (const ap of p.antiPatterns) {
      const icon = ap.severity === 'error' ? `${c.red}✗${c.reset}` : ap.severity === 'warning' ? `${c.yellow}!${c.reset}` : `${c.blue}i${c.reset}`;
      console.log(`  ${icon} ${ap.message}`);
    }
  }

  // Monorepo
  const mono = analysis.monorepo || {};
  if (mono.isMonorepo) {
    console.log(`\n${c.cyan}📦 Monorepo Detected:${c.reset} ${mono.type}`);
    console.log(`  ${c.dim}Workspaces:${c.reset} ${mono.workspaces?.length || 0}`);
    if (mono.sharedPackages?.length > 0) {
      console.log(`  ${c.dim}Shared packages:${c.reset} ${mono.sharedPackages.slice(0, 3).map(p => p.name).join(", ")}...`);
    }
  }

  // AI Memory
  const memoryStatus = loadMemory();
  const projectCount = Object.keys(memoryStatus.projects || {}).length;
  if (projectCount > 0) {
    console.log(`\n${c.magenta}🧠 AI Memory:${c.reset}`);
    console.log(`  ${c.dim}Projects learned:${c.reset} ${projectCount}`);
    console.log(`  ${c.dim}Total learnings:${c.reset} ${memoryStatus.learnings?.length || 0}`);
  }

  // Recommendations
  const recommendations = getRecommendations(analysis);
  if (recommendations.length > 0) {
    console.log(`\n${c.green}💡 Recommendations:${c.reset}`);
    for (const rec of recommendations) {
      console.log(`  ${c.dim}•${c.reset} ${rec.message}`);
    }
  }

  console.log(`\n${c.dim}Generating rules files...${c.reset}\n`);

  // Write files
  const written = writeFiles(projectPath, opts.platform, analysis, opts.verbose);

  // Generate additional enhanced files
  const guardrailDir = path.join(projectPath, ".guardrail");

  // Always generate context.md (AI Feedback Loop)
  const contextMdFromTruthpack = generateContextMdFromTruthpack(projectPath);
  const contextMdContent = contextMdFromTruthpack || generateContextMd(analysis, projectPath);
  fs.writeFileSync(path.join(guardrailDir, "context.md"), contextMdContent);
  written.push(".guardrail/context.md");
  
  // Dependency graph
  if (opts.verbose) {
    console.log(`${c.dim}Generating dependency graph...${c.reset}`);
  }
  const depGraph = buildDependencyGraph(projectPath);
  const mermaidDiagram = generateMermaidDiagram(depGraph, { maxNodes: 50 });
  fs.writeFileSync(path.join(guardrailDir, "dependency-graph.mmd"), mermaidDiagram);
  written.push(".guardrail/dependency-graph.mmd");
  
  // HTML visualization
  const htmlViz = generateHtmlVisualization(depGraph, { maxNodes: 100 });
  fs.writeFileSync(path.join(guardrailDir, "dependency-graph.html"), htmlViz);
  written.push(".guardrail/dependency-graph.html");
  
  // Git context
  const gitContext = getGitContext(projectPath);
  if (gitContext?.isRepo) {
    fs.writeFileSync(
      path.join(guardrailDir, "git-context.json"),
      JSON.stringify(gitContext, null, 2)
    );
    written.push(".guardrail/git-context.json");
  }
  
  // API contracts
  const apiContext = generateAPIContext(projectPath);
  fs.writeFileSync(
    path.join(guardrailDir, "api-contracts.json"),
    JSON.stringify(apiContext, null, 2)
  );
  written.push(".guardrail/api-contracts.json");
  
  // Team conventions
  const teamReport = generateTeamReport(projectPath);
  if (teamReport.available) {
    fs.writeFileSync(
      path.join(guardrailDir, "team-conventions.json"),
      JSON.stringify(teamReport, null, 2)
    );
    written.push(".guardrail/team-conventions.json");
  }
  
  // Save snapshot for diff tracking
  const snapshot = saveSnapshot(projectPath, analysis);

  // Display results
  printSectionHeader('GENERATION COMPLETE');
  console.log(`${c.green}✓ Generated ${written.length} files:${c.reset}\n`);
  
  written.forEach((file, idx) => {
    console.log(`  ${c.cyan}${idx + 1}.${c.reset} ${highlightPath(file)}`);
  });

  // Enhancements summary
  const enhancements = [];
  if (p.hooks?.length) enhancements.push("custom hooks");
  if (p.stateManagement) enhancements.push("state patterns");
  if (p.codeExamples?.hooks) enhancements.push("code examples");
  if (p.antiPatterns?.length) enhancements.push("anti-pattern warnings");
  if (p.testing?.length) enhancements.push("testing patterns");
  if (analysis.types?.interfaces?.length) enhancements.push("type definitions");
  if (analysis.envVars?.variables?.length) enhancements.push("env vars");
  if (analysis.stats?.totalFiles) enhancements.push("file statistics");
  if (analysis.monorepo?.isMonorepo) enhancements.push("monorepo workspaces");
  enhancements.push("AI memory");
  enhancements.push("chat insights");
  enhancements.push("dependency graphs");
  if (gitContext?.isRepo) enhancements.push("git context");
  enhancements.push("API contracts");
  if (teamReport.available) enhancements.push("team conventions");

  console.log();
  console.log(`${c.bgGreen}${c.black}  ✓ CONTEXT GENERATION COMPLETE  ${c.reset}\n`);
  
  console.log(`${c.bold}Your AI coding assistants now have full project awareness:${c.reset}\n`);
  
  const platforms = [
    ['Cursor', '.cursorrules and .cursor/rules/'],
    ['Windsurf', '.windsurf/rules/'],
    ['Copilot', '.github/copilot-instructions.md'],
    ['Claude Code', '.claude/project-context.md'],
    ['Codex/ChatGPT', '.codex-instructions.md'],
    ['MCP', '.guardrail/context.json'],
  ];
  
  platforms.forEach(([name, files]) => {
    console.log(`  ${c.cyan}•${c.reset} ${name.padEnd(14)} ${c.dim}will read${c.reset} ${files}`);
  });
  
  console.log(`\n${c.magenta}🧠 AI Memory active:${c.reset} Learning from your projects to give better recommendations\n`);
  
  if (enhancements.length > 0) {
    console.log(`${c.magenta}Enhanced with:${c.reset} ${enhancements.join(", ")}\n`);
  }
  
  console.log(`${c.dim}Next steps:${c.reset}`);
  console.log(`  • Regenerate after major changes: ${highlightCode('guardrail context')}`);
  console.log(`  • Track changes: ${highlightCode('guardrail context --diff')}`);
  console.log(`  • Generate pruned context: ${highlightCode('guardrail context --prune')}`);
  console.log(`  • Semantic search: ${highlightCode('guardrail context --search "query"')}`);
  console.log(`  • Security scan: ${highlightCode('guardrail context --scan')}`);
  console.log(`  • AI task analysis: ${highlightCode('guardrail context --decompose "task"')}`);
  console.log(`  • Multi-repo federation: ${highlightCode('guardrail context --federate')}`);
  console.log();

  // Watch mode
  if (opts.watch) {
    startWatchMode(projectPath, opts.platform, opts.verbose);
    return new Promise(() => {});
  }

  return 0;
}

module.exports = { runContext };
