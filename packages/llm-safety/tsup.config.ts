import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'middleware-adapters/express': 'src/middleware-adapters/express.ts',
    'middleware-adapters/langchain': 'src/middleware-adapters/langchain.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'node20',
});
