/**
 * Critical Invariants
 * 
 * Hard rules that agents must not violate:
 * - No entitlement bypass, no owner-mode shortcuts, offline never grants paid features
 * - CLI output contract: exit codes + JSON schema version must remain stable
 * - Dashboard action rules: must go through action registry + action wrapper
 * - Webhooks: signatures verified + idempotent + audited
 * - No empty catches + no fake success paths
 */

export interface CriticalInvariant {
  id: string;
  category: 'entitlements' | 'cli-contract' | 'dashboard-actions' | 'webhooks' | 'error-handling' | 'dead-buttons';
  rule: string;
  rationale: string;
  enforcement: 'compile-time' | 'runtime' | 'test' | 'review';
  examples: {
    violation: string;
    correct: string;
  };
}

export const CRITICAL_INVARIANTS: CriticalInvariant[] = [
  // Entitlements
  {
    id: 'INV-001',
    category: 'entitlements',
    rule: 'No entitlement bypass. Offline mode never grants paid features.',
    rationale: 'Prevents unauthorized access to premium features. Offline mode must respect tier limits.',
    enforcement: 'runtime',
    examples: {
      violation: 'if (offline) { return { plan: "enterprise" }; }',
      correct: 'if (offline) { return { plan: cachedPlan || "free" }; }',
    },
  },
  {
    id: 'INV-002',
    category: 'entitlements',
    rule: 'No owner-mode or admin-mode shortcuts that bypass plan checks.',
    rationale: 'Owner/admin status does not grant plan features. Plan checks must always run.',
    enforcement: 'runtime',
    examples: {
      violation: 'if (user.isOwner) { return true; } // Skip plan check',
      correct: 'if (user.isOwner && hasPlanFeature(user.plan, feature)) { return true; }',
    },
  },

  // CLI Contract
  {
    id: 'INV-003',
    category: 'cli-contract',
    rule: 'CLI exit codes must remain stable. JSON schema version must be versioned.',
    rationale: 'CI/CD and automation depend on stable exit codes. Schema changes break integrations.',
    enforcement: 'compile-time',
    examples: {
      violation: 'process.exit(Math.random() > 0.5 ? 0 : 1);',
      correct: 'process.exit(ExitCode.POLICY_FAIL); // Stable constant',
    },
  },
  {
    id: 'INV-004',
    category: 'cli-contract',
    rule: 'JSON output schema must include version field. Breaking changes require major version bump.',
    rationale: 'Consumers parse JSON output. Version field enables compatibility checks.',
    enforcement: 'test',
    examples: {
      violation: '{ "findings": [...] }',
      correct: '{ "version": "2.0.0", "findings": [...] }',
    },
  },

  // Dashboard Actions
  {
    id: 'INV-005',
    category: 'dashboard-actions',
    rule: 'All UI actions must go through action registry. No inline fetch() calls in components.',
    rationale: 'Centralized action management enables auditing, telemetry, and consistent error handling.',
    enforcement: 'compile-time',
    examples: {
      violation: 'onClick={() => fetch("/api/upgrade")}',
      correct: 'onClick={() => actionRegistry.execute("upgrade-plan")}',
    },
  },
  {
    id: 'INV-006',
    category: 'dashboard-actions',
    rule: 'Actions must use action wrapper for loading/error/success states.',
    rationale: 'Consistent UX requires standardized state management. No silent failures.',
    enforcement: 'test',
    examples: {
      violation: 'try { await apiCall(); } catch {}',
      correct: 'await actionWrapper(apiCall, { onSuccess, onError });',
    },
  },

  // Webhooks
  {
    id: 'INV-007',
    category: 'webhooks',
    rule: 'Webhook handlers must verify signatures, be idempotent, and audited.',
    rationale: 'Security and reliability require signature verification, idempotency prevents duplicates, audit trail enables debugging.',
    enforcement: 'runtime',
    examples: {
      violation: 'app.post("/webhook", (req, res) => { process(req.body); });',
      correct: 'app.post("/webhook", verifySignature, idempotent, audit, handler);',
    },
  },

  // Error Handling
  {
    id: 'INV-008',
    category: 'error-handling',
    rule: 'No empty catch blocks. No fake success paths (success:true in catch).',
    rationale: 'Silent failures hide bugs. Fake success misleads users and breaks trust.',
    enforcement: 'test',
    examples: {
      violation: 'try { await apiCall(); } catch {}',
      correct: 'try { await apiCall(); } catch (err) { logger.error(err); toast.error("Failed"); }',
    },
  },
  {
    id: 'INV-009',
    category: 'error-handling',
    rule: 'Errors must be visible with next-step messaging. No "best effort" silent fallbacks.',
    rationale: 'Users need feedback. Silent fallbacks create confusion and support burden.',
    enforcement: 'review',
    examples: {
      violation: 'try { save(); } catch { return true; } // Best effort',
      correct: 'try { save(); } catch (err) { showError("Save failed", "Please retry"); return false; }',
    },
  },

  // Dead Buttons
  {
    id: 'INV-010',
    category: 'dead-buttons',
    rule: 'No dead buttons: href="#", empty onClick, TODO/stub/placeholder in button context.',
    rationale: 'Dead buttons frustrate users and indicate incomplete features.',
    enforcement: 'test',
    examples: {
      violation: '<button onClick={() => {}}>Coming Soon</button>',
      correct: '<button onClick={handleAction} data-action-id="upgrade">Upgrade</button>',
    },
  },
  {
    id: 'INV-011',
    category: 'dead-buttons',
    rule: 'Buttons must have data-action-id for button sweep testing.',
    rationale: 'Automated testing requires stable selectors. data-action-id enables deterministic testing.',
    enforcement: 'test',
    examples: {
      violation: '<button onClick={handleClick}>Save</button>',
      correct: '<button onClick={handleClick} data-action-id="save-settings">Save</button>',
    },
  },
];

/**
 * Get invariants by category
 */
export function getInvariantsByCategory(category: CriticalInvariant['category']): CriticalInvariant[] {
  return CRITICAL_INVARIANTS.filter(inv => inv.category === category);
}

/**
 * Get invariants for a specific lane
 */
export function getInvariantsForLane(lane: 'cli-mcp' | 'dashboard' | 'shared'): CriticalInvariant[] {
  switch (lane) {
    case 'cli-mcp':
      return CRITICAL_INVARIANTS.filter(inv => 
        inv.category === 'entitlements' || 
        inv.category === 'cli-contract' ||
        inv.category === 'error-handling'
      );
    case 'dashboard':
      return CRITICAL_INVARIANTS.filter(inv => 
        inv.category === 'dashboard-actions' || 
        inv.category === 'webhooks' ||
        inv.category === 'dead-buttons' ||
        inv.category === 'error-handling'
      );
    case 'shared':
      return CRITICAL_INVARIANTS.filter(inv => 
        inv.category === 'entitlements' ||
        inv.category === 'error-handling'
      );
  }
}

/**
 * Format invariants as markdown
 */
export function formatInvariantsAsMarkdown(invariants: CriticalInvariant[]): string {
  const lines: string[] = [];
  
  lines.push('## Critical Invariants');
  lines.push('');
  lines.push('**These rules must not be violated. Agents must respect these constraints.**');
  lines.push('');

  // Group by category
  const byCategory = invariants.reduce((acc, inv) => {
    if (!acc[inv.category]) acc[inv.category] = [];
    acc[inv.category].push(inv);
    return acc;
  }, {} as Record<string, CriticalInvariant[]>);

  for (const [category, invs] of Object.entries(byCategory)) {
    lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ')}`);
    lines.push('');

    for (const inv of invs) {
      lines.push(`#### ${inv.id}: ${inv.rule}`);
      lines.push('');
      lines.push(`**Rationale:** ${inv.rationale}`);
      lines.push('');
      lines.push(`**Enforcement:** ${inv.enforcement}`);
      lines.push('');
      lines.push('**Examples:**');
      lines.push('');
      lines.push('❌ **Violation:**');
      lines.push('```typescript');
      lines.push(inv.examples.violation);
      lines.push('```');
      lines.push('');
      lines.push('✅ **Correct:**');
      lines.push('```typescript');
      lines.push(inv.examples.correct);
      lines.push('```');
      lines.push('');
    }
  }

  return lines.join('\n');
}
