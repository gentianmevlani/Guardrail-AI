import {
  InterceptedRequest,
  InterceptedResponse,
  FakePattern,
  TrafficClassification,
  TrafficVerdict,
} from "./types";

export class TrafficClassifier {
  private fakePatterns: FakePattern[];

  constructor(patterns: FakePattern[]) {
    this.fakePatterns = patterns;
  }

  /**
   * Classify a single network interaction (request + response)
   */
  classify(
    request: InterceptedRequest,
    response?: InterceptedResponse,
  ): TrafficClassification {
    const reasons: string[] = [];
    let score = 100;
    let verdict: TrafficVerdict = "green";

    // 1. Check for Red Flags (Fake Patterns)
    for (const pattern of this.fakePatterns) {
      if (pattern.detect(request)) {
        score -= pattern.severity === "critical" ? 100 : 20;
        reasons.push(
          `Mock Backend: Request matches ${pattern.name} (${pattern.description})`,
        );
      }
      if (response && pattern.detect(response)) {
        score -= pattern.severity === "critical" ? 100 : 20;
        reasons.push(
          `Mock Backend: Response matches ${pattern.name} (${pattern.description})`,
        );
      }
    }

    if (score <= 50) {
      return { verdict: "red", reasons, score: Math.max(0, score) };
    }

    // 2. Check for Yellow Flags (Suspicious)

    // Suspicious: API returns "success" but no data
    if (response && response.body) {
      try {
        const body = JSON.parse(response.body);
        if (
          body.success === true &&
          !body.data &&
          Object.keys(body).length <= 2
        ) {
          score -= 10;
          reasons.push(
            "Potential No-Wire UI: API returns generic success with no data",
          );
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Suspicious: URL looks like a dev/staging environment but we are running in "production" mode?
    // (Assuming we are looking for production credibility)
    if (
      request.url.includes("localhost") ||
      request.url.includes("127.0.0.1")
    ) {
      // If we are testing local, this is fine. If testing prod, it's red.
      // Context matters. For now, let's treat localhost as "yellow" unless explicitly allowed.
      // Actually, reality-scanner treats localhost as a fake pattern (critical) in default patterns.
      // So it's already caught above.
    }

    // Suspicious: Non-standard status codes
    if (response && response.status >= 400) {
      // 404/500 on API endpoints -> Red flag (Missing Wiring)
      if (
        response.url.includes("/api/") ||
        response.url.includes("/graphql") ||
        response.url.includes("/trpc")
      ) {
        score -= 40;
        reasons.push(
          `Missing Wiring: API Error ${response.status} on ${response.url}`,
        );
        if (response.status === 404) verdict = "red";
      } else if (response.status === 418 || response.status === 999) {
        score -= 30;
        reasons.push(
          `Mock Backend: Suspicious HTTP status code ${response.status}`,
        );
      } else {
        // Other errors (e.g. 401/403 are handled by AuthEnforcer, but still suspicious if unintended)
        score -= 10;
        reasons.push(`Schema Drift: HTTP Error ${response.status}`);
      }
    }

    // 3. Green Signals (Real Data)
    if (response && response.body) {
      // IDs looking like UUIDs or MongoDB IDs or integer sequences
      if (/"id":\s*["'][a-f0-9-]{36}["']/i.test(response.body)) {
        // UUID found - likely real
        // Boost score slightly if it was lowered by minor things
        if (score < 100) score += 5;
      }
      if (/"created_at":\s*["']\d{4}-\d{2}-\d{2}/i.test(response.body)) {
        // ISO Date found
        if (score < 100) score += 5;
      }
    }

    // Final Verdict
    if (score < 60) verdict = "red";
    else if (score < 90) verdict = "yellow";
    else verdict = "green";

    return {
      verdict,
      reasons,
      score: Math.min(100, Math.max(0, score)),
    };
  }

  /**
   * Analyze consistency across multiple runs (stateful check)
   */
  classifyConsistency(
    currentResponse: InterceptedResponse,
    previousResponse?: InterceptedResponse,
  ): TrafficClassification {
    if (!previousResponse) {
      return { verdict: "green", reasons: ["First run"], score: 100 };
    }

    // Exact body match is suspicious for dynamic data (timestamps, nonces)
    if (
      currentResponse.body &&
      currentResponse.body === previousResponse.body
    ) {
      // Check if the body looks like it SHOULD have dynamic data
      if (
        currentResponse.body.includes("timestamp") ||
        currentResponse.body.includes("created_at") ||
        currentResponse.body.includes("nonce")
      ) {
        return {
          verdict: "yellow",
          reasons: [
            "Response body identical across runs despite containing timestamps",
          ],
          score: 70,
        };
      }
    }

    return {
      verdict: "green",
      reasons: ["Data varies or is static static-content"],
      score: 100,
    };
  }
}
