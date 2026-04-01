import { Metadata } from "next";

export const metadata: Metadata = {
  title: "CI Passed. Production Failed. Here’s Why.",
  description:
    "CI proves compilation and tests; production proves reality. Learn the failure patterns and add a gate that blocks deploys when “real wiring” is missing.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function CIPassedProductionBugPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>CI Passed. Production Failed. Here’s Why.</h1>

      <p>
        Passing CI is not proof of production readiness. CI validates{" "}
        <strong>syntax and test expectations</strong>. Production exposes{" "}
        <strong>runtime truth</strong>: env, wiring, auth, real APIs, real data,
        real load.
      </p>

      <h2>The 6 patterns that cause "CI green, prod broken"</h2>

      <h3>1) Stubs that look real</h3>
      <p>
        A function returns a valid object, but it's fabricated or incomplete.
      </p>

      <h3>2) Mocked integration boundaries</h3>
      <p>
        Tests mock the database/client/auth layer so nothing real is exercised.
      </p>

      <h3>3) Missing configuration</h3>
      <p>
        Env variables are absent or misnamed, so code falls back to "safe
        defaults" (which are often fake).
      </p>

      <h3>4) Dead routes and placeholders</h3>
      <p>
        Routes exist but contain placeholder handlers or incomplete logic that
        never got hit.
      </p>

      <h3>5) Auth / RBAC isn't enforced</h3>
      <p>CI doesn't simulate real permissions and token paths.</p>

      <h3>6) Monorepo drift</h3>
      <p>
        Frontend calls endpoints that don't match the backend, and tests never
        cover the mismatch.
      </p>

      <h2>The fix: a deploy gate that checks reality, not just correctness</h2>

      <p>A practical gate checks:</p>

      <ul>
        <li>endpoint mapping (frontend ↔ backend)</li>
        <li>auth coverage (who can call what)</li>
        <li>mock/stub imports</li>
        <li>unused or placeholder route handlers</li>
        <li>required env vars present</li>
      </ul>

      <h2>One-command gate (example)</h2>

      <pre>
        <code>npx guardrail gate</code>
      </pre>

      <h2>What "reality" looks like in a build</h2>

      <p>CI should fail on this:</p>

      <ul>
        <li>✓ TypeScript compiled</li>
        <li>✓ Unit tests passed</li>
        <li>✗ API endpoints mismatch</li>
        <li>✗ Mock client imported in production build</li>
        <li>✗ Required env var missing: DATABASE_URL</li>
      </ul>

      <h2>If you want fewer production surprises</h2>

      <ul>
        <li>Add a gate before deploy</li>
        <li>Block merges on "reality failures"</li>
        <li>
          Treat fake data and placeholder wiring as build-breaking defects
        </li>
      </ul>
    </article>
  );
}
