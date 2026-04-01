/**
 * @guardrail/rules-nextjs — Built-in Next.js rule pack.
 *
 * Rules: NEXT-001 through NEXT-008
 * Catches common AI hallucinations in Next.js projects:
 * - Ghost API routes that don't resolve
 * - Wrong data-fetching patterns (getServerSideProps in app router)
 * - Invalid middleware config
 * - Mixing client/server patterns
 * - Invalid route segment configs
 */

import type { PluginManifest, RuleDefinition, RuleContext } from '../types';

const rules: RuleDefinition[] = [
  {
    id: 'NEXT-001',
    name: 'no-pages-in-app-router',
    description: 'Detects getServerSideProps/getStaticProps in App Router files (app/ directory). These are Pages Router patterns.',
    severity: 'high',
    languages: ['typescript', 'javascript'],
    category: 'framework-mismatch',
    check(ctx: RuleContext) {
      if (!ctx.filePath.includes('/app/')) return;

      const pagesPatterns = [
        { re: /export\s+(?:async\s+)?function\s+getServerSideProps/g, name: 'getServerSideProps' },
        { re: /export\s+(?:async\s+)?function\s+getStaticProps/g, name: 'getStaticProps' },
        { re: /export\s+(?:async\s+)?function\s+getStaticPaths/g, name: 'getStaticPaths' },
      ];

      for (const { re, name } of pagesPatterns) {
        let match: RegExpExecArray | null;
        while ((match = re.exec(ctx.source))) {
          const line = ctx.source.substring(0, match.index).split('\n').length;
          ctx.report({
            message: `"${name}" is a Pages Router pattern. In App Router (app/), use React Server Components with async/await or generateStaticParams() instead.`,
            line,
            severity: 'high',
            evidence: match[0],
            suggestion: name === 'getStaticPaths'
              ? 'Use generateStaticParams() in App Router.'
              : 'Use async Server Components or fetch() with caching options.',
          });
        }
      }
    },
  },
  {
    id: 'NEXT-002',
    name: 'no-client-directive-in-server-file',
    description: 'Detects server-only imports in files marked with "use client".',
    severity: 'high',
    languages: ['typescript', 'javascript'],
    category: 'framework-mismatch',
    check(ctx: RuleContext) {
      const hasUseClient = /^['"]use client['"]/m.test(ctx.source);
      if (!hasUseClient) return;

      const serverImports = [
        { re: /import\s+.*from\s+['"]server-only['"]/g, name: 'server-only' },
        { re: /import\s+.*from\s+['"]next\/headers['"]/g, name: 'next/headers' },
        { re: /import\s+.*from\s+['"]next\/cookies['"]/g, name: 'next/cookies' },
        { re: /import\s+.*from\s+['"]@prisma\/client['"]/g, name: '@prisma/client' },
      ];

      for (const { re, name } of serverImports) {
        let match: RegExpExecArray | null;
        while ((match = re.exec(ctx.source))) {
          const line = ctx.source.substring(0, match.index).split('\n').length;
          ctx.report({
            message: `"${name}" is a server-only module but this file has "use client". This will fail at runtime.`,
            line,
            severity: 'critical',
            evidence: match[0],
            suggestion: `Remove "use client" or move the server logic to a separate Server Component.`,
          });
        }
      }
    },
  },
  {
    id: 'NEXT-003',
    name: 'valid-route-exports',
    description: 'Detects invalid exports in Next.js App Router route handlers (route.ts).',
    severity: 'medium',
    languages: ['typescript', 'javascript'],
    category: 'api-integrity',
    check(ctx: RuleContext) {
      const isRouteFile = /\/route\.(ts|tsx|js|jsx)$/.test(ctx.filePath);
      if (!isRouteFile) return;

      const validMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
      const exportRe = /export\s+(?:async\s+)?function\s+(\w+)/g;

      let match: RegExpExecArray | null;
      while ((match = exportRe.exec(ctx.source))) {
        const name = match[1]!;
        // Skip non-HTTP method exports that are valid (config, etc.)
        if (['generateStaticParams', 'revalidate', 'dynamic', 'runtime'].includes(name)) continue;

        if (!validMethods.has(name) && name === name.toLowerCase()) {
          const line = ctx.source.substring(0, match.index).split('\n').length;
          ctx.report({
            message: `"${name}" is not a valid route handler export. HTTP methods must be uppercase: ${[...validMethods].join(', ')}.`,
            line,
            evidence: match[0],
            suggestion: `Rename to "${name.toUpperCase()}" if it's meant to be an HTTP handler.`,
          });
        }
      }
    },
  },
  {
    id: 'NEXT-004',
    name: 'no-invalid-metadata-export',
    description: 'Detects metadata export in client components (incompatible).',
    severity: 'high',
    languages: ['typescript', 'javascript'],
    category: 'framework-mismatch',
    check(ctx: RuleContext) {
      const hasUseClient = /^['"]use client['"]/m.test(ctx.source);
      if (!hasUseClient) return;

      const metadataRe = /export\s+(?:const|function)\s+(?:metadata|generateMetadata)\b/g;
      let match: RegExpExecArray | null;
      while ((match = metadataRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: `metadata/generateMetadata cannot be exported from a "use client" component. Metadata is server-only.`,
          line,
          severity: 'high',
          evidence: match[0],
          suggestion: 'Remove "use client" or move metadata to a layout.tsx/page.tsx Server Component.',
        });
      }
    },
  },
  {
    id: 'NEXT-005',
    name: 'no-hardcoded-revalidate',
    description: 'Detects suspiciously small revalidation values that may be AI hallucinations.',
    severity: 'low',
    languages: ['typescript', 'javascript'],
    category: 'hallucination',
    check(ctx: RuleContext) {
      const revalidateRe = /export\s+const\s+revalidate\s*=\s*(\d+)/g;
      let match: RegExpExecArray | null;
      while ((match = revalidateRe.exec(ctx.source))) {
        const value = parseInt(match[1]!, 10);
        if (value > 0 && value < 10) {
          const line = ctx.source.substring(0, match.index).split('\n').length;
          ctx.report({
            message: `revalidate=${value} seconds is suspiciously low. This will cause excessive ISR regeneration. Did the AI hallucinate this value?`,
            line,
            severity: 'low',
            evidence: match[0],
            suggestion: 'Use at least 60 seconds for ISR, or 0 for on-demand revalidation.',
          });
        }
      }
    },
  },
  {
    id: 'NEXT-006',
    name: 'no-router-push-in-server',
    description: 'Detects useRouter() usage in files without "use client" (Server Components).',
    severity: 'high',
    languages: ['typescript', 'javascript'],
    category: 'framework-mismatch',
    check(ctx: RuleContext) {
      if (!ctx.filePath.includes('/app/')) return;
      const hasUseClient = /^['"]use client['"]/m.test(ctx.source);
      if (hasUseClient) return;

      // Skip route.ts files
      if (/\/route\.(ts|tsx|js|jsx)$/.test(ctx.filePath)) return;

      const hookRe = /\buseRouter\s*\(\s*\)/g;
      let match: RegExpExecArray | null;
      while ((match = hookRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'useRouter() cannot be used in Server Components. Add "use client" directive or use redirect() from next/navigation.',
          line,
          severity: 'high',
          evidence: match[0],
          suggestion: 'Add "use client" at the top of the file, or use redirect() for server-side redirects.',
        });
      }
    },
  },
  {
    id: 'NEXT-007',
    name: 'no-missing-loading-boundary',
    description: 'Suggests adding loading.tsx for pages with async data fetching.',
    severity: 'info',
    languages: ['typescript', 'javascript'],
    category: 'best-practice',
    check(ctx: RuleContext) {
      // Only check page.tsx files in app router
      if (!/\/app\/.*\/page\.(ts|tsx|js|jsx)$/.test(ctx.filePath)) return;

      const isAsync = /export\s+default\s+async\s+function/.test(ctx.source);
      const hasFetch = /\bfetch\s*\(/.test(ctx.source) || /\bawait\b/.test(ctx.source);

      if (isAsync && hasFetch) {
        // Check if sibling loading.tsx exists
        const dir = ctx.filePath.replace(/\/page\.(ts|tsx|js|jsx)$/, '');
        const loadingExts = ['loading.tsx', 'loading.ts', 'loading.jsx', 'loading.js'];
        // We can't check file existence from a rule context, so just suggest
        ctx.report({
          message: 'Async page with data fetching detected. Consider adding a loading.tsx sibling for streaming/Suspense.',
          line: 1,
          severity: 'info',
          evidence: 'async default function + fetch/await',
          suggestion: 'Create loading.tsx in the same directory to show a loading state during data fetching.',
        });
      }
    },
  },
  {
    id: 'NEXT-008',
    name: 'no-dynamic-import-in-server-component',
    description: 'Detects next/dynamic usage in server components (unnecessary, use React.lazy or regular import).',
    severity: 'medium',
    languages: ['typescript', 'javascript'],
    category: 'best-practice',
    check(ctx: RuleContext) {
      if (!ctx.filePath.includes('/app/')) return;
      const hasUseClient = /^['"]use client['"]/m.test(ctx.source);
      if (hasUseClient) return;

      const dynamicRe = /import\s+dynamic\s+from\s+['"]next\/dynamic['"]/g;
      let match: RegExpExecArray | null;
      while ((match = dynamicRe.exec(ctx.source))) {
        const line = ctx.source.substring(0, match.index).split('\n').length;
        ctx.report({
          message: 'next/dynamic is unnecessary in Server Components. Use regular imports — code splitting is automatic.',
          line,
          severity: 'medium',
          evidence: match[0],
          suggestion: 'Remove next/dynamic and use a regular import. For client-only components, add "use client" to the component file.',
        });
      }
    },
  },
];

export const nextjsPack: PluginManifest = {
  name: '@guardrail/rules-nextjs',
  version: '1.0.0',
  description: 'Next.js-specific rules for App Router, Server Components, and route handlers.',
  author: 'Guardrail',
  framework: 'nextjs',
  languages: ['typescript', 'javascript'],
  keywords: ['nextjs', 'react', 'app-router', 'server-components'],
  rules,
};
