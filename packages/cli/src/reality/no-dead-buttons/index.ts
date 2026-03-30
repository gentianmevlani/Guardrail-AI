/**
 * No Dead Buttons System
 * 
 * Comprehensive system to prevent dead buttons and silent failures:
 * - Static scanner for dead UI patterns
 * - Button sweep test generator
 * - Integration helpers
 */

export {
  runStaticScan,
  formatStaticScanResults,
  type DeadUIPattern,
  type StaticScanResult,
} from './static-scanner';

export {
  generateButtonSweepTest,
  generateCIButtonSweepTest,
  type ButtonSweepConfig,
} from './button-sweep-generator';
