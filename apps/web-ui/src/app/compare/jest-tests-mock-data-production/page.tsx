import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tests Can Pass While Mock Data Ships — The Prevention Pattern",
  description:
    "Jest tests validate code against mocks, but mocks can ship to production. Learn the gap and how to add a reality gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function JestMockDataProductionPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Tests Can Pass While Mock Data Ships — The Prevention Pattern</h1>

      <p>
        Jest is excellent at testing code behavior. But when tests use mocks,
        those mocks can accidentally ship to production. Passing tests don't
        prove production readiness.
      </p>

      <h2>What Jest validates</h2>

      <ul>
        <li>Code behavior against test expectations</li>
        <li>Function outputs with given inputs</li>
        <li>Component rendering and interactions</li>
        <li>Async operations and promises</li>
        <li>Error handling paths</li>
      </ul>

      <h2>What Jest misses</h2>

      <ul>
        <li>Mock libraries included in production builds</li>
        <li>Test fixtures in deployed artifacts</li>
        <li>Fallback clients triggered by missing config</li>
        <li>Placeholder handlers in production routes</li>
        <li>Real service wiring validation</li>
      </ul>

      <h2>The gap</h2>

      <p>
        Jest tests <strong>against mocks</strong>. If those mocks are
        accidentally included in production, the tests still pass—but production
        serves fake data. Tests validate <em>behavior</em>, not <em>reality</em>
        .
      </p>

      <h2>The solution: Add a reality gate</h2>

      <p>Complement Jest with a deploy gate that validates:</p>

      <ul>
        <li>Mock/stub imports excluded from production builds</li>
        <li>Test fixtures not in build artifacts</li>
        <li>Real service wiring verified</li>
        <li>Required env vars present</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>
          # Jest tests (existing) npm test # Add reality gate (new) npx
          guardrail mockproof npx guardrail gate
        </code>
      </pre>

      <h2>Result</h2>

      <p>
        Jest ensures code works correctly. The reality gate ensures code uses
        real services. Together they prevent both broken logic and fake data.
      </p>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
