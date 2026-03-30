/**
 * Library detection for context-aware polish checking.
 */

import path from 'path';
import { pathExists, readFileSafe } from './utils';
import type { Severity, ProjectType } from './types';

export const LIBRARY_ALTERNATIVES: Record<string, string[]> = {
  errorBoundary: ['react-error-boundary', '@sentry/react', 'bugsnag-react'],
  toast: ['react-hot-toast', 'react-toastify', 'sonner', '@radix-ui/react-toast', 'notistack', 'react-notifications'],
  spinner: ['react-spinners', 'react-loader-spinner', 'react-loading', '@chakra-ui/react', '@mantine/core'],
  skeleton: [
    'react-loading-skeleton',
    'react-content-loader',
    '@chakra-ui/react',
    '@mantine/core',
    '@radix-ui/themes',
  ],
  formValidation: ['react-hook-form', 'formik', '@tanstack/react-form', 'react-final-form', 'zod', 'yup'],
  uiLibrary: [
    '@chakra-ui/react',
    '@mantine/core',
    '@radix-ui/themes',
    '@mui/material',
    'antd',
    '@nextui-org/react',
    'shadcn',
    '@headlessui/react',
  ],
  stateManagement: ['zustand', '@reduxjs/toolkit', 'jotai', 'recoil', 'mobx', '@tanstack/react-query'],
  i18n: ['next-intl', 'react-i18next', 'next-translate', '@formatjs/intl', 'lingui'],
  analytics: [
    '@sentry/nextjs',
    '@sentry/react',
    '@vercel/analytics',
    'posthog-js',
    'mixpanel-browser',
    '@segment/analytics-next',
  ],
};

export function hasLibrary(packageJsonContent: string | null, libraries: string[]): string | null {
  if (!packageJsonContent) return null;

  for (const lib of libraries) {
    const escaped = lib.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`"${escaped}"\\s*:`, 'i');
    if (pattern.test(packageJsonContent)) {
      return lib;
    }
  }

  return null;
}

export async function detectProjectType(
  projectPath: string,
  packageJsonContent: string | null
): Promise<ProjectType> {
  const hasApp = await pathExists(path.join(projectPath, 'app'));
  const hasPages = await pathExists(path.join(projectPath, 'pages'));
  const hasSrc = await pathExists(path.join(projectPath, 'src'));

  const isNextJs = !!packageJsonContent && /["']next["']/.test(packageJsonContent);
  const isRemix = !!packageJsonContent && /["']@remix-run\//.test(packageJsonContent);
  const isVite = !!packageJsonContent && /["']vite["']/.test(packageJsonContent);
  const isAstro = !!packageJsonContent && /["']astro["']/.test(packageJsonContent);

  const isLibrary = !!packageJsonContent && /"main"|"module"|"exports"/.test(packageJsonContent);
  const isCli = !!packageJsonContent && /"bin"/.test(packageJsonContent);
  const isApi =
    !hasApp &&
    !hasPages &&
    !!packageJsonContent &&
    /["']express["']|["']fastify["']|["']hono["']/.test(packageJsonContent);

  const uiLib = hasLibrary(packageJsonContent, LIBRARY_ALTERNATIVES.uiLibrary);

  return {
    isNextJs,
    isRemix,
    isVite,
    isAstro,
    isLibrary,
    isCli,
    isApi,
    hasAppRouter: hasApp && isNextJs,
    hasPagesRouter: hasPages && isNextJs,
    hasSrc,
    uiLibrary: uiLib,
    skipFrontend: isLibrary || isCli || isApi,
  };
}

export function adjustSeverity(
  baseSeverity: Severity,
  projectType: ProjectType,
  issueId: string
): Severity {
  if (projectType.skipFrontend && issueId.startsWith('missing-')) {
    return 'low';
  }

  if (projectType.uiLibrary) {
    const componentIssues = [
      'missing-spinner',
      'missing-skeleton',
      'missing-toast',
      'missing-empty-states',
    ];
    if (componentIssues.includes(issueId)) {
      return 'low';
    }
  }

  return baseSeverity;
}
