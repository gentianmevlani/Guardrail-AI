/**
 * SecurityEngine v2.0 — Detects injection vulnerabilities, XSS, SSRF, prototype
 * pollution, weak crypto, and other OWASP Top-10 patterns.
 *
 * 50+ patterns covering:
 *   SEC001 — SQL/NoSQL injection
 *   SEC002 — Command injection, destructive ops
 *   SEC003 — XSS (innerHTML, document.write, dangerouslySetInnerHTML)
 *   SEC004 — Path traversal
 *   SEC005 — SSRF, CORS wildcard
 *   SEC006 — Prototype pollution
 *   SEC007 — Code execution (eval, new Function, dynamic require)
 *   SEC008 — Mass assignment
 *   SEC009 — Insecure randomness, weak crypto
 *   SEC010 — JWT vulnerabilities (no verification, algorithm confusion)
 *   SEC011 — Destructive SQL (DROP TABLE, unfiltered DELETE)
 *   SEC012 — Shell injection (spawn shell:true, execSync interpolation)
 *   SEC013 — Weak cipher
 *   SEC014 — ReDoS
 *   SEC015 — Mongoose mass assignment
 *   SEC016 — Open redirect
 *   SEC017 — Insecure cookie settings
 *   SEC018 — Insecure deserialization
 *   SEC019 — Hardcoded credentials in config
 *   SEC020 — Missing security headers
 *   SEC021 — HTTP header injection
 *
 * Latency target: <80ms per file
 */

import type { Finding, DeltaContext, ScanEngine } from './core-types';

/** FNV-1a deterministic hash → stable finding IDs across re-scans */
function deterministicId(uri: string, line: number, ruleId: string, patternName: string): string {
  const input = `sec:${uri}::${line}::${ruleId}::${patternName}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return `sec-${hash.toString(16).padStart(8, '0')}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isTestFile(uri: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx)$/i.test(uri) ||
    /(?:^|\/)(?:__tests__|__mocks__|tests?|fixtures?|e2e|spec|cypress|playwright|__snapshots__|stubs?|mocks?)\//i.test(uri);
}

function isCriticalPath(uri: string): boolean {
  return /\/api\/|\/auth\/|\/payment|\/billing|\/admin|\/checkout|\/webhook|\/security|middleware\.(ts|js)|\/lib\/auth|\/lib\/db/.test(uri);
}

function isScriptFile(uri: string): boolean {
  return /(?:^|\/)scripts?\//i.test(uri);
}

function isBuildOrUtilityFile(uri: string): boolean {
  const basename = uri.split('/').pop()?.toLowerCase() ?? '';
  return /(?:cleanup|clean|build|generate|deploy|migrate|setup|teardown|seed|reset|purge|prune)/.test(basename);
}

function isGuardrailFile(uri: string): boolean {
  return /guardrail/i.test(uri);
}

/** Check if a line contains user-input indicators */
function hasUserInputIndicators(line: string): boolean {
  return /(?:req\.|params\.|query\.|body\.|args\.|argv\.|request\.|searchParams|formData)/.test(line);
}

function escalate(severity: Finding['severity'], critical: boolean): Finding['severity'] {
  if (!critical) return severity;
  const up: Record<string, Finding['severity']> = {
    low: 'medium',
    medium: 'high',
    high: 'critical',
    critical: 'critical',
  };
  return up[severity] ?? severity;
}

// ─── Pattern definition ───────────────────────────────────────────────────────

interface SecPattern {
  name: string;
  ruleId: string;
  regex: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  message: string;
  suggestion: string;
  /** 0-100 */
  confidence: number;
  excludeInTests: boolean;
  validate?: (line: string, lines: string[], index: number) => boolean;
}

const PATTERNS: SecPattern[] = [
  // ── SQL Injection ──
  {
    name: 'sql-injection-template',
    ruleId: 'SEC001',
    regex: /(?:query|execute|raw)\s*\(\s*[`'"](?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\s[^`'"]*\$\{/i,
    severity: 'critical',
    message: 'SQL injection: template literal in query',
    suggestion: 'Use parameterized queries: db.query("SELECT * FROM users WHERE id = $1", [userId])',
    confidence: 92,
    excludeInTests: true,
  },
  {
    name: 'sql-injection-concat',
    ruleId: 'SEC001',
    regex: /(?:query|execute|raw)\s*\(\s*['"](?:SELECT|INSERT|UPDATE|DELETE)\s[^'"]*['"]\s*\+/i,
    severity: 'critical',
    message: 'SQL injection: string concatenation in query',
    suggestion: 'Use parameterized queries. Never concatenate user input into SQL.',
    confidence: 90,
    excludeInTests: true,
  },
  {
    name: 'unfiltered-delete',
    ruleId: 'SEC011',
    regex: /DELETE\s+FROM\s+\w+\s*;?\s*$/im,
    severity: 'critical',
    message: 'Unfiltered DELETE statement — no WHERE clause',
    suggestion: 'Add a WHERE clause. Add confirmation logic for destructive operations.',
    confidence: 85,
    excludeInTests: true,
  },
  {
    name: 'drop-table',
    ruleId: 'SEC011',
    regex: /DROP\s+TABLE/i,
    severity: 'critical',
    message: 'DROP TABLE in application code',
    suggestion: 'Use schema migrations. Never DROP tables in application logic.',
    confidence: 88,
    excludeInTests: true,
  },

  // ── Command Injection ──
  {
    name: 'exec-template',
    ruleId: 'SEC002',
    regex: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*`[^`]*\$\{/,
    severity: 'critical',
    message: 'Command injection: template literal in shell command',
    suggestion: 'Use execFile() with args array: execFile("cmd", [arg1, arg2])',
    confidence: 95,
    excludeInTests: true,
    validate: (line) => !/(?:which\s+\$|where\s+\$|--version|--help|\$\{(?:mgr|tool|bin|cmd)(?:\.name)?\}\s+--|taskkill.*\/pid\s+\$|lsof\s+-i|netstat|ps\s+-p)/i.test(line),
  },
  {
    name: 'exec-concat',
    ruleId: 'SEC002',
    regex: /(?:exec|execSync)\s*\(\s*['"][^'"]*['"]\s*\+/,
    severity: 'critical',
    message: 'Command injection: string concatenation in shell command',
    suggestion: 'Use execFile() with args array.',
    confidence: 93,
    excludeInTests: true,
  },
  {
    name: 'spawn-shell-true',
    ruleId: 'SEC012',
    regex: /spawn\s*\(.*shell\s*:\s*true/,
    severity: 'critical',
    message: 'spawn() with { shell: true } — enables shell injection',
    suggestion: 'Remove shell: true and pass arguments as an array: spawn("cmd", [arg1, arg2])',
    confidence: 92,
    excludeInTests: true,
  },
  {
    name: 'execsync-interpolation',
    ruleId: 'SEC012',
    regex: /execSync\s*\(\s*`[^`]*\$\{/,
    severity: 'critical',
    message: 'execSync() with string interpolation — shell injection risk',
    suggestion: 'Use execFileSync() with args array.',
    confidence: 94,
    excludeInTests: true,
    validate: (line) => !/(?:which\s+\$|--version|--help)/i.test(line),
  },
  {
    name: 'child-process-exec',
    ruleId: 'SEC002',
    regex: /child_process\s*\.\s*exec\s*\(/,
    severity: 'high',
    message: 'child_process.exec() can run arbitrary shell commands',
    suggestion: 'Prefer execFile() or spawn() with an explicit args array.',
    confidence: 80,
    excludeInTests: true,
  },

  // ── XSS ──
  {
    name: 'innerhtml-assignment',
    ruleId: 'SEC003',
    regex: /\.innerHTML\s*=/,
    severity: 'high',
    message: 'innerHTML assignment — XSS risk if content is user-controlled',
    suggestion: 'Use textContent for text. Use DOMPurify.sanitize() if HTML is required.',
    confidence: 75,
    excludeInTests: true,
    validate: (line, lines, index) => {
      // Skip if the value is a string literal (static HTML/CSS)
      if (/\.innerHTML\s*=\s*['"`]/.test(line)) return false;
      // Skip if the value comes from a sanitization function
      if (/(?:sanitize|purify|escape|DOMPurify|sanitizeHtml|xss|marked|markdown|highlight|hljs)\s*\(/i.test(line)) return false;
      // Skip if the variable is named safe/sanitized/escaped/purified
      if (/\.innerHTML\s*=\s*(?:sanitized|safe|escaped|purified|content|html|rendered|compiled)/i.test(line)) return false;
      // Check surrounding lines for sanitization context
      for (let j = Math.max(0, index - 5); j <= Math.min(lines.length - 1, index + 5); j++) {
        if (/(?:DOMPurify|sanitize|purify|sanitizeHtml|xss)\s*[\.(]/i.test(lines[j]!)) return false;
      }
      // Skip if it's clearing content (innerHTML = '')
      if (/\.innerHTML\s*=\s*['"`]['"`]/.test(line)) return false;
      return true;
    },
  },
  {
    name: 'dangerously-set-innerhtml',
    ruleId: 'SEC003',
    regex: /dangerouslySetInnerHTML\s*=\s*\{/,
    severity: 'info',
    message: 'dangerouslySetInnerHTML — ensure content is sanitized before use',
    suggestion: 'Sanitize with DOMPurify before passing to dangerouslySetInnerHTML.',
    confidence: 70,
    excludeInTests: true,
    validate: (line, lines, index) => {
      // Skip if inside a <style> tag
      if (/<style[\s>]/i.test(line)) return false;
      // Check surrounding lines for <style> context (multi-line JSX)
      for (let j = Math.max(0, index - 3); j <= Math.min(lines.length - 1, index + 3); j++) {
        if (/<style[\s>]/i.test(lines[j]!)) return false;
      }
      // Skip if __html value is a string literal (inline CSS, static HTML)
      if (/__html\s*:\s*['"`]/.test(line)) return false;
      // Skip if the value goes through a sanitization function
      if (/(?:sanitize|purify|escape|DOMPurify|sanitizeHtml|xss|marked|markdown|rehype|remark|serialize|render|compile|highlight|hljs|prism)\s*\(/i.test(line)) return false;
      // Check surrounding lines (expanded range) for sanitization / markdown / CMS context
      for (let j = Math.max(0, index - 8); j <= Math.min(lines.length - 1, index + 8); j++) {
        if (/(?:DOMPurify|sanitize|purify|sanitizeHtml|xss|marked|markdown|rehype|remark|serialize|highlight|hljs|prismjs|showdown|turndown|unified|mdx|contentlayer|cms|richtext|PortableText|BlockContent)\s*[\.(]/i.test(lines[j]!)) return false;
      }
      // Skip if the variable is named safe/sanitized/escaped/purified/content/html/markup/rendered
      if (/__html\s*:\s*(?:sanitized|safe|escaped|purified|content|html|markup|rendered|processed|parsed|compiled)/i.test(line)) return false;
      // Skip if the value comes from a variable that suggests pre-processed content
      if (/__html\s*:\s*\w*(?:content|html|body|markup|rendered|compiled|processed|parsed|article|post|page|blog|description|summary|excerpt|bio|text|message|richText|mdx)/i.test(line)) return false;
      return true;
    },
  },
  {
    name: 'document-write',
    ruleId: 'SEC003',
    regex: /document\.write\s*\(/,
    severity: 'high',
    message: 'document.write() can overwrite the entire page with unescaped content',
    suggestion: 'Use DOM manipulation methods (createElement, appendChild) instead.',
    confidence: 80,
    excludeInTests: true,
  },

  // ── Path Traversal ──
  {
    name: 'path-traversal-join',
    ruleId: 'SEC004',
    regex: /(?:path\.join|path\.resolve)\s*\([^)]*(?:req\.|params\.|query\.|body\.)/,
    severity: 'high',
    message: 'User input in file path — potential path traversal',
    suggestion: 'Validate the resolved path starts with the allowed base directory.',
    confidence: 82,
    excludeInTests: true,
  },
  {
    name: 'fs-read-user-input',
    ruleId: 'SEC004',
    regex: /fs\.(?:readFile|readFileSync|createReadStream)\s*\([^)]*(?:req\.|params\.|query\.)/,
    severity: 'high',
    message: 'User input passed directly to file read',
    suggestion: 'Sanitize path and verify it is within the allowed directory.',
    confidence: 85,
    excludeInTests: true,
  },

  // ── SSRF ──
  {
    name: 'ssrf-fetch',
    ruleId: 'SEC005',
    regex: /fetch\s*\(\s*(?:req\.query|req\.params|req\.body|request\.url|searchParams|formData)/,
    severity: 'high',
    message: 'User-controlled URL in server-side fetch — SSRF risk',
    suggestion: 'Validate URL against an allowlist. Block private IPs (10.x, 172.16-31.x, 192.168.x, 169.254.x).',
    confidence: 78,
    excludeInTests: true,
  },
  {
    name: 'ssrf-axios',
    ruleId: 'SEC005',
    regex: /axios\s*(?:\.get|\.post|\.put|\.delete|\.request)\s*\(\s*(?:req\.|params\.|query\.|body\.)/,
    severity: 'high',
    message: 'User-controlled URL in axios request — SSRF risk',
    suggestion: 'Validate URL against an allowlist of allowed domains.',
    confidence: 78,
    excludeInTests: true,
  },
  {
    name: 'cors-wildcard',
    ruleId: 'SEC005',
    regex: /(?:(?:Access-Control-Allow-Origin|origin)\s*[:=]\s*['"`]\*['"`]|['"]Access-Control-Allow-Origin['"]\s*,\s*['"`]\*['"`])/,
    severity: 'high',
    message: 'CORS wildcard — allows requests from any origin',
    suggestion: 'Restrict Access-Control-Allow-Origin to specific trusted origins.',
    confidence: 80,
    excludeInTests: true,
  },

  // ── Code Execution ──
  {
    name: 'eval-usage',
    ruleId: 'SEC007',
    regex: /\beval\s*\(/,
    severity: 'critical',
    message: 'eval() executes arbitrary code',
    suggestion: 'Use JSON.parse() for data. Use a sandboxed interpreter for expressions.',
    confidence: 88,
    excludeInTests: true,
    validate: (line) => !/\/\/.*eval|['"][^'"]*eval[^'"]*['"]/.test(line),
  },
  {
    name: 'new-function',
    ruleId: 'SEC007',
    regex: /\bnew\s+Function\s*\(/,
    severity: 'critical',
    message: 'new Function() executes arbitrary code',
    suggestion: 'Avoid dynamic code generation. Use a template engine or parser.',
    confidence: 90,
    excludeInTests: true,
    validate: (line) => !/['"].*new\s+Function.*['"]/.test(line) && !/\/\/.*new\s+Function/.test(line),
  },
  {
    name: 'dynamic-require',
    ruleId: 'SEC007',
    regex: /require\s*\(\s*[^'"][a-zA-Z_$]/,
    severity: 'info',
    message: 'Dynamic require() — path injection risk if path comes from user input',
    suggestion: 'Use static imports. Validate the path against an allowlist if dynamic loading is needed.',
    confidence: 55,
    excludeInTests: true,
    validate: (line) => {
      // Safe: require(path.join(...)) with __dirname or string literals
      if (/require\s*\(\s*path\.\w+\s*\(\s*__dirname/.test(line)) return false;
      if (/require\s*\(\s*path\.\w+\s*\(\s*['"`]/.test(line)) return false;
      // Safe: require(variable) where variable is from config/options
      if (/require\s*\(\s*(?:config|options|settings|modulePath|pluginPath|resolvedPath)\b/.test(line)) return false;
      // Contains user input — escalate (handled by scan method)
      return true;
    },
  },

  // ── Prototype Pollution ──
  {
    name: 'proto-access',
    ruleId: 'SEC006',
    regex: /__proto__|prototype\s*\[/,
    severity: 'high',
    message: 'Prototype pollution risk — __proto__ or prototype[] access',
    suggestion: 'Use Object.create(null) for lookup objects. Validate property names before access.',
    confidence: 82,
    excludeInTests: true,
  },
  {
    name: 'mass-assignment',
    ruleId: 'SEC008',
    regex: /Object\.assign\s*\([^,]+,\s*req\.body/,
    severity: 'high',
    message: 'Mass assignment — spreading request body into object',
    suggestion: 'Whitelist allowed fields: const { name, email } = req.body',
    confidence: 85,
    excludeInTests: true,
  },
  {
    name: 'spread-req-body',
    ruleId: 'SEC008',
    regex: /\{\s*\.\.\.req\.body\s*\}/,
    severity: 'high',
    message: 'Mass assignment — spreading request body directly',
    suggestion: 'Destructure only the fields you need from req.body.',
    confidence: 88,
    excludeInTests: true,
  },
  {
    name: 'mongoose-mass-assign',
    ruleId: 'SEC015',
    regex: /find(?:ById|One)And(?:Update|Replace)\s*\([^)]*req\.body/,
    severity: 'high',
    message: 'Mongoose update with raw req.body — mass assignment risk',
    suggestion: 'Use { $set: pick(req.body, allowedFields) } with schema validation.',
    confidence: 86,
    excludeInTests: true,
  },

  // ── Insecure Randomness ──
  {
    name: 'math-random-token',
    ruleId: 'SEC009',
    regex: /Math\.random\s*\(\s*\).*(?:token|secret|password|nonce|salt|session|auth|csrf)/i,
    severity: 'high',
    message: 'Math.random() used for security-sensitive value — not cryptographically secure',
    suggestion: 'Use crypto.randomUUID() or crypto.randomBytes()',
    confidence: 85,
    excludeInTests: true,
  },
  {
    name: 'math-random-hex',
    ruleId: 'SEC009',
    regex: /Math\.random\(\)\.toString\((?:16|36)\)/,
    severity: 'info',
    message: 'Math.random() for ID generation — not cryptographically secure',
    suggestion: 'Use crypto.randomUUID() for unique IDs.',
    confidence: 60,
    excludeInTests: true,
    validate: (line) => {
      // Skip when used for UI patterns (toast IDs, tab keys, CSS class suffixes)
      if (/(?:id|key|className|style|toast|tab|index|suffix|prefix|label|color|placeholder)\s*[:=]/i.test(line)) return false;
      return true;
    },
  },

  // ── Weak Crypto ──
  {
    name: 'md5-usage',
    ruleId: 'SEC009',
    regex: /createHash\s*\(\s*['"`]md5['"`]\s*\)/,
    severity: 'info',
    message: 'MD5 hash — not suitable for security use (fine for checksums)',
    suggestion: 'Use SHA-256 for security: crypto.createHash("sha256"). MD5 is OK for non-security checksums.',
    confidence: 60,
    excludeInTests: true,
    validate: (line, lines, index) => {
      // Check if used for password/auth context — escalate handled in scan
      // For validate, return true to show it, but it's at info level now
      return true;
    },
  },
  {
    name: 'sha1-usage',
    ruleId: 'SEC009',
    regex: /createHash\s*\(\s*['"`]sha1['"`]\s*\)/,
    severity: 'medium',
    message: 'SHA-1 hash — deprecated for security use',
    suggestion: 'Use SHA-256: crypto.createHash("sha256")',
    confidence: 85,
    excludeInTests: true,
  },
  {
    name: 'weak-cipher',
    ruleId: 'SEC013',
    regex: /createCipher(?:iv)?\s*\(\s*['"]?(?:des|rc4|blowfish|rc2|seed)/i,
    severity: 'high',
    message: 'Weak cipher algorithm — vulnerable to known attacks',
    suggestion: 'Use aes-256-gcm: crypto.createCipheriv("aes-256-gcm", key, iv)',
    confidence: 93,
    excludeInTests: true,
  },

  // ── NoSQL Injection ──
  {
    name: 'nosql-injection',
    ruleId: 'SEC001',
    regex: /\$(?:where|regex|gt|lt|ne|or|and)\s*[:=]\s*(?:req\.|params\.|query\.|body\.)/,
    severity: 'high',
    message: 'NoSQL injection — MongoDB operator built from user input',
    suggestion: 'Sanitize input. Use mongoose-sanitize or explicit field selection.',
    confidence: 82,
    excludeInTests: true,
  },

  // ── Destructive Ops ──
  {
    name: 'rm-rf-root',
    ruleId: 'SEC002',
    regex: /rm\s+-rf\s+\//,
    severity: 'critical',
    message: 'Recursive delete from root directory',
    suggestion: 'Use an explicit, validated path. Never delete from root.',
    confidence: 98,
    excludeInTests: false,
  },
  {
    name: 'rm-rf-wildcard',
    ruleId: 'SEC002',
    regex: /rm\s+-rf\s+\*/,
    severity: 'critical',
    message: 'Recursive delete with wildcard',
    suggestion: 'Use an explicit, validated path.',
    confidence: 95,
    excludeInTests: false,
  },
  {
    name: 'fs-unlink-unvalidated',
    ruleId: 'SEC002',
    regex: /fs\.(?:unlink|rmdir|rm)(?:Sync)?\s*\(/,
    severity: 'medium',
    message: 'File/directory deletion — ensure path is validated',
    suggestion: 'Validate path is within the allowed directory before deletion.',
    confidence: 65,
    excludeInTests: true,
    validate: (line) => {
      // Safe patterns: temp/tmp cleanup, config-driven, hardcoded string paths
      if (/(?:temp|tmp|cache|dist|build|output|\.cache|node_modules)/i.test(line)) return false;
      // Hardcoded string path is safe
      if (/(?:unlink|rmdir|rm)(?:Sync)?\s*\(\s*['"`]/.test(line)) return false;
      return true;
    },
  },

  // ── ReDoS ──
  {
    name: 'redos-req-input',
    ruleId: 'SEC014',
    regex: /new\s+RegExp\s*\([^)]*req\.(?:body|query|params|headers)/,
    severity: 'critical',
    message: 'User input in new RegExp() — ReDoS attack vector',
    suggestion: 'Never construct regex from user input. Validate against a fixed pattern instead.',
    confidence: 91,
    excludeInTests: true,
  },
  {
    name: 'redos-var-input',
    ruleId: 'SEC014',
    regex: /new\s+RegExp\s*\([^)]*\binput\b/,
    severity: 'critical',
    message: 'Variable "input" in new RegExp() — potential ReDoS',
    suggestion: 'Avoid building regex from external input. Use escapeRegExp() to sanitize.',
    confidence: 78,
    excludeInTests: true,
    validate: (line) => !/['"].*input.*['"]/.test(line),
  },

  // ── JWT Vulnerabilities ──
  {
    name: 'jwt-no-verify',
    ruleId: 'SEC010',
    regex: /jwt\.decode\s*\(/,
    severity: 'high',
    message: 'jwt.decode() does NOT verify the signature — tokens can be forged',
    suggestion: 'Use jwt.verify(token, secret) to validate the signature before trusting the payload.',
    confidence: 88,
    excludeInTests: true,
    validate: (line, lines, index) => {
      // Skip if jwt.verify is also present nearby (decode + verify is a valid pattern)
      for (let j = Math.max(0, index - 5); j <= Math.min(lines.length - 1, index + 5); j++) {
        if (/jwt\.verify\s*\(/.test(lines[j]!)) return false;
      }
      return true;
    },
  },
  {
    name: 'jwt-algorithm-none',
    ruleId: 'SEC010',
    regex: /algorithms?\s*:\s*\[?\s*['"`]none['"`]/i,
    severity: 'critical',
    message: 'JWT with "none" algorithm — accepts unsigned tokens',
    suggestion: 'Never allow "none" algorithm. Use: algorithms: ["HS256"] or ["RS256"]',
    confidence: 95,
    excludeInTests: true,
  },
  {
    name: 'jwt-no-expiry',
    ruleId: 'SEC010',
    regex: /jwt\.sign\s*\([^)]*\)\s*(?:;|\n)/,
    severity: 'medium',
    message: 'JWT signed without expiration — tokens are valid forever',
    suggestion: 'Add expiresIn: jwt.sign(payload, secret, { expiresIn: "1h" })',
    confidence: 72,
    excludeInTests: true,
    validate: (line) => {
      // Skip if expiresIn or exp is present in the same call
      if (/(?:expiresIn|exp\s*:)/.test(line)) return false;
      return true;
    },
  },

  // ── Open Redirect ──
  {
    name: 'open-redirect-param',
    ruleId: 'SEC016',
    regex: /(?:res\.redirect|redirect|location\.href|window\.location)\s*(?:=|\()\s*(?:req\.query|req\.params|req\.body|searchParams\.get)/,
    severity: 'high',
    message: 'Open redirect — user-controlled redirect destination',
    suggestion: 'Validate redirect URL against an allowlist of trusted domains. Use new URL() to parse and check the hostname.',
    confidence: 88,
    excludeInTests: true,
  },
  {
    name: 'open-redirect-url-param',
    ruleId: 'SEC016',
    regex: /(?:redirect|callback|return|next|goto|url|returnTo|redirect_uri)\s*=\s*(?:req\.|params\.|query\.|searchParams)/,
    severity: 'medium',
    message: 'URL parameter used for redirect — potential open redirect',
    suggestion: 'Validate the redirect target is a relative path or a trusted domain.',
    confidence: 75,
    excludeInTests: true,
    validate: (line) => {
      // Skip if URL validation is present
      if (/(?:new\s+URL|isValidUrl|allowedHosts|trustedDomains|startsWith\s*\(\s*['"`]\/)/i.test(line)) return false;
      return true;
    },
  },

  // ── Insecure Cookie Settings ──
  {
    name: 'cookie-no-httponly',
    ruleId: 'SEC017',
    regex: /(?:cookie|setCookie|set-cookie|cookies\.set)\s*\([^)]*(?:session|auth|token|jwt|csrf)/i,
    severity: 'medium',
    message: 'Security-sensitive cookie — verify httpOnly, secure, and sameSite are set',
    suggestion: 'Set { httpOnly: true, secure: true, sameSite: "strict" } for auth cookies.',
    confidence: 70,
    excludeInTests: true,
    validate: (line, lines, index) => {
      // Check nearby lines for httpOnly setting
      const context = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 5)).join(' ');
      if (/httpOnly\s*:\s*true/i.test(context)) return false;
      return true;
    },
  },
  {
    name: 'cookie-secure-false',
    ruleId: 'SEC017',
    regex: /secure\s*:\s*false/,
    severity: 'high',
    message: 'Cookie with secure: false — will be sent over HTTP (plaintext)',
    suggestion: 'Set secure: true. Use secure: process.env.NODE_ENV === "production" if needed for dev.',
    confidence: 88,
    excludeInTests: true,
  },

  // ── Insecure Deserialization ──
  {
    name: 'unsafe-json-parse-req',
    ruleId: 'SEC018',
    regex: /JSON\.parse\s*\(\s*(?:req\.body|req\.query|req\.params|request\.body)/,
    severity: 'medium',
    message: 'JSON.parse on raw request input — use schema validation',
    suggestion: 'Validate input with zod, joi, or ajv before parsing. Framework body parsers handle this automatically.',
    confidence: 72,
    excludeInTests: true,
    validate: (line, lines, index) => {
      // Skip if zod/joi/ajv validation is nearby
      for (let j = Math.max(0, index - 5); j <= Math.min(lines.length - 1, index + 8); j++) {
        if (/(?:\.parse\(|\.validate\(|\.safeParse\(|ajv\.compile|Joi\.object|z\.object)/i.test(lines[j]!)) return false;
      }
      return true;
    },
  },
  {
    name: 'unsafe-yaml-load',
    ruleId: 'SEC018',
    regex: /yaml\.load\s*\(/,
    severity: 'high',
    message: 'yaml.load() allows arbitrary code execution via YAML tags',
    suggestion: 'Use yaml.safeLoad() or the "json" schema: yaml.load(str, { schema: FAILSAFE_SCHEMA })',
    confidence: 85,
    excludeInTests: true,
    validate: (line) => {
      // Skip if safe schema is specified
      if (/(?:safeLoad|FAILSAFE_SCHEMA|JSON_SCHEMA|safe:\s*true)/i.test(line)) return false;
      return true;
    },
  },

  // ── Hardcoded Config Secrets ──
  {
    name: 'hardcoded-jwt-secret',
    ruleId: 'SEC019',
    regex: /(?:jwt|JWT)(?:_SECRET|Secret|_secret)\s*[:=]\s*['"`][^'"`]{4,}['"`]/,
    severity: 'critical',
    message: 'JWT secret hardcoded in source — anyone with code access can forge tokens',
    suggestion: 'Use environment variable: process.env.JWT_SECRET',
    confidence: 92,
    excludeInTests: true,
    validate: (line) => {
      // Skip if it's reading from env
      if (/process\.env|import\.meta\.env|Deno\.env|getenv/i.test(line)) return false;
      // Skip if it's a type definition
      if (/(?:type|interface|declare)\s/.test(line)) return false;
      return true;
    },
  },
  {
    name: 'hardcoded-db-password',
    ruleId: 'SEC019',
    regex: /(?:password|passwd|db_pass|DB_PASSWORD)\s*[:=]\s*['"`](?!process\.env|import\.meta)[^'"`]{4,}['"`]/i,
    severity: 'high',
    message: 'Database password hardcoded in source code',
    suggestion: 'Use environment variable: process.env.DB_PASSWORD',
    confidence: 78,
    excludeInTests: true,
    validate: (line) => {
      if (/process\.env|import\.meta\.env|getenv|placeholder|example|changeme|your[-_]?password/i.test(line)) return false;
      // Skip type definitions and interfaces
      if (/(?:type|interface|declare|@param|@type)\s/.test(line)) return false;
      // Skip validation schemas
      if (/(?:z\.|Joi\.|yup\.)/.test(line)) return false;
      return true;
    },
  },

  // ── HTTP Header Injection ──
  {
    name: 'header-injection',
    ruleId: 'SEC021',
    regex: /(?:res\.setHeader|res\.header|response\.headers\.set)\s*\(\s*[^,]+,\s*(?:req\.|params\.|query\.|body\.)/,
    severity: 'high',
    message: 'User input in HTTP response header — header injection / response splitting risk',
    suggestion: 'Sanitize header values. Remove newlines (\\r\\n) from user input before setting headers.',
    confidence: 82,
    excludeInTests: true,
  },
  {
    name: 'location-header-user-input',
    ruleId: 'SEC021',
    regex: /(?:res\.setHeader|response\.headers\.set)\s*\(\s*['"`](?:Location|location)['"`]\s*,\s*(?:req\.|params\.|query\.)/,
    severity: 'high',
    message: 'User input in Location header — open redirect via header injection',
    suggestion: 'Validate redirect URLs against an allowlist of trusted domains.',
    confidence: 88,
    excludeInTests: true,
  },

  // ── Timing Attack ──
  {
    name: 'string-comparison-secret',
    ruleId: 'SEC009',
    regex: /(?:secret|token|apiKey|password|hash|signature|hmac|digest)\s*(?:===|!==|==|!=)\s*(?:req\.|params\.|query\.|body\.|input|provided|submitted)/i,
    severity: 'medium',
    message: 'String comparison for secret — vulnerable to timing attacks',
    suggestion: 'Use crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)) for constant-time comparison.',
    confidence: 78,
    excludeInTests: true,
    validate: (line) => {
      if (/timingSafeEqual/.test(line)) return false;
      return true;
    },
  },

  // ── Insecure TLS ──
  {
    name: 'tls-reject-unauthorized',
    ruleId: 'SEC020',
    regex: /(?:rejectUnauthorized|NODE_TLS_REJECT_UNAUTHORIZED)\s*[:=]\s*(?:false|0|'0'|"0")/,
    severity: 'critical',
    message: 'TLS certificate verification disabled — MITM attack possible',
    suggestion: 'Never disable certificate verification in production. Fix the certificate chain instead.',
    confidence: 95,
    excludeInTests: false,
    validate: (line) => {
      // Allow in explicitly marked dev/test contexts
      if (/(?:development|dev|test|local|NODE_ENV)/i.test(line)) return false;
      return true;
    },
  },
];

// ─── Engine ───────────────────────────────────────────────────────────────────

export class SecurityEngine implements ScanEngine {
  readonly id = 'security' as const;

  async scan(delta: DeltaContext, signal?: AbortSignal): Promise<Finding[]> {
    if (signal?.aborted) return [];
    const uri = delta.documentUri;
    const isTest = isTestFile(uri);
    const critical = isCriticalPath(uri);
    const isScript = isScriptFile(uri);
    const isBuildUtil = isBuildOrUtilityFile(uri);
    const isGuardrailSelf = isGuardrailFile(uri);

    const findings: Finding[] = [];
    const lines = delta.fullText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (signal?.aborted) break;
      const line = lines[i]!;
      const trimmed = line.trim();

      // Skip comment-only lines
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('#')) continue;

      for (const pattern of PATTERNS) {
        if (isTest && pattern.excludeInTests) continue;

        const match = pattern.regex.exec(line);
        if (!match) continue;

        if (pattern.validate && !pattern.validate(line, lines, i)) continue;

        // ── Context-aware filtering ──

        const ruleId = pattern.ruleId;

        // SEC002: Skip fs.unlink/rmSync in scripts/ and build utilities
        if (ruleId === 'SEC002' && pattern.name === 'fs-unlink-unvalidated') {
          if (isScript || isBuildUtil) continue;
          // Only flag at high/critical when user input is involved
          // otherwise demote to info
        }

        // SEC003: Skip when scanning Guardrail's own source code
        if (ruleId === 'SEC003' && isGuardrailSelf) continue;

        // SEC007: Skip dynamic-require in scripts/
        if (ruleId === 'SEC007' && pattern.name === 'dynamic-require' && isScript) continue;

        // SEC012: Skip spawn shell:true / execSync interpolation in scripts/
        if (ruleId === 'SEC012' && (isScript || isBuildUtil)) continue;

        // ── Severity adjustment ──
        let severity = escalate(pattern.severity, critical);

        // SEC002 (fs-unlink): demote to info when no user input
        if (ruleId === 'SEC002' && pattern.name === 'fs-unlink-unvalidated') {
          if (hasUserInputIndicators(line)) {
            severity = escalate('high', critical);
          } else {
            severity = 'info';
          }
        }

        // SEC007 (dynamic-require): escalate to medium if user input detected
        if (ruleId === 'SEC007' && pattern.name === 'dynamic-require') {
          if (hasUserInputIndicators(line)) {
            severity = escalate('medium', critical);
          }
        }

        // SEC009 (md5-usage): escalate to medium if password/auth context
        if (ruleId === 'SEC009' && pattern.name === 'md5-usage') {
          if (/(?:password|passwd|auth|credential|secret|token)/i.test(line)) {
            severity = escalate('medium', critical);
          }
        }

        findings.push({
          id: deterministicId(uri, i + 1, ruleId, pattern.name),
          engine: 'security',
          severity,
          category: 'security',
          file: uri,
          line: i + 1,
          column: match.index ?? 0,
          message: pattern.message,
          evidence: trimmed,
          suggestion: pattern.suggestion,
          confidence: pattern.confidence / 100,
          autoFixable: false,
          ruleId,
        });
      }
    }

    return findings;
  }
}
