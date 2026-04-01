import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dependency Scanners Don’t Validate Runtime Reality",
  description:
    "OWASP dependency check finds vulnerable dependencies but doesn't validate runtime behavior. Learn the gap and how to add a reality gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function OWASPRuntimeTruthPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Dependency Scanners Don't Validate Runtime Reality</h1>

      <p>
        OWASP Dependency Check is excellent at finding vulnerable dependencies.
        But it cannot validate <strong>runtime truth</strong>—whether your code
        actually uses real services or fake fallbacks.
      </p>

      <h2>What dependency scanners catch</h2>

      <ul>
        <li>Vulnerable dependencies</li>
        <li>Outdated packages</li>
        <li>Known CVEs</li>
        <li>License compliance issues</li>
        <li>Malicious packages</li>
      </ul>

      <h2>What dependency scanners miss</h2>

      <ul>
        <li>Mock data serving real users</li>
        <li>Fallback clients returning fabricated responses</li>
        <li>Missing env vars triggering stubs</li>
        <li>Placeholder API endpoints in production</li>
        <li>Fake database connections</li>
      </ul>

      <h2>The gap</h2>

      <p>
        Dependency scanners validate <strong>what you depend on</strong>.
        Runtime truth validates <strong>how your code behaves</strong>. A
        dependency can be perfectly secure, but if your code falls back to a
        fake client when config is missing, production still serves fake data.
      </p>

      <h2>The solution: Add a reality gate</h2>

      <p>Complement dependency scanning with a deploy gate that validates:</p>

      <ul>
        <li>Runtime service wiring</li>
        <li>Endpoint contract enforcement</li>
        <li>Auth coverage verification</li>
        <li>Mock/stub detection</li>
      </ul>

      <h2>Practical example</h2>

      <pre>
        <code>
          # OWASP dependency check (existing) dependency-check --scan ./src #
          Add reality gate (new) npx guardrail mockproof npx guardrail gate
        </code>
      </pre>

      <h2>Result</h2>

      <p>
        Dependency scanners protect against vulnerable packages. The reality
        gate protects against fake behavior. Together they secure both
        dependencies and runtime.
      </p>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
