// IaC Security
export * from './iac';

// Compliance Frameworks
export * from './frameworks';

// PII Detection
export * from './pii';

// Container Security
export * from './container';

// Automation Components
export * from './automation';

// Audit Trail (Compliance+ feature)
export * from './audit';

// Compliance Scanner (Enterprise Feature)
export { ComplianceScannerEngine, PolicyLoader, DriftDetector } from './scanner';
export { TableFormatter } from './scanner/formatters/table-formatter';
export { JsonFormatter } from './scanner/formatters/json-formatter';
export { SarifFormatter } from './scanner/formatters/sarif-formatter';

// SBOM Generation (Enterprise Feature)
export * from './sbom';

// Policy-as-Code (Enterprise Feature)
export { PolicyManager, formatPolicyResults } from './policies/policy-as-code';
export type { PolicyFile, PolicyRule, PolicyEvalInput, PolicyEvalResult } from './policies/policy-as-code';

// Signed Audit Storage (Enterprise Feature)
export { SignedJSONLStorage, AuditKeyManager } from './audit/signed-storage';
export type { SignedAuditEvent, SignatureValidation } from './audit/signed-storage';

// SSO & SCIM (Enterprise Feature)
export { SSOService, InMemorySCIMStore, ssoService } from './sso';
export type { SSOConfig, SSOProvider, SCIMUser, SCIMGroup, SSOSession, SSOAuthResult } from './sso';

// Trend Analytics (Enterprise Feature)
export * from './analytics';
