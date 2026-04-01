import { defineConfig } from 'tsup';

export default defineConfig({
<<<<<<< HEAD
  entry: ['src/index.ts', 'src/plugins/index.ts'],
=======
  entry: ['src/index.ts'],
>>>>>>> 64774cf6f8ffd3a30c44ac65801f229995aeb6e7
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node20',
  splitting: false,
  treeshake: true,
  external: ['guardrail-security'],
});
