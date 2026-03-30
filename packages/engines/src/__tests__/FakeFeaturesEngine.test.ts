import { describe, it, expect } from 'vitest';
import { FakeFeaturesEngine } from '../FakeFeaturesEngine.js';
import type { DeltaContext, Finding } from '../core-types';

// ─── Helper ────────────────────────────────────────────────────────────────────

function makeDelta(code: string, uri = '/src/components/App.tsx'): DeltaContext {
  return {
    documentUri: uri,
    documentLanguage: 'typescriptreact',
    fullText: code,
    changedRanges: [],
    changedText: code,
  };
}

function findByRule(findings: Finding[], ruleId: string): Finding[] {
  return findings.filter((f) => f.ruleId === ruleId);
}

// ─── Engine Instance ───────────────────────────────────────────────────────────

const engine = new FakeFeaturesEngine();
const signal = new AbortController().signal;

// ═══════════════════════════════════════════════════════════════════════════════

describe('FakeFeaturesEngine', () => {
  describe('engine identity', () => {
    it('has id "fake_features"', () => {
      expect(engine.id).toBe('fake_features');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE001 — Dead UI Elements
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE001 — Dead UI Elements', () => {
    it('detects empty <div></div> in .tsx files', async () => {
      const code = `export default function Page() {
  return (
    <div>
      <div></div>
    </div>
  );
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.severity).toBe('low');
      expect(hits[0]!.message).toContain('Empty <div>');
    });

    it('detects empty <div> with className', async () => {
      const code = `export default function Page() {
  return <div className="card"></div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001');
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it('detects empty semantic elements <section></section>', async () => {
      const code = `export default function Layout() {
  return (
    <main>
      <section></section>
    </main>
  );
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Empty semantic HTML element'))).toBe(true);
      expect(hits[0]!.severity).toBe('medium');
    });

    it('detects empty article, aside, nav, header, footer elements', async () => {
      const tags = ['article', 'aside', 'nav', 'header', 'footer'];
      for (const tag of tags) {
        const code = `export default function Page() {\n  return <${tag}></${tag}>;\n}`;
        const findings = await engine.scan(makeDelta(code), signal);
        const hits = findByRule(findings, 'FAKE001').filter((f) =>
          f.message.includes('Empty semantic HTML'),
        );
        expect(hits.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('detects disabled empty button', async () => {
      const code = `export default function Page() {
  return <button disabled></button>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Disabled button'))).toBe(true);
    });

    it('detects hidden-always inline style display:none', async () => {
      const code = `export default function Page() {
  return <div style={{ display: 'none' }}>secret</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('permanently hidden'))).toBe(true);
    });

    it('detects hidden-always inline style visibility:hidden', async () => {
      const code = `export default function Page() {
  return <div style={{ visibility: 'hidden' }}>secret</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('permanently hidden'))).toBe(true);
    });

    it('does NOT flag empty <div> with spacer className (FP prevention)', async () => {
      const code = `export default function Page() {
  return <div className="spacer-lg"></div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001').filter((f) =>
        f.message.includes('Empty <div>'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag empty <div> with divider/separator className (FP prevention)', async () => {
      const code = `<div className="divider"></div>\n<div className="separator"></div>`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001').filter((f) =>
        f.message.includes('Empty <div>'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag empty <div> with inline style height/width (FP prevention)', async () => {
      const code = `export default function Page() {
  return <div style={{ height: '20px', width: '100%' }}></div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001').filter((f) =>
        f.message.includes('Empty <div>'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag hidden element with toggle mechanism nearby (FP prevention)', async () => {
      const code = `export default function Modal() {
  const isVisible = false;
  return isVisible ? <div style={{ display: 'none' }}>content</div> : null;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE001').filter((f) =>
        f.message.includes('permanently hidden'),
      );
      expect(hits).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE002 — Fake Async / Loading
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE002 — Fake Async/Loading', () => {
    it('detects setTimeout with setLoading', async () => {
      const code = `export function useFakeData() {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setTimeout(() => { setLoading(false) }, 2000);
  }, []);
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.severity).toBe('high');
      expect(hits[0]!.message).toContain('setTimeout');
    });

    it('detects setTimeout with fake/simulate comment', async () => {
      const code = `function loadData() {
  setTimeout(() => fetchData(), 1500); // simulate loading
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('fake/temporary'))).toBe(true);
    });

    it('detects setTimeout with todo comment', async () => {
      const code = `function init() {
  setTimeout(() => setReady(true), 500); // todo replace with real fetch
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002');
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it('detects artificial delay (await new Promise + setTimeout)', async () => {
      const code = `async function getData() {
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { data: [] };
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Artificial delay'))).toBe(true);
      expect(hits[0]!.severity).toBe('medium');
    });

    it('does NOT flag delay in retry/backoff context (FP prevention)', async () => {
      const code = `async function fetchWithRetry(url: string) {
  // retry with backoff
  await new Promise(resolve => setTimeout(resolve, 1000));
  return await fetch(url);
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002').filter((f) =>
        f.message.includes('Artificial delay'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag delay in rate-limit context (FP prevention)', async () => {
      const code = `async function rateLimitedFetch(url: string) {
  // rate limit delay
  await new Promise(resolve => setTimeout(resolve, 200));
  return fetch(url);
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002').filter((f) =>
        f.message.includes('Artificial delay'),
      );
      expect(hits).toHaveLength(0);
    });

    it('detects setInterval fake progress bar', async () => {
      const code = `function simulateUpload() {
  setInterval(updateProgress, 500);
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('fake progress'))).toBe(true);
    });

    it('detects setInterval incrementing percent', async () => {
      const code = `function fakeDownload() {
  setInterval(incrementPercent, 300);
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE002');
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE003 — Placeholder Content
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE003 — Placeholder Content', () => {
    it('detects "TODO" rendered in JSX', async () => {
      const code = `export function Feature() {
  return <div>TODO</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE003');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Placeholder text'))).toBe(true);
    });

    it('detects "PLACEHOLDER" text in JSX', async () => {
      const code = `export function Feature() {
  return <span>PLACEHOLDER</span>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects "Work in progress" text in JSX', async () => {
      const code = `export function Feature() {
  return <p>Work in progress</p>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects "Coming soon" string literal', async () => {
      const code = `export function Beta() {
  const label = "Coming soon";
  return <span>{label}</span>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE003');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Placeholder string'))).toBe(true);
    });

    it('detects "Not yet implemented" string literal', async () => {
      const code = `const msg = 'Not yet implemented';`;
      const findings = await engine.scan(makeDelta(code, '/src/feature.ts'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects "TBD" string literal', async () => {
      const code = `const status = "TBD";`;
      const findings = await engine.scan(makeDelta(code, '/src/feature.ts'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects "Sample text" string literal', async () => {
      const code = `const description = "Sample text";`;
      const findings = await engine.scan(makeDelta(code, '/src/feature.ts'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects placeholder image URLs (via.placeholder.com)', async () => {
      const code = `export function Card() {
  return <img src="https://via.placeholder.com/300x200" alt="hero" />;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE003');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Placeholder image URL'))).toBe(true);
    });

    it('detects placeholder image URLs (picsum.photos)', async () => {
      const code = `const bgImage = "https://picsum.photos/800/600";`;
      const findings = await engine.scan(makeDelta(code, '/src/Hero.tsx'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects placeholder image URLs (placehold.co)', async () => {
      const code = `const thumb = 'https://placehold.co/150x150';`;
      const findings = await engine.scan(makeDelta(code, '/src/Card.tsx'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects Lorem ipsum text', async () => {
      const code = `export function About() {
  return <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE003');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Lorem ipsum'))).toBe(true);
    });

    it('detects placeholder avatar URLs (i.pravatar.cc)', async () => {
      const code = `const avatar = 'https://i.pravatar.cc/150';`;
      const findings = await engine.scan(makeDelta(code, '/src/Profile.tsx'), signal);
      const hits = findByRule(findings, 'FAKE003');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Placeholder avatar'))).toBe(true);
    });

    it('detects placeholder avatar URLs (dicebear)', async () => {
      const code = `const avatar = "https://avatars.dicebear.com/api/human/seed.svg";`;
      const findings = await engine.scan(makeDelta(code, '/src/User.tsx'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('detects placeholder avatar URLs (ui-avatars.com)', async () => {
      const code = `const avatar = "https://ui-avatars.com/api/?name=John+Doe";`;
      const findings = await engine.scan(makeDelta(code, '/src/Avatar.tsx'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE004 — Empty / Noop Handlers
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE004 — Empty/Noop Handlers', () => {
    it('detects onClick={() => {}}', async () => {
      const code = `export function Button() {
  return <button onClick={() => {}}>Click me</button>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Noop event handler'))).toBe(true);
    });

    it('detects onSubmit={() => {}}', async () => {
      const code = `export function Form() {
  return <form onSubmit={() => {}}>Submit</form>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findByRule(findings, 'FAKE004').length).toBeGreaterThanOrEqual(1);
    });

    it('detects onChange={() => null}', async () => {
      const code = `export function Input() {
  return <input onChange={() => null} />;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findByRule(findings, 'FAKE004').length).toBeGreaterThanOrEqual(1);
    });

    it('detects empty function event handler onClick={function() {}}', async () => {
      const code = `export function Page() {
  return <button onClick={function() {}}>Click</button>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Empty function event handler'))).toBe(true);
    });

    it('detects empty catch blocks', async () => {
      const code = `export async function getData() {
  try {
    return await fetch('/api/data');
  } catch (err) {}
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Empty catch block'))).toBe(true);
      expect(hits[0]!.severity).toBe('high');
    });

    it('detects catch block with TODO comment', async () => {
      const code = `async function load() {
  try { await fetch('/api'); } catch (e) { // todo handle this
  }
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.some((f) => f.message.includes('TODO/ignore comment'))).toBe(true);
    });

    it('detects catch block with "intentional" comment', async () => {
      const code = `async function load() {
  try { await api(); } catch (e) { // intentional ignore
  }
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.some((f) => f.message.includes('TODO/ignore comment'))).toBe(true);
    });

    it('detects Promise .catch(() => {})', async () => {
      const code = `export function submitForm(data: FormData) {
  fetch('/api/submit', { method: 'POST', body: data }).catch(() => {});
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Promise .catch()'))).toBe(true);
      expect(hits[0]!.severity).toBe('high');
    });

    it('detects .catch(() => null)', async () => {
      const code = `fetch('/api').catch(() => null);`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it('detects empty useEffect', async () => {
      const code = `export function Dashboard() {
  useEffect(() => {}, []);
  return <div>Dashboard</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Empty useEffect'))).toBe(true);
    });

    it('detects empty useCallback', async () => {
      const code = `export function Page() {
  const handleClick = useCallback(() => {}, []);
  return <div>Page</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Empty useCallback'))).toBe(true);
    });

    it('detects useCallback(() => null, [deps])', async () => {
      const code = `export function Page() {
  const handleClick = useCallback(() => null, [dep]);
  return <div>Page</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.some((f) => f.message.includes('Empty useCallback'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE005 — Hardcoded Mock Data
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE005 — Hardcoded Mock Data', () => {
    it("detects name: 'John Doe' in component", async () => {
      const code = `export function Profile() {
  const user = { name: 'John Doe', age: 30 };
  return <div>{user.name}</div>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE005');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Hardcoded fake user data'))).toBe(true);
    });

    it("detects firstName: 'Jane Smith'", async () => {
      const code = `const user = { firstName: "Jane Smith" };`;
      const findings = await engine.scan(makeDelta(code, '/src/User.tsx'), signal);
      expect(findByRule(findings, 'FAKE005').length).toBeGreaterThanOrEqual(1);
    });

    it("detects username: 'Test User'", async () => {
      const code = `const profile = { username: 'Test User' };`;
      const findings = await engine.scan(makeDelta(code, '/src/Profile.tsx'), signal);
      expect(findByRule(findings, 'FAKE005').length).toBeGreaterThanOrEqual(1);
    });

    it('detects test email addresses', async () => {
      const code = `export function Contact() {
  const email = "test@example.com";
  return <a href={\`mailto:\${email}\`}>{email}</a>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE005');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Hardcoded test email'))).toBe(true);
    });

    it('detects admin@test.com email', async () => {
      const code = `const adminEmail = "admin@test.com";`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.ts'), signal);
      expect(findByRule(findings, 'FAKE005').length).toBeGreaterThanOrEqual(1);
    });

    it('detects hardcoded prices (9.99)', async () => {
      const code = `export function PricingCard() {
  const price = 9.99;
  return <span>\${price}/month</span>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE005');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Hardcoded price value'))).toBe(true);
    });

    it('detects hardcoded prices (49.99)', async () => {
      const code = `const plan = { price: 49.99, name: 'Pro' };`;
      const findings = await engine.scan(makeDelta(code, '/src/Pricing.tsx'), signal);
      expect(findByRule(findings, 'FAKE005').length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT flag price in DEFAULT_PRICE constant (FP prevention)', async () => {
      const code = `const DEFAULT_PRICE = 9.99;`;
      const findings = await engine.scan(makeDelta(code, '/src/config.ts'), signal);
      const hits = findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('price'),
      );
      expect(hits).toHaveLength(0);
    });

    it('detects hardcoded mock arrays with object elements', async () => {
      const code = `export default function UserList() {
  const users = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ];
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE005');
      expect(hits.some((f) => f.message.includes('Hardcoded data array'))).toBe(true);
    });

    it('detects hardcoded todos array', async () => {
      const code = `export function TodoList() {
  const todos = [
    { id: 1, text: "Buy groceries", done: false },
  ];
  return <ul>{todos.map(t => <li key={t.id}>{t.text}</li>)}</ul>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findByRule(findings, 'FAKE005').some((f) =>
        f.message.includes('Hardcoded data array'),
      )).toBe(true);
    });

    it('does NOT flag hardcoded data in seed/fixture files (FP prevention)', async () => {
      const code = `const user = { name: 'John Doe', email: 'test@example.com' };
export default user;`;
      const findings = await engine.scan(makeDelta(code, '/src/fixtures/seed-data.ts'), signal);
      const hits = findByRule(findings, 'FAKE005');
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag hardcoded data in factory files (FP prevention)', async () => {
      const code = `const user = { name: 'John Doe' };`;
      const findings = await engine.scan(makeDelta(code, '/src/userFactory.ts'), signal);
      expect(findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('fake user data'),
      )).toHaveLength(0);
    });

    it('does NOT flag test emails in mock files (FP prevention)', async () => {
      const code = `const email = 'test@example.com';`;
      const findings = await engine.scan(makeDelta(code, '/src/mockData.ts'), signal);
      expect(findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('test email'),
      )).toHaveLength(0);
    });

    it('does NOT flag mock arrays in config files (FP prevention)', async () => {
      const code = `const items = [\n  { id: 1, label: "Dashboard" },\n];`;
      const findings = await engine.scan(makeDelta(code, '/project/next.config.tsx'), signal);
      expect(findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('Hardcoded data array'),
      )).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE006 — Stub Implementations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE006 — Stub Implementations', () => {
    it("detects throw new Error('Not implemented')", async () => {
      const code = `export class PaymentService {
  processPayment(amount: number) {
    throw new Error('Not implemented');
  }
}`;
      const findings = await engine.scan(makeDelta(code, '/src/services/payment.ts'), signal);
      const hits = findByRule(findings, 'FAKE006');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Stub implementation'))).toBe(true);
      expect(hits[0]!.severity).toBe('high');
    });

    it("detects throw new Error('TODO')", async () => {
      const code = `function calculate() {\n  throw new Error("TODO");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/calc.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it("detects throw new Error('Implement this')", async () => {
      const code = `function save() {\n  throw new Error("Implement this");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/store.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it("detects throw new Error('Feature not yet implemented')", async () => {
      const code = `function exportPDF() {\n  throw new Error('Feature not yet implemented');\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/export.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it('detects return null; // TODO implement', async () => {
      const code = `export function calculateTax(amount: number): number {
  return null; // TODO implement tax calculation
}`;
      const findings = await engine.scan(makeDelta(code, '/src/utils/tax.ts'), signal);
      const hits = findByRule(findings, 'FAKE006');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Stub return with TODO'))).toBe(true);
    });

    it('detects return []; // FIXME', async () => {
      const code = `function getItems() {\n  return []; // FIXME\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/items.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it('detects return false; // STUB', async () => {
      const code = `function isValid() {\n  return false; // STUB\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/validate.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it("detects console.log('TODO: implement')", async () => {
      const code = `export function sendEmail(to: string, body: string) {
  console.log('TODO: implement email sending');
}`;
      const findings = await engine.scan(makeDelta(code, '/src/services/email.ts'), signal);
      const hits = findByRule(findings, 'FAKE006');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Console message admitting TODO'))).toBe(true);
    });

    it("detects console.warn('IMPLEMENT validation')", async () => {
      const code = `function validate() {\n  console.warn("IMPLEMENT validation logic");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/validate.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it("detects console.error('PLACEHOLDER')", async () => {
      const code = `function handle() {\n  console.error("PLACEHOLDER error handler");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/handle.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it("detects alert('clicked')", async () => {
      const code = `export function SaveButton() {
  return <button onClick={() => alert('clicked')}>Save</button>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE006');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('alert()'))).toBe(true);
    });

    it("detects alert('form submitted')", async () => {
      const code = `function onSubmit() {\n  alert("form submitted");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/form.tsx'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it("detects alert('saved')", async () => {
      const code = `function handleSave() {\n  alert("saved");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/save.ts'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });

    it('detects empty function body (arrow)', async () => {
      const code = `const handleClick = () => {};`;
      const findings = await engine.scan(makeDelta(code, '/src/handlers.ts'), signal);
      const hits = findByRule(findings, 'FAKE006');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Empty function body'))).toBe(true);
    });

    it('detects empty named function body', async () => {
      const code = `const processOrder = () => {}`;
      const findings = await engine.scan(makeDelta(code, '/src/orders.ts'), signal);
      expect(findByRule(findings, 'FAKE006').some((f) =>
        f.message.includes('Empty function body'),
      )).toBe(true);
    });

    it('does NOT flag empty function body in config files (FP prevention)', async () => {
      const code = `const onStart = () => {};`;
      const findings = await engine.scan(makeDelta(code, '/project/vite.config.ts'), signal);
      expect(findByRule(findings, 'FAKE006').filter((f) =>
        f.message.includes('Empty function body'),
      )).toHaveLength(0);
    });

    it('does NOT flag empty function body in jest.config (FP prevention)', async () => {
      const code = `const transform = (src) => {};`;
      const findings = await engine.scan(makeDelta(code, '/project/jest.config.ts'), signal);
      expect(findByRule(findings, 'FAKE006').filter((f) =>
        f.message.includes('Empty function body'),
      )).toHaveLength(0);
    });

    it('skips lifecycle methods (ngOnInit, componentDidMount)', async () => {
      const code = `ngOnInit() {}\ncomponentDidMount() {}`;
      const findings = await engine.scan(makeDelta(code, '/src/app.component.ts'), signal);
      expect(findByRule(findings, 'FAKE006').filter((f) =>
        f.message.includes('Empty function body'),
      )).toHaveLength(0);
    });

    it('skips noop-by-design functions', async () => {
      const code = `const noop = () => {};`;
      const findings = await engine.scan(makeDelta(code, '/src/utils.ts'), signal);
      expect(findByRule(findings, 'FAKE006').filter((f) =>
        f.message.includes('Empty function body'),
      )).toHaveLength(0);
    });

    it('detects class method with TODO comment', async () => {
      const code = `class PaymentService {
  processRefund(orderId: string): void { // TODO implement
    return;
  }
}`;
      const findings = await engine.scan(makeDelta(code, '/src/PaymentService.ts'), signal);
      const hits = findByRule(findings, 'FAKE006');
      expect(hits.some((f) => f.message.includes('Class method'))).toBe(true);
    });

    it('does NOT flag class-method-not-implemented on regular function declarations', async () => {
      const code = `export function processRefund(orderId: string): void { // TODO implement
  return;
}`;
      const findings = await engine.scan(makeDelta(code, '/src/refund.ts'), signal);
      const hits = findByRule(findings, 'FAKE006').filter((f) =>
        f.message.includes('Class method'),
      );
      expect(hits).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE007 — Dead Code Paths
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE007 — Dead Code', () => {
    it('detects if (false) {', async () => {
      const code = `export function feature() {
  if (false) {
    console.log('unreachable');
  }
  return 'active';
}`;
      const findings = await engine.scan(makeDelta(code, '/src/feature.ts'), signal);
      const hits = findByRule(findings, 'FAKE007');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('if (false)'))).toBe(true);
      expect(hits[0]!.severity).toBe('medium');
    });

    it('detects if (true) {', async () => {
      const code = `function main() {
  if (true) {
    console.log('always');
  }
}`;
      const findings = await engine.scan(makeDelta(code, '/src/main.ts'), signal);
      const hits = findByRule(findings, 'FAKE007');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('if (true)'))).toBe(true);
      expect(hits[0]!.severity).toBe('low');
    });

    it('does NOT flag if (true) with DEBUG/FEATURE keyword (FP prevention)', async () => {
      const code = `if (true) { // FEATURE enabled for all
  enableNewUI();
}`;
      const findings = await engine.scan(makeDelta(code, '/src/main.ts'), signal);
      const ifTrueHits = findByRule(findings, 'FAKE007').filter((f) =>
        f.message.includes('if (true)'),
      );
      expect(ifTrueHits).toHaveLength(0);
    });

    it('detects feature flags hardcoded to false', async () => {
      const code = `const isNewDashboardEnabled = false;
export function Dashboard() {
  if (isNewDashboardEnabled) {
    return <NewDashboard />;
  }
  return <LegacyDashboard />;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE007');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Feature flag hardcoded to false'))).toBe(true);
    });

    it('detects various feature flag names (showWidget, enableBeta, hasNewUI)', async () => {
      const flags = ['showWidget', 'enableBeta', 'hasNewUI', 'allowExport', 'useNewFeature'];
      for (const flag of flags) {
        const code = `const ${flag} = false;`;
        const findings = await engine.scan(makeDelta(code, '/src/flags.ts'), signal);
        const hits = findByRule(findings, 'FAKE007').filter((f) =>
          f.message.includes('Feature flag'),
        );
        expect(hits.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('does NOT flag feature flag with process.env nearby (FP prevention)', async () => {
      const code = `const featureFlags = process.env.FLAGS;
const isNewDashboardEnabled = false;
const fallback = config.getFlags();`;
      const findings = await engine.scan(makeDelta(code, '/src/features.ts'), signal);
      expect(findByRule(findings, 'FAKE007').filter((f) =>
        f.message.includes('Feature flag'),
      )).toHaveLength(0);
    });

    it('detects commented-out code blocks (3+ consecutive lines)', async () => {
      // The engine has a special case: comment lines are normally skipped,
      // but the commented-out-code-block pattern IS checked on comment lines.
      // With 3+ consecutive commented-out code lines, it fires.
      const code = `export function App() {
// const oldData = fetchLegacy();
// const result = transform(oldData);
// return render(result);
  return <div>New App</div>;
}`;
      const findings = await engine.scan(makeDelta(code, '/src/App.ts'), signal);
      const hits = findByRule(findings, 'FAKE007').filter((f) =>
        f.message.includes('Commented-out code'),
      );
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag 1-2 commented-out lines (requires 3+ consecutive)', async () => {
      const code = `function main() {
  // const old = getOld();
  const current = getCurrent();
}`;
      // Even if they somehow bypassed the comment pre-filter, the validate
      // requires 3+ consecutive commented code lines
      const findings = await engine.scan(makeDelta(code, '/src/main.ts'), signal);
      const commentHits = findByRule(findings, 'FAKE007').filter((f) =>
        f.message.includes('Commented-out code'),
      );
      expect(commentHits).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAKE008 — Fake Auth / Authorization
  // ═══════════════════════════════════════════════════════════════════════════

  describe('FAKE008 — Fake Auth', () => {
    it('detects isAuthenticated = true (critical)', async () => {
      const code = `export function useAuth() {
  const isAuthenticated = true;
  return { isAuthenticated, user: { name: 'Admin' } };
}`;
      const findings = await engine.scan(makeDelta(code, '/src/hooks/useAuth.ts'), signal);
      const hits = findByRule(findings, 'FAKE008');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.severity).toBe('critical');
      expect(hits.some((f) => f.message.includes('Authentication/authorization hardcoded'))).toBe(
        true,
      );
    });

    it('detects isLoggedIn = true', async () => {
      const code = `let isLoggedIn = true;`;
      const findings = await engine.scan(makeDelta(code, '/src/session.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('detects isAdmin = true', async () => {
      const code = `const isAdmin = true;`;
      const findings = await engine.scan(makeDelta(code, '/src/rbac.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it("detects hardcoded role = 'admin'", async () => {
      const code = `export function getUserPermissions() {
  const role = 'admin';
  return { role, canDelete: true };
}`;
      const findings = await engine.scan(makeDelta(code, '/src/auth/permissions.ts'), signal);
      const hits = findByRule(findings, 'FAKE008');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits[0]!.severity).toBe('critical');
      expect(hits.some((f) => f.message.includes('User role hardcoded'))).toBe(true);
    });

    it("detects hardcoded userRole = 'superadmin'", async () => {
      const code = `const userRole = "superadmin";`;
      const findings = await engine.scan(makeDelta(code, '/src/rbac.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it("detects hardcoded currentRole = 'root'", async () => {
      const code = `const currentRole = "root";`;
      const findings = await engine.scan(makeDelta(code, '/src/admin.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('detects hardcoded JWT token (eyJ...)', async () => {
      const code = `const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';`;
      const findings = await engine.scan(makeDelta(code, '/src/api.ts'), signal);
      const hits = findByRule(findings, 'FAKE008');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Hardcoded authentication token'))).toBe(true);
      expect(hits[0]!.severity).toBe('critical');
    });

    it('detects hardcoded sk- API key', async () => {
      const code = `const apiKey = "sk-1234567890abcdefghijklmnop";`;
      const findings = await engine.scan(makeDelta(code, '/src/openai.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('detects hardcoded Bearer token', async () => {
      const code = `const authToken = "Bearer eyJhbGciOiJIUzI1NiJ9.long_token_here";`;
      const findings = await engine.scan(makeDelta(code, '/src/client.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('detects bypassed auth check with TODO comment', async () => {
      const code = `export function authMiddleware(req, res, next) {
  return next(); // bypass auth check
}`;
      const findings = await engine.scan(makeDelta(code, '/src/middleware/auth.ts'), signal);
      const hits = findByRule(findings, 'FAKE008');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Auth check bypassed'))).toBe(true);
    });

    it('detects return true; // skip auth', async () => {
      const code = `function isAllowed(user) {
  return true; // skip auth
}`;
      const findings = await engine.scan(makeDelta(code, '/src/guard.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('detects return true; // bypass auth check', async () => {
      const code = `function checkPermission() {
  return true; // bypass auth check
}`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('detects fake session user object', async () => {
      const code = `const currentUser = { id: '1', name: 'Admin', role: 'admin' };`;
      const findings = await engine.scan(makeDelta(code, '/src/context.ts'), signal);
      const hits = findByRule(findings, 'FAKE008');
      expect(hits.length).toBeGreaterThanOrEqual(1);
      expect(hits.some((f) => f.message.includes('Hardcoded session'))).toBe(true);
    });

    it('detects session = { userId: 1, email: ... }', async () => {
      const code = `const session = { userId: 1, email: 'admin@co.com' };`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.ts'), signal);
      expect(findByRule(findings, 'FAKE008').length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT flag auth patterns in test files (FP prevention)', async () => {
      const code = `const isAuthenticated = true;\nconst role = 'admin';`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.test.ts'), signal);
      expect(findings).toHaveLength(0);
    });

    it('does NOT flag fake session in seed files (FP prevention)', async () => {
      const code = `const currentUser = { id: '1', name: 'Admin', role: 'admin' };`;
      const findings = await engine.scan(makeDelta(code, '/src/seed-users.ts'), signal);
      const hits = findByRule(findings, 'FAKE008').filter((f) =>
        f.message.includes('Hardcoded session'),
      );
      expect(hits).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — File Exclusions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — file exclusions', () => {
    it('returns zero findings for .test.ts files', async () => {
      const code = `const isAuthenticated = true;\nonClick={() => {}}\n<div></div>`;
      const findings = await engine.scan(
        makeDelta(code, '/src/components/App.test.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for .test.tsx files', async () => {
      const code = `const isAuthenticated = true;`;
      const findings = await engine.scan(
        makeDelta(code, '/src/Auth.test.tsx'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for .spec.tsx files', async () => {
      const code = `const isAuthenticated = true;`;
      const findings = await engine.scan(
        makeDelta(code, '/src/components/App.spec.tsx'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for .spec.js files', async () => {
      const code = `const role = 'admin';`;
      const findings = await engine.scan(
        makeDelta(code, '/src/auth.spec.js'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for Storybook files (.stories.tsx)', async () => {
      const code = `const role = 'admin';\n<div></div>`;
      const findings = await engine.scan(
        makeDelta(code, '/src/components/Button.stories.tsx'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for Storybook files (.stories.mdx)', async () => {
      const code = `const isAuthenticated = true;`;
      const findings = await engine.scan(
        makeDelta(code, '/src/Auth.stories.mdx'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for __tests__ directory', async () => {
      const code = `const isAuthenticated = true;`;
      const findings = await engine.scan(
        makeDelta(code, '/src/__tests__/auth.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for __mocks__ directory', async () => {
      const code = `const user = { name: 'John Doe' };`;
      const findings = await engine.scan(
        makeDelta(code, '/src/__mocks__/data.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for fixtures directory', async () => {
      const code = `const isAuthenticated = true;`;
      const findings = await engine.scan(
        makeDelta(code, '/src/fixtures/auth-mock.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for cypress directory', async () => {
      const code = `const isAuthenticated = true;\nalert('test');`;
      const findings = await engine.scan(
        makeDelta(code, '/project/cypress/support/commands.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for playwright directory', async () => {
      const code = `const role = 'admin';`;
      const findings = await engine.scan(
        makeDelta(code, '/project/playwright/tests/auth.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });

    it('returns zero findings for e2e directory', async () => {
      const code = `const isLoggedIn = true;`;
      const findings = await engine.scan(
        makeDelta(code, '/project/e2e/login.ts'),
        signal,
      );
      expect(findings).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — Extension Filtering
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — extension filtering', () => {
    it('does NOT flag empty <div> in .ts files (requires .tsx/.jsx/.html)', async () => {
      const code = `const html = '<div></div>';`;
      const findings = await engine.scan(makeDelta(code, '/src/utils/render.ts'), signal);
      const hits = findByRule(findings, 'FAKE001').filter((f) =>
        f.message.includes('Empty <div>'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag noop onClick in .ts files (requires .tsx/.jsx)', async () => {
      const code = `const config = { onClick: () => {} };`;
      const findings = await engine.scan(makeDelta(code, '/src/config.ts'), signal);
      const hits = findByRule(findings, 'FAKE004').filter((f) =>
        f.message.includes('Noop event handler'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag empty useEffect in .ts files (requires .tsx/.jsx)', async () => {
      const code = `useEffect(() => {}, []);`;
      const findings = await engine.scan(makeDelta(code, '/src/hooks/useData.ts'), signal);
      const hits = findByRule(findings, 'FAKE004').filter((f) =>
        f.message.includes('Empty useEffect'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag empty useCallback in .ts files (requires .tsx/.jsx)', async () => {
      const code = `const cb = useCallback(() => {}, []);`;
      const findings = await engine.scan(makeDelta(code, '/src/hooks.ts'), signal);
      const hits = findByRule(findings, 'FAKE004').filter((f) =>
        f.message.includes('Empty useCallback'),
      );
      expect(hits).toHaveLength(0);
    });

    it('does NOT flag mock arrays in .ts files (requires .tsx/.jsx)', async () => {
      const code = `const users = [\n  { id: 1, name: "Alice" },\n];`;
      const findings = await engine.scan(makeDelta(code, '/src/data.ts'), signal);
      const hits = findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('Hardcoded data array'),
      );
      expect(hits).toHaveLength(0);
    });

    it('detects non-extension-filtered patterns in any file type', async () => {
      // Lorem ipsum has no extension filter
      const code = `const text = "Lorem ipsum dolor sit amet, consectetur adipiscing";`;
      const findings = await engine.scan(makeDelta(code, '/src/data/content.ts'), signal);
      const hits = findByRule(findings, 'FAKE003');
      expect(hits.length).toBeGreaterThanOrEqual(1);
    });

    it('placeholder images match in any file extension', async () => {
      const code = `const url = 'https://via.placeholder.com/300';`;
      const findings = await engine.scan(makeDelta(code, '/src/constants.ts'), signal);
      expect(findByRule(findings, 'FAKE003').length).toBeGreaterThanOrEqual(1);
    });

    it('throw-not-implemented matches in any file extension', async () => {
      const code = `function process() {\n  throw new Error("Not implemented");\n}`;
      const findings = await engine.scan(makeDelta(code, '/src/handler.py'), signal);
      expect(findByRule(findings, 'FAKE006').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — Comment Line Skipping
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — comment line skipping', () => {
    it('skips lines starting with //', async () => {
      const code = `// const isAuthenticated = true;\nconst x = 1;`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.ts'), signal);
      expect(findByRule(findings, 'FAKE008')).toHaveLength(0);
    });

    it('skips lines starting with /*', async () => {
      const code = `/* throw new Error('Not implemented'); */\nconst x = 1;`;
      const findings = await engine.scan(makeDelta(code, '/src/service.ts'), signal);
      expect(findByRule(findings, 'FAKE006').filter((f) =>
        f.message.includes('Stub'),
      )).toHaveLength(0);
    });

    it('skips lines starting with * (block comment continuation)', async () => {
      const code = `/**\n * const role = 'admin';\n */\nconst x = 1;`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.ts'), signal);
      expect(findByRule(findings, 'FAKE008').filter((f) =>
        f.message.includes('role'),
      )).toHaveLength(0);
    });

    it('skips lines starting with {/* (JSX comment)', async () => {
      const code = `{/* <div></div> */}`;
      const findings = await engine.scan(makeDelta(code, '/src/Page.tsx'), signal);
      expect(findByRule(findings, 'FAKE001')).toHaveLength(0);
    });

    it('skips empty/blank lines', async () => {
      const code = `\n\n\n`;
      const findings = await engine.scan(makeDelta(code, '/src/empty.ts'), signal);
      expect(findings).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — Deterministic IDs
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — deterministic IDs', () => {
    it('produces deterministic IDs across re-scans', async () => {
      const code = `export function Broken() {
  return <div></div>;
}`;
      const delta = makeDelta(code);
      const run1 = await engine.scan(delta, signal);
      const run2 = await engine.scan(delta, signal);

      expect(run1.length).toBeGreaterThan(0);
      expect(run1.length).toBe(run2.length);
      for (let i = 0; i < run1.length; i++) {
        expect(run1[i]!.id).toBe(run2[i]!.id);
      }
    });

    it('produces different IDs for different files with same code', async () => {
      const code = `export function Broken() {
  return <div></div>;
}`;
      const findings1 = await engine.scan(makeDelta(code, '/src/A.tsx'), signal);
      const findings2 = await engine.scan(makeDelta(code, '/src/B.tsx'), signal);

      expect(findings1.length).toBeGreaterThan(0);
      expect(findings2.length).toBeGreaterThan(0);
      expect(findings1[0]!.id).not.toBe(findings2[0]!.id);
    });

    it('IDs use fake- prefix with 8 hex chars', async () => {
      const code = `throw new Error('Not implemented');`;
      const findings = await engine.scan(makeDelta(code, '/src/stub.ts'), signal);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.id).toMatch(/^fake-[0-9a-f]{8}$/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — Deduplication
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — deduplication', () => {
    it('same rule + same line = one finding per pattern name', async () => {
      // A single line with user data
      const code = `const user = { name: 'John Doe', username: 'John Smith' };`;
      const findings = await engine.scan(makeDelta(code, '/src/user.tsx'), signal);
      const userDataHits = findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('fake user data'),
      );
      // Dedup key is ruleId:patternName:lineIndex
      const lineNumbers = userDataHits.map((f) => f.line);
      const uniqueLines = new Set(lineNumbers);
      expect(lineNumbers.length).toBe(uniqueLines.size);
    });

    it('same rule on different lines produces separate findings', async () => {
      const code = `const a = { name: 'John Doe' };\nconst b = { name: 'Jane Doe' };`;
      const findings = await engine.scan(makeDelta(code, '/src/users.tsx'), signal);
      const userHits = findByRule(findings, 'FAKE005').filter((f) =>
        f.message.includes('fake user data'),
      );
      expect(userHits.length).toBe(2);
      expect(userHits[0]!.line).not.toBe(userHits[1]!.line);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — Finding Structure
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — finding structure', () => {
    it('findings have all required fields from Finding interface', async () => {
      const code = `export function Noop() {
  return <button onClick={() => {}}>Click</button>;
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings.length).toBeGreaterThan(0);

      const f = findings[0]!;
      expect(f.id).toBeDefined();
      expect(f.id).toMatch(/^fake-[0-9a-f]{8}$/);
      expect(f.engine).toBe('fake_features');
      expect(f.severity).toBeDefined();
      expect(f.category).toBe('fake_features');
      expect(f.file).toBe('/src/components/App.tsx');
      expect(f.line).toBeGreaterThan(0);
      expect(typeof f.column).toBe('number');
      expect(f.message).toBeDefined();
      expect(f.evidence).toBeDefined();
      expect(f.suggestion).toBeDefined();
      expect(f.confidence).toBeGreaterThan(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
      expect(f.autoFixable).toBe(false);
      expect(f.ruleId).toBeDefined();
    });

    it('confidence is a fraction between 0 and 1', async () => {
      const code = `const isAuthenticated = true;`;
      const findings = await engine.scan(makeDelta(code, '/src/auth.ts'), signal);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.confidence).toBeGreaterThan(0);
      expect(findings[0]!.confidence).toBeLessThanOrEqual(1);
    });

    it('evidence is truncated at 120 characters with ellipsis', async () => {
      const longLine =
        `  return <button onClick={() => {}}>${'A'.repeat(200)}</button>;`;
      const code = `export function LongLine() {\n${longLine}\n}`;
      const findings = await engine.scan(makeDelta(code), signal);
      const hits = findByRule(findings, 'FAKE004');
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]!.evidence.length).toBeLessThanOrEqual(120);
      expect(hits[0]!.evidence).toMatch(/\.\.\.$/);
    });

    it('short evidence is not truncated or ellipsized', async () => {
      const code = `throw new Error('Not implemented');`;
      const findings = await engine.scan(makeDelta(code, '/src/stub.ts'), signal);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.evidence).not.toMatch(/\.\.\.$/);
    });

    it('autoFixable is always false', async () => {
      const code = `const isAuthenticated = true;\nonClick={() => {}}`;
      const findings = await engine.scan(makeDelta(code, '/src/Page.tsx'), signal);
      expect(findings.length).toBeGreaterThan(0);
      for (const f of findings) {
        expect(f.autoFixable).toBe(false);
      }
    });

    it('line numbers are 1-based', async () => {
      const code = `const x = 1;\nconst y = 2;\nthrow new Error('Not implemented');`;
      const findings = await engine.scan(makeDelta(code, '/src/stub.ts'), signal);
      const hit = findByRule(findings, 'FAKE006')[0];
      expect(hit).toBeDefined();
      expect(hit!.line).toBe(3);
    });

    it('includes endLine and endColumn', async () => {
      const code = `throw new Error('Not implemented');`;
      const findings = await engine.scan(makeDelta(code, '/src/stub.ts'), signal);
      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0]!.endLine).toBeDefined();
      expect(findings[0]!.endColumn).toBeDefined();
      expect(findings[0]!.endColumn).toBeGreaterThan(findings[0]!.column);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-cutting — AbortSignal
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Cross-cutting — AbortSignal', () => {
    it('respects AbortSignal and stops scanning early', async () => {
      const lines = Array.from({ length: 500 }, (_, i) =>
        `  const price${i} = 9.99;`,
      ).join('\n');
      const code = `export function Prices() {\n${lines}\n}`;
      const controller = new AbortController();
      controller.abort();
      const findings = await engine.scan(makeDelta(code, '/src/Prices.tsx'), controller.signal);
      expect(findings.length).toBe(0);
    });

    it('works normally without a signal (optional parameter)', async () => {
      const code = `throw new Error('Not implemented');`;
      const findings = await engine.scan(makeDelta(code, '/src/stub.ts'));
      expect(findings.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Clean code — no false positives
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clean code produces no findings', () => {
    it('returns empty array for well-implemented component', async () => {
      const code = `import { useState, useEffect } from "react";

export default function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(\`/api/users/\${userId}\`)
      .then(res => res.json())
      .then(data => { setUser(data); setLoading(false); })
      .catch(err => { console.error("Failed to fetch user:", err); setLoading(false); });
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="profile">
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
}`;
      const findings = await engine.scan(makeDelta(code), signal);
      expect(findings).toHaveLength(0);
    });
  });
});
