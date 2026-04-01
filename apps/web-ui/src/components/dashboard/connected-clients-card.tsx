"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Cpu, Link2, Terminal } from "lucide-react";
import Link from "next/link";

import { GUARDRAIL_DEFAULT_API_URL } from "@/lib/integrations/constants";

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
      {children}
    </pre>
  );
}

export function ConnectedClientsCard() {
  return (
    <Card className="bg-card border-border glass-card">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Link2 className="w-5 h-5 text-teal-400" />
          Connected clients
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Send CLI, MCP, VS Code, and CI runs to this workspace using your API
          key so the dashboard shows findings.{" "}
          <Link
            href="/integrations"
            className="text-teal-400 hover:underline font-medium"
          >
            All platforms →
          </Link>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            CLI
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Set the API base and key, then add{" "}
            <span className="text-foreground/90">--sync</span> or{" "}
            <span className="text-foreground/90">GUARDRAIL_SYNC=1</span>.
          </p>
          <CodeBlock>{`export GUARDRAIL_API_URL=${GUARDRAIL_DEFAULT_API_URL}
export GUARDRAIL_API_KEY=grl_...
guardrail scan --sync
guardrail ship --sync`}</CodeBlock>
          <p className="text-xs text-muted-foreground mt-2">
            In CI, <span className="font-mono text-foreground/80">GUARDRAIL_API_URL</span>{" "}
            defaults when <span className="font-mono">CI=true</span> if only the key is set.
          </p>
        </section>

        <section>
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <Cpu className="w-4 h-4 text-violet-400" />
            CI / artifacts
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            After writing JSON to disk, upload the artifact (alias:{" "}
            <span className="font-mono text-foreground/80">guardrail exec</span>).
          </p>
          <CodeBlock>{`guardrail ci-upload -f ship-results.json
# or
guardrail exec -f .guardrail/scan.json --kind scan`}</CodeBlock>
        </section>

        <section>
          <h3 className="text-sm font-medium text-foreground">MCP</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Same env vars as the CLI. Runs recorded in MCP state sync automatically
            unless <span className="font-mono">GUARDRAIL_SYNC=0</span>.
          </p>
          <CodeBlock>{`export GUARDRAIL_API_URL=${GUARDRAIL_DEFAULT_API_URL}
export GUARDRAIL_API_KEY=grl_...`}</CodeBlock>
        </section>

        <section>
          <h3 className="text-sm font-medium text-foreground">VS Code</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Settings: <span className="font-mono">guardrail.apiEndpoint</span>, enable{" "}
            <span className="font-mono">guardrail.uploadRunsToCloud</span>, and store your
            API key in the extension secrets.
          </p>
        </section>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Create and manage keys in{" "}
          <Link href="/api-key" className="text-teal-400 hover:underline">
            API Key
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}
