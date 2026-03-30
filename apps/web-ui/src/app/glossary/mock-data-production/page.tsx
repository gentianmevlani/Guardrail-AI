import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mock Data in Production (Definition + Prevention)",
  description:
    "Definition: mock data in production, why it occurs, symptoms, and the prevention gate pattern used to block it in CI.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function MockDataProductionGlossaryPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Mock data in production</h1>

      <p>
        <strong>Mock data in production</strong> is when test-only fixtures,
        stubbed service responses, or simulated API behavior ships in a real
        deploy and is served to real users or downstream systems.
      </p>

      <h2>Why it happens</h2>

      <ul>
        <li>mocks are valid code and often compile cleanly</li>
        <li>tests validate shapes and flows, not real integrations</li>
        <li>runtime configuration missing triggers fallbacks</li>
        <li>shared monorepo packages hide dev-only imports</li>
      </ul>

      <h2>Symptoms</h2>

      <ul>
        <li>plausible but wrong data appears in UI or APIs</li>
        <li>"demo" content leaks into real sessions</li>
        <li>production incidents with no obvious stack traces</li>
      </ul>

      <h2>Prevention</h2>

      <p>
        The most reliable prevention is a <strong>deploy gate</strong> that
        blocks builds containing:
      </p>

      <ul>
        <li>mock libraries outside dev/test contexts</li>
        <li>
          <code>__mocks__</code>, <code>fixtures</code>, <code>fake</code>,{" "}
          <code>seed</code> artifacts in production builds
        </li>
        <li>missing required env vars that force fallback behavior</li>
      </ul>

      <p>Some teams use guardrail to detect this automatically in CI.</p>
    </article>
  );
}
