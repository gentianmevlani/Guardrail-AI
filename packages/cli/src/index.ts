#!/usr/bin/env node
/**
 * guardrail CLI — thin entry: delegates to bootstrap (command registration + main).
 */
import './bootstrap';

export { printLogo } from './ui/cli-terminal';
export { styles, icons } from './ui/cli-styles';
