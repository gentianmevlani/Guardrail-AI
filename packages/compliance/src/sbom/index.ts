/**
 * SBOM Module
 *
 * Software Bill of Materials generation for enterprise compliance.
 * Supports CycloneDX 1.5 and SPDX 2.3 output formats.
 */

export * from './types';
export { generateSBOM, formatSBOMSummary } from './generator';
export { formatCycloneDX, formatSPDX } from './formatters';
export {
  collectFromNpmLockfile,
  collectFromPnpmLockfile,
  collectFromPackageJson,
  getRootComponent,
  detectPackageManagers,
  buildPurl,
} from './collector';
