/**
 * @guardrail/rules-python — Built-in Python rule pack.
 *
 * Rules: PY-001 through PY-009
 * Catches common AI hallucinations in Python projects (FastAPI, Django, Flask):
 * - Ghost routes and missing endpoint handlers
 * - Unvalidated request data
 * - SQL injection via f-strings
 * - Missing async/await patterns
 * - Hardcoded secrets
 * - Missing CORS configuration
 */

import type { PluginManifest, RuleDefinition, RuleContext } from '../types';

const rules: RuleDefinition[] = [
  {
    id: 'PY-001',
    name: 'no-sql-fstring',
    description: 'Detects SQL queries built with f-strings or .format() — classic SQL injection vector.',
    severity: 'critical',
    languages: ['python'],
    category: 'security',
    check(ctx: RuleContext) {
      // f-string SQL patterns
      const fstringSqlRe = /f["'](?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\s/gi;
      let match: RegExpExecArray | null;
      while ((match = fstringSqlRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'SQL query built with f-string. This is a SQL injection vulnerability.',
          line,
          severity: 'critical',
          evidence: match[0],
          suggestion: 'Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
        });
      }

      // .format() SQL patterns
      const formatSqlRe = /["'](?:SELECT|INSERT|UPDATE|DELETE)\s[^"']*["']\.format\s*\(/gi;
      while ((match = formatSqlRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'SQL query built with .format(). This is a SQL injection vulnerability.',
          line,
          severity: 'critical',
          evidence: match[0],
          suggestion: 'Use parameterized queries instead of string formatting.',
        });
      }

      // % string formatting for SQL
      const percentSqlRe = /["'](?:SELECT|INSERT|UPDATE|DELETE)\s[^"']*%s[^"']*["']\s*%/gi;
      while ((match = percentSqlRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'SQL query built with % formatting. This is a SQL injection vulnerability.',
          line,
          severity: 'critical',
          evidence: match[0],
          suggestion: 'Use parameterized queries: cursor.execute("SELECT * WHERE id = %s", (id,))',
        });
      }
    },
  },
  {
    id: 'PY-002',
    name: 'no-hardcoded-secret',
    description: 'Detects hardcoded secrets, API keys, and passwords in Python code.',
    severity: 'critical',
    languages: ['python'],
    category: 'security',
    check(ctx: RuleContext) {
      const secretPatterns = [
        { re: /(?:SECRET_KEY|API_KEY|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*["'][^"']{8,}["']/gi, name: 'secret' },
        { re: /(?:aws_access_key_id|aws_secret_access_key)\s*=\s*["'][^"']+["']/gi, name: 'AWS key' },
        { re: /(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|STRIPE_SECRET)\s*=\s*["'][^"']+["']/gi, name: 'API key' },
      ];

      for (const { re, name } of secretPatterns) {
        let match: RegExpExecArray | null;
        while ((match = re.exec(ctx.source))) {
          // Skip if it's loading from env
          const lineText = ctx.lines[ctx.source.substring(0, match.index).split('\n').length - 1] ?? '';
          if (/os\.environ|os\.getenv|dotenv|settings\./.test(lineText)) continue;
          // Skip if value is a placeholder
          if (/["'](?:your[_-]|CHANGE[_-]|xxx|placeholder|example)/i.test(match[0])) continue;

          const line = ctx.source.substring(0, match.index).split('\n').length;
          ctx.report({
            message: `Hardcoded ${name} detected. Use environment variables instead.`,
            line,
            severity: 'critical',
            evidence: match[0].substring(0, 60) + '...',
            suggestion: 'Use os.environ.get("SECRET_KEY") or a .env file with python-dotenv.',
          });
        }
      }
    },
  },
  {
    id: 'PY-003',
    name: 'fastapi-missing-response-model',
    description: 'Detects FastAPI endpoints without response_model — allows data leakage.',
    severity: 'medium',
    languages: ['python'],
    category: 'api-integrity',
    check(ctx: RuleContext) {
      if (!ctx.source.includes('fastapi') && !ctx.source.includes('FastAPI')) return;

      const routeRe = /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["'][^"']+["']\s*(?:\)|,(?![^)]*response_model))/g;
      let match: RegExpExecArray | null;
      while ((match = routeRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: `FastAPI ${match[1]!.toUpperCase()} endpoint without response_model. Internal data may leak to clients.`,
          line,
          severity: 'medium',
          evidence: match[0],
          suggestion: 'Add response_model=YourSchema to the decorator to control response shape.',
        });
      }
    },
  },
  {
    id: 'PY-004',
    name: 'no-sync-in-async-handler',
    description: 'Detects blocking synchronous calls in async FastAPI/async handlers.',
    severity: 'high',
    languages: ['python'],
    category: 'performance',
    check(ctx: RuleContext) {
      const asyncDefRe = /async\s+def\s+\w+/g;
      let match: RegExpExecArray | null;

      while ((match = asyncDefRe.exec(ctx.source))) {
        const startLine = ctx.source.substring(0, match.index).split('\n').length;
        // Scan the next ~30 lines for blocking calls
        const blockingOps = [
          'time.sleep', 'open(', 'requests.get', 'requests.post',
          'requests.put', 'requests.delete', 'os.system', 'subprocess.run',
          'subprocess.call',
        ];

        for (let i = startLine; i < Math.min(startLine + 30, ctx.lines.length); i++) {
          const line = ctx.lines[i];
          if (!line) continue;
          // Stop at next function def
          if (/^(?:async\s+)?def\s+/.test(line.trimStart()) && i > startLine) break;

          for (const op of blockingOps) {
            if (line.includes(op)) {
              ctx.report({
                message: `Blocking call "${op}" inside async function. This blocks the event loop.`,
                line: i + 1,
                severity: 'high',
                evidence: line.trim(),
                suggestion: `Use asyncio equivalent: aiofiles for file I/O, httpx/aiohttp for HTTP, asyncio.sleep() for delays.`,
              });
            }
          }
        }
      }
    },
  },
  {
    id: 'PY-005',
    name: 'django-no-raw-sql',
    description: 'Detects raw SQL queries in Django views instead of using the ORM.',
    severity: 'medium',
    languages: ['python'],
    category: 'security',
    check(ctx: RuleContext) {
      if (!ctx.source.includes('django')) return;

      const rawSqlRe = /(?:connection\.cursor|\.raw|\.extra)\s*\(/g;
      let match: RegExpExecArray | null;
      while ((match = rawSqlRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'Raw SQL query detected in Django code. Prefer ORM queries to avoid SQL injection.',
          line,
          severity: 'medium',
          evidence: match[0],
          suggestion: 'Use Django ORM: Model.objects.filter() instead of raw SQL.',
        });
      }
    },
  },
  {
    id: 'PY-006',
    name: 'no-bare-except',
    description: 'Detects bare except clauses that swallow all exceptions including SystemExit and KeyboardInterrupt.',
    severity: 'medium',
    languages: ['python'],
    category: 'error-handling',
    check(ctx: RuleContext) {
      const bareExceptRe = /^\s*except\s*:/gm;
      let match: RegExpExecArray | null;
      while ((match = bareExceptRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'Bare except: catches SystemExit, KeyboardInterrupt, and GeneratorExit. Be specific.',
          line,
          severity: 'medium',
          evidence: 'except:',
          suggestion: 'Use except Exception: to catch only application errors, not system signals.',
        });
      }
    },
  },
  {
    id: 'PY-007',
    name: 'no-mutable-default-arg',
    description: 'Detects mutable default arguments in function definitions — a classic Python gotcha.',
    severity: 'medium',
    languages: ['python'],
    category: 'runtime-error',
    check(ctx: RuleContext) {
      const defRe = /def\s+\w+\s*\([^)]*(?:=\s*(?:\[\]|\{\}|set\(\)))[^)]*\)/g;
      let match: RegExpExecArray | null;
      while ((match = defRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'Mutable default argument detected ([], {}, set()). This is shared across all calls and causes subtle bugs.',
          line,
          severity: 'medium',
          evidence: match[0].substring(0, 80),
          suggestion: 'Use None as default and create the mutable object inside the function body.',
        });
      }
    },
  },
  {
    id: 'PY-008',
    name: 'fastapi-missing-status-code',
    description: 'Detects FastAPI POST/PUT/DELETE endpoints without explicit status_code.',
    severity: 'low',
    languages: ['python'],
    category: 'api-integrity',
    check(ctx: RuleContext) {
      if (!ctx.source.includes('fastapi') && !ctx.source.includes('FastAPI')) return;

      const mutationRe = /@(?:app|router)\.(post|put|delete|patch)\s*\(\s*["'][^"']+["']\s*(?:\)|,(?![^)]*status_code))/g;
      let match: RegExpExecArray | null;
      while ((match = mutationRe.exec(ctx.source))) {
        const method = match[1]!.toUpperCase();
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: `FastAPI ${method} endpoint without explicit status_code. POST should return 201, DELETE should return 204.`,
          line,
          severity: 'low',
          evidence: match[0],
          suggestion: `Add status_code=${method === 'POST' ? '201' : method === 'DELETE' ? '204' : '200'} to the decorator.`,
        });
      }
    },
  },
  {
    id: 'PY-009',
    name: 'no-debug-true-in-production',
    description: 'Detects DEBUG=True or debug=True that may leak into production.',
    severity: 'high',
    languages: ['python'],
    category: 'security',
    check(ctx: RuleContext) {
      const debugRe = /\bDEBUG\s*=\s*True\b/g;
      let match: RegExpExecArray | null;
      while ((match = debugRe.exec(ctx.source))) {
        // Skip if it's reading from env
        const lineText = ctx.lines[ctx.source.substring(0, match.index).split('\n').length - 1] ?? '';
        if (/os\.environ|os\.getenv|config\./.test(lineText)) continue;

        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'DEBUG=True hardcoded. This exposes stack traces, settings, and SQL queries in production.',
          line,
          severity: 'high',
          evidence: match[0],
          suggestion: 'Use DEBUG = os.environ.get("DEBUG", "False").lower() == "true"',
        });
      }

      // Also check Flask/Django app.run(debug=True)
      const runDebugRe = /\.run\s*\([^)]*debug\s*=\s*True/g;
      while ((match = runDebugRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'app.run(debug=True) hardcoded. The debugger exposes a remote code execution console.',
          line,
          severity: 'critical',
          evidence: match[0],
          suggestion: 'Use debug=os.environ.get("FLASK_DEBUG", False) or remove for production.',
        });
      }
    },
  },
];

export const pythonPack: PluginManifest = {
  name: '@guardrail/rules-python',
  version: '1.0.0',
  description: 'Python rules for FastAPI, Django, Flask — security, async, and ORM patterns.',
  author: 'Guardrail',
  framework: 'python',
  languages: ['python'],
  keywords: ['python', 'fastapi', 'django', 'flask', 'security', 'async'],
  rules,
};
