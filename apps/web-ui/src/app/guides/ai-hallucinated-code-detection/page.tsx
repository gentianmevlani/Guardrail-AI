import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI-Generated Code Hallucinations Are Reaching Production",
  description:
    "AI code often fails silently because it looks valid. Learn the detection signals and add a reality gate for fabricated APIs, placeholders, and fake logic.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function AIHallucinatedCodeDetectionPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>AI-Generated Code Hallucinations Are Reaching Production</h1>

      <p>
        AI code fails silently because it looks syntactically valid. It
        compiles. It type-checks. It may even pass tests. And then it breaks
        reality.
      </p>

      <h2>What an "AI code hallucination" is (practically)</h2>

      <ul>
        <li>A fabricated API call that doesn't exist</li>
        <li>Placeholder logic that returns "reasonable" data</li>
        <li>Inferred behavior that isn't true for your codebase</li>
        <li>A confident but wrong implementation with no runtime proof</li>
      </ul>

      <h2>The 7 hallucination signals that show up in real repos</h2>

      <ol>
        <li>"TODO: implement" left in critical paths</li>
        <li>Hardcoded responses "for now"</li>
        <li>Missing error handling around network/auth</li>
        <li>Incorrect imports from internal packages</li>
        <li>Fake endpoints or wrong URL paths</li>
        <li>Functions with suspiciously generic return objects</li>
        <li>Tests that only validate shape, not truth</li>
      </ol>

      <h2>Why existing tools miss this</h2>

      <p>Static analyzers catch:</p>

      <ul>
        <li>syntax, types, known vulnerabilities</li>
      </ul>

      <p>They don't catch:</p>

      <ul>
        <li>fabricated behavior that passes types</li>
        <li>fake but plausible data</li>
        <li>"real wiring" absent at runtime</li>
      </ul>

      <h2>The fix: reality checks + mockproofing</h2>

      <p>A practical detection setup:</p>

      <ul>
        <li>block mock/fake paths from production builds</li>
        <li>verify endpoint contracts</li>
        <li>validate required env vars and service wiring</li>
        <li>flag placeholder branches in production-only code</li>
      </ul>

      <h2>One-command detection (example)</h2>

      <pre>
        <code>npx guardrail scan</code>
      </pre>

      <h3>CI enforcement</h3>

      <pre>
        <code>npx guardrail gate</code>
      </pre>

      <h2>Result: AI becomes safe to ship</h2>

      <p>The goal is not "don't use AI."</p>

      <p>
        The goal is: <strong>AI code can't ship unless it's real.</strong>
      </p>
    </article>
  );
}
