import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mock Data in Production: Why It Happens (and How to Stop It)",
  description:
    "Detect leftover mocks, fake API responses, and test-only code paths before deploy. Practical causes, symptoms, and a CI-safe prevention gate.",
};

// Static page - revalidate every hour
export const revalidate = 3600;

export default function StopMockDataProductionPage() {
  return (
    <article className="prose prose-slate max-w-4xl mx-auto py-12 px-4">
      <h1>Mock Data in Production: Why It Happens (and How to Stop It)</h1>

      <p>
        If mock data, fake APIs, or test responses reached production, your
        tooling failed silently. The fix is not "write more tests." The fix is{" "}
        <strong>a deploy gate that detects non-real code paths</strong> before
        shipping.
      </p>

      <h2>What "mock data in production" actually means</h2>

      <p>This usually shows up as:</p>

      <ul>
        <li>
          Users seeing placeholder content ("John Doe", "Lorem ipsum", demo
          prices)
        </li>
        <li>API responses that look valid but are not from real services</li>
        <li>Feature flags or dev-only branches accidentally enabled</li>
        <li>"Temporary" stubs that became permanent</li>
      </ul>

      <h3>Common examples</h3>

      <ul>
        <li>
          <code>__mocks__</code> folders shipped in build output
        </li>
        <li>
          <code>msw</code> / mock service workers enabled in non-dev
          environments
        </li>
        <li>Functions returning hardcoded objects that pass type-checks</li>
        <li>A "fake" service client used when env vars are missing</li>
      </ul>

      <h2>Why CI and linters miss this</h2>

      <p>
        Most pipelines verify <strong>syntax</strong> and <strong>tests</strong>
        , but not <strong>reality</strong>:
      </p>

      <ul>
        <li>Type-checking can't tell if a function returns fabricated data</li>
        <li>Tests can pass against stubs</li>
        <li>Mocks can be conditionally imported (only visible at runtime)</li>
        <li>Monorepos hide "dev-only" code in shared packages</li>
      </ul>

      <p>
        <strong>CI typically answers:</strong> "Does it compile?"
        <br />
        <strong>Production needs:</strong> "Is it real?"
      </p>

      <h2>The prevention pattern: a MockProof gate</h2>

      <p>
        A MockProof gate scans for mock and fake-code signals before deploy:
      </p>

      <ul>
        <li>
          Import graph + file-path patterns (<code>__mocks__</code>,{" "}
          <code>fixtures</code>, <code>mock</code>, <code>fake</code>,{" "}
          <code>seed</code>)
        </li>
        <li>Known mocking libraries used outside dev/test</li>
        <li>
          Build artifact inspection (what is actually in the shipped output)
        </li>
        <li>
          Optional allowlists for legitimate fixtures in non-prod docs/examples
        </li>
      </ul>

      <h2>One-command check (example)</h2>

      <pre>
        <code>npx guardrail mockproof</code>
      </pre>

      <h3>CI example</h3>

      <pre>
        <code>
          # fail the build if mock/fake code is detected npx guardrail gate
        </code>
      </pre>

      <h2>What to do if you already shipped it</h2>

      <h3>Stop the bleed</h3>

      <ul>
        <li>Disable mock toggles / MSW in prod immediately</li>
        <li>
          Find the source (look for conditional imports, missing env vars, and
          fallback clients)
        </li>
        <li>Add the gate (make reality checks a required CI step)</li>
      </ul>

      <h2>Who this is for</h2>

      <ul>
        <li>Teams shipping fast with AI-assisted coding</li>
        <li>Monorepos with shared "utils" packages</li>
        <li>Startups that can't afford silent production hallucinations</li>
      </ul>

      <h2>Next step</h2>

      <p>
        If you want production to stop accepting fake data as "valid," add a
        reality gate:
      </p>

      <ul>
        <li>
          <strong>MockProof:</strong> catches leftover mocks and fake responses
        </li>
        <li>
          <strong>Reality Mode:</strong> validates runtime boundaries and wiring
        </li>
      </ul>
    </article>
  );
}
