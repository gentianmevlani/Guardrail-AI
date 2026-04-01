import { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "ESLint Can’t Prevent “CI Passed, Prod Failed” — Here’s the Missing Layer",
  description:
    "ESLint enforces code style and patterns but doesn't validate runtime reality. Learn the gap and how to add a reality gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function EsLintCIPassedProdFailedPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>
        ESLint Can't Prevent "CI Passed, Prod Failed" — Here's the Missing Layer
      </h1>

      <p>
        ESLint is excellent at enforcing code style, catching syntax errors, and
        preventing common bugs. But it cannot prevent{" "}
        <strong>"CI passed, prod failed"</strong> scenarios because it doesn't
        validate runtime reality.
      </p>

      <h2>What ESLint catches</h2>

      <ul>
        <li>Syntax errors and typos</li>
        <li>Code style inconsistencies</li>
        <li>Unused variables and imports</li>
        <li>Common bugs and anti-patterns</li>
        <li>Security best practices</li>
      </ul>

      <h2>What ESLint misses</h2>

      <ul>
        <li>Mock clients in production builds</li>
        <li>Missing env vars triggering fallbacks</li>
        <li>Endpoint mismatches between frontend/backend</li>
        <li>Placeholder handlers in deployed routes</li>
        <li>Auth checks missing at runtime</li>
      </ul>

      <h2>The gap</h2>

      <p>
        ESLint validates <strong>code correctness</strong>. "CI passed, prod
        failed" is a <strong>runtime wiring issue</strong>. Code can be
        perfectly linted, type-safe, and styled correctly—but still fail in
        production because it's wired to fake services.
      </p>

      <h2>The solution: Add a reality gate</h2>

      <p>Complement ESLint with a deploy gate that validates:</p>

      <ul>
        <li>Frontend-backend endpoint mapping</li>
        <li>Auth coverage across routes</li>
        <li>Mock/stub import detection</li>
        <li>Required environment variables</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>
          # ESLint (existing) eslint src/ # Add reality gate (new) npx guardrail
          mockproof npx guardrail gate
        </code>
      </pre>

      <h2>Result</h2>

      <p>
        ESLint ensures code quality. The reality gate ensures runtime wiring.
        Together they prevent both bad code and broken deployments.
      </p>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
