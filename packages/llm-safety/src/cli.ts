#!/usr/bin/env node
/**
 * CLI — `llm-guardrail serve` starts the Fastify API.
 * (Does not replace the main `guardrail` code-scan CLI.)
 */
import { Guardrail } from './sdk/guardrail.js';
import { listenServer } from './server/app.js';

async function main(): Promise<void> {
  const [cmd] = process.argv.slice(2);
  if (cmd === 'serve' || cmd === undefined) {
    const configPath = process.env['LLM_GUARDRAIL_CONFIG'];
    const g = await Guardrail.create(configPath ? { configPath } : {});
    const host = process.env['HOST'] ?? g.config.server?.host ?? '0.0.0.0';
    const port = Number(process.env['PORT'] ?? g.config.server?.port ?? 8787);
    await listenServer(g, host, port);
    // eslint-disable-next-line no-console
    console.log(`[llm-guardrail] listening on http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`);
    return;
  }
  // eslint-disable-next-line no-console
  console.error(`Unknown command: ${cmd}. Use: llm-guardrail serve`);
  process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
