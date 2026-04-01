/**
 * Reality Explorer Types
 *
 * Types for the comprehensive app exploration system that actually
 * tests everything - buttons, forms, modals, auth flows, etc.
 */

// ============================================================================
// App Surface Discovery
// ============================================================================

export interface DiscoveredRoute {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  source: "link" | "router" | "api-call" | "redirect";
  requiresAuth: boolean;
  visited: boolean;
  status?: number;
  error?: string;
}

export interface DiscoveredElement {
  id: string;
  selector: string;
  type:
    | "button"
    | "link"
    | "input"
    | "form"
    | "modal-trigger"
    | "dropdown"
    | "tab"
    | "accordion";
  text: string;
  page: string;
  isDestructive: boolean;
  tested: boolean;
  result?: ElementTestResult;
}

export interface DiscoveredForm {
  id: string;
  selector: string;
  page: string;
  action?: string;
  method: string;
  fields: FormField[];
  submitButton?: string;
  tested: boolean;
  result?: FormTestResult;
}

export interface FormField {
  name: string;
  type: string;
  required: boolean;
  selector: string;
  placeholder?: string;
  pattern?: string;
}

export interface DiscoveredAPI {
  url: string;
  method: string;
  calledFrom: string;
  status?: number;
  responseTime?: number;
  error?: string;
}

export interface AppSurface {
  routes: DiscoveredRoute[];
  elements: DiscoveredElement[];
  forms: DiscoveredForm[];
  apis: DiscoveredAPI[];
  timestamp: string;
}

// ============================================================================
// Test Results
// ============================================================================

export interface ElementTestResult {
  success: boolean;
  action: "click" | "hover" | "focus";
  beforeState: PageState;
  afterState: PageState;
  changes: StateChange[];
  errors: CapturedError[];
  networkCalls: NetworkCall[];
  duration: number;
  screenshot?: string;
}

export interface FormTestResult {
  success: boolean;
  fieldsFilledCount: number;
  submitAttempted: boolean;
  submitSucceeded: boolean;
  validationErrors: string[];
  networkCalls: NetworkCall[];
  errors: CapturedError[];
  duration: number;
  screenshot?: string;
}

export interface PageState {
  url: string;
  title: string;
  modalsOpen: number;
  loadingIndicators: number;
  errorMessages: string[];
  domHash: string;
}

export interface StateChange {
  type: "url" | "modal" | "dom" | "console" | "network";
  description: string;
  significance: "major" | "minor" | "none";
}

export interface CapturedError {
  type: "console" | "network" | "uncaught" | "react-boundary";
  message: string;
  stack?: string;
  url?: string;
  timestamp: number;
}

export interface NetworkCall {
  url: string;
  method: string;
  status: number;
  duration: number;
  requestBody?: string;
  responsePreview?: string;
  error?: string;
}

// ============================================================================
// Critical Flows
// ============================================================================

export interface CriticalFlow {
  id: string;
  name: string;
  description: string;
  steps: FlowStep[];
  assertions: FlowAssertion[];
  required: boolean;
}

export interface FlowStep {
  action: "navigate" | "click" | "fill" | "wait" | "assert";
  target?: string;
  value?: string;
  timeout?: number;
}

export interface FlowAssertion {
  type:
    | "url-contains"
    | "element-visible"
    | "element-hidden"
    | "cookie-exists"
    | "localstorage-has"
    | "network-success"
    | "no-errors";
  value: string;
  critical: boolean;
}

export interface FlowResult {
  flow: CriticalFlow;
  success: boolean;
  stepsCompleted: number;
  stepsTotal: number;
  assertionsPassed: number;
  assertionsTotal: number;
  failedAt?: string;
  errors: CapturedError[];
  duration: number;
  trace?: string;
  video?: string;
}

// ============================================================================
// Coverage & Scoring
// ============================================================================

export interface CoverageMetrics {
  routes: {
    discovered: number;
    visited: number;
    successful: number;
    blocked: number;
    percentage: number;
  };
  elements: {
    discovered: number;
    tested: number;
    successful: number;
    skippedDestructive: number;
    percentage: number;
  };
  forms: {
    discovered: number;
    tested: number;
    successful: number;
    blockedByAuth: number;
    percentage: number;
  };
  apis: {
    discovered: number;
    called: number;
    successful: number;
    failed: number;
    percentage: number;
  };
  flows: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    percentage: number;
  };
}

export interface RealityScore {
  overall: number; // 0-100
  breakdown: {
    coverage: number; // 40 points max
    functionality: number; // 35 points max
    stability: number; // 15 points max
    ux: number; // 10 points max
  };
  grade: "A" | "B" | "C" | "D" | "F";
  verdict: "ship-it" | "needs-work" | "broken";
}

// ============================================================================
// Explorer Config
// ============================================================================

export interface ExplorerConfig {
  baseUrl: string;
  maxPages: number;
  maxActionsPerPage: number;
  timeout: number;
  headless: boolean;

  // Auth config
  auth?: {
    loginUrl: string;
    credentials: {
      emailField: string;
      passwordField: string;
      email: string;
      password: string;
    };
    successIndicator: string;
  };

  // Safety
  allowDestructive: boolean;
  destructivePatterns: string[];

  // Output
  outputDir: string;
  captureVideo: boolean;
  captureTrace: boolean;
  captureScreenshots: boolean;

  // Custom flows
  flows?: CriticalFlow[];
}

// ============================================================================
// Final Report
// ============================================================================

export interface ExplorerReport {
  summary: {
    score: RealityScore;
    coverage: CoverageMetrics;
    duration: number;
    timestamp: string;
  };

  surface: AppSurface;

  results: {
    routes: RouteResult[];
    elements: ElementResult[];
    forms: FormResult[];
    flows: FlowResult[];
  };

  failures: {
    critical: FailureReport[];
    warnings: FailureReport[];
  };

  recommendations: Recommendation[];

  artifacts: {
    traces: string[];
    videos: string[];
    screenshots: string[];
  };
}

export interface RouteResult {
  route: DiscoveredRoute;
  status: "success" | "error" | "blocked" | "skipped";
  responseTime?: number;
  errors: CapturedError[];
}

export interface ElementResult {
  element: DiscoveredElement;
  status: "success" | "error" | "no-change" | "skipped";
  result?: ElementTestResult;
}

export interface FormResult {
  form: DiscoveredForm;
  status:
    | "success"
    | "validation-error"
    | "submit-error"
    | "blocked"
    | "skipped";
  result?: FormTestResult;
}

export interface FailureReport {
  id: string;
  type: "route" | "element" | "form" | "flow" | "api";
  severity: "critical" | "warning";
  title: string;
  description: string;
  location: string;
  rootCause?: string;
  reproduction: string[];
  screenshot?: string;
  trace?: string;
}

export interface Recommendation {
  priority: "high" | "medium" | "low";
  category: "functionality" | "auth" | "ux" | "performance" | "stability";
  title: string;
  description: string;
  fix?: string;
}
