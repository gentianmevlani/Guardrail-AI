import { Metadata } from "next";

export const metadata: Metadata = {
  title: "GitHub Actions Isn’t a Safety Net Without a Reality Gate",
  description:
    "GitHub Actions automates CI/CD but doesn't validate runtime reality. Learn the gap and how to add a reality gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function GitHubActionsProdReadinessPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>GitHub Actions Isn't a Safety Net Without a Reality Gate</h1>

      <p>
        GitHub Actions is excellent at automating CI/CD pipelines. But it
        doesn't automatically validate <strong>runtime reality</strong>—it only
        runs the tests you configure. If your tests don't check for mocks, mocks
        can ship.
      </p>

      <h2>What GitHub Actions provides</h2>

      <ul>
        <li>Automated test execution</li>
        <li>Build and deployment pipelines</li>
        <li>Integration with other tools (linters, scanners)</li>
        <li>Workflow automation</li>
        <li>Artifact management</li>
      </ul>

      <h2>What GitHub Actions misses by default</h2>

      <ul>
        <li>Mock/stub detection in builds</li>
        <li>Runtime service wiring validation</li>
        <li>Endpoint contract enforcement</li>
        <li>Auth coverage verification</li>
        <li>Real vs fake service detection</li>
      </ul>

      <h2>The gap</h2>

      <p>
        GitHub Actions runs <strong>what you tell it to run</strong>. If you
        don't add a reality check step, it won't check for reality. Passing
        tests and green builds don't prove production readiness—they only prove
        your configured checks passed.
      </p>

      <h2>The solution: Add a reality gate step</h2>

      <p>Add a step to your GitHub Actions workflow that validates:</p>

      <ul>
        <li>Mock/stub imports excluded from production builds</li>
        <li>Build artifacts don't contain fixtures</li>
        <li>Real service wiring verified</li>
        <li>Required env vars present</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>
          # .github/workflows/ci.yml name: CI on: [push, pull_request] jobs:
          test: runs-on: ubuntu-latest steps: - uses: actions/checkout@v3 -
          uses: actions/setup-node@v3 - run: npm ci - run: npm test - run: npx
          guardrail mockproof # Add this - run: npx guardrail gate # Add this
        </code>
      </pre>

      <h2>Result</h2>

      <p>
        GitHub Actions automates your pipeline. The reality gate validates
        production readiness. Together they ensure deployments are both
        automated and real.
      </p>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
