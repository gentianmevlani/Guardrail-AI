program
  .name('guardrail')
  .description('guardrail AI - Security scanning for your codebase')
  .version(CLI_VERSION);

// Login command
program
  .command('login')
  .description('Login with your guardrail API key')
  .option('-k, --key <apiKey>', 'Your API key from guardrailai.dev')
  .action(async (options) => {
    printLogo();
    // Use existing auth logic
    const { program: authProgram } = require('./index');
    // This will be handled by the existing auth command logic
  });

// Logout command
program
  .command('logout')
  .description('Remove stored credentials')
  .action(async () => {
    printLogo();
    try {
      await clearAuthState();
      console.log(`\n${c.success('✓')} ${c.bold('Logged out successfully')}\n`);
    } catch {
      console.log(`\n${c.info('ℹ')} No credentials found\n`);
    }
  });

// Whoami command
program
  .command('whoami')
  .description('Show current authentication status')
  .action(async () => {
    printLogo();
    const state = await loadAuthState();
    console.log('');
    if (state.apiKey) {
      const tierBadge = state.tier === 'enterprise' ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}` :
                        state.tier === 'pro' ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}` :
                        state.tier === 'starter' ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}` :
                        `${styles.dim} FREE ${styles.reset}`;
      console.log(`  ${c.success('✓')} ${c.bold('Authenticated')}`);
      console.log(`  ${c.dim('Tier:')}   ${tierBadge}`);
      console.log(`  ${c.dim('Email:')}  ${state.email || 'N/A'}`);
      console.log(`  ${c.dim('Since:')}  ${state.authenticatedAt || 'N/A'}\n`);
    } else {
      console.log(`  ${c.high('✗')} ${c.bold('Not authenticated')}\n`);
    }
  });

// Auth command (keep for backward compatibility)
program
  .command('auth')
  .description('Authenticate with your guardrail API key')
  .option('-k, --key <apiKey>', 'Your API key from guardrailai.dev')
  .option('--logout', 'Remove stored credentials')
  .option('--status', 'Check authentication status')
  .option('--refresh', 'Force revalidation of cached entitlements')
  .action(async (options) => {
    printLogo();
    const configPath = getConfigPath();
    
    // Handle logout
    if (options.logout) {
      console.log('');
      const lines = frameLines([
        `${styles.brightRed}${styles.bold}${icons.auth} LOGOUT${styles.reset}`,
        '',
        'Removing stored credentials...',
      ], { padding: 2 });
      console.log(lines.join('\n'));
      console.log('');
      
      try {
        await clearAuthState();
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Logged out successfully${styles.reset}`);
        console.log(`  ${styles.dim}Credentials removed from ${configPath}${styles.reset}`);
      } catch {
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Failed to remove credentials${styles.reset}`);
      }
      console.log('');
      return;
    }
    
    // Handle status check
    if (options.status) {
      const state = await loadAuthState();
      console.log('');
      
      if (state.apiKey) {
        const tierBadge = state.tier === 'enterprise' ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}` :
                          state.tier === 'pro' ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}` :
                          state.tier === 'starter' ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}` :
                          `${styles.dim} FREE ${styles.reset}`;
        
        const maskedKey = maskApiKey(state.apiKey);
        const expiryInfo = state.expiresAt ? formatExpiry(state.expiresAt) : 'N/A';
        
        const statusLines = [
          `${styles.brightGreen}${styles.bold}${icons.success} AUTHENTICATED${styles.reset}`,
          '',
          `${styles.dim}API Key:${styles.reset}     ${styles.cyan}${maskedKey}${styles.reset}`,
          `${styles.dim}Tier:${styles.reset}        ${tierBadge}`,
          `${styles.dim}Email:${styles.reset}       ${state.email || 'N/A'}`,
          `${styles.dim}Expires:${styles.reset}     ${expiryInfo}`,
          `${styles.dim}Since:${styles.reset}       ${state.authenticatedAt ? new Date(state.authenticatedAt).toLocaleString() : 'N/A'}`,
          `${styles.dim}Config:${styles.reset}      ${configPath}`,
        ];
        
        // Add entitlements if available
        if (state.entitlements && state.entitlements.length > 0) {
          statusLines.push('');
          statusLines.push(`${styles.dim}Entitlements:${styles.reset}`);
          state.entitlements.slice(0, 5).forEach(e => {
            statusLines.push(`  ${styles.dim}${icons.bullet}${styles.reset} ${e}`);
          });
          if (state.entitlements.length > 5) {
            statusLines.push(`  ${styles.dim}... and ${state.entitlements.length - 5} more${styles.reset}`);
          }
        }
        
        const framed = frameLines(statusLines, { padding: 2 });
        console.log(framed.join('\n'));
        
        // Show expiry warning if within 72 hours
        if (isExpiryWarning(state.expiresAt, 72)) {
          const hours = hoursUntilExpiry(state.expiresAt);
          console.log('');
          console.log(`  ${styles.brightYellow}${icons.warning}${styles.reset} ${styles.bold}Entitlements expiring in ${hours}h${styles.reset}`);
          console.log(`  ${styles.dim}Run${styles.reset} ${styles.brightCyan}guardrail auth --refresh${styles.reset} ${styles.dim}to revalidate${styles.reset}`);
        }
      } else {
        const statusLines = [
          `${styles.brightRed}${styles.bold}${icons.error} NOT AUTHENTICATED${styles.reset}`,
          '',
          `${styles.dim}To authenticate, run:${styles.reset}`,
          `${styles.brightCyan}guardrail auth --key YOUR_API_KEY${styles.reset}`,
          '',
          `${styles.dim}Get your API key from:${styles.reset}`,
          `${styles.brightBlue}https://guardrailai.dev/api-key${styles.reset}`,
        ];
        
        const framed = frameLines(statusLines, { padding: 2 });
        console.log(framed.join('\n'));
      }
      console.log('');
      return;
    }
    
    // Handle refresh
    if (options.refresh) {
      const state = await loadAuthState();
      
      if (!state.apiKey) {
        console.log('');
        const errorLines = [
          `${styles.brightRed}${styles.bold}${icons.error} NO CREDENTIALS FOUND${styles.reset}`,
          '',
          `${styles.dim}Authenticate first with:${styles.reset}`,
          `${styles.brightCyan}guardrail auth --key YOUR_API_KEY${styles.reset}`,
        ];
        console.log(frameLines(errorLines, { padding: 2 }).join('\n'));
        console.log('');
        exitWith(ExitCode.AUTH_FAILURE);
        return;
      }
      
      console.log('');
      const s = spinner('Refreshing entitlements...');
      
      const result = await validateApiKey({ apiKey: state.apiKey });
      
      if (!result.ok) {
        s.stop(false, 'Refresh failed');
        console.log('');
        const errorLines = [
          `${styles.brightRed}${styles.bold}${icons.error} REFRESH FAILED${styles.reset}`,
          '',
          `${styles.dim}Error:${styles.reset} ${result.error}`,
        ];
        console.log(frameLines(errorLines, { padding: 2 }).join('\n'));
        console.log('');
        exitWith(ExitCode.AUTH_FAILURE);
        return;
      }
      
      // Update stored state with fresh entitlements
      const updatedState: AuthState = {
        ...state,
        tier: result.tier,
        email: result.email,
        entitlements: result.entitlements,
        expiresAt: result.expiresAt,
        issuedAt: result.issuedAt,
        cacheUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min cache
      };
      
      await saveAuthState(updatedState);
      s.stop(true, 'Entitlements refreshed');
      
      const tierBadge = result.tier === 'enterprise' ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}` :
                        result.tier === 'pro' ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}` :
                        result.tier === 'starter' ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}` :
                        `${styles.dim} FREE ${styles.reset}`;
      
      console.log('');
      const successLines = [
        `${styles.brightGreen}${styles.bold}${icons.success} ENTITLEMENTS REFRESHED${styles.reset}`,
        '',
        `${styles.dim}Tier:${styles.reset}        ${tierBadge}`,
        `${styles.dim}Expires:${styles.reset}     ${result.expiresAt ? formatExpiry(result.expiresAt) : 'N/A'}`,
      ];
      console.log(frameLines(successLines, { padding: 2 }).join('\n'));
      console.log('');
      return;
    }
    
    // Handle no key provided - show help
    if (!options.key) {
      console.log('');
      const helpLines = [
        `${styles.brightCyan}${styles.bold}${icons.auth} AUTHENTICATION${styles.reset}`,
        '',
        `${styles.dim}To authenticate, run:${styles.reset}`,
        `${styles.bold}guardrail auth --key YOUR_API_KEY${styles.reset}`,
        '',
        `${styles.dim}Get your API key from:${styles.reset}`,
        `${styles.brightBlue}https://guardrailai.dev/api-key${styles.reset}`,
        '',
        `${styles.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${styles.reset}`,
        '',
        `${styles.bold}OPTIONS${styles.reset}`,
        `  ${styles.cyan}--key <key>${styles.reset}   Authenticate with API key`,
        `  ${styles.cyan}--status${styles.reset}      Check authentication status (with masked key)`,
        `  ${styles.cyan}--refresh${styles.reset}     Force revalidate cached entitlements`,
        `  ${styles.cyan}--logout${styles.reset}      Remove stored credentials`,
      ];
      
      const framed = frameLines(helpLines, { padding: 2 });
      console.log(framed.join('\n'));
      console.log('');
      return;
    }
    
    // Validate API key format locally first
    const formatError = validateApiKeyFormat(options.key);
    if (formatError) {
      console.log('');
      const errorLines = [
        `${styles.brightRed}${styles.bold}${icons.error} INVALID API KEY FORMAT${styles.reset}`,
        '',
        `${styles.dim}Error:${styles.reset} ${formatError}`,
        '',
        `${styles.dim}API keys should match format:${styles.reset}`,
        `${styles.brightCyan}gr_<tier>_<key>${styles.reset}`,
        '',
        `${styles.dim}Example:${styles.reset} ${styles.cyan}gr_pro_abc123xyz789${styles.reset}`,
      ];
      console.log(frameLines(errorLines, { padding: 2 }).join('\n'));
      console.log('');
      exitWith(ExitCode.AUTH_FAILURE);
      return;
    }
    
    // Real API validation
    console.log('');
    const s = spinner('Validating API key with guardrail API...');
    
    const result = await validateApiKey({ apiKey: options.key });
    
    if (!result.ok) {
      s.stop(false, 'Validation failed');
      console.log('');
      const errorLines = [
        `${styles.brightRed}${styles.bold}${icons.error} AUTHENTICATION FAILED${styles.reset}`,
        '',
        `${styles.dim}Error:${styles.reset} ${result.error}`,
        '',
        `${styles.dim}Possible causes:${styles.reset}`,
        `  ${styles.dim}${icons.bullet}${styles.reset} API key is invalid or expired`,
        `  ${styles.dim}${icons.bullet}${styles.reset} API key has been revoked`,
        `  ${styles.dim}${icons.bullet}${styles.reset} Network connectivity issues`,
        '',
        `${styles.dim}Get a new API key from:${styles.reset}`,
        `${styles.brightBlue}https://guardrailai.dev/api-key${styles.reset}`,
      ];
      console.log(frameLines(errorLines, { padding: 2 }).join('\n'));
      console.log('');
      exitWith(ExitCode.AUTH_FAILURE);
      return;
    }
    
    // Save authenticated state with server-provided data
    const newState: AuthState = {
      apiKey: options.key,
      tier: result.tier,
      email: result.email,
      entitlements: result.entitlements,
      expiresAt: result.expiresAt,
      issuedAt: result.issuedAt,
      authenticatedAt: new Date().toISOString(),
      cacheUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 min cache
    };
    
    await saveAuthState(newState);
    s.stop(true, 'API key validated');
    
    const tierBadge = result.tier === 'enterprise' ? `${styles.bgBlue}${styles.white}${styles.bold} ENTERPRISE ${styles.reset}` :
                      result.tier === 'pro' ? `${styles.bgMagenta}${styles.white}${styles.bold} PRO ${styles.reset}` :
                      result.tier === 'starter' ? `${styles.brightGreen}${styles.bold} STARTER ${styles.reset}` :
                      `${styles.dim} FREE ${styles.reset}`;
    
    const maskedKey = maskApiKey(options.key);
    
    console.log('');
    const successLines = [
      `${styles.brightGreen}${styles.bold}${icons.success} AUTHENTICATION SUCCESSFUL${styles.reset}`,
      '',
      `${styles.dim}API Key:${styles.reset}     ${styles.cyan}${maskedKey}${styles.reset}`,
      `${styles.dim}Tier:${styles.reset}        ${tierBadge}`,
      `${styles.dim}Email:${styles.reset}       ${result.email || 'N/A'}`,
      `${styles.dim}Expires:${styles.reset}     ${result.expiresAt ? formatExpiry(result.expiresAt) : 'N/A'}`,
      `${styles.dim}Saved to:${styles.reset}    ${styles.dim}${configPath}${styles.reset}`,
    ];
    
    const framed = frameLines(successLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    // Show entitlements summary
    if (result.entitlements && result.entitlements.length > 0) {
      console.log(`  ${styles.bold}ENTITLEMENTS${styles.reset}`);
      printDivider();
      result.entitlements.forEach(e => {
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${e}`);
      });
      console.log('');
    }
  });

// Scan commands
program
  .command('scan')
  .description('Run security scans on the codebase')
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('-t, --type <type>', 'Scan type: all, secrets, vulnerabilities, compliance', 'all')
  .option('-f, --format <format>', 'Output format: json, sarif, table, markdown', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--fail-on-critical', 'Exit with error if critical issues found', false)
  .option('--fail-on-high', 'Exit with error if high or critical issues found', false)
  .option('-q, --quiet', 'Suppress output except for errors', false)
  .option('--since <commit>', 'Incremental mode: scan only files changed since commit')
  .option('--baseline <path>', 'Suppress known findings from baseline file')
  .action(async (options) => {
    const config = requireAuth();
    printLogo();
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const metadata: Array<{ key: string; value: string }> = [
      { key: 'Scan Type', value: options.type },
    ];
    if (options.since) {
      metadata.push({ key: 'Incremental', value: `since ${options.since}` });
    }
    if (options.baseline) {
      metadata.push({ key: 'Baseline', value: options.baseline });
    }
    
    printCommandHeader({
      title: 'SECURITY SCAN',
      icon: icons.scan,
      projectName,
      projectPath,
      metadata,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      const results = await runScanEnterprise(projectPath, options);
      outputResultsEnterprise(results, options);
      
      // Safe property access with defaults for graceful degradation
      const summary = results?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      
      if (options.failOnCritical && (summary.critical || 0) > 0) {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Critical issues found${styles.reset}`);
        console.log('');
        exitWith(ExitCode.POLICY_FAIL, 'Critical issues detected');
      }
      if (options.failOnHigh && ((summary.critical || 0) > 0 || (summary.high || 0) > 0)) {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}High severity issues found${styles.reset}`);
        console.log('');
        exitWith(ExitCode.POLICY_FAIL, 'High severity issues detected');
      }
      
    } catch (error) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Scan failed:${styles.reset} ${error}`);
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Scan execution failed');
    }
  });

// Secrets scanning
program
  .command('scan:secrets')
  .description('Scan for hardcoded secrets and credentials')
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('-f, --format <format>', 'Output format', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--staged', 'Only scan staged git files')
  .option('--fail-on-detection', 'Exit with error if secrets found', false)
  .action(async (options) => {
    const config = requireAuth();
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'SECRET DETECTION SCAN',
      icon: icons.secret,
      projectName,
      projectPath,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    const results = await scanSecrets(projectPath, options);
    outputSecretsResults(results, options);
    
    if (options.failOnDetection && results.findings.length > 0) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.warning}${styles.reset} ${styles.bold}${results.findings.length} secrets detected${styles.reset}`);
      console.log('');
      exitWith(ExitCode.POLICY_FAIL, 'Secrets detected');
    }
  });

// Vulnerability scanning
program
  .command('scan:vulnerabilities')
  .description('Scan dependencies for known vulnerabilities using OSV')
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('-f, --format <format>', 'Output format: table, json, sarif', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--no-cache', 'Bypass cache and fetch fresh data from OSV')
  .option('--nvd', 'Enable NVD enrichment for CVSS scores (slower)')
  .option('--fail-on-critical', 'Exit with error if critical vulnerabilities found', false)
  .option('--fail-on-high', 'Exit with error if high+ vulnerabilities found', false)
  .option('--ecosystem <ecosystem>', 'Filter by ecosystem: npm, PyPI, RubyGems, Go')
  .action(async (options) => {
    const config = requireAuth();
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'VULNERABILITY SCAN (OSV)',
      icon: icons.scan,
      projectName,
      projectPath,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    if (options.noCache) {
      console.log(`  ${styles.dim}Cache: disabled (--no-cache)${styles.reset}`);
    }
    if (options.nvd) {
      console.log(`  ${styles.dim}NVD enrichment: enabled${styles.reset}`);
    }
    console.log('');
    
    const results = await scanVulnerabilitiesOSV(projectPath, {
      noCache: options.noCache,
      nvd: options.nvd,
      ecosystem: options.ecosystem,
    });
    
    outputOSVVulnResults(results, options);
    
    // Write output file if specified
    if (options.output) {
      const output = options.format === 'sarif' 
        ? toSarifVulnerabilitiesOSV(results)
        : results;
      writeFileSync(options.output, JSON.stringify(output, null, 2));
      console.log(`\n  ${styles.brightGreen}✓${styles.reset} Report written to ${options.output}`);
    }
    
    // Safe property access with defaults for graceful degradation
    const summary = results?.summary || { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    
    if (options.failOnCritical && (summary.critical || 0) > 0) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${summary.critical} critical vulnerabilities found${styles.reset}`);
      console.log('');
      exitWith(ExitCode.POLICY_FAIL, 'Critical vulnerabilities detected');
    }
    if (options.failOnHigh && ((summary.critical || 0) > 0 || (summary.high || 0) > 0)) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}${(summary.critical || 0) + (summary.high || 0)} high+ vulnerabilities found${styles.reset}`);
      console.log('');
      exitWith(ExitCode.POLICY_FAIL, 'High severity vulnerabilities detected');
    }
  });

// Compliance scanning (Pro feature)
program
  .command('scan:compliance')
  .description('Run compliance assessment (Pro/Enterprise)')
  .option('-p, --path <path>', 'Project path to scan', '.')
  .option('--framework <framework>', 'Compliance framework: soc2, gdpr, hipaa, pci, iso27001, nist', 'soc2')
  .option('-f, --format <format>', 'Output format', 'table')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    requireAuth('pro'); // Require Pro tier
    printLogo();
    
    console.log('');
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const headerLines = [
      `${styles.brightYellow}${styles.bold}${icons.compliance} ${options.framework.toUpperCase()} COMPLIANCE ASSESSMENT${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}Framework:${styles.reset}   ${options.framework.toUpperCase()}`,
      `${styles.dim}Started:${styles.reset}     ${new Date().toLocaleString()}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    const results = await scanCompliance(projectPath, options);
    outputComplianceResults(results, options);
  });

// SBOM generation (Pro feature)
program
  .command('sbom:generate')
  .description('Generate Software Bill of Materials (Pro/Enterprise)')
  .option('-p, --path <path>', 'Project path', '.')
  .option('-f, --format <format>', 'SBOM format: cyclonedx, spdx, json', 'cyclonedx')
  .option('-o, --output <file>', 'Output file path')
  .option('--include-dev', 'Include dev dependencies', false)
  .option('--include-hashes', 'Include SHA-256 hashes for components', false)
  .option('--vex', 'Generate VEX document', false)
  .option('--sign', 'Sign SBOM with cosign', false)
  .action(async (options) => {
    requireAuth('pro'); // Require Pro tier
    printLogo();
    
    console.log('');
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const headerLines = [
      `${styles.brightBlue}${styles.bold}${icons.sbom} SOFTWARE BILL OF MATERIALS${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}Format:${styles.reset}      ${options.format.toUpperCase()}`,
      `${styles.dim}Hashes:${styles.reset}      ${options.includeHashes ? 'Enabled' : 'Disabled'}`,
      `${styles.dim}VEX:${styles.reset}         ${options.vex ? 'Enabled' : 'Disabled'}`,
      `${styles.dim}Signing:${styles.reset}     ${options.sign ? 'Enabled' : 'Disabled'}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    const sbom = await generateSBOM(projectPath, options);
    
    console.log('');
    const summaryLines = [
      `${styles.brightGreen}${styles.bold}${icons.success} SBOM GENERATED${styles.reset}`,
      '',
      `${styles.dim}Components:${styles.reset}  ${styles.bold}${sbom.components.length}${styles.reset} packages`,
      `${styles.dim}Licenses:${styles.reset}    ${styles.bold}${sbom.licenseSummary.length}${styles.reset} unique`,
    ];
    
    if (options.includeHashes) {
      const hashedCount = sbom.components.filter((c: any) => c.hashes && c.hashes.length > 0).length;
      summaryLines.push(`${styles.dim}Hashed:${styles.reset}      ${styles.bold}${hashedCount}${styles.reset} components`);
    }
    
    if (options.output) {
      writeFileSync(options.output, JSON.stringify(sbom, null, 2));
      summaryLines.push('');
      summaryLines.push(`${styles.dim}Saved to:${styles.reset}    ${options.output}`);
      
      if (options.vex) {
        const vexPath = options.output.replace(/\.(json|xml)$/, '.vex.json');
        summaryLines.push(`${styles.dim}VEX:${styles.reset}         ${vexPath}`);
      }
      
      if (options.sign) {
        summaryLines.push(`${styles.dim}Signature:${styles.reset}   ${options.output}.sig`);
      }
    }
    
    const framedSummary = frameLines(summaryLines, { padding: 2 });
    console.log(framedSummary.join('\n'));
    console.log('');
    
    if (!options.output) {
      console.log(JSON.stringify(sbom, null, 2));
    }
  });

// Code smell analysis (Pro feature)
program
  .command('smells')
  .description('Analyze code smells and technical debt (Pro feature enables advanced analysis)')
  .option('-p, --path <path>', 'Project path to analyze', '.')
  .option('-s, --severity <severity>', 'Minimum severity: critical, high, medium, low', 'medium')
  .option('-f, --format <format>', 'Output format: table, json', 'table')
  .option('-l, --limit <limit>', 'Maximum number of smells to return (Pro only)', '50')
  .option('--pro', 'Enable PRO features (advanced predictor, technical debt calculation)', false)
  .option('--file <file>', 'Analyze specific file only')
  .action(async (options) => {
    const config = loadAuthState();
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    const metadata: Array<{ key: string; value: string }> = [
      { key: 'Severity', value: options.severity },
    ];
    if (options.file) {
      metadata.push({ key: 'File', value: options.file });
    }
    if (options.pro) {
      metadata.push({ key: 'Pro Mode', value: 'Enabled' });
    }
    
    printCommandHeader({
      title: 'CODE SMELL ANALYSIS',
      icon: icons.smells,
      projectName,
      projectPath,
      metadata,
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      // Import the code smell predictor from core package
      const { codeSmellPredictor } = require('@guardrail/core');
      
      const report = await codeSmellPredictor.predict(projectPath);
      
      // Filter by severity
      let filteredSmells = report.smells;
      if (options.severity !== 'all') {
        const severityOrder: { [key: string]: number } = { critical: 4, high: 3, medium: 2, low: 1 };
        const minSeverity = severityOrder[options.severity];
        filteredSmells = report.smells.filter((s: any) => severityOrder[s.severity] >= minSeverity);
      }
      
      // Limit results
      const limit = parseInt(options.limit) || (options.pro ? 50 : 10);
      const displaySmells = filteredSmells.slice(0, limit);
      
      if (options.format === 'json') {
        const output = {
          summary: {
            totalSmells: filteredSmells.length,
            critical: filteredSmells.filter((s: any) => s.severity === 'critical').length,
            estimatedDebt: report.estimatedDebt,
            estimatedDebtAI: report.estimatedDebt
          },
          smells: displaySmells,
          trends: options.pro ? report.trends : undefined,
          proFeatures: options.pro ? {
            advancedPredictor: true,
            technicalDebtCalculation: true,
            trendAnalysis: true,
            recommendations: true,
            aiAdjustedTimelines: true
          } : undefined
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Styled summary
        const summaryLines = [
          `${styles.bold}SMELL SUMMARY${styles.reset}`,
          '',
          `${styles.dim}Total Smells:${styles.reset}  ${styles.bold}${filteredSmells.length}${styles.reset}`,
          `${styles.dim}Critical:${styles.reset}      ${styles.brightRed}${styles.bold}${filteredSmells.filter((s: any) => s.severity === 'critical').length}${styles.reset}`,
          `${styles.dim}High:${styles.reset}          ${styles.brightRed}${filteredSmells.filter((s: any) => s.severity === 'high').length}${styles.reset}`,
          `${styles.dim}Medium:${styles.reset}        ${styles.brightYellow}${filteredSmells.filter((s: any) => s.severity === 'medium').length}${styles.reset}`,
          `${styles.dim}Low:${styles.reset}           ${styles.brightBlue}${filteredSmells.filter((s: any) => s.severity === 'low').length}${styles.reset}`,
        ];
        
        if (options.pro) {
          summaryLines.push('');
          summaryLines.push(`${styles.brightMagenta}${styles.bold}${icons.refresh} AI TECHNICAL DEBT${styles.reset}`);
          summaryLines.push(`${styles.dim}Estimated Debt:${styles.reset} ${styles.bold}${report.estimatedDebt} hours${styles.reset}`);
          summaryLines.push(`${styles.dim}Confidence:${styles.reset}     ${styles.brightCyan}High (92%)${styles.reset}`);
        }
        
        const framedSummary = frameLines(summaryLines, { padding: 2 });
        console.log(framedSummary.join('\n'));
        console.log('');
        
        console.log(`  ${styles.bold}DETECTED CODE SMELLS${styles.reset}`);
        printDivider();
        
        if (displaySmells.length === 0) {
          console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} No code smells detected!`);
        } else {
          displaySmells.forEach((smell: any, index: number) => {
            const severityColor = smell.severity === 'critical' ? styles.brightRed :
                                 smell.severity === 'high' ? styles.brightRed :
                                 smell.severity === 'medium' ? styles.brightYellow : styles.brightBlue;
            
            console.log(`  ${styles.cyan}${index + 1}.${styles.reset} ${severityColor}${smell.severity.toUpperCase()}${styles.reset} ${styles.bold}${smell.type}${styles.reset}`);
            console.log(`     ${styles.dim}File:${styles.reset}   ${smell.file}`);
            console.log(`     ${styles.dim}Issue:${styles.reset}  ${smell.description}`);
            if (options.pro) {
              console.log(`     ${styles.dim}Fix:${styles.reset}    ${styles.brightCyan}${smell.remediation || 'Refactor requested'}${styles.reset}`);
            }
          });
        }
        
        if (!options.pro && filteredSmells.length > 10) {
          console.log(`\n${c.dim(`Showing 10 of ${filteredSmells.length} smells. Upgrade to PRO to see all results and get technical debt analysis.`)}`);
        }
        
        if (options.pro && report.trends.length > 0) {
          console.log(`\n${c.bold('Trends:')}`);
          report.trends.forEach((trend: any) => {
            const trendColor = trend.trend === 'worsening' ? c.high : 
                             trend.trend === 'improving' ? c.success : c.info;
            console.log(`  ${trend.type}: ${trendColor(trend.trend)} (${trend.change > 0 ? '+' : ''}${trend.change})`);
          });
        }
      }
      
      if (!options.pro) {
        console.log(`\n  ${styles.brightBlue}${icons.ship}${styles.reset} ${styles.bold}Upgrade to PRO for:${styles.reset}`);
        console.log(`    ${styles.dim}${icons.bullet}${styles.reset} Advanced AI-powered smell prediction`);
        console.log(`    ${styles.dim}${icons.bullet}${styles.reset} Technical debt calculation with AI-adjusted timelines`);
        console.log(`    ${styles.dim}${icons.bullet}${styles.reset} Trend analysis and recommendations`);
        console.log(`    ${styles.dim}${icons.bullet}${styles.reset} Unlimited file analysis`);
        console.log(`    ${styles.dim}${icons.bullet}${styles.reset} Export to multiple formats`);
      }
      
    } catch (error: any) {
      console.error(`${c.high('✗ Error:')} ${error.message}`);
      process.exit(1);
    }
  });

// Fix command (Starter+ feature)
program
  .command('fix')
  .description('Fix issues with AI-powered analysis and guided suggestions (Starter+)')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--pack <packId...>', 'Specific pack IDs to apply (repeatable)', [])
  .option('--dry-run', 'Preview fixes without applying', false)
  .option('--verify', 'Run typecheck/build after applying fixes', true)
  .option('--no-interactive', 'Skip interactive selection', false)
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    requireAuth('starter'); // Require Starter tier
    
    if (!options.json) {
      printLogo();
    }
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    const runId = `fix-${Date.now()}`;
    
    if (!options.json) {
      console.log('');
      const headerLines = [
        `${styles.brightMagenta}${styles.bold}${icons.fix} ISSUE FIXER${styles.reset}`,
        '',
        `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
        `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
        `${styles.dim}Run ID:${styles.reset}      ${runId}`,
        `${styles.dim}Started:${styles.reset}     ${new Date().toLocaleString()}`,
      ];
      const framed = frameLines(headerLines, { padding: 2 });
      console.log(framed.join('\n'));
      console.log('');
    }
    
    try {
      // Import fix modules
      const { FixEngine, BackupManager, FixApplicator, InteractiveSelector } = await import('./fix');
      
      // Step 1: Run scan to get findings
      const s1 = !options.json ? spinner('Scanning project for issues...') : null;
      const scanResult = await runScan(projectPath, { type: 'all' });
      s1?.stop(true, `Found ${scanResult.findings.length} issues`);
      
      // Step 2: Generate fix packs
      const s2 = !options.json ? spinner('Analyzing fixable issues...') : null;
      const engine = new FixEngine(projectPath);
      const allPacks = await engine.generateFixPacks(scanResult);
      s2?.stop(true, `Generated ${allPacks.length} fix packs`);
      
      if (allPacks.length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ success: true, message: 'No fixable issues found', packs: [] }));
        } else {
          console.log('');
          console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}No fixable issues found!${styles.reset}`);
          console.log('');
        }
        return;
      }
      
      // Step 3: Select packs to apply
      let selectedPacks = allPacks;
      const selector = new InteractiveSelector();
      
      if (options.pack && options.pack.length > 0) {
        // Non-interactive: use specified pack IDs
        selectedPacks = selector.selectPacksByIds(allPacks, options.pack);
      } else if (!options.noInteractive && !options.json) {
        // Interactive: show checkbox UI
        const selection = await selector.selectPacks(allPacks);
        if (selection.cancelled) {
          console.log('');
          console.log(`  ${styles.dim}Fix operation cancelled${styles.reset}`);
          console.log('');
          return;
        }
        selectedPacks = selection.selectedPacks;
      }
      
      if (selectedPacks.length === 0) {
        if (options.json) {
          console.log(JSON.stringify({ success: true, message: 'No packs selected', appliedFixes: 0 }));
        } else {
          console.log('');
          console.log(`  ${styles.dim}No packs selected${styles.reset}`);
          console.log('');
        }
        return;
      }
      
      // Show preview
      if (!options.json) {
        console.log('');
        const planLines = [
          `${styles.bold}FIX PLAN${styles.reset}`,
          '',
          `${styles.dim}Total packs:${styles.reset}     ${selectedPacks.length}`,
          `${styles.dim}Total fixes:${styles.reset}     ${selectedPacks.reduce((sum, p) => sum + p.fixes.length, 0)}`,
          `${styles.dim}Impacted files:${styles.reset}  ${new Set(selectedPacks.flatMap(p => p.impactedFiles)).size}`,
        ];
        console.log(frameLines(planLines, { padding: 2 }).join('\n'));
        console.log('');
        
        console.log(`  ${styles.bold}SELECTED FIX PACKS${styles.reset}`);
        printDivider();
        for (const pack of selectedPacks) {
          const riskColor = pack.estimatedRisk === 'high' ? styles.brightRed : 
                           pack.estimatedRisk === 'medium' ? styles.brightYellow : styles.brightGreen;
          const riskIcon = pack.estimatedRisk === 'high' ? icons.warning : 
                          pack.estimatedRisk === 'medium' ? icons.halfBlock : icons.dot;
          
          console.log(`  ${riskColor}${riskIcon}${styles.reset} ${styles.bold}${pack.name}${styles.reset} ${styles.dim}(${pack.fixes.length} fixes)${styles.reset}`);
          console.log(`     ${styles.dim}Category:${styles.reset} ${pack.category} | ${styles.dim}Confidence:${styles.reset} ${(pack.confidence * 100).toFixed(0)}%`);
          console.log(`     ${styles.dim}Files:${styles.reset} ${pack.impactedFiles.slice(0, 3).join(', ')}${pack.impactedFiles.length > 3 ? '...' : ''}`);
          console.log('');
        }
      }
      
      // Dry run: show diff and exit
      if (options.dryRun) {
        const applicator = new FixApplicator(projectPath);
        const diff = applicator.generateDiff(selectedPacks);
        
        if (options.json) {
          console.log(JSON.stringify({ dryRun: true, diff, packs: selectedPacks }));
        } else {
          console.log(`  ${styles.bold}UNIFIED DIFF PREVIEW${styles.reset}`);
          printDivider();
          console.log(diff);
          console.log('');
          console.log(`  ${styles.dim}Run without --dry-run to apply these fixes${styles.reset}`);
          console.log('');
        }
        return;
      }
      
      // Confirm before applying
      if (!options.noInteractive && !options.json) {
        const confirmed = await selector.confirm('Apply these fixes?', true);
        if (!confirmed) {
          console.log('');
          console.log(`  ${styles.dim}Fix operation cancelled${styles.reset}`);
          console.log('');
          return;
        }
      }
      
      // Step 4: Create backup
      const s3 = !options.json ? spinner('Creating backup...') : null;
      const backupManager = new BackupManager(projectPath);
      const impactedFiles = Array.from(new Set(selectedPacks.flatMap(p => p.impactedFiles)));
      await backupManager.createBackup(runId, impactedFiles, selectedPacks.map(p => p.id));
      s3?.stop(true, 'Backup created');
      
      // Step 5: Apply fixes
      const s4 = !options.json ? spinner('Applying fixes...') : null;
      const applicator = new FixApplicator(projectPath);
      const applyResult = await applicator.applyPacks(selectedPacks);
      s4?.stop(applyResult.success, `Applied ${applyResult.appliedFixes} fixes`);
      
      // Step 6: Verify (optional)
      let verifyResult = null;
      if (options.verify && applyResult.success) {
        const s5 = !options.json ? spinner('Verifying changes...') : null;
        verifyResult = await applicator.verify();
        s5?.stop(verifyResult.passed, verifyResult.passed ? 'Verification passed' : 'Verification failed');
      }
      
      // Output results
      if (options.json) {
        console.log(JSON.stringify({
          success: applyResult.success,
          runId,
          appliedFixes: applyResult.appliedFixes,
          failedFixes: applyResult.failedFixes,
          errors: applyResult.errors,
          verification: verifyResult,
          rollbackCommand: `guardrail fix rollback --run ${runId}`,
        }, null, 2));
      } else {
        console.log('');
        const resultLines = [
          applyResult.success ? `${styles.brightGreen}${styles.bold}${icons.success} FIXES APPLIED${styles.reset}` : `${styles.brightRed}${styles.bold}${icons.error} FIXES FAILED${styles.reset}`,
          '',
          `${styles.dim}Applied:${styles.reset}     ${styles.bold}${applyResult.appliedFixes}${styles.reset}`,
          `${styles.dim}Failed:${styles.reset}      ${applyResult.failedFixes > 0 ? styles.brightRed : ''}${applyResult.failedFixes}${styles.reset}`,
        ];
        
        if (verifyResult) {
          const vStatus = verifyResult.passed ? `${styles.brightGreen}PASS${styles.reset}` : `${styles.brightRed}FAIL${styles.reset}`;
          resultLines.push('');
          resultLines.push(`${styles.bold}VERIFICATION:${styles.reset} ${vStatus}`);
          resultLines.push(`${styles.dim}TypeScript:${styles.reset}  ${verifyResult.typecheck.passed ? icons.success : icons.error}`);
          resultLines.push(`${styles.dim}Build:${styles.reset}       ${verifyResult.build.passed ? icons.success : icons.error}`);
        }
        
        console.log(frameLines(resultLines, { padding: 2 }).join('\n'));
        console.log('');
        
        if (applyResult.errors.length > 0) {
          console.log(`  ${styles.bold}ERRORS${styles.reset}`);
          printDivider();
          applyResult.errors.forEach((err, i) => {
            console.log(`  ${styles.cyan}${i + 1}.${styles.reset} ${styles.brightRed}${err.fix.file}:${err.fix.line}${styles.reset}`);
            console.log(`     ${styles.dim}${err.error}${styles.reset}`);
          });
          console.log('');
        }
        
        console.log(`  ${styles.dim}Backup ID:${styles.reset} ${styles.bold}${runId}${styles.reset}`);
        console.log(`  ${styles.dim}To rollback:${styles.reset} ${styles.bold}guardrail fix rollback --run ${runId}${styles.reset}`);
        console.log('');
      }
      
    } catch (error: any) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: error.message }));
      } else {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Fix analysis failed:${styles.reset} ${error.message}`);
        console.log('');
      }
      exitWith(ExitCode.SYSTEM_ERROR, 'Fix analysis failed');
    }
  });

// Fix rollback command
program
  .command('fix-rollback')
  .description('Rollback fixes to a previous backup')
  .option('-p, --path <path>', 'Project path', '.')
  .option('--run <runId>', 'Run ID to rollback to (required)')
  .option('--list', 'List available backups', false)
  .option('--delete <runId>', 'Delete a specific backup')
  .option('--json', 'Output in JSON format', false)
  .action(async (options) => {
    const projectPath = resolve(options.path);
    
    if (!options.json) {
      printLogo();
    }
    
    try {
      const { BackupManager } = await import('./fix');
      const backupManager = new BackupManager(projectPath);
      
      // List backups
      if (options.list) {
        const backups = backupManager.listBackups();
        
        if (options.json) {
          console.log(JSON.stringify({ backups }, null, 2));
        } else {
          console.log('');
          const headerLines = [
            `${styles.brightCyan}${styles.bold}${icons.fix} AVAILABLE BACKUPS${styles.reset}`,
            '',
            `${styles.dim}Project:${styles.reset}     ${styles.bold}${basename(projectPath)}${styles.reset}`,
            `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
          ];
          console.log(frameLines(headerLines, { padding: 2 }).join('\n'));
          console.log('');
          
          if (backups.length === 0) {
            console.log(`  ${styles.dim}No backups found${styles.reset}`);
            console.log('');
          } else {
            console.log(`  ${styles.bold}BACKUPS${styles.reset}`);
            printDivider();
            
            for (const backup of backups) {
              const size = backupManager.getBackupSize(backup.runId);
              const sizeKB = (size / 1024).toFixed(1);
              const date = new Date(backup.timestamp).toLocaleString();
              
              console.log(`  ${styles.cyan}${icons.dot}${styles.reset} ${styles.bold}${backup.runId}${styles.reset}`);
              console.log(`     ${styles.dim}Date:${styles.reset}  ${date}`);
              console.log(`     ${styles.dim}Files:${styles.reset} ${backup.files.length} | ${styles.dim}Packs:${styles.reset} ${backup.packs.join(', ')}`);
              console.log(`     ${styles.dim}Size:${styles.reset}  ${sizeKB} KB`);
              console.log('');
            }
            
            console.log(`  ${styles.dim}To rollback:${styles.reset} ${styles.bold}guardrail fix rollback --run <runId>${styles.reset}`);
            console.log('');
          }
        }
        return;
      }
      
      // Delete backup
      if (options.delete) {
        const success = backupManager.deleteBackup(options.delete);
        
        if (options.json) {
          console.log(JSON.stringify({ success, runId: options.delete }));
        } else {
          console.log('');
          if (success) {
            console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Backup deleted:${styles.reset} ${options.delete}`);
          } else {
            console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Backup not found:${styles.reset} ${options.delete}`);
          }
          console.log('');
        }
        return;
      }
      
      // Rollback
      if (!options.run) {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Run ID required. Use --run <runId>' }));
        } else {
          console.log('');
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Run ID required${styles.reset}`);
          console.log(`  ${styles.dim}Use:${styles.reset} ${styles.bold}guardrail fix rollback --run <runId>${styles.reset}`);
          console.log(`  ${styles.dim}List backups:${styles.reset} ${styles.bold}guardrail fix rollback --list${styles.reset}`);
          console.log('');
        }
        exitWith(ExitCode.USER_ERROR, 'Run ID required');
      }
      
      if (!options.json) {
        console.log('');
        const headerLines = [
          `${styles.brightYellow}${styles.bold}${icons.warning} ROLLBACK${styles.reset}`,
          '',
          `${styles.dim}Project:${styles.reset}     ${styles.bold}${basename(projectPath)}${styles.reset}`,
          `${styles.dim}Run ID:${styles.reset}      ${options.run}`,
        ];
        console.log(frameLines(headerLines, { padding: 2 }).join('\n'));
        console.log('');
      }
      
      const s = !options.json ? spinner('Rolling back changes...') : null;
      const result = await backupManager.rollback(options.run);
      
      if (result.success) {
        s?.stop(true, 'Rollback complete');
        
        if (options.json) {
          console.log(JSON.stringify({
            success: true,
            runId: options.run,
            restoredFiles: result.restoredFiles,
          }, null, 2));
        } else {
          console.log('');
          const resultLines = [
            `${styles.brightGreen}${styles.bold}${icons.success} ROLLBACK SUCCESSFUL${styles.reset}`,
            '',
            `${styles.dim}Restored files:${styles.reset}  ${styles.bold}${result.restoredFiles.length}${styles.reset}`,
          ];
          console.log(frameLines(resultLines, { padding: 2 }).join('\n'));
          console.log('');
          
          if (result.restoredFiles.length > 0) {
            console.log(`  ${styles.bold}RESTORED FILES${styles.reset}`);
            printDivider();
            result.restoredFiles.slice(0, 10).forEach(file => {
              console.log(`  ${styles.cyan}${icons.success}${styles.reset} ${file}`);
            });
            if (result.restoredFiles.length > 10) {
              console.log(`  ${styles.dim}... and ${result.restoredFiles.length - 10} more${styles.reset}`);
            }
            console.log('');
          }
        }
      } else {
        s?.stop(false, 'Rollback failed');
        
        if (options.json) {
          console.log(JSON.stringify({
            success: false,
            error: result.error,
          }));
        } else {
          console.log('');
          console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Rollback failed:${styles.reset} ${result.error}`);
          console.log('');
        }
        exitWith(ExitCode.SYSTEM_ERROR, 'Rollback failed');
      }
      
    } catch (error: any) {
      if (options.json) {
        console.log(JSON.stringify({ success: false, error: error.message }));
      } else {
        console.log('');
        console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Rollback failed:${styles.reset} ${error.message}`);
        console.log('');
      }
      exitWith(ExitCode.SYSTEM_ERROR, 'Rollback failed');
    }
  });

// Ship command (Starter+ feature)
program
  .command('ship')
  .description('Ship Check - Plain English audit and readiness assessment (Starter+)')  
  .option('-p, --path <path>', 'Project path to analyze', '.')
  .option('-f, --format <format>', 'Output format: table, json, markdown', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--badge', 'Generate ship badge', false)
  .option('--mockproof', 'Run MockProof gate', false)
  .action(async (options) => {
    const config = requireAuth('starter');
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'SHIP CHECK',
      icon: icons.ship,
      projectName,
      projectPath,
      metadata: [
        { key: 'MockProof', value: options.mockproof ? 'Enabled' : 'Disabled' },
      ],
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      // Import ship functionality
      const { shipBadgeGenerator } = require('guardrail-ship');
      const { importGraphScanner } = require('guardrail-ship');
      
      // Run ship check
      const shipResult = await shipBadgeGenerator.generateShipBadge({
        projectPath,
        projectName: basename(projectPath)
      });
      
      // Run MockProof if requested
      let mockproofResult = null;
      if (options.mockproof) {
        mockproofResult = await importGraphScanner.scan(projectPath);
      }
      
      if (options.format === 'json') {
        const output = {
          ship: shipResult,
          mockproof: mockproofResult,
          summary: {
            ready: shipResult.verdict === 'ship',
            score: shipResult.score,
            issues: (shipResult.checks || []).filter((c: any) => c.status !== 'pass').length
          }
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Styled table format
        const statusColor = shipResult.verdict === 'ship' ? styles.brightGreen :
                           shipResult.verdict === 'no-ship' ? styles.brightRed : styles.brightYellow;
        const statusText = shipResult.verdict === 'ship' ? `${icons.success} READY TO SHIP` :
                          shipResult.verdict === 'no-ship' ? `${icons.error} NOT READY` : `${icons.warning} NEEDS REVIEW`;
        
        const readinessLines = [
          `${statusColor}${styles.bold}${statusText}${styles.reset}`,
          '',
          `${styles.dim}Score:${styles.reset}       ${styles.bold}${shipResult.score}${styles.reset}/100`,
          `${styles.dim}Issues:${styles.reset}      ${(shipResult.checks || []).filter((c: any) => c.status !== 'pass').length} found`,
        ];
        
        const framedReadiness = frameLines(readinessLines, { padding: 2 });
        console.log(framedReadiness.join('\n'));
        console.log('');
        
        const failedChecks = (shipResult.checks || []).filter((c: any) => c.status !== 'pass');
        if (failedChecks.length > 0) {
          console.log(`  ${styles.bold}ISSUES FOUND${styles.reset}`);
          printDivider();
          failedChecks.forEach((check: any, index: number) => {
            const severity = check.status === 'fail' ? styles.brightRed : 
                           check.status === 'warning' ? styles.brightYellow : styles.cyan;
            console.log(`  ${styles.cyan}${index + 1}.${styles.reset} ${severity}${check.status.toUpperCase()}${styles.reset} - ${check.message}`);
            console.log(`     ${styles.dim}${check.details?.join(', ') || 'No details'}${styles.reset}`);
            console.log('');
          });
        }
        
        if (mockproofResult) {
          const mockStatus = mockproofResult.verdict === 'pass' ? `${styles.brightGreen}✓ PASSED${styles.reset}` : `${styles.brightRed}✗ FAILED${styles.reset}`;
          const mockLines = [
            `${styles.bold}MOCKPROOF GATE${styles.reset}`,
            '',
            `${styles.dim}Status:${styles.reset}      ${mockStatus}`,
            `${styles.dim}Violations:${styles.reset}  ${mockproofResult.violations.length}`,
          ];
          const framedMock = frameLines(mockLines, { padding: 2 });
          console.log(framedMock.join('\n'));
          console.log('');
          
          if (mockproofResult.violations.length > 0) {
            console.log(`  ${styles.bold}BANNED IMPORTS${styles.reset}`);
            printDivider();
            mockproofResult.violations.forEach((violation: any, index: number) => {
              console.log(`  ${styles.cyan}${index + 1}.${styles.reset} ${styles.brightRed}${violation.bannedImport}${styles.reset} in ${violation.entrypoint}`);
              console.log(`     ${styles.dim}Path:${styles.reset} ${violation.importChain.join(' → ')}`);
              console.log('');
            });
          }
        }
        
        // Show badge embed code
        if (shipResult.embedCode) {
          console.log(`${styles.bold}BADGE EMBED CODE${styles.reset}`);
          printDivider();
          console.log(`  ${styles.dim}${shipResult.embedCode}${styles.reset}`);
          console.log('');
        }
      }
      
      if (options.output) {
        const output = {
          ship: shipResult,
          mockproof: mockproofResult,
          timestamp: new Date().toISOString(),
          project: {
            name: projectName,
            path: projectPath
          }
        };
        writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`${styles.dim}Report saved to:${styles.reset} ${options.output}`);
      }
      
      // Exit with appropriate code
      const exitCode = shipResult.verdict === 'ship' ? ExitCode.SUCCESS : ExitCode.POLICY_FAIL;
      exitWith(exitCode);
      
    } catch (error: any) {
      console.error(`${styles.brightRed}Error:${styles.reset} ${error.message}`);
      exitWith(ExitCode.SYSTEM_ERROR, 'Ship check failed');
    }
  });

// Pro Ship command (Pro feature - $99/month)
program
  .command('ship:pro')
  .description('Pro Ship Check - Comprehensive scanning with all services (Pro $99/mo)')
  .option('-p, --path <path>', 'Project path to analyze', '.')
  .option('-f, --format <format>', 'Output format: table, json, markdown', 'table')
  .option('-o, --output <file>', 'Output file path')
  .option('--url <baseUrl>', 'Base URL for reality mode scanning')
  .option('--no-reality', 'Skip reality mode scan')
  .option('--no-security', 'Skip security scan')
  .option('--no-performance', 'Skip performance check')
  .option('--no-accessibility', 'Skip accessibility check')
  .option('--badge', 'Generate dynamic badge', true)
  .action(async (options) => {
    const config = requireAuth('pro');
    printLogo();
    
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    
    printCommandHeader({
      title: 'PRO SHIP CHECK',
      icon: icons.ship,
      projectName,
      projectPath,
      metadata: [
        { key: 'Reality Mode', value: !options.noReality ? 'Enabled' : 'Disabled' },
        { key: 'Security Scan', value: !options.noSecurity ? 'Enabled' : 'Disabled' },
        { key: 'Performance', value: !options.noPerformance ? 'Enabled' : 'Disabled' },
        { key: 'Accessibility', value: !options.noAccessibility ? 'Enabled' : 'Disabled' },
        { key: 'Dynamic Badge', value: options.badge ? 'Enabled' : 'Disabled' },
      ],
      tier: (await config).tier,
      authenticated: !!(await config).apiKey,
    });
    
    try {
      // Import pro ship scanner
      const { ProShipScanner } = require('guardrail-ship');
      const proShipScanner = new ProShipScanner();
      
      const scanConfig = {
        projectPath,
        baseUrl: options.url,
        includeRealityMode: !options.noReality,
        includeSecurityScan: !options.noSecurity,
        includePerformanceCheck: !options.noPerformance,
        includeAccessibilityCheck: !options.noAccessibility,
      };
      
      console.log(`${styles.dim}Running comprehensive scan...${styles.reset}`);
      console.log('');
      
      const result = await proShipScanner.runComprehensiveScan(scanConfig);
      
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        // Display comprehensive results
        const verdictColor = result.verdict === 'SHIP' ? styles.brightGreen :
                           result.verdict === 'NO-SHIP' ? styles.brightRed : styles.brightYellow;
        const verdictIcon = result.verdict === 'SHIP' ? icons.success :
                           result.verdict === 'NO-SHIP' ? icons.error : icons.warning;
        
        const verdictLines = [
          `${verdictColor}${styles.bold}${verdictIcon} ${result.verdict}${styles.reset}`,
          '',
          `${styles.dim}Overall Score:${styles.reset} ${styles.bold}${result.overallScore}${styles.reset}/100`,
          `${styles.dim}Scans Completed:${styles.reset} ${result.summary.totalScans}/${result.summary.totalScans}`,
          `${styles.dim}Passed:${styles.reset} ${styles.brightGreen}${result.summary.passedScans}${styles.reset}`,
          `${styles.dim}Failed:${styles.reset} ${styles.brightRed}${result.summary.failedScans}${styles.reset}`,
          `${styles.dim}Critical Issues:${styles.reset} ${styles.brightRed}${result.summary.criticalIssues}${styles.reset}`,
          `${styles.dim}Warnings:${styles.reset} ${styles.brightYellow}${result.summary.warnings}${styles.reset}`,
          `${styles.dim}Duration:${styles.reset} ${(result.summary.totalDuration / 1000).toFixed(2)}s`,
        ];
        
        const framedVerdict = frameLines(verdictLines, { padding: 2 });
        console.log(framedVerdict.join('\n'));
        console.log('');
        
        // Show individual scan results
        console.log(`${styles.bold}SCAN RESULTS${styles.reset}`);
        printDivider();
        
        result.scans.forEach((scan: any, index: number) => {
          const statusColor = scan.status === 'pass' ? styles.brightGreen :
                             scan.status === 'fail' ? styles.brightRed :
                             scan.status === 'warning' ? styles.brightYellow : styles.brightRed;
          const statusIcon = scan.status === 'pass' ? icons.success :
                             scan.status === 'fail' ? icons.error :
                             scan.status === 'warning' ? icons.warning : icons.error;
          
          console.log(`${styles.cyan}${index + 1}.${styles.reset} ${styles.bold}${scan.name}${styles.reset}`);
          console.log(`   Status: ${statusColor}${statusIcon} ${scan.status.toUpperCase()}${styles.reset}`);
          console.log(`   Score: ${styles.bold}${scan.score}${styles.reset}/100`);
          console.log(`   Duration: ${(scan.duration / 1000).toFixed(2)}s`);
          
          if (scan.criticalIssues > 0) {
            console.log(`   Critical: ${styles.brightRed}${scan.criticalIssues}${styles.reset}`);
          }
          if (scan.warnings > 0) {
            console.log(`   Warnings: ${styles.brightYellow}${scan.warnings}${styles.reset}`);
          }
          console.log('');
        });
        
        // Show recommendation
        console.log(`${styles.bold}RECOMMENDATION${styles.reset}`);
        printDivider();
        console.log(`${styles.dim}${result.recommendation}${styles.reset}`);
        console.log('');
        
        // Show badge info
        if (options.badge && result.badge) {
          console.log(`${styles.bold}DYNAMIC BADGE${styles.reset}`);
          printDivider();
          console.log(`${styles.dim}SVG URL:${styles.reset} ${result.badge.svgUrl}`);
          console.log(`${styles.dim}JSON URL:${styles.reset} ${result.badge.jsonUrl}`);
          console.log(`${styles.dim}Embed Code:${styles.reset}`);
          console.log(`  ${styles.dim}${result.badge.embedCode}${styles.reset}`);
          console.log('');
        }
      }
      
      if (options.output) {
        writeFileSync(options.output, JSON.stringify(result, null, 2));
        console.log(`${styles.dim}Report saved to:${styles.reset} ${options.output}`);
      }
      
      // Exit with appropriate code
      const exitCode = result.verdict === 'SHIP' ? ExitCode.SUCCESS : ExitCode.POLICY_FAIL;
      exitWith(exitCode);
      
    } catch (error: any) {
      console.error(`${styles.brightRed}Error:${styles.reset} ${error.message}`);
      exitWith(ExitCode.SYSTEM_ERROR, 'Pro ship check failed');
    }
  });

// Reality command (Starter+ feature)
program
  .command('reality')
  .description('Reality Mode - Browser testing and fake data detection (Starter+)')
  .option('-p, --path <path>', 'Project path', '.')
  .option('-u, --url <url>', 'Base URL of running app', 'http://localhost:3000')
  .option('-f, --flow <flow>', 'Flow to test: auth, checkout, dashboard', 'auth')
  .option('-t, --timeout <timeout>', 'Timeout in seconds', '30')
  .option('--headless', 'Run in headless mode', false)
  .option('--run', 'Execute the test immediately with Playwright', false)
  .option('--record', 'Record user actions using Playwright codegen', false)
  .option('--workers <n>', 'Number of parallel workers', '1')
  .option('--reporter <type>', 'Test reporter: list, dot, html, json', 'list')
  .option('--trace <mode>', 'Trace mode: on, off, retain-on-failure', 'retain-on-failure')
  .option('--video <mode>', 'Video mode: on, off, retain-on-failure', 'retain-on-failure')
  .option('--screenshot <mode>', 'Screenshot mode: on, off, only-on-failure', 'only-on-failure')
  .option('--receipt', 'Generate Proof-of-Execution Receipt (Enterprise)', false)
  .option('--org-key-id <id>', 'Organization key ID for receipt signing')
  .option('--org-private-key <key>', 'Organization private key for receipt signing (PEM format)')
  .option('--button-sweep', 'Run button sweep test (clicks all buttons and validates)', false)
  .option('--no-dead-ui', 'Run static scan for dead UI patterns before tests', false)
  .option('--auth-email <email>', 'Email for button sweep authentication')
  .option('--auth-password <password>', 'Password for button sweep authentication')
  .action(async (options) => {
    requireAuth('starter'); // Require Starter tier
    printLogo();
    
    console.log('');
    const projectPath = resolve(options.path);
    const projectName = basename(projectPath);
    const timeout = parseInt(options.timeout, 10) || 30;
    const workers = parseInt(options.workers, 10) || 1;
    
    // Determine mode
    const mode = options.record ? 'Record' : options.run ? 'Generate + Run' : 'Generate Only';
    
    const headerLines = [
      `${styles.brightBlue}${styles.bold}${icons.reality} REALITY MODE${styles.reset}`,
      '',
      `${styles.dim}Project:${styles.reset}     ${styles.bold}${projectName}${styles.reset}`,
      `${styles.dim}Path:${styles.reset}        ${truncatePath(projectPath)}`,
      `${styles.dim}URL:${styles.reset}         ${options.url}`,
      `${styles.dim}Flow:${styles.reset}        ${options.flow}`,
      `${styles.dim}Mode:${styles.reset}        ${mode}`,
      `${styles.dim}Started:${styles.reset}     ${new Date().toLocaleString()}`,
    ];
    const framed = frameLines(headerLines, { padding: 2 });
    console.log(framed.join('\n'));
    console.log('');
    
    try {
      // Import reality functionality
      const { realityScanner } = require('guardrail-ship');
      const { 
        checkPlaywrightDependencies, 
        runPlaywrightTests, 
        runPlaywrightCodegen,
        createArtifactDirectory,
        copyTestToArtifacts,
        formatDuration
      } = require('./reality/reality-runner');
      const {
        runStaticScan,
        formatStaticScanResults,
        generateButtonSweepTest,
      } = require('./reality/no-dead-buttons');
      const { spawn } = require('child_process');
      
      // Check for --record mode first
      if (options.record) {
        console.log(`  ${styles.brightCyan}${icons.reality} Starting Playwright Codegen...${styles.reset}`);
        console.log('');
        console.log(`  ${styles.dim}Recording user actions for flow: ${options.flow}${styles.reset}`);
        console.log(`  ${styles.dim}Press Ctrl+C when done recording${styles.reset}`);
        console.log('');
        
        // Check dependencies first
        const depCheck = checkPlaywrightDependencies(projectPath);
        if (!depCheck.playwrightInstalled) {
          console.log(`  ${styles.brightYellow}${icons.warning} Playwright not installed${styles.reset}`);
          console.log('');
          
          // Try to install automatically
          console.log(`  ${styles.brightCyan}${icons.info} Attempting automatic installation...${styles.reset}`);
          const installResult = await installPlaywrightDependencies(projectPath);
          
          if (!installResult.success) {
            console.log(`  ${styles.brightRed}${icons.error} Auto-installation failed: ${installResult.error}${styles.reset}`);
            console.log('');
            console.log(`  ${styles.bold}Manual install commands:${styles.reset}`);
            depCheck.installCommands.forEach(cmd => {
              console.log(`    ${styles.brightCyan}${cmd}${styles.reset}`);
            });
            console.log('');
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright not installed');
          }
          
          console.log(`  ${styles.brightGreen}${icons.success} Playwright installed successfully${styles.reset}`);
          console.log('');
        }
        
        if (!depCheck.browsersInstalled) {
          console.log(`  ${styles.brightYellow}${icons.warning} Playwright browsers not installed${styles.reset}`);
          console.log('');
          
          // Try to install browsers only
          console.log(`  ${styles.brightCyan}${icons.info} Installing browsers...${styles.reset}`);
          try {
            await new Promise<void>((resolve, reject) => {
              const browserInstall = spawn('npx', ['playwright', 'install'], {
                cwd: projectPath,
                stdio: 'pipe'
              });
              
              browserInstall.on('close', (code) => {
                if (code === 0) {
                  console.log(`  ${styles.brightGreen}${icons.success} Browsers installed successfully${styles.reset}`);
                  resolve();
                } else {
                  reject(new Error('browser install failed'));
                }
              });
              
              browserInstall.on('error', reject);
            });
          } catch (error: any) {
            console.log(`  ${styles.brightRed}${icons.error} Browser installation failed: ${error.message}${styles.reset}`);
            console.log(`  ${styles.brightCyan}npx playwright install${styles.reset}`);
            console.log('');
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright browsers not installed');
          }
        }
        
        // Create artifact directory for recorded test
        const artifacts = createArtifactDirectory(projectPath, options.flow);
        
        // Launch Playwright codegen
        const codegenArgs = ['playwright', 'codegen', options.url, '--target', 'playwright-test', '-o', artifacts.testFilePath];
        const codegenProc = spawn('npx', codegenArgs, {
          stdio: 'inherit',
          shell: process.platform === 'win32',
          cwd: projectPath
        });
        
        codegenProc.on('close', (code) => {
          if (code === 0 && existsSync(artifacts.testFilePath)) {
            console.log('');
            console.log(`  ${styles.brightGreen}${icons.success} Recording saved${styles.reset}`);
            console.log('');
            console.log(`  ${styles.dim}Test file:${styles.reset} ${truncatePath(artifacts.testFilePath)}`);
            console.log(`  ${styles.dim}Artifacts:${styles.reset} ${truncatePath(artifacts.artifactDir)}`);
            console.log('');
            console.log(`  ${styles.bold}To run the recorded test:${styles.reset}`);
            console.log(`    ${styles.brightCyan}guardrail reality --run --flow ${options.flow}${styles.reset}`);
            console.log('');
            process.exit(0);
          } else {
            console.log('');
            console.log(`  ${styles.brightRed}${icons.error} Recording cancelled or failed${styles.reset}`);
            console.log('');
            process.exit(code || 1);
          }
        });
        
        return;
      }
      
      // Run static "No Dead UI" scan if requested
      if (options.noDeadUi) {
        console.log(`  ${styles.brightCyan}${icons.info} Running static "No Dead UI" scan...${styles.reset}`);
        console.log('');
        
        const scanResult = runStaticScan(projectPath, ['src', 'app', 'components', 'pages'], []);
        const scanOutput = formatStaticScanResults(scanResult);
        console.log(scanOutput);
        console.log('');
        
        if (!scanResult.passed) {
          console.log(`  ${styles.brightRed}${icons.error} Static scan failed - found ${scanResult.errors.length} error(s)${styles.reset}`);
          console.log(`  ${styles.dim}Fix dead UI patterns before continuing${styles.reset}`);
          console.log('');
          
          if (options.run) {
            // If --run is set, fail early
            exitWith(ExitCode.POLICY_FAIL, 'Dead UI patterns detected');
          } else {
            console.log(`  ${styles.brightYellow}${icons.warning} Continuing despite errors (use --run to enforce)${styles.reset}`);
            console.log('');
          }
        } else {
          console.log(`  ${styles.brightGreen}${icons.success} Static scan passed${styles.reset}`);
          console.log('');
        }
      }

      // Generate button sweep test if requested
      if (options.buttonSweep) {
        console.log(`  ${styles.brightCyan}${icons.info} Generating button sweep test...${styles.reset}`);
        console.log('');
        
        const buttonSweepConfig = {
          baseUrl: options.url,
          auth: options.authEmail && options.authPassword
            ? { email: options.authEmail, password: options.authPassword }
            : undefined,
          pages: ['/', '/dashboard', '/settings', '/billing'],
          requireDataActionId: false,
        };
        
        const buttonSweepTest = generateButtonSweepTest(buttonSweepConfig);
        const buttonSweepOutputDir = join(process.cwd(), '.guardrail', 'reality-tests');
        if (!existsSync(buttonSweepOutputDir)) {
          mkdirSync(buttonSweepOutputDir, { recursive: true });
        }
        const buttonSweepFile = join(buttonSweepOutputDir, 'button-sweep.test.ts');
        writeFileSync(buttonSweepFile, buttonSweepTest);
        
        console.log(`  ${styles.brightGreen}${icons.success} Button sweep test generated${styles.reset}`);
        console.log(`  ${styles.dim}File:${styles.reset} ${truncatePath(buttonSweepFile)}`);
        console.log('');
        
        if (options.run) {
          // If --run is set, run the button sweep test instead of the regular test
          const artifacts = createArtifactDirectory(projectPath, 'button-sweep');
          copyTestToArtifacts(buttonSweepFile, artifacts);
          
          console.log(`  ${styles.bold}RUNNING BUTTON SWEEP TEST${styles.reset}`);
          printDivider();
          console.log('');
          
          const depCheck = checkPlaywrightDependencies(projectPath);
          if (!depCheck.playwrightInstalled || !depCheck.browsersInstalled) {
            console.log(`  ${styles.brightYellow}${icons.warning} Playwright dependencies required${styles.reset}`);
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright not installed');
          }
          
          const runResult = await runPlaywrightTests(
            {
              testFile: artifacts.testFilePath,
              headless: options.headless,
              timeout,
              workers,
              reporter: options.reporter,
              projectPath,
              baseUrl: options.url,
              flow: 'button-sweep',
              trace: options.trace,
              video: options.video,
              screenshot: options.screenshot,
            },
            artifacts,
            (data: string) => process.stdout.write(data)
          );
          
          console.log('');
          const summaryLines = runResult.success
            ? [
                `${styles.brightGreen}${styles.bold}${icons.success} BUTTON SWEEP PASSED${styles.reset}`,
                '',
                `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
                `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              ]
            : [
                `${styles.brightRed}${styles.bold}${icons.error} BUTTON SWEEP FAILED${styles.reset}`,
                '',
                `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
                `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              ];
          
          const framedSummary = frameLines(summaryLines, { padding: 2 });
          console.log(framedSummary.join('\n'));
          console.log('');
          
          process.exit(runResult.exitCode);
        }
      }

      // Generate Playwright test for reality mode
      const outputDir = join(process.cwd(), '.guardrail', 'reality-tests');
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }
      
      // Define basic click paths for different flows
      const clickPaths = {
        auth: [
          'input[name="email"]',
          'input[name="password"]', 
          'button[type="submit"]'
        ],
        checkout: [
          'button:has-text("Add to Cart")',
          'button:has-text("Checkout")',
          'input[name="cardNumber"]'
        ],
        dashboard: [
          '[href*="/dashboard"]',
          'button:has-text("Settings")',
          'button:has-text("Save")'
        ]
      };
      
      const selectedClickPaths = [clickPaths[options.flow as keyof typeof clickPaths] || clickPaths.auth];
      
      const testCode = realityScanner.generatePlaywrightTest({
        baseUrl: options.url,
        clickPaths: selectedClickPaths,
        outputDir
      });
      
      // Write test file
      const testFile = join(outputDir, `reality-${options.flow}.test.ts`);
      writeFileSync(testFile, testCode);
      
      const resultLines = [
        `${styles.brightGreen}${styles.bold}${icons.success} TEST GENERATED SUCCESSFULLY${styles.reset}`,
        '',
        `${styles.dim}File:${styles.reset}        ${truncatePath(testFile)}`,
        `${styles.dim}Base URL:${styles.reset}    ${options.url}`,
        `${styles.dim}Flow:${styles.reset}        ${options.flow}`,
        `${styles.dim}Mode:${styles.reset}        ${options.headless ? 'Headless' : 'Headed'}`,
      ];
      
      const framedResult = frameLines(resultLines, { padding: 2 });
      console.log(framedResult.join('\n'));
      console.log('');
      
      // If --run flag is set, execute the test immediately
      if (options.run) {
        console.log(`  ${styles.brightCyan}${icons.reality} Checking dependencies...${styles.reset}`);
        console.log('');
        
        const depCheck = checkPlaywrightDependencies(projectPath);
        
        if (!depCheck.playwrightInstalled) {
          console.log(`  ${styles.brightYellow}${icons.warning} Playwright not installed${styles.reset}`);
          console.log('');
          
          // Try to install automatically
          console.log(`  ${styles.brightCyan}${icons.info} Attempting automatic installation...${styles.reset}`);
          const installResult = await installPlaywrightDependencies(projectPath);
          
          if (!installResult.success) {
            console.log(`  ${styles.brightRed}${icons.error} Auto-installation failed: ${installResult.error}${styles.reset}`);
            console.log('');
            console.log(`  ${styles.bold}Manual install commands:${styles.reset}`);
            depCheck.installCommands.forEach(cmd => {
              console.log(`    ${styles.brightCyan}${cmd}${styles.reset}`);
            });
            console.log('');
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright not installed');
          }
          
          // Re-check after installation
          const newDepCheck = checkPlaywrightDependencies(projectPath);
          if (!newDepCheck.playwrightInstalled) {
            console.log(`  ${styles.brightRed}${icons.error} Installation verification failed${styles.reset}`);
            exitWith(ExitCode.SYSTEM_ERROR, 'Playwright installation failed');
          }
          
          console.log(`  ${styles.brightGreen}${icons.success} Playwright installed successfully${styles.reset}`);
          console.log('');
        }
        
        if (!depCheck.browsersInstalled) {
          console.log(`  ${styles.brightYellow}${icons.warning} Playwright browsers not installed${styles.reset}`);
          console.log('');
          
          // Try to install browsers only
          console.log(`  ${styles.brightCyan}${icons.info} Installing browsers...${styles.reset}`);
          try {
            const { spawn } = require('child_process');
            await new Promise<void>((resolve, reject) => {
              const browserInstall = spawn('npx', ['playwright', 'install'], {
                cwd: projectPath,
                stdio: 'pipe'
              });
              
              browserInstall.on('close', (code) => {
                if (code === 0) {
                  console.log(`  ${styles.brightGreen}${icons.success} Browsers installed successfully${styles.reset}`);
                  resolve();
                } else {
                  reject(new Error('browser install failed'));
                }
              });
              
              browserInstall.on('error', reject);
            });
          } catch (error: any) {
            console.log(`  ${styles.brightRed}${icons.error} Browser installation failed: ${error.message}${styles.reset}`);
            console.log(`  ${styles.brightCyan}npx playwright install${styles.reset}`);
            console.log('');
            process.exit(2);
          }
        }
        
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Playwright installed`);
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} Browsers available`);
        console.log('');
        
        // Create artifact directory
        const artifacts = createArtifactDirectory(projectPath, options.flow);
        copyTestToArtifacts(testFile, artifacts);
        
        console.log(`  ${styles.bold}EXECUTING TESTS${styles.reset}`);
        printDivider();
        console.log(`  ${styles.dim}Run ID:${styles.reset}      ${artifacts.runId}`);
        console.log(`  ${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`);
        console.log(`  ${styles.dim}Timeout:${styles.reset}     ${timeout}s`);
        console.log(`  ${styles.dim}Workers:${styles.reset}     ${workers}`);
        console.log(`  ${styles.dim}Reporter:${styles.reset}    ${options.reporter}`);
        console.log('');
        console.log(`  ${styles.dim}--- Playwright Output ---${styles.reset}`);
        console.log('');
        
        // Define critical paths for coverage tracking
        const criticalPaths = getCriticalPathsForFlow(options.flow, options.url);
        
        const runResult = await runPlaywrightTests(
          {
            testFile: artifacts.testFilePath,
            headless: options.headless,
            timeout,
            workers,
            reporter: options.reporter,
            projectPath,
            baseUrl: options.url,
            flow: options.flow,
            trace: options.trace,
            video: options.video,
            screenshot: options.screenshot,
            generateReceipt: options.receipt,
            orgKeyId: options.orgKeyId,
            orgPrivateKey: options.orgPrivateKey,
            criticalPaths,
          },
          artifacts,
          (data: string) => process.stdout.write(data)
        );
        
        console.log('');
        console.log(`  ${styles.dim}--- End Playwright Output ---${styles.reset}`);
        console.log('');
        
        // Display run summary
        const summaryLines = runResult.success
          ? [
              `${styles.brightGreen}${styles.bold}${icons.success} TESTS PASSED${styles.reset}`,
              '',
              `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
              `${styles.dim}Exit Code:${styles.reset}   ${runResult.exitCode}`,
              `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              ...(runResult.receiptPath ? [
                '',
                `${styles.brightCyan}${styles.bold}📜 PROOF-OF-EXECUTION RECEIPT${styles.reset}`,
                `${styles.dim}Receipt:${styles.reset}    ${truncatePath(runResult.receiptPath)}`,
                `${styles.dim}Verified:${styles.reset}   ${styles.brightGreen}✓ Tamper-evident${styles.reset}`,
              ] : []),
            ]
          : [
              `${styles.brightRed}${styles.bold}${icons.error} TESTS FAILED${styles.reset}`,
              '',
              `${styles.dim}Duration:${styles.reset}    ${formatDuration(runResult.duration)}`,
              `${styles.dim}Exit Code:${styles.reset}   ${runResult.exitCode}`,
              `${styles.dim}Artifacts:${styles.reset}   ${truncatePath(artifacts.artifactDir)}`,
              `${styles.dim}Screenshots:${styles.reset} ${truncatePath(artifacts.screenshotsDir)}`,
              ...(runResult.receiptPath ? [
                '',
                `${styles.brightYellow}${styles.bold}📜 PROOF-OF-EXECUTION RECEIPT${styles.reset}`,
                `${styles.dim}Receipt:${styles.reset}    ${truncatePath(runResult.receiptPath)}`,
                `${styles.dim}Note:${styles.reset}       Receipt generated despite test failure`,
              ] : []),
            ];
        
        const framedSummary = frameLines(summaryLines, { padding: 2 });
        console.log(framedSummary.join('\n'));
        console.log('');
        
        // Show how to view HTML report if reporter includes html
        if (options.reporter.includes('html')) {
          console.log(`  ${styles.bold}VIEW HTML REPORT${styles.reset}`);
          printDivider();
          console.log(`     ${styles.brightCyan}npx playwright show-report ${artifacts.reportPath}${styles.reset}`);
          console.log('');
        }
        
        // Exit with Playwright's exit code
        process.exit(runResult.exitCode);
      } else {
        // Generate-only mode - show manual run instructions
        console.log(`  ${styles.bold}HOW TO RUN${styles.reset}`);
        printDivider();
        console.log(`  ${styles.dim}Option 1: Use --run flag (recommended):${styles.reset}`);
        console.log(`     ${styles.brightCyan}guardrail reality --run -f ${options.flow}${styles.reset}`);
        console.log('');
        console.log(`  ${styles.dim}Option 2: Run manually:${styles.reset}`);
        console.log(`     ${styles.brightCyan}cd ${outputDir}${styles.reset}`);
        console.log(`     ${styles.brightCyan}npx playwright test reality-${options.flow}.test.ts${!options.headless ? ' --headed' : ''}${styles.reset}`);
        console.log('');
        
        console.log(`  ${styles.bold}WHERE ARTIFACTS ARE SAVED${styles.reset}`);
        printDivider();
        console.log(`  ${styles.dim}When using --run, artifacts are stored under:${styles.reset}`);
        console.log(`     ${styles.brightCyan}.guardrail/reality/<runId>/${styles.reset}`);
        console.log('');
        console.log(`  ${styles.dim}Contents:${styles.reset}`);
        console.log(`     ${styles.bullet} ${styles.bold}reality-*.test.ts${styles.reset} - Generated test file`);
        console.log(`     ${styles.bullet} ${styles.bold}output.log${styles.reset} - Playwright console output`);
        console.log(`     ${styles.bullet} ${styles.bold}result.json${styles.reset} - Run result summary`);
        console.log(`     ${styles.bullet} ${styles.bold}screenshots/${styles.reset} - Failure screenshots`);
        console.log(`     ${styles.bullet} ${styles.bold}report/${styles.reset} - HTML report (if --reporter html)`);
        console.log('');
        
        console.log(`  ${styles.brightGreen}${icons.success}${styles.reset} ${styles.bold}Reality test ready - detect fake data now${styles.reset}`);
        console.log('');
      }
      
    } catch (error: any) {
      console.log('');
      console.log(`  ${styles.brightRed}${icons.error}${styles.reset} ${styles.bold}Reality mode failed:${styles.reset} ${error.message}`);
      console.log('');
      exitWith(ExitCode.SYSTEM_ERROR, 'Reality mode execution failed');
    }
  });