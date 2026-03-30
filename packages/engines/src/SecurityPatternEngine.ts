/**
 * SecurityPatternEngine — Detects security anti-patterns commonly produced by AI.
 * Rules: SEC001–SEC008 (unprotected routes, exposed secrets, CSRF, SQLi, JWT, rate limit, redirect, CSP)
 */

import { BaseEngine } from './base-engine.js';
import type { Finding, DeltaContext } from './core-types';
import {
  ROUTE_HANDLER_RE,
  AUTH_PATTERNS,
  HARDCODED_SECRET_RE,
  BODY_READ_RE,
  CSRF_CHECK_RE,
  SQL_INTERPOLATION_RE,
  JWT_WEAK_SECRET_RE,
  JWT_ALG_NONE_RE,
  AUTH_ROUTE_RE,
  RATE_LIMIT_RE,
  UNSAFE_REDIRECT_RE,
  HEADERS_SET_RE,
  CSP_HEADER_RE,
} from './data/security-patterns.js';

export class SecurityPatternEngine extends BaseEngine {
  readonly id = 'security-pattern';
  readonly name = 'Security Pattern Engine';
  readonly version = '1.0.0';
  readonly supportedExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

  async scan(delta: DeltaContext, signal: AbortSignal): Promise<Finding[]> {
    const findings: Finding[] = [];
    const source = delta.fullText;
    const uri = delta.documentUri.replace(/^file:\/\//, '');
    const lines = source.split('\n');

    this.checkAbort(signal);

    const isClientFile = /(?:^|\/)(?:app|pages|components)\//.test(uri);
    const hasCsrf = CSRF_CHECK_RE.test(source);
    const hasRateLimit = RATE_LIMIT_RE.test(source);
    const hasCsp = CSP_HEADER_RE.test(source);
    const hasStateChange = /\.(post|put|delete|patch)\s*\(/i.test(source);
    let sec003Added = false;
    let sec006Added = false;
    let sec008Added = false;

    for (let i = 0; i < lines.length; i++) {
      this.checkAbort(signal);
      const line = lines[i]!;
      const lineNum = i + 1;

      // SEC001 — Unprotected API route
      if (ROUTE_HANDLER_RE.test(line)) {
        const hasAuth = AUTH_PATTERNS.some((p) => source.match(p));
        if (!hasAuth) {
          findings.push(
            this.createFinding({
              id: this.deterministicId(uri, lineNum, 0, 'SEC001', 'route'),
              ruleId: 'SEC001',
              category: 'security',
              message: 'Route handler without authentication check',
              severity: 'high',
              confidence: 0.85,
              file: uri,
              line: lineNum,
              column: 0,
              evidence: line.trim().slice(0, 60),
              suggestion: 'Add auth middleware, getServerSession, or JWT verification',
              autoFixable: false,
            })
          );
        }
      }

      // SEC002 — Exposed secrets in client bundle
      if (isClientFile && HARDCODED_SECRET_RE.test(line)) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC002', 'secret'),
            ruleId: 'SEC002',
            category: 'security',
            message: 'Hardcoded secret or server env var in client-side file',
            severity: 'critical',
            confidence: 0.95,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: '[REDACTED]',
            suggestion: 'Move secrets to server-only code; use env vars only on server',
            autoFixable: false,
          })
        );
      }

      // SEC003 — Missing CSRF protection
      if (
        !sec003Added &&
        BODY_READ_RE.test(line) &&
        !hasCsrf &&
        hasStateChange
      ) {
        sec003Added = true;
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC003', 'csrf'),
            ruleId: 'SEC003',
            category: 'security',
            message: 'State-changing handler without CSRF token check',
            severity: 'medium',
            confidence: 0.75,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Verify x-csrf-token header or use csurf middleware',
            autoFixable: false,
          })
        );
      }

      // SEC004 — SQL injection vector
      if (SQL_INTERPOLATION_RE.test(line)) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC004', 'sqli'),
            ruleId: 'SEC004',
            category: 'security',
            message: 'SQL query with string interpolation — possible injection',
            severity: 'critical',
            confidence: 0.9,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Use parameterized queries or prepared statements',
            autoFixable: false,
          })
        );
      }

      // SEC005 — Insecure JWT configuration
      if (JWT_WEAK_SECRET_RE.test(line) || JWT_ALG_NONE_RE.test(line)) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC005', 'jwt'),
            ruleId: 'SEC005',
            category: 'security',
            message: 'Weak or hardcoded JWT secret; or algorithm "none" allowed',
            severity: 'critical',
            confidence: 0.9,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Use strong secret from env; disallow "none" algorithm',
            autoFixable: false,
          })
        );
      }

      // SEC006 — Missing rate limiting on auth endpoint
      if (!sec006Added && AUTH_ROUTE_RE.test(line) && !hasRateLimit) {
        sec006Added = true;
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC006', 'ratelimit'),
            ruleId: 'SEC006',
            category: 'security',
            message: 'Auth endpoint without rate limiting',
            severity: 'high',
            confidence: 0.8,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Add rate limiting middleware (e.g. express-rate-limit)',
            autoFixable: false,
          })
        );
      }

      // SEC007 — Unsafe redirect
      if (UNSAFE_REDIRECT_RE.test(line)) {
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC007', 'redirect'),
            ruleId: 'SEC007',
            category: 'security',
            message: 'Redirect using unvalidated user input — open redirect risk',
            severity: 'high',
            confidence: 0.9,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Validate redirect URL against allowlist before redirecting',
            autoFixable: false,
          })
        );
      }

      // SEC008 — Missing Content-Security-Policy (informational)
      if (
        !sec008Added &&
        HEADERS_SET_RE.test(line) &&
        !hasCsp &&
        /middleware|middleware\.(ts|js)/.test(uri)
      ) {
        sec008Added = true;
        findings.push(
          this.createFinding({
            id: this.deterministicId(uri, lineNum, 0, 'SEC008', 'csp'),
            ruleId: 'SEC008',
            category: 'security',
            message: 'Middleware sets headers but no Content-Security-Policy',
            severity: 'low',
            confidence: 0.6,
            file: uri,
            line: lineNum,
            column: 0,
            evidence: line.trim().slice(0, 60),
            suggestion: 'Consider adding Content-Security-Policy header',
            autoFixable: false,
          })
        );
      }
    }

    return findings;
  }
}
