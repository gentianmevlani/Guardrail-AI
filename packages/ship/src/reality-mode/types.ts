export interface FakePattern {
  id: string;
  name: string;
  description: string;
  severity: "critical" | "warning" | "info";
  detect: (request: InterceptedRequest | InterceptedResponse) => boolean;
}

export interface InterceptedRequest {
  type: "request";
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

export interface InterceptedResponse {
  type: "response";
  url: string;
  status: number;
  headers: Record<string, string>;
  body?: string;
  timestamp: number;
}

export interface UserAction {
  type: "click" | "input" | "navigation" | "scroll";
  selector?: string;
  value?: string;
  url?: string;
  timestamp: number;
  screenshot?: string;
}

export interface FakeDetection {
  pattern: FakePattern;
  request?: InterceptedRequest;
  response?: InterceptedResponse;
  action?: UserAction;
  timestamp: number;
  evidence: string;
}

export interface ReplayStep {
  timestamp: number;
  type: "request" | "response" | "action";
  data: any;
  detections: FakeDetection[];
  screenshot?: string;
}

export type TrafficVerdict = "green" | "yellow" | "red";

export interface TrafficClassification {
  verdict: TrafficVerdict;
  reasons: string[];
  score: number;
}

export interface FakeSuccessResult {
  isFake: boolean;
  score: number;
  evidence: string[];
  actionStep?: ReplayStep;
}

export interface RealityModeResult {
  verdict: "real" | "fake" | "suspicious";
  score: number;
  detections: FakeDetection[];
  replay: ReplayStep[];
  trafficAnalysis: TrafficClassification[];
  fakeSuccessAnalysis: FakeSuccessResult[];
  authViolations?: { route: string; status: number; type: string }[];
  summary: {
    totalRequests: number;
    fakeRequests: number;
    totalActions: number;
    criticalIssues: number;
    warnings: number;
  };
  timestamp: string;
  duration: number;
}

export interface RealityModeConfig {
  baseUrl: string;
  timeout: number;
  patterns: FakePattern[];
  clickPaths: string[][];
  screenshotOnDetection: boolean;
  headless: boolean;
  checkAuth: boolean;
}
