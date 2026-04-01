/**
 * MockProof Build Gate
 * 
 * "One rule, one red line."
 * 
 * Blocks MockProvider, useMock, mock-context, localhost, and other
 * banned imports from reaching production entrypoints.
 */

export {
  ImportGraphScanner,
  importGraphScanner,
  type BannedImport,
  type ImportNode,
  type ViolationPath,
  type MockProofResult,
  type MockProofConfig,
} from './import-graph-scanner';
