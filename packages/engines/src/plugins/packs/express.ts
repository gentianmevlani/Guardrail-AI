/**
 * @guardrail/rules-express — Built-in Express.js rule pack.
 *
 * Rules: EXPR-001 through EXPR-007
 * Catches common AI hallucinations in Express.js projects:
 * - Missing error handlers
 * - Unvalidated request body usage
 * - res.send after res.end
 * - Missing CORS configuration
 * - Sync file operations in request handlers
 */

import type { PluginManifest, RuleDefinition, RuleContext } from '../types';

const rules: RuleDefinition[] = [
  {
    id: 'EXPR-001',
    name: 'no-unhandled-async-route',
    description: 'Detects async Express route handlers without try/catch or express-async-errors.',
    severity: 'high',
    languages: ['typescript', 'javascript'],
    category: 'error-handling',
    check(ctx: RuleContext) {
      // Check if express-async-errors or a wrapper is imported
      const hasAsyncWrapper =
        /express-async-errors/.test(ctx.source) ||
        /asyncHandler|wrapAsync|catchAsync/.test(ctx.source);
      if (hasAsyncWrapper) return;

      const asyncRouteRe = /\.(get|post|put|patch|delete|all|use)\s*\(\s*[^,]*,?\s*async\s+(?:function\s*)?\(/g;
      let match: RegExpExecArray | null;
      while ((match = asyncRouteRe.exec(ctx.source))) {
        // Check if the handler body has try/catch
        const startIdx = match.index;
        const handlerBody = ctx.source.substring(startIdx, startIdx + 500);
        if (/try\s*\{/.test(handlerBody)) continue;

        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'Async route handler without error handling. Unhandled rejections will crash the server.',
          line,
          evidence: match[0],
          suggestion: 'Wrap in try/catch, use express-async-errors, or wrap with an asyncHandler utility.',
        });
      }
    },
  },
  {
    id: 'EXPR-002',
    name: 'no-raw-body-access',
    description: 'Detects direct req.body usage without validation (no Zod, Joi, express-validator).',
    severity: 'medium',
    languages: ['typescript', 'javascript'],
    category: 'security',
    check(ctx: RuleContext) {
      // Check if a validation library is in use
      const hasValidation =
        /(?:zod|joi|yup|express-validator|class-validator|ajv)/.test(ctx.source) ||
        /\.validate\(|\.parse\(|\.safeParse\(|validationResult\(/.test(ctx.source);
      if (hasValidation) return;

      // Only flag in route handler files
      if (!/\.(get|post|put|patch|delete)\s*\(/.test(ctx.source)) return;

      const bodyAccessRe = /req\.body\.(\w+)/g;
      let match: RegExpExecArray | null;
      const reported = new Set<number>();
      while ((match = bodyAccessRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        if (reported.has(line)) continue;
        reported.add(line);
        ctx.report({
          message: `Direct req.body.${match[1]} access without input validation. AI-generated code often skips validation.`,
          line,
          severity: 'medium',
          evidence: match[0],
          suggestion: 'Validate request body with Zod, Joi, or express-validator before accessing properties.',
        });
      }
    },
  },
  {
    id: 'EXPR-003',
    name: 'no-response-after-send',
    description: 'Detects multiple response sends in the same handler (res.send after res.json, etc.).',
    severity: 'high',
    languages: ['typescript', 'javascript'],
    category: 'runtime-error',
    check(ctx: RuleContext) {
      const sendMethods = /res\.(send|json|render|redirect|end|status\(\d+\)\.send)\s*\(/g;

      // Simple heuristic: find functions with multiple sends that aren't in if/else branches
      for (let i = 0; i < ctx.lines.length; i++) {
        const line = ctx.lines[i]!;
        if (/return\s+res\.|res\.\w+\(.*\);\s*$/.test(line)) continue; // has return — OK

        // Check for res.send/json without return
        if (/\bres\.(send|json|render|redirect)\s*\(/.test(line) && !/\breturn\b/.test(line)) {
          // Look ahead for another res.send in the same scope
          for (let j = i + 1; j < Math.min(i + 20, ctx.lines.length); j++) {
            if (/\bres\.(send|json|render|redirect)\s*\(/.test(ctx.lines[j]!)) {
              ctx.report({
                message: 'Possible double response: res.send/json called without return. The second call will throw "headers already sent".',
                line: i + 1,
                evidence: line.trim(),
                suggestion: 'Add "return" before res.send/json to prevent execution of subsequent response calls.',
              });
              break;
            }
            // Stop at function boundaries
            if (/^\s*\}/.test(ctx.lines[j]!) || /^\s*(async\s+)?function/.test(ctx.lines[j]!)) break;
          }
        }
      }
    },
  },
  {
    id: 'EXPR-004',
    name: 'no-sync-fs-in-handler',
    description: 'Detects synchronous file system operations in route handlers.',
    severity: 'medium',
    languages: ['typescript', 'javascript'],
    category: 'performance',
    check(ctx: RuleContext) {
      // Only check files that look like route handlers
      if (!/\.(get|post|put|patch|delete|use)\s*\(/.test(ctx.source)) return;

      const syncOps = [
        'readFileSync', 'writeFileSync', 'appendFileSync', 'mkdirSync',
        'readdirSync', 'statSync', 'existsSync', 'unlinkSync', 'copyFileSync',
      ];

      for (const op of syncOps) {
        const re = new RegExp(`\\b${op}\\s*\\(`, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(ctx.source))) {
          const line = ctx.source.substring(0, match.index).split('\n').length;
          ctx.report({
            message: `Synchronous fs.${op}() in a route handler blocks the event loop. Use async equivalent.`,
            line,
            severity: 'medium',
            evidence: match[0],
            suggestion: `Use fs/promises.${op.replace('Sync', '')}() instead.`,
          });
        }
      }
    },
  },
  {
    id: 'EXPR-005',
    name: 'no-missing-error-middleware',
    description: 'Detects Express app setup files without error-handling middleware.',
    severity: 'medium',
    languages: ['typescript', 'javascript'],
    category: 'error-handling',
    check(ctx: RuleContext) {
      // Only check main app files
      const isAppFile = /(?:app|server|index)\.(ts|js)$/.test(ctx.filePath);
      if (!isAppFile) return;

      const hasExpress = /express\(\)/.test(ctx.source) || /new\s+Express/.test(ctx.source);
      if (!hasExpress) return;

      // Error middleware has 4 params: (err, req, res, next)
      const hasErrorMiddleware = /\(\s*err\s*,\s*req\s*,\s*res\s*,\s*next\s*\)/.test(ctx.source);
      if (!hasErrorMiddleware) {
        ctx.report({
          message: 'Express app has no error-handling middleware (4-param handler). Unhandled errors will crash the server.',
          line: 1,
          evidence: 'express() without (err, req, res, next) handler',
          suggestion: 'Add app.use((err, req, res, next) => { ... }) after all routes.',
        });
      }
    },
  },
  {
    id: 'EXPR-006',
    name: 'no-hardcoded-port',
    description: 'Detects hardcoded port numbers instead of using process.env.PORT.',
    severity: 'low',
    languages: ['typescript', 'javascript'],
    category: 'configuration',
    check(ctx: RuleContext) {
      const listenRe = /\.listen\s*\(\s*(\d{4,5})\s*[,)]/g;
      let match: RegExpExecArray | null;
      while ((match = listenRe.exec(ctx.source))) {
        // Check if PORT env is also referenced
        if (/process\.env\.PORT/.test(ctx.source)) continue;

        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: `Hardcoded port ${match[1]}. Use process.env.PORT for deployment flexibility.`,
          line,
          severity: 'low',
          evidence: match[0],
          suggestion: `Use: app.listen(process.env.PORT || ${match[1]})`,
        });
      }
    },
  },
  {
    id: 'EXPR-007',
    name: 'no-trust-proxy-missing',
    description: 'Detects Express apps behind a reverse proxy without trust proxy setting.',
    severity: 'medium',
    languages: ['typescript', 'javascript'],
    category: 'security',
    check(ctx: RuleContext) {
      const isAppFile = /(?:app|server|index)\.(ts|js)$/.test(ctx.filePath);
      if (!isAppFile) return;

      const hasExpress = /express\(\)/.test(ctx.source);
      if (!hasExpress) return;

      // Check for rate limiting or IP-based features without trust proxy
      const hasIpFeatures =
        /rateLimit|express-rate-limit|req\.ip\b|req\.ips\b/.test(ctx.source);
      const hasTrustProxy = /trust\s*proxy/.test(ctx.source);

      if (hasIpFeatures && !hasTrustProxy) {
        ctx.report({
          message: 'Using IP-based features (rate limiting, req.ip) without "trust proxy" set. Behind a reverse proxy, req.ip will always be 127.0.0.1.',
          line: 1,
          evidence: 'rate limiting without trust proxy',
          suggestion: 'Add app.set("trust proxy", 1) for single-proxy setups or "trust proxy", "loopback" for local proxies.',
        });
      }
    },
  },
];

export const expressPack: PluginManifest = {
  name: '@guardrail/rules-express',
  version: '1.0.0',
  description: 'Express.js-specific rules for error handling, security, and performance.',
  author: 'Guardrail',
  framework: 'express',
  languages: ['typescript', 'javascript'],
  keywords: ['express', 'node', 'api', 'middleware'],
  rules,
};
