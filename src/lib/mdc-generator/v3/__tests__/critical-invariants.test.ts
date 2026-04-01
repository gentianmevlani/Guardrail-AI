/**
 * Tests for Critical Invariants
 */

import { describe, it, expect } from '@jest/globals';
import {
  CRITICAL_INVARIANTS,
  getInvariantsByCategory,
  getInvariantsForLane,
  formatInvariantsAsMarkdown,
} from '../critical-invariants';

describe('Critical Invariants', () => {
  it('should have invariants defined', () => {
    expect(CRITICAL_INVARIANTS.length).toBeGreaterThan(0);
  });

  it('should have unique IDs', () => {
    const ids = CRITICAL_INVARIANTS.map(inv => inv.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should filter invariants by category', () => {
    const entitlements = getInvariantsByCategory('entitlements');
    expect(entitlements.length).toBeGreaterThan(0);
    entitlements.forEach(inv => {
      expect(inv.category).toBe('entitlements');
    });
  });

  it('should filter invariants by lane', () => {
    const cliInvariants = getInvariantsForLane('cli-mcp');
    expect(cliInvariants.length).toBeGreaterThan(0);
    // Should include entitlements and CLI contract
    expect(cliInvariants.some(inv => inv.category === 'entitlements')).toBe(true);
    expect(cliInvariants.some(inv => inv.category === 'cli-contract')).toBe(true);

    const dashboardInvariants = getInvariantsForLane('dashboard');
    expect(dashboardInvariants.length).toBeGreaterThan(0);
    // Should include dashboard actions and dead buttons
    expect(dashboardInvariants.some(inv => inv.category === 'dashboard-actions')).toBe(true);
    expect(dashboardInvariants.some(inv => inv.category === 'dead-buttons')).toBe(true);
  });

  it('should format invariants as markdown', () => {
    const invariants = CRITICAL_INVARIANTS.slice(0, 3);
    const markdown = formatInvariantsAsMarkdown(invariants);

    expect(markdown).toContain('# Critical Invariants');
    expect(markdown).toContain('##');
    invariants.forEach(inv => {
      expect(markdown).toContain(inv.id);
      expect(markdown).toContain(inv.rule);
    });
  });

  it('should include examples in formatted markdown', () => {
    const invariants = CRITICAL_INVARIANTS.slice(0, 1);
    const markdown = formatInvariantsAsMarkdown(invariants);

    expect(markdown).toContain('Violation:');
    expect(markdown).toContain('Correct:');
    expect(markdown).toContain('```typescript');
  });
});
