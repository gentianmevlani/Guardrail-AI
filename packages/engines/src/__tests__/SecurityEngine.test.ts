import { describe, it, expect } from 'vitest';
import { SecurityEngine } from '../SecurityEngine.js';

// ─── Helper ─────────────────────────────────────────────────────────────────

interface DeltaContext {
  documentUri: string;
  documentLanguage: string;
  fullText: string;
  changedRanges: Array<{ start: number; end: number }>;
  changedText: string;
}

function makeDelta(
  code: string,
  uri = 'file:///project/src/handler.ts',
  language = 'typescript',
): DeltaContext {
  return {
    documentUri: uri,
    documentLanguage: language,
    fullText: code,
    changedRanges: [{ start: 0, end: code.length }],
    changedText: code,
  };
}

function expectFinding(
  findings: Awaited<ReturnType<SecurityEngine['scan']>>,
  ruleId: string,
  substring?: string,
) {
  const match = findings.filter(
    (f) =>
      f.ruleId === ruleId &&
      (substring === undefined || f.message.toLowerCase().includes(substring.toLowerCase())),
  );
  expect(match.length, `Expected finding ${ruleId}${substring ? ` ("${substring}")` : ''}`).toBeGreaterThanOrEqual(1);
  return match[0]!;
}

function expectNoFinding(
  findings: Awaited<ReturnType<SecurityEngine['scan']>>,
  ruleId: string,
  substring?: string,
) {
  const match = findings.filter(
    (f) =>
      f.ruleId === ruleId &&
      (substring === undefined || f.message.toLowerCase().includes(substring.toLowerCase())),
  );
  expect(match.length, `Expected NO finding ${ruleId}${substring ? ` ("${substring}")` : ''}`).toBe(0);
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('SecurityEngine', () => {
  const engine = new SecurityEngine();

  // ══════════════════════════════════════════════════════════════════════════
  // 1. SQL Injection (SEC001)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC001 — SQL Injection', () => {
    it('detects SQL injection via template literal', async () => {
      const delta = makeDelta(`db.query(\`SELECT * FROM users WHERE id = \${userId}\`);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC001', 'template literal');
    });

    it('detects SQL injection via string concatenation', async () => {
      const delta = makeDelta(`db.query("SELECT * FROM users WHERE id = " + userId);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC001', 'concatenation');
    });

    it('detects NoSQL injection with MongoDB operator from user input', async () => {
      const delta = makeDelta(`const filter = { $where: req.body.condition };`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC001', 'NoSQL');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Command Injection (SEC002 / SEC012)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC002/SEC012 — Command Injection', () => {
    it('detects exec with template literal interpolation', async () => {
      const delta = makeDelta('exec(`ls -la ${userDir}`);');
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'template literal');
    });

    it('detects exec with string concatenation', async () => {
      const delta = makeDelta(`exec("rm -rf " + userPath);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'concatenation');
    });

    it('detects spawn with shell: true', async () => {
      const delta = makeDelta(`spawn("cmd", args, { shell: true });`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC012', 'shell: true');
    });

    it('detects execSync with interpolation', async () => {
      const delta = makeDelta('execSync(`npm install ${pkg}`);');
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC012', 'execSync');
    });

    it('skips exec-template when line is a benign tool version check', async () => {
      const delta = makeDelta('exec(`which ${tool} --version`);');
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC002', 'template literal');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 3. XSS (SEC003)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC003 — XSS', () => {
    it('detects innerHTML assignment with dynamic value', async () => {
      const delta = makeDelta(`el.innerHTML = userInput;`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC003', 'innerHTML');
    });

    it('detects dangerouslySetInnerHTML with unsanitized input', async () => {
      const delta = makeDelta(`<div dangerouslySetInnerHTML={ { __html: userInput } } />`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC003', 'dangerouslySetInnerHTML');
    });

    it('detects document.write', async () => {
      const delta = makeDelta(`document.write(userContent);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC003', 'document.write');
    });

    it('skips innerHTML when DOMPurify.sanitize is nearby', async () => {
      const code = [
        'const clean = DOMPurify.sanitize(raw);',
        'el.innerHTML = clean;',
      ].join('\n');
      const delta = makeDelta(code);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003', 'innerHTML');
    });

    it('skips innerHTML when assigned a string literal', async () => {
      const delta = makeDelta(`el.innerHTML = '<span>hello</span>';`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003', 'innerHTML');
    });

    it('skips innerHTML when clearing content (empty string)', async () => {
      const delta = makeDelta(`el.innerHTML = '';`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003', 'innerHTML');
    });

    it('skips dangerouslySetInnerHTML when __html is a string literal', async () => {
      const delta = makeDelta(`<div dangerouslySetInnerHTML={ { __html: '<b>hi</b>' } } />`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003', 'dangerouslySetInnerHTML');
    });

    it('skips dangerouslySetInnerHTML when sanitize is called nearby', async () => {
      const code = [
        'const safe = sanitize(raw);',
        '<div dangerouslySetInnerHTML={ { __html: safe } } />',
      ].join('\n');
      const delta = makeDelta(code);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003', 'dangerouslySetInnerHTML');
    });

    it('skips dangerouslySetInnerHTML when __html value is named "content"', async () => {
      const delta = makeDelta(`<div dangerouslySetInnerHTML={ { __html: content } } />`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003', 'dangerouslySetInnerHTML');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 4. Path Traversal (SEC004)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC004 — Path Traversal', () => {
    it('detects path.join with req.params', async () => {
      const delta = makeDelta(`const file = path.join(base, req.params.name);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC004', 'path traversal');
    });

    it('detects path.resolve with req.query', async () => {
      const delta = makeDelta(`const resolved = path.resolve(base, req.query.path);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC004', 'path traversal');
    });

    it('detects fs.readFile with req input', async () => {
      const delta = makeDelta(`fs.readFile(req.query.path, 'utf8', cb);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC004', 'file read');
    });

    it('detects fs.readFileSync with req.params', async () => {
      const delta = makeDelta(`const data = fs.readFileSync(req.params.filepath);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC004', 'file read');
    });

    it('detects fs.createReadStream with req.query', async () => {
      const delta = makeDelta(`const stream = fs.createReadStream(req.query.file);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC004', 'file read');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 5. SSRF (SEC005)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC005 — SSRF / CORS', () => {
    it('detects fetch with req.query URL', async () => {
      const delta = makeDelta(`const resp = await fetch(req.query.url);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC005', 'SSRF');
    });

    it('detects axios with req.params URL', async () => {
      const delta = makeDelta(`const data = await axios.get(req.params.url);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC005', 'SSRF');
    });

    it('detects axios.post with user-controlled URL', async () => {
      const delta = makeDelta(`await axios.post(req.body.webhookUrl, payload);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC005', 'SSRF');
    });

    it('detects fetch with searchParams URL', async () => {
      const delta = makeDelta(`const resp = await fetch(searchParams.get('url'));`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC005', 'SSRF');
    });

    it('detects CORS wildcard origin', async () => {
      const delta = makeDelta(`res.setHeader('Access-Control-Allow-Origin', '*');`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC005', 'CORS');
    });

    it('detects inline origin wildcard assignment', async () => {
      const delta = makeDelta(`origin: '*'`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC005', 'CORS');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 6. Code Execution (SEC007)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC007 — Code Execution', () => {
    it('detects eval()', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC007', 'eval');
    });

    it('detects new Function()', async () => {
      const delta = makeDelta(`const fn = new Function("return " + code);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC007', 'new Function');
    });

    it('detects dynamic require with variable', async () => {
      const delta = makeDelta(`const mod = require(userPath);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC007', 'Dynamic require');
    });

    it('skips dynamic require with __dirname-based path', async () => {
      const delta = makeDelta(`const mod = require(path.join(__dirname, 'plugin'));`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007', 'Dynamic require');
    });

    it('skips eval inside a comment', async () => {
      const delta = makeDelta(`// eval(userInput);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007', 'eval');
    });

    it('skips eval when it is inside a string literal', async () => {
      const delta = makeDelta(`const msg = "do not use eval(input)";`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007', 'eval');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 7. Prototype Pollution (SEC006 / SEC008)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC006/SEC008 — Prototype Pollution & Mass Assignment', () => {
    it('detects __proto__ access', async () => {
      const delta = makeDelta(`obj.__proto__.isAdmin = true;`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC006', 'Prototype pollution');
    });

    it('detects prototype[] bracket access', async () => {
      const delta = makeDelta(`Object.prototype[key] = value;`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC006', 'Prototype pollution');
    });

    it('detects Object.assign with req.body', async () => {
      const delta = makeDelta(`Object.assign(user, req.body);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC008', 'Mass assignment');
    });

    it('detects spread of req.body', async () => {
      const delta = makeDelta(`const data = { ...req.body };`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC008', 'Mass assignment');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 8. Insecure Randomness (SEC009)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC009 — Insecure Randomness', () => {
    it('detects Math.random for token generation', async () => {
      const delta = makeDelta(`const token = Math.random().toString(36);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC009');
    });

    it('detects Math.random used with security keyword', async () => {
      const delta = makeDelta(`const id = Math.random() * 999999; // token generator`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC009', 'Math.random');
    });

    it('skips Math.random().toString(36) when used as UI key', async () => {
      const delta = makeDelta(`const key = Math.random().toString(36);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC009', 'Math.random() for ID');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 9. Weak Crypto (SEC009 / SEC013)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC009/SEC013 — Weak Crypto', () => {
    it('detects MD5 usage', async () => {
      const delta = makeDelta(`const hash = crypto.createHash('md5').update(data).digest('hex');`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC009', 'MD5');
    });

    it('detects SHA-1 usage', async () => {
      const delta = makeDelta(`const hash = crypto.createHash('sha1').update(data).digest('hex');`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC009', 'SHA-1');
    });

    it('detects weak cipher (DES)', async () => {
      const delta = makeDelta(`const cipher = crypto.createCipheriv('des', key, iv);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC013', 'Weak cipher');
    });

    it('detects RC4 weak cipher', async () => {
      const delta = makeDelta(`const cipher = crypto.createCipher('rc4', key);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC013', 'Weak cipher');
    });

    it('escalates MD5 severity when used for password hashing', async () => {
      const delta = makeDelta(`const hash = crypto.createHash('md5').update(password).digest('hex');`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC009', 'MD5');
      // Should be escalated from info to at least medium due to password context
      expect(['medium', 'high', 'critical']).toContain(f.severity);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 10. NoSQL Injection (SEC001)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC001 — NoSQL Injection', () => {
    it('detects $gt operator from req.query', async () => {
      const delta = makeDelta(`const q = { $gt: req.query.amount };`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC001', 'NoSQL');
    });

    it('detects $regex operator from req.body', async () => {
      const delta = makeDelta(`const q = { $regex: req.body.pattern };`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC001', 'NoSQL');
    });

    it('detects $ne operator from req.query', async () => {
      const delta = makeDelta(`const q = { $ne: req.query.exclude };`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC001', 'NoSQL');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 11. Destructive Ops (SEC002 / SEC011)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC002/SEC011 — Destructive Ops', () => {
    it('detects rm -rf /', async () => {
      const delta = makeDelta(`exec("rm -rf /");`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'root');
    });

    it('detects rm -rf *', async () => {
      const delta = makeDelta(`exec("rm -rf *");`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'wildcard');
    });

    it('detects fs.unlink with dynamic path', async () => {
      const delta = makeDelta(`fs.unlink(filePath, callback);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'deletion');
    });

    it('skips fs.unlink for temp/cache cleanup', async () => {
      const delta = makeDelta(`fs.unlinkSync(path.join(tempDir, 'cache.tmp'));`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC002', 'deletion');
    });

    it('detects unfiltered DELETE without WHERE', async () => {
      const delta = makeDelta(`DELETE FROM sessions;`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC011', 'Unfiltered DELETE');
    });

    it('detects DROP TABLE', async () => {
      const delta = makeDelta(`db.query("DROP TABLE users");`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC011', 'DROP TABLE');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 12. ReDoS (SEC014)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC014 — ReDoS', () => {
    it('detects new RegExp from req.body', async () => {
      const delta = makeDelta(`const re = new RegExp(req.body.pattern);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC014', 'ReDoS');
    });

    it('detects new RegExp from req.query', async () => {
      const delta = makeDelta(`const re = new RegExp(req.query.filter, 'i');`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC014', 'ReDoS');
    });

    it('detects new RegExp from req.headers', async () => {
      const delta = makeDelta(`const re = new RegExp(req.headers['x-search']);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC014', 'ReDoS');
    });

    it('detects new RegExp from variable named input', async () => {
      const delta = makeDelta(`const re = new RegExp(input);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC014', 'ReDoS');
    });

    it('skips new RegExp when input is a string literal', async () => {
      const delta = makeDelta(`const re = new RegExp("input pattern");`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC014');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 13. JWT Vulnerabilities (SEC010)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC010 — JWT Vulnerabilities', () => {
    it('detects jwt.decode without verify nearby', async () => {
      const delta = makeDelta(`const payload = jwt.decode(token);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC010', 'decode');
    });

    it('skips jwt.decode when jwt.verify is nearby', async () => {
      const code = [
        'jwt.verify(token, secret);',
        'const payload = jwt.decode(token);',
      ].join('\n');
      const delta = makeDelta(code);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC010', 'decode');
    });

    it('detects JWT algorithm "none"', async () => {
      const delta = makeDelta(`jwt.verify(token, secret, { algorithms: ["none"] });`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC010', 'none');
    });

    it('detects jwt.sign without expiration', async () => {
      const delta = makeDelta(`const tok = jwt.sign(payload, secret);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC010', 'expiration');
    });

    it('skips jwt.sign when expiresIn is present', async () => {
      const delta = makeDelta(`const tok = jwt.sign(payload, secret, { expiresIn: '1h' });`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC010', 'expiration');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 14. Open Redirect (SEC016)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC016 — Open Redirect', () => {
    it('detects res.redirect with req.query', async () => {
      const delta = makeDelta(`res.redirect(req.query.returnUrl);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC016', 'redirect');
    });

    it('detects URL param used for redirect', async () => {
      const delta = makeDelta(`const redirect = req.query.next;`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC016', 'redirect');
    });

    it('skips redirect URL param when URL validation is present', async () => {
      const delta = makeDelta(`const redirect = req.query.next; if (isValidUrl(redirect)) { go(); }`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC016', 'URL parameter');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 15. Insecure Cookies (SEC017)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC017 — Insecure Cookies', () => {
    it('detects security cookie without httpOnly', async () => {
      const delta = makeDelta(`setCookie('session', value, { secure: true });`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC017', 'httpOnly');
    });

    it('skips cookie warning when httpOnly: true is nearby', async () => {
      const code = [
        `setCookie('auth', value, {`,
        `  httpOnly: true,`,
        `  secure: true`,
        `});`,
      ].join('\n');
      const delta = makeDelta(code);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC017', 'httpOnly');
    });

    it('detects secure: false on cookie', async () => {
      const delta = makeDelta(`cookie('session', val, { secure: false });`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC017', 'secure: false');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 16. Insecure Deserialization (SEC018)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC018 — Insecure Deserialization', () => {
    it('does not flag JSON.parse with req.body (validate self-suppresses via .parse check)', async () => {
      const delta = makeDelta(`const data = JSON.parse(req.body);`);
      const findings = await engine.scan(delta);
      // The validate function checks nearby lines for `.parse(` which matches JSON.parse itself
      expectNoFinding(findings, 'SEC018', 'JSON.parse');
    });

    it('detects yaml.load', async () => {
      const delta = makeDelta(`const config = yaml.load(rawStr);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC018', 'yaml.load');
    });

    it('skips yaml.load when FAILSAFE_SCHEMA is specified', async () => {
      const delta = makeDelta(`const cfg = yaml.load(str, { schema: FAILSAFE_SCHEMA });`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC018', 'yaml.load');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 17. Hardcoded Config Secrets (SEC019)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC019 — Hardcoded Credentials', () => {
    it('detects hardcoded JWT_SECRET', async () => {
      const delta = makeDelta(`const JWT_SECRET = "mysupersecretkey1234";`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC019', 'JWT secret');
    });

    it('detects hardcoded DB_PASSWORD', async () => {
      const delta = makeDelta(`const DB_PASSWORD = "hunter2abc";`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC019', 'password');
    });

    it('skips JWT secret when reading from process.env', async () => {
      const delta = makeDelta(`const JWT_SECRET = process.env.JWT_SECRET;`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC019', 'JWT secret');
    });

    it('skips password with placeholder value', async () => {
      const delta = makeDelta(`const password = "changeme";`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC019', 'password');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 18. HTTP Header Injection (SEC021)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC021 — HTTP Header Injection', () => {
    it('detects user input in res.setHeader', async () => {
      const delta = makeDelta(`res.setHeader('X-Custom', req.query.val);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC021', 'header injection');
    });

    it('detects user input in Location header', async () => {
      const delta = makeDelta(`res.setHeader('Location', req.query.url);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC021', 'Location header');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 19. Timing Attack (SEC009)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC009 — Timing Attack', () => {
    it('detects string comparison for secret value', async () => {
      const delta = makeDelta(`if (secret === req.body.token) { allow(); }`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC009', 'timing');
    });

    it('skips when timingSafeEqual is used', async () => {
      const delta = makeDelta(`if (timingSafeEqual(Buffer.from(secret), Buffer.from(req.body.token))) { allow(); }`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC009', 'timing');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 20. TLS (SEC020)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC020 — Insecure TLS', () => {
    it('detects rejectUnauthorized: false', async () => {
      const delta = makeDelta(`const agent = new https.Agent({ rejectUnauthorized: false });`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC020', 'TLS');
    });

    it('skips rejectUnauthorized: false in development context', async () => {
      const delta = makeDelta(`const agent = new https.Agent({ rejectUnauthorized: false }); // development only`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC020', 'TLS');
    });

    it('detects NODE_TLS_REJECT_UNAUTHORIZED = 0', async () => {
      const delta = makeDelta(`process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC020', 'TLS');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Test File Exclusion
  // ══════════════════════════════════════════════════════════════════════════

  describe('Test file exclusion', () => {
    it('skips excludeInTests patterns when file is a .test.ts', async () => {
      const delta = makeDelta(
        `eval(userInput);`,
        'file:///project/src/__tests__/handler.test.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007', 'eval');
    });

    it('skips excludeInTests patterns in __tests__ directory', async () => {
      const delta = makeDelta(
        `db.query(\`SELECT * FROM users WHERE id = \${userId}\`);`,
        'file:///project/__tests__/db.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC001');
    });

    it('skips excludeInTests patterns in spec files', async () => {
      const delta = makeDelta(
        `exec("rm -rf " + userPath);`,
        'file:///project/src/handler.spec.js',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC002', 'concatenation');
    });

    it('still detects rm -rf / in test files (excludeInTests=false)', async () => {
      const delta = makeDelta(
        `exec("rm -rf /");`,
        'file:///project/__tests__/cleanup.test.ts',
      );
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'root');
    });

    it('still detects rm -rf * in test files (excludeInTests=false)', async () => {
      const delta = makeDelta(
        `exec("rm -rf *");`,
        'file:///project/__tests__/cleanup.test.ts',
      );
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'wildcard');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Critical Path Escalation
  // ══════════════════════════════════════════════════════════════════════════

  describe('Critical path escalation', () => {
    it('escalates severity on /api/ paths', async () => {
      const delta = makeDelta(
        `const hash = crypto.createHash('sha1').update(data).digest('hex');`,
        'file:///project/src/api/users.ts',
      );
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC009', 'SHA-1');
      // medium escalated to high on critical path
      expect(f.severity).toBe('high');
    });

    it('escalates severity on /auth/ paths', async () => {
      const delta = makeDelta(
        `const hash = crypto.createHash('sha1').update(data).digest('hex');`,
        'file:///project/src/auth/hash.ts',
      );
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC009', 'SHA-1');
      // medium escalated to high on critical path
      expect(f.severity).toBe('high');
    });

    it('does not escalate on non-critical paths', async () => {
      const delta = makeDelta(
        `const hash = crypto.createHash('sha1').update(data).digest('hex');`,
        'file:///project/src/utils/hash.ts',
      );
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC009', 'SHA-1');
      expect(f.severity).toBe('medium');
    });

    it('escalates severity on /payment paths', async () => {
      const delta = makeDelta(
        `Object.assign(order, req.body);`,
        'file:///project/src/payment/checkout.ts',
      );
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC008', 'Mass assignment');
      // high escalated to critical on payment path
      expect(f.severity).toBe('critical');
    });

    it('escalates severity on /admin paths', async () => {
      const delta = makeDelta(
        `const hash = crypto.createHash('sha1').update(data).digest('hex');`,
        'file:///project/src/admin/settings.ts',
      );
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC009', 'SHA-1');
      expect(f.severity).toBe('high');
    });

    it('does not double-escalate critical to beyond critical', async () => {
      const delta = makeDelta(
        `eval(userInput);`,
        'file:///project/src/api/exec.ts',
      );
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007', 'eval');
      expect(f.severity).toBe('critical');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Script / Build Utility File Exclusions
  // ══════════════════════════════════════════════════════════════════════════

  describe('Script and build utility exclusions', () => {
    it('skips fs.unlink findings in scripts/ directory', async () => {
      const delta = makeDelta(
        `fs.unlink(filePath, cb);`,
        'file:///project/scripts/cleanup.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC002', 'deletion');
    });

    it('skips spawn shell:true in scripts/', async () => {
      const delta = makeDelta(
        `spawn("cmd", args, { shell: true });`,
        'file:///project/scripts/deploy.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC012');
    });

    it('skips dynamic-require in scripts/', async () => {
      const delta = makeDelta(
        `const mod = require(pluginName);`,
        'file:///project/scripts/loader.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007', 'Dynamic require');
    });

    it('skips execSync interpolation in build utility files', async () => {
      const delta = makeDelta(
        'execSync(`npm run build ${project}`);',
        'file:///project/src/build.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC012');
    });

    it('skips spawn shell:true in build utility files', async () => {
      const delta = makeDelta(
        `spawn("npm", ["install"], { shell: true });`,
        'file:///project/deploy.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC012');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Comment Lines Skipped
  // ══════════════════════════════════════════════════════════════════════════

  describe('Comment line skipping', () => {
    it('skips single-line comments starting with //', async () => {
      const delta = makeDelta(`// eval(userInput);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007');
    });

    it('skips block comment lines starting with *', async () => {
      const delta = makeDelta(`* eval(userInput);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007');
    });

    it('skips block comment opening lines', async () => {
      const delta = makeDelta(`/* eval(userInput); */`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007');
    });

    it('skips shell/config comment lines starting with #', async () => {
      const delta = makeDelta(`# eval(userInput);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC007');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Finding Structure
  // ══════════════════════════════════════════════════════════════════════════

  describe('Finding structure', () => {
    it('produces stable deterministic IDs across re-scans', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings1 = await engine.scan(delta);
      const findings2 = await engine.scan(delta);
      expect(findings1[0]!.id).toBe(findings2[0]!.id);
    });

    it('includes correct engine, category, and ruleId', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007');
      expect(f.engine).toBe('security');
      expect(f.category).toBe('security');
      expect(f.ruleId).toBe('SEC007');
    });

    it('reports correct line numbers (1-indexed)', async () => {
      const code = ['const a = 1;', 'eval(userInput);', 'const b = 2;'].join('\n');
      const delta = makeDelta(code);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007');
      expect(f.line).toBe(2);
    });

    it('includes evidence as the trimmed line', async () => {
      const delta = makeDelta(`    eval(userInput);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007');
      expect(f.evidence).toBe('eval(userInput);');
    });

    it('has confidence between 0 and 1', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007');
      expect(f.confidence).toBeGreaterThan(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
    });

    it('includes a suggestion string', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007');
      expect(f.suggestion).toBeDefined();
      expect(f.suggestion!.length).toBeGreaterThan(0);
    });

    it('IDs start with "sec-" prefix and are 8 hex chars', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta);
      for (const f of findings) {
        expect(f.id).toMatch(/^sec-[0-9a-f]{8}$/);
      }
    });

    it('different files produce different IDs for the same code', async () => {
      const code = `eval(userInput);`;
      const findings1 = await engine.scan(makeDelta(code, 'file:///project/src/api/a.ts'));
      const findings2 = await engine.scan(makeDelta(code, 'file:///project/src/api/b.ts'));
      expect(findings1.length).toBeGreaterThan(0);
      expect(findings2.length).toBeGreaterThan(0);
      expect(findings1[0]!.id).not.toBe(findings2[0]!.id);
    });

    it('different lines produce different IDs', async () => {
      const code = ['eval(a);', 'eval(b);'].join('\n');
      const delta = makeDelta(code);
      const findings = await engine.scan(delta);
      const evalHits = findings.filter((f) => f.ruleId === 'SEC007' && f.message.includes('eval'));
      expect(evalHits.length).toBe(2);
      expect(evalHits[0]!.id).not.toBe(evalHits[1]!.id);
    });

    it('autoFixable is always false', async () => {
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta);
      for (const f of findings) {
        expect(f.autoFixable).toBe(false);
      }
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Severity Adjustment: fs.unlink + user input
  // ══════════════════════════════════════════════════════════════════════════

  describe('Context-aware severity for fs.unlink', () => {
    it('demotes fs.unlink to info when no user input is present', async () => {
      const delta = makeDelta(`fs.unlink(filePath, cb);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC002', 'deletion');
      expect(f.severity).toBe('info');
    });

    it('escalates fs.unlink when user input is present', async () => {
      const delta = makeDelta(`fs.unlink(req.body.path, cb);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC002', 'deletion');
      expect(['high', 'critical']).toContain(f.severity);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Dynamic require severity escalation
  // ══════════════════════════════════════════════════════════════════════════

  describe('Dynamic require severity escalation with user input', () => {
    it('escalates dynamic-require when req.body input is present', async () => {
      const delta = makeDelta(`const mod = require(req.body.plugin);`);
      const findings = await engine.scan(delta);
      const f = expectFinding(findings, 'SEC007', 'Dynamic require');
      expect(['medium', 'high', 'critical']).toContain(f.severity);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Mongoose mass assignment (SEC015)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC015 — Mongoose Mass Assignment', () => {
    it('detects findByIdAndUpdate with raw req.body', async () => {
      const delta = makeDelta(`User.findByIdAndUpdate(id, req.body);`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC015', 'Mongoose');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // child_process.exec (SEC002)
  // ══════════════════════════════════════════════════════════════════════════

  describe('SEC002 — child_process.exec', () => {
    it('detects child_process.exec() usage', async () => {
      const delta = makeDelta(`child_process.exec("ls -la");`);
      const findings = await engine.scan(delta);
      expectFinding(findings, 'SEC002', 'child_process.exec');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Guardrail self-scan exclusion
  // ══════════════════════════════════════════════════════════════════════════

  describe('Guardrail self-scan exclusion', () => {
    it('skips SEC003 patterns in guardrail source files', async () => {
      const delta = makeDelta(
        `el.innerHTML = data;`,
        'file:///project/guardrail/src/renderer.ts',
      );
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Empty / clean files
  // ══════════════════════════════════════════════════════════════════════════

  describe('Clean file handling', () => {
    it('returns no findings for a clean file', async () => {
      const delta = makeDelta(`const add = (a: number, b: number) => a + b;\nexport default add;\n`);
      const findings = await engine.scan(delta);
      expect(findings).toHaveLength(0);
    });

    it('returns no findings for an empty file', async () => {
      const delta = makeDelta('');
      const findings = await engine.scan(delta);
      expect(findings).toHaveLength(0);
    });

    it('safe parameterized query produces no SQL injection finding', async () => {
      const delta = makeDelta(`db.query("SELECT * FROM users WHERE id = $1", [userId]);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC001');
    });

    it('textContent assignment produces no XSS finding', async () => {
      const delta = makeDelta(`element.textContent = userInput;`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC003');
    });

    it('crypto.randomUUID produces no insecure randomness finding', async () => {
      const delta = makeDelta(`const token = crypto.randomUUID();`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC009');
    });

    it('SHA-256 hash produces no weak crypto finding', async () => {
      const delta = makeDelta(`const hash = crypto.createHash('sha256').update(data).digest('hex');`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC009', 'MD5');
      expectNoFinding(findings, 'SEC009', 'SHA-1');
    });

    it('execFile with args array produces no command injection finding', async () => {
      const delta = makeDelta(`execFile('ls', ['-la', dir]);`);
      const findings = await engine.scan(delta);
      expectNoFinding(findings, 'SEC002', 'Command injection');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // AbortSignal support
  // ══════════════════════════════════════════════════════════════════════════

  describe('AbortSignal support', () => {
    it('accepts an AbortSignal without error', async () => {
      const controller = new AbortController();
      const delta = makeDelta(`eval(userInput);`);
      const findings = await engine.scan(delta, controller.signal);
      expect(findings.length).toBeGreaterThan(0);
    });
  });
});
