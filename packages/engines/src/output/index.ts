/**
 * @guardrail/engines — Output formatters for scan results.
 */

export {
  toSarif,
  type SarifLog,
  type SarifInput,
  type ToSarifOptions,
} from './sarif.js';

export {
  formatFindings,
  formatSummary,
  type RunSummaryLike,
  type RunResultLike,
  type OutputFormat,
  type FormatOptions,
} from './formatters.js';
