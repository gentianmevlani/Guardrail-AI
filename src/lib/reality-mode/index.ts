/**
 * Reality Mode - Runtime Fake Detection
 *
 * "Stop shipping pretend features. guardrail runs your app and catches the lies."
 *
 * A literal "flight recorder" for fake apps.
 */

export {
  RealityScanner,
  realityScanner,
  DEFAULT_FAKE_PATTERNS,
} from "./reality-scanner";

export * from "./types";
export { ReportGenerator } from "./report-generator";
export { TrafficClassifier } from "./traffic-classifier";
export { FakeSuccessDetector } from "./fake-success-detector";
export { AuthEnforcer } from "./auth-enforcer";

// Enhanced Reality Mode - Universal Project Testing
export * from "./project-detector";
export * from "./test-flows";
export * from "./enhanced-runner";
