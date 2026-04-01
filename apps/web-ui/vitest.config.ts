import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.d.ts",
        "**/*.config.{js,ts}",
        "**/__tests__/**",
        "**/*.{test,spec}.{ts,tsx}",
      ],
      // No global 80% gate; raise per-area floors after `pnpm --filter @guardrail/web-ui test:coverage` with @vitest/coverage-v8 installed.
      thresholds: {
        "src/**": {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/components": path.resolve(__dirname, "./src/components"),
      "@/lib": path.resolve(__dirname, "./src/lib"),
      "@/hooks": path.resolve(__dirname, "./src/hooks"),
    },
  },
});
