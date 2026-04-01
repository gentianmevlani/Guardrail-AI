"use client";

import { IntegrationCodeBlock } from "@/components/integrations/integration-code-block";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GUARDRAIL_DEFAULT_API_URL } from "@/lib/integrations/constants";
import {
  Box,
  Cable,
  Cloud,
  Code2,
  Container,
  Github,
  KeyRound,
  MonitorSmartphone,
  Terminal,
} from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const API = GUARDRAIL_DEFAULT_API_URL;

export default function IntegrationsPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground">
            Platform connections
          </h1>
          <Badge variant="secondary" className="text-xs">
            Dashboard sync
          </Badge>
        </div>
        <p className="text-muted-foreground mt-2 max-w-2xl">
          Use the same API key everywhere so scans, ship checks, and MCP runs
          appear under Runs and Findings. Nothing here stores secrets — copy
          snippets into your own env or CI secrets.
        </p>
        <p className="text-sm mt-3">
          <Link
            href="/api-key"
            className="text-teal-400 hover:underline inline-flex items-center gap-1"
          >
            <KeyRound className="w-4 h-4" />
            Create or rotate an API key
          </Link>
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="overview" className="gap-1.5">
            <Cable className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="cli" className="gap-1.5">
            <Terminal className="w-4 h-4" />
            CLI
          </TabsTrigger>
          <TabsTrigger value="ci" className="gap-1.5">
            <Cloud className="w-4 h-4" />
            CI / CD
          </TabsTrigger>
          <TabsTrigger value="editors" className="gap-1.5">
            <MonitorSmartphone className="w-4 h-4" />
            Editors
          </TabsTrigger>
          <TabsTrigger value="mcp" className="gap-1.5">
            <Code2 className="w-4 h-4" />
            MCP
          </TabsTrigger>
          <TabsTrigger value="containers" className="gap-1.5">
            <Container className="w-4 h-4" />
            Containers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Local & CLI
                </CardTitle>
                <CardDescription>
                  Export env vars, run <code className="text-xs">scan --sync</code>{" "}
                  or <code className="text-xs">ship --sync</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntegrationCodeBlock label="shell">
                  {`export GUARDRAIL_API_URL=${API}
export GUARDRAIL_API_KEY=grl_...
export GUARDRAIL_SYNC=1`}
                </IntegrationCodeBlock>
              </CardContent>
            </Card>
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Github className="w-4 h-4 text-foreground" />
                  GitHub Actions
                </CardTitle>
                <CardDescription>
                  Add repository secrets{" "}
                  <code className="text-xs">GUARDRAIL_API_KEY</code> and optional{" "}
                  <code className="text-xs">GUARDRAIL_API_URL</code>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Generated workflows from{" "}
                  <code className="text-xs">guardrail init</code> can include a
                  “Sync to Guardrail Cloud” step. In CI, the API URL defaults to{" "}
                  {API} when <code className="text-xs">CI=true</code> and only
                  the key is set.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <MonitorSmartphone className="w-4 h-4 text-violet-400" />
                  VS Code / Cursor
                </CardTitle>
                <CardDescription>
                  Point the extension at your API and enable upload after Ship
                  Check.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntegrationCodeBlock label="settings.json">
                  {`{
  "guardrail.apiEndpoint": "${API}",
  "guardrail.uploadRunsToCloud": true
}`}
                </IntegrationCodeBlock>
              </CardContent>
            </Card>
            <Card className="bg-card/80 border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  MCP hosts
                </CardTitle>
                <CardDescription>
                  Pass the same env vars into MCP server config (Claude Desktop,
                  Cursor, etc.).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IntegrationCodeBlock label="env">
                  {`GUARDRAIL_API_URL=${API}
GUARDRAIL_API_KEY=grl_...
# Optional: GUARDRAIL_SYNC=0 to disable MCP→cloud upload`}
                </IntegrationCodeBlock>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cli" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Shell & npm</CardTitle>
              <CardDescription>
                Install the published CLI, then sync results to the cloud.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IntegrationCodeBlock label="install">
                {`npm install -g guardrail-cli-tool
# or
pnpm add -g guardrail-cli-tool`}
              </IntegrationCodeBlock>
              <IntegrationCodeBlock label="one-off sync">
                {`export GUARDRAIL_API_URL=${API}
export GUARDRAIL_API_KEY=grl_...
guardrail scan --sync
guardrail ship --sync`}
              </IntegrationCodeBlock>
              <IntegrationCodeBlock label="artifact upload (CI or local)">
                {`guardrail ci-upload -f ./ship-results.json --kind auto
guardrail exec   # alias: uses .guardrail/scan.json or .guardrail/ship.json`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ci" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>GitHub Actions</CardTitle>
              <CardDescription>
                Repository → Settings → Secrets and variables → Actions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>
                  <code className="text-xs">GUARDRAIL_API_KEY</code> — required
                  for uploads
                </li>
                <li>
                  <code className="text-xs">GUARDRAIL_API_URL</code> — optional
                  if you use a self-hosted API
                </li>
              </ul>
              <IntegrationCodeBlock label="env">
                {`env:
  GUARDRAIL_API_KEY: \${{ secrets.GUARDRAIL_API_KEY }}
  GUARDRAIL_API_URL: \${{ secrets.GUARDRAIL_API_URL }}`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>GitLab CI</CardTitle>
              <CardDescription>
                CI/CD → Variables — mask <code className="text-xs">GUARDRAIL_API_KEY</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label=".gitlab-ci.yml (excerpt)">
                {`variables:
  GUARDRAIL_API_URL: "${API}"

script:
  - npm install -g guardrail-cli-tool
  - export GUARDRAIL_SYNC=1
  - guardrail scan --sync || true
  - guardrail ci-upload -f .guardrail/scan.json --kind scan || true`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Azure Pipelines</CardTitle>
              <CardDescription>
                Library → Variable groups — link the group to your pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="YAML">
                {`- bash: |
    npm install -g guardrail-cli-tool
    export GUARDRAIL_SYNC=1
    guardrail scan --sync
  env:
    GUARDRAIL_API_URL: $(GUARDRAIL_API_URL)
    GUARDRAIL_API_KEY: $(GUARDRAIL_API_KEY)`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CircleCI</CardTitle>
              <CardDescription>
                Project Settings → Environment Variables.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="config.yml (excerpt)">
                {`environment:
  GUARDRAIL_API_URL: ${API}
  GUARDRAIL_SYNC: "1`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="editors" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Visual Studio Code</CardTitle>
              <CardDescription>
                Install the Guardrail extension from the Marketplace, then set
                credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <IntegrationCodeBlock label="settings.json">
                {`{
  "guardrail.apiEndpoint": "${API}",
  "guardrail.uploadRunsToCloud": true
}`}
              </IntegrationCodeBlock>
              <p className="text-sm text-muted-foreground">
                Store the API key via the extension’s sign-in / secrets flow
                (Command Palette → Guardrail).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cursor</CardTitle>
              <CardDescription>
                Same extension as VS Code when compatible. For MCP, add env in
                Cursor Settings → MCP.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="Typical MCP env">
                {`GUARDRAIL_API_URL=${API}
GUARDRAIL_API_KEY=grl_...`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>JetBrains (WebStorm, IntelliJ, …)</CardTitle>
              <CardDescription>
                Run/Debug configuration or Tools → Terminal env.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="Environment variables">
                {`GUARDRAIL_API_URL=${API}
GUARDRAIL_API_KEY=grl_...
GUARDRAIL_SYNC=1`}
              </IntegrationCodeBlock>
              <p className="text-sm text-muted-foreground mt-3">
                Point external tools or npm scripts at{" "}
                <code className="text-xs">guardrail</code> on your PATH with
                these variables set.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mcp" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Claude Desktop</CardTitle>
              <CardDescription>
                Edit your MCP config file and restart the app.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="claude_desktop_config.json (shape)">
                {`{
  "mcpServers": {
    "guardrail": {
      "command": "npx",
      "args": ["guardrail", "mcp"],
      "env": {
        "GUARDRAIL_API_URL": "${API}",
        "GUARDRAIL_API_KEY": "grl_..."
      }
    }
  }
}`}
              </IntegrationCodeBlock>
              <p className="text-xs text-muted-foreground mt-2">
                Exact <code className="text-xs">command</code> /{" "}
                <code className="text-xs">args</code> depend on your global
                install — use the same path as <code className="text-xs">which guardrail</code> locally.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>State sync</CardTitle>
              <CardDescription>
                When MCP records a run, it can POST to the API if env vars are
                set.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                <code className="text-xs">GUARDRAIL_SYNC=0</code> disables
                automatic upload from MCP state.
              </p>
              <p>
                Branch/commit can be set with{" "}
                <code className="text-xs">GUARDRAIL_BRANCH</code>{" "}
                and <code className="text-xs">GUARDRAIL_COMMIT_SHA</code> (or
                standard CI vars like <code className="text-xs">GITHUB_SHA</code>
                ).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Box className="w-5 h-5 text-teal-400" />
                More docs
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <Link href="/mcp" className="text-teal-400 hover:underline">
                MCP Plugin page →
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="containers" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Docker</CardTitle>
              <CardDescription>
                Mount the repo and pass secrets at runtime — never bake keys into
                images.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="docker run">
                {`docker run --rm \\
  -e GUARDRAIL_API_KEY \\
  -e GUARDRAIL_API_URL=${API} \\
  -e GUARDRAIL_SYNC=1 \\
  -v "$(pwd):/workspace" -w /workspace \\
  node:20-bookworm-slim \\
  bash -lc "npm install -g guardrail-cli-tool && guardrail scan --sync"`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kubernetes (Job)</CardTitle>
              <CardDescription>
                Use a Secret for the key and a ConfigMap or env for the URL.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IntegrationCodeBlock label="Pod env (excerpt)">
                {`env:
  - name: GUARDRAIL_API_URL
    value: "${API}"
  - name: GUARDRAIL_API_KEY
    valueFrom:
      secretKeyRef:
        name: guardrail-api
        key: api-key`}
              </IntegrationCodeBlock>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
