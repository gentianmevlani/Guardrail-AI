/**
 * CLI UI utilities - shared styling and rendering components.
 */
export {
  stripAnsi,
  padRight,
  isNoColor,
  frameStyles,
  renderCommandHeader,
  printCommandHeader,
  type FrameOptions,
  type CommandHeaderOptions,
} from './frame';

export { createSpinner, withSpinner, type Spinner } from './spinner';
export { createProgress, createSteps, type ProgressBar, type StepTracker } from './progress';
export {
  renderScanSummary,
  printScanSummary,
  renderCompactVerdict,
  type ScanSummaryData,
} from './summary';

export { supportsUnicode, box, icons, styles, style } from './cli-styles';
export { frameLines, truncatePath, renderGuardrailBanner } from './cli-frame-inline';
export { colors, c, printLogo, spinner } from './cli-terminal';
export {
  promptSelect,
  promptInput,
  promptConfirm,
  promptPassword,
  printScanSummary as printScanSummaryFramed,
} from './cli-prompts';
export { printMenuHeader, printDivider, printStatusBadge } from './cli-menus';
