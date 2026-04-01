/**
 * Audit Trail Module
 * 
 * Comprehensive audit logging for Compliance+ tier.
 * Exports all audit functionality.
 */

// Event types and schemas
export * from './events';

// Storage adapters
export * from './storage';

// Emitter (main API)
export { 
  audit,
  configureAudit,
  emit,
  emitAction,
  emitScanStart,
  emitScanComplete,
  emitShipCheck,
  emitRealityStart,
  emitRealityComplete,
  emitAutopilotAction,
  emitFixPlan,
  emitFixApply,
  emitGateCheck,
  emitToolInvoke,
  emitAuth,
  hasFullAuditAccess,
} from './emitter';

// Default export
export { default } from './emitter';
