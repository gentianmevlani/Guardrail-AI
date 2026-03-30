import {
  loadAuthState,
  saveAuthState,
  isCacheValid,
  type AuthState,
  type Tier,
} from './creds';
import { validateCredentials, getCacheExpiry } from './client';
import { ExitCode, exitWith } from './exit-codes';
import { loadConfig, type CliConfig } from './cli-config';
import { c } from '../ui/cli-terminal';

let cachedAuthState: AuthState | null = null;

export async function requireAuthAsync(requiredTier?: Tier): Promise<AuthState> {
  const state = cachedAuthState || (await loadAuthState());
  cachedAuthState = state;

  if (!state.apiKey && !state.accessToken) {
    console.error(`\n${c.critical('ERROR')} Authentication required\n`);
    console.log(`  ${c.dim('Run')} ${c.bold('guardrail auth --key YOUR_API_KEY')} ${c.dim('to authenticate')}`);
    console.log(`  ${c.dim('Get your API key from')} ${c.info('https://guardrail.dev/api-key')}\n`);
    exitWith(ExitCode.AUTH_FAILURE);
  }

  if (isCacheValid(state) && state.tier) {
    return checkTierAccess(state, requiredTier);
  }

  const validation = await validateCredentials({
    apiKey: state.apiKey,
    accessToken: state.accessToken,
  });

  if (!validation.ok) {
    if (state.tier) {
      console.log(`  ${c.dim('(offline mode - using cached entitlements)')}\n`);
      return checkTierAccess(state, requiredTier);
    }
    console.error(`\n${c.critical('ERROR')} ${validation.error || 'Authentication failed'}\n`);
    exitWith(ExitCode.AUTH_FAILURE);
  }

  const updatedState: AuthState = {
    ...state,
    tier: validation.tier,
    email: validation.email,
    entitlements: validation.entitlements,
    cacheUntil: getCacheExpiry(15),
  };

  await saveAuthState(updatedState);
  cachedAuthState = updatedState;

  return checkTierAccess(updatedState, requiredTier);
}

export function checkTierAccess(state: AuthState, requiredTier?: Tier): AuthState {
  if (!requiredTier) return state;

  const tierLevels: Record<Tier, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
  const requiredLevel = tierLevels[requiredTier] || 0;
  const currentLevel = tierLevels[state.tier || 'free'] || 0;

  if (currentLevel < requiredLevel) {
    console.error(
      `\n${c.critical('UPGRADE REQUIRED')} This feature requires ${c.bold(requiredTier.toUpperCase())} tier\n`
    );
    console.log(`  ${c.dim('Current tier:')} ${c.info(state.tier || 'free')}`);
    console.log(`  ${c.dim('Upgrade at')} ${c.info('https://guardrail.dev/pricing')}\n`);
    exitWith(ExitCode.AUTH_FAILURE);
  }

  return state;
}

export function requireAuth(tier?: 'starter' | 'pro' | 'enterprise'): CliConfig {
  const config = loadConfig();
  if (!config.apiKey) {
    console.error(`\n${c.critical('ERROR')} Authentication required\n`);
    console.log(`  ${c.dim('Run')} ${c.bold('guardrail auth --key YOUR_API_KEY')} ${c.dim('to authenticate')}`);
    console.log(`  ${c.dim('Get your API key from')} ${c.info('https://guardrail.dev/api-key')}\n`);
    exitWith(ExitCode.AUTH_FAILURE);
  }

  if (tier) {
    const tierLevels: Record<string, number> = { free: 0, starter: 1, pro: 2, enterprise: 3 };
    const requiredLevel = tierLevels[tier] || 0;
    const currentLevel = tierLevels[config.tier || 'free'] || 0;

    if (currentLevel < requiredLevel) {
      console.error(`\n${c.critical('UPGRADE REQUIRED')} This feature requires ${c.bold(tier.toUpperCase())} tier\n`);
      console.log(`  ${c.dim('Current tier:')} ${c.info(config.tier || 'free')}`);
      console.log(`  ${c.dim('Upgrade at')} ${c.info('https://guardrail.dev/pricing')}\n`);
      exitWith(ExitCode.AUTH_FAILURE);
    }
  }

  return config;
}
