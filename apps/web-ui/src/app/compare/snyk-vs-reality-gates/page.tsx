import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why Snyk Doesn’t Catch Fake Runtime Behavior",
  description:
    "Snyk detects dependencies and vulnerabilities but doesn't validate runtime reality. Learn the gap and how to add a reality gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function SnykRealityGatesPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Why Snyk Doesn’t Catch Fake Runtime Behavior</h1>

      <p>
        Snyk is excellent at finding vulnerable dependencies and security
        issues. But it cannot detect <strong>fake runtime behavior</strong>{" "}
        because mocks and stubs are not security vulnerabilities.
      </p>

      <h2>What Snyk catches</h2>

      <ul>
        <li>Vulnerable dependencies</li>
        <li>Known security vulnerabilities</li>
        <li>License compliance issues</li>
        <li>Container image vulnerabilities</li>
        <li>IaC security misconfigurations</li>
      </ul>

      <h2>What Snyk misses</h2>

      <ul>
        <li>Mock data serving real users</li>
        <li>Fallback clients returning fabricated responses</li>
        <li>Placeholder API endpoints in production</li>
        <li>Missing auth checks (not a vuln, just missing)</li>
        <li>Fake database connections</li>
      </ul>

      <h2>The gap</h2>

      <p>
        Snyk scans for <strong>known bad patterns</strong>. Mock data in
        production is a <strong>valid pattern applied incorrectly</strong>. A
        fallback client is not a vulnerability—it's a feature that's being used
        in the wrong context.
      </p>

      <h2>The solution: Add a reality gate</h2>

      <p>Complement Snyk with a deploy gate that validates:</p>

      <ul>
        <li>Runtime service wiring</li>
        <li>Endpoint contract enforcement</li>
        <li>Auth coverage verification</li>
        <li>Mock/stub detection</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>
          # Snyk scan (existing) snyk test # Add reality gate (new) npx
          guardrail mockproof npx guardrail gate
        </code>
      </pre>

      <h2>Result</h2>

      <p>
        Snyk protects against known vulnerabilities. The reality gate protects
        against fake behavior. Together they secure both dependencies and
        runtime.
      </p>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
