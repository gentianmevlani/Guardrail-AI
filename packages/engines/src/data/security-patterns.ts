/**
 * Regex patterns for SecurityPatternEngine — security anti-pattern detection.
 */

import {
  STRIPE_PK_LIVE_PREFIX,
  STRIPE_PK_TEST_PREFIX,
  STRIPE_TEST_PREFIX,
} from 'guardrail-security/secrets/stripe-placeholder-prefix';

// SEC001 — Unprotected API route: route handler without auth
export const ROUTE_HANDLER_RE =
  /(?:export\s+)?(?:async\s+)?function\s+(?:GET|POST|PUT|DELETE|PATCH)\s*\(|app\.(?:get|post|put|delete|patch)\s*\(|router\.(?:get|post|put|delete|patch)\s*\(/;

export const AUTH_PATTERNS = [
  /getServerSession|auth\s*\(|req\.user|req\.session|verifyToken|jwt\.verify|middleware.*auth|authMiddleware|requireAuth/i,
];

// SEC002 — Exposed secrets in client bundle
export const HARDCODED_SECRET_RE = new RegExp(
  `(?:sk-live-|${STRIPE_TEST_PREFIX}|${STRIPE_PK_LIVE_PREFIX}|${STRIPE_PK_TEST_PREFIX}|ghp_|gho_|xox[baprs]-)[a-zA-Z0-9_-]{20,}|['"][a-f0-9]{32}['"]|process\\.env\\.(STRIPE_SECRET_KEY|DATABASE_URL|JWT_SECRET|API_SECRET|PRIVATE_KEY)`,
  'i',
);

export const CLIENT_DIRS = ['app/', 'pages/', 'components/', 'src/components/'];

// SEC003 — Missing CSRF protection
export const BODY_READ_RE = /req\.body|request\.body/;
export const CSRF_CHECK_RE =
  /x-csrf-token|csrf|csurf|csrfProtection|_csrf/;

// SEC004 — SQL injection vector
export const SQL_INTERPOLATION_RE =
  /(?:db\.query|pool\.query|knex\.raw|prisma\.\$queryRaw|sequelize\.query)\s*\(\s*`[^`]*\$\{/;

// SEC005 — Insecure JWT configuration
export const JWT_WEAK_SECRET_RE = /jwt\.(?:sign|verify)\s*\(\s*[^,]+,\s*['"][^'"]{1,20}['"]/;
export const JWT_ALG_NONE_RE = /algorithms:\s*\[\s*['"]none['"]\s*\]/;

// SEC006 — Missing rate limiting on auth endpoint
export const AUTH_ROUTE_RE = /\/(?:login|signin|auth|register|signup|reset-password)/i;
export const RATE_LIMIT_RE = /rateLimit|rate-limit|express-rate-limit|limiter/;

// SEC007 — Unsafe redirect
export const UNSAFE_REDIRECT_RE = /(?:res|response)\.redirect\s*\(\s*req\.(?:query|params|body)\.[^)]+\)/;

// SEC008 — Missing Content-Security-Policy
export const HEADERS_SET_RE = /(?:res|response)\.(?:setHeader|set)\s*\(/;
export const CSP_HEADER_RE = /content-security-policy|Content-Security-Policy/;
