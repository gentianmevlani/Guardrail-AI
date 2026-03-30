import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Why SonarQube Misses Mock Data in Production (and what to add)",
  description:
    "SonarQube detects code quality issues but doesn't validate runtime reality. Learn the blind spot and how to add a reality gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function SonarQubeMockDataPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Why SonarQube Misses Mock Data in Production (and what to add)</h1>

      <p>
        SonarQube is excellent at detecting code smells, bugs, and
        vulnerabilities. But it cannot detect{" "}
        <strong>mock data in production</strong> because mocks are valid code.
      </p>

      <h2>What SonarQube catches</h2>

      <ul>
        <li>Code complexity and maintainability issues</li>
        <li>Common bugs and anti-patterns</li>
        <li>Security vulnerabilities</li>
        <li>Code coverage gaps</li>
        <li>Duplications and dead code</li>
      </ul>

      <h2>What SonarQube misses</h2>

      <ul>
        <li>Mock libraries imported in production builds</li>
        <li>Fallback clients returning fake data</li>
        <li>Missing env vars triggering stubs</li>
        <li>Placeholder handlers in deployed routes</li>
        <li>Build artifacts containing fixtures</li>
      </ul>

      <h2>The blind spot</h2>

      <p>
        SonarQube analyzes <strong>static code structure</strong>. Mock data in
        production is a <strong>runtime behavior issue</strong>. A function that
        returns fake data is syntactically correct, type-safe, and passes all
        SonarQube rules.
      </p>

      <h2>The solution: Add a reality gate</h2>

      <p>Complement SonarQube with a deploy gate that checks:</p>

      <ul>
        <li>Import graph for mock/stub patterns</li>
        <li>Build artifact inspection</li>
        <li>Runtime configuration validation</li>
        <li>Endpoint wiring verification</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>
          # SonarQube scan (existing) sonar-scanner # Add reality gate (new) npx
          guardrail mockproof npx guardrail gate
        </code>
      </pre>

      <h2>Result</h2>

      <p>
        SonarQube ensures code quality. The reality gate ensures production
        reality. Together they prevent both bad code and fake data.
      </p>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
