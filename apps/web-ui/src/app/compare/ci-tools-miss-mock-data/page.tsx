import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why CI Tools Miss Mock Data (and How to Block It)",
  description:
    "Static checks and tests can pass while mocks and fake API responses still ship. This page explains the blind spot and the gating pattern that closes it.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function CIToolsMissMockDataPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Why CI Tools Miss Mock Data (and How to Block It)</h1>

      <p>
        Most CI stacks validate compilation, linting, tests, and
        vulnerabilities. That's necessary, but it's not sufficient. Mock data
        can ship because it is <strong>valid code</strong>.
      </p>

      <h2>The blind spot</h2>

      <p>CI is optimized for:</p>

      <ul>
        <li>correctness against a test environment</li>
        <li>code style and type safety</li>
        <li>known vulnerability patterns</li>
      </ul>

      <p>It is not optimized for:</p>

      <ul>
        <li>detecting "fake" runtime behavior</li>
        <li>identifying stubs that return plausible data</li>
        <li>verifying real wiring (env/auth/endpoints)</li>
      </ul>

      <h2>The common failure mode</h2>

      <ul>
        <li>Tests mock services → green build</li>
        <li>App deploys with fallback clients → fake responses</li>
        <li>Users see "valid-looking" data → silent corruption</li>
      </ul>

      <h2>The blocking pattern</h2>

      <p>Add a dedicated step that checks:</p>

      <ul>
        <li>mock/stub imports in production build graph</li>
        <li>
          build artifacts include no <code>__mocks__</code>,{" "}
          <code>fixtures</code>, <code>seed</code> content
        </li>
        <li>env vars required for real services are present</li>
        <li>placeholder handlers and dead routes are flagged</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>npx guardrail mockproof npx guardrail gate</code>
      </pre>

      <h2>What success looks like</h2>

      <p>
        Your pipeline fails early, loudly, and specifically — before production
        sees fake data.
      </p>
    </article>
  );
}
