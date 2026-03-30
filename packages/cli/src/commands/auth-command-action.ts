import {
  getConfigPath,
  saveAuthState,
  loadAuthState,
  clearAuthState,
  type AuthState,
} from '../runtime/creds';
import { validateApiKey, getCacheExpiry } from '../runtime/client';
import { ExitCode, exitWith } from '../runtime/exit-codes';
import { maskApiKey, isExpiryWarning, formatExpiry, validateApiKeyFormat, hoursUntilExpiry } from '../runtime/auth-utils';
import { icons, styles } from '../ui/cli-styles';
import { frameLines } from '../ui/cli-frame-inline';
import { printDivider } from '../ui/cli-menus';
import { printLogo, spinner } from '../ui/cli-terminal';

export async function runAuthOptionsAction(options: {
  key?: string;
  logout?: boolean;
  status?: boolean;
  refresh?: boolean;
}): Promise<void> {
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
          `${styles.brightBlue}https://guardrail.dev/api-key${styles.reset}`,
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
        `${styles.brightBlue}https://guardrail.dev/api-key${styles.reset}`,
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
        `${styles.brightBlue}https://guardrail.dev/api-key${styles.reset}`,
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
}
