/**
 * Template Generator
 *
 * Generates project files based on user selections and templates.
 * Copies real template files from the templates/ directory and generates
 * framework-specific scaffolding for each project type.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectConfig {
  projectName: string;
  projectDescription?: string;
  author?: string;
  type: string;
  [key: string]: unknown;
}

export interface TemplateContext {
  config: ProjectConfig;
  answers: Record<string, string>;
  projectType: string;
}

export interface GenerateResult {
  filesCreated: string[];
  dirsCreated: string[];
  errors: string[];
}

interface ProjectTypeDefinition {
  name: string;
  templates: string[];
}

const PROJECT_TYPES: Record<string, ProjectTypeDefinition> = {
  'full-stack': {
    name: 'Full-Stack Web Application',
    templates: ['03', '04', '08', '09', '10', '01', '02', '07', '06'],
  },
  'frontend-only': {
    name: 'Frontend-Only Application',
    templates: ['03', '01', '02', '07', '08'],
  },
  'backend-only': {
    name: 'Backend API Only',
    templates: ['03', '04', '08', '09', '10', '06'],
  },
  'landing-page': {
    name: 'Landing Page',
    templates: ['02', '01'],
  },
  'dashboard': {
    name: 'Admin Dashboard',
    templates: ['03', '01', '02', '07', '08', '10'],
  },
  'api-gateway': {
    name: 'API Gateway',
    templates: ['03', '04', '08', '10'],
  },
};

class TemplateGenerator {
  private templatesDir: string;
  private result: GenerateResult;

  constructor() {
    this.templatesDir = path.join(__dirname, '..', '..', 'templates');
    this.result = { filesCreated: [], dirsCreated: [], errors: [] };
  }

  /**
   * Generate all files for a project
   */
  async generateProject(context: TemplateContext): Promise<GenerateResult> {
    this.result = { filesCreated: [], dirsCreated: [], errors: [] };

    const projectType = PROJECT_TYPES[context.projectType];
    if (!projectType) {
      throw new Error(`Unknown project type: ${context.projectType}. Available: ${Object.keys(PROJECT_TYPES).join(', ')}`);
    }

    const projectPath = path.resolve(context.config.projectName);
    await this.ensureDir(projectPath);

    // Generate files based on selected templates
    for (const templateNum of projectType.templates) {
      await this.generateTemplate(templateNum, context, projectPath);
    }

    // Always generate guardrails
    await this.generateGuardrails(context, projectPath);

    return this.result;
  }

  /**
   * Generate files for a specific template
   */
  private async generateTemplate(
    templateNum: string,
    context: TemplateContext,
    projectPath: string,
  ): Promise<void> {
    switch (templateNum) {
      case '00':
        await this.generateQuickStart(context, projectPath);
        break;
      case '01':
        await this.generateUIUX(context, projectPath);
        break;
      case '02':
        await this.generateDesignSystem(context, projectPath);
        break;
      case '03':
        await this.generateArchitecture(context, projectPath);
        break;
      case '04':
        await this.generateAPI(context, projectPath);
        break;
      case '05':
        await this.generateFileRules(context, projectPath);
        break;
      case '06':
        await this.generateTesting(context, projectPath);
        break;
      case '07':
        await this.generateStateManagement(context, projectPath);
        break;
      case '08':
        await this.generateEnvironment(context, projectPath);
        break;
      case '09':
        await this.generateDatabase(context, projectPath);
        break;
      case '10':
        await this.generateAuth(context, projectPath);
        break;
    }
  }

  /**
   * Generate Quick Start files
   */
  private async generateQuickStart(context: TemplateContext, projectPath: string): Promise<void> {
    const docsDir = path.join(projectPath, 'docs');
    await this.ensureDir(docsDir);

    const quickStartContent = this.applyVariables(`# {{projectName}} — Quick Start

> {{projectDescription}}

## Prerequisites

- Node.js 18+
- npm / pnpm / yarn

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Run development server
npm run dev
\`\`\`

## Project Structure

\`\`\`
{{projectName}}/
├── src/
│   ├── components/    # Reusable UI components
│   ├── lib/           # Utility functions
│   ├── hooks/         # Custom React hooks
│   └── styles/        # Global styles & design tokens
├── docs/              # Documentation
├── tests/             # Test files
└── .guardrailrc       # Guardrail configuration
\`\`\`

## Scripts

| Command | Description |
|---------|-------------|
| \`npm run dev\` | Start development server |
| \`npm run build\` | Build for production |
| \`npm run test\` | Run tests |
| \`npx guardrail ship\` | Check shipping readiness |

## Author

{{author}}
`, context);

    await this.writeFile(path.join(docsDir, 'QUICK-START.md'), quickStartContent);
  }

  /**
   * Generate UI/UX System
   */
  private async generateUIUX(context: TemplateContext, projectPath: string): Promise<void> {
    const componentsDir = path.join(projectPath, 'src', 'components');
    await this.ensureDir(componentsDir);

    // Copy production-ready components from templates
    const componentsToCopy = [
      'ErrorBoundary.tsx',
      'ErrorBoundary.css',
      'LoadingState.tsx',
      'LoadingState.css',
      'EmptyState.tsx',
      'EmptyState.css',
      'AnimatedButton.tsx',
      'AnimatedButton.css',
      'AnimatedCard.tsx',
      'AnimatedCard.css',
      'Breadcrumbs.tsx',
      'Breadcrumbs.css',
    ];

    for (const file of componentsToCopy) {
      await this.copyTemplateFile(
        path.join('components', file),
        path.join(componentsDir, file),
      );
    }

    // Copy page templates
    const pagesDir = path.join(projectPath, 'src', 'pages');
    await this.ensureDir(pagesDir);
    await this.copyTemplateFile(path.join('pages', 'NotFound.tsx'), path.join(pagesDir, 'NotFound.tsx'));
    await this.copyTemplateFile(path.join('pages', 'NotFound.css'), path.join(pagesDir, 'NotFound.css'));

    // Copy hooks
    const hooksDir = path.join(projectPath, 'src', 'hooks');
    await this.ensureDir(hooksDir);
    await this.copyTemplateFile(path.join('hooks', 'usePageTransition.ts'), path.join(hooksDir, 'usePageTransition.ts'));

    // Generate barrel export
    const indexContent = `// UI Components — auto-generated by guardrail
export { ErrorBoundary } from './ErrorBoundary';
export { LoadingState, LoadingSkeleton } from './LoadingState';
export { EmptyState } from './EmptyState';
export { AnimatedButton } from './AnimatedButton';
export { AnimatedCard } from './AnimatedCard';
export { Breadcrumbs } from './Breadcrumbs';
`;
    await this.writeFile(path.join(componentsDir, 'index.ts'), indexContent);
  }

  /**
   * Generate Design System
   */
  private async generateDesignSystem(context: TemplateContext, projectPath: string): Promise<void> {
    const { config } = context;
    const stylesDir = path.join(projectPath, 'src', 'styles');
    await this.ensureDir(stylesDir);

    // Copy design system tokens
    await this.copyTemplateFile(path.join('design-systems', 'global.css'), path.join(stylesDir, 'global.css'));
    await this.copyTemplateFile(path.join('design-systems', 'components.css'), path.join(stylesDir, 'components.css'));

    if (config.styling === 'tailwind') {
      const tailwindConfig = `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
`;
      await this.writeFile(path.join(projectPath, 'tailwind.config.ts'), tailwindConfig);

      const postcssConfig = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
      await this.writeFile(path.join(projectPath, 'postcss.config.js'), postcssConfig);
    }
  }

  /**
   * Generate Project Architecture
   */
  private async generateArchitecture(context: TemplateContext, projectPath: string): Promise<void> {
    const dirs = [
      'src/components',
      'src/lib',
      'src/hooks',
      'src/styles',
      'src/types',
      'src/config',
      'tests',
      'docs',
      'public',
    ];

    // Add backend dirs if full-stack or backend project
    if (['full-stack', 'backend-only', 'api-gateway'].includes(context.projectType)) {
      dirs.push(
        'src/routes',
        'src/middleware',
        'src/models',
        'src/services',
        'src/utils',
      );
    }

    for (const dir of dirs) {
      await this.ensureDir(path.join(projectPath, dir));
    }

    // Generate types/index.ts with common types
    const typesContent = `// Common types — auto-generated by guardrail

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}
`;
    await this.writeFile(path.join(projectPath, 'src', 'types', 'index.ts'), typesContent);

    // Generate lib/utils.ts
    const utilsContent = `// Utility functions — auto-generated by guardrail

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}
`;
    await this.writeFile(path.join(projectPath, 'src', 'lib', 'utils.ts'), utilsContent);
  }

  /**
   * Generate API Architecture
   */
  private async generateAPI(context: TemplateContext, projectPath: string): Promise<void> {
    const { config } = context;
    const apiStyle = (config.apiStyle as string) || 'rest';

    // Copy backend template files
    const routesDir = path.join(projectPath, 'src', 'routes');
    const middlewareDir = path.join(projectPath, 'src', 'middleware');
    const utilsDir = path.join(projectPath, 'src', 'utils');
    await this.ensureDir(routesDir);
    await this.ensureDir(middlewareDir);
    await this.ensureDir(utilsDir);

    // Always copy health route
    await this.copyTemplateFile(path.join('backend', 'routes', 'health.route.ts'), path.join(routesDir, 'health.route.ts'));

    // Copy middleware
    const middlewareFiles = [
      'async.middleware.ts',
      'cors.middleware.ts',
      'error-handler.middleware.ts',
      'rate-limit.middleware.ts',
      'request-id.middleware.ts',
      'validation.middleware.ts',
    ];
    for (const file of middlewareFiles) {
      await this.copyTemplateFile(path.join('backend', 'middleware', file), path.join(middlewareDir, file));
    }

    // Copy utility files
    const utilFiles = [
      'cache.util.ts',
      'logger.util.ts',
      'pagination.util.ts',
      'response.util.ts',
      'search.util.ts',
    ];
    for (const file of utilFiles) {
      await this.copyTemplateFile(path.join('backend', 'utils', file), path.join(utilsDir, file));
    }

    // Copy app entry point
    await this.copyTemplateFile(path.join('backend', 'app.example.ts'), path.join(projectPath, 'src', 'app.ts'));

    if (apiStyle === 'rest') {
      const routeIndexContent = this.applyVariables(`// API Routes — auto-generated by guardrail
import { Router } from 'express';
import { healthRouter } from './health.route';

const router = Router();

// Health check
router.use('/health', healthRouter);

// TODO: Add your resource routes here
// router.use('/users', usersRouter);
// router.use('/posts', postsRouter);

export default router;
`, context);
      await this.writeFile(path.join(routesDir, 'index.ts'), routeIndexContent);
    } else if (apiStyle === 'graphql') {
      const schemaContent = `// GraphQL Schema — auto-generated by guardrail
import { buildSchema } from 'graphql';

export const schema = buildSchema(\`
  type Query {
    health: HealthStatus!
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    uptime: Float!
  }

  type Mutation {
    _empty: String
  }
\`);

export const rootValue = {
  health: () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }),
};
`;
      await this.writeFile(path.join(projectPath, 'src', 'schema.ts'), schemaContent);
    } else if (apiStyle === 'trpc') {
      const trpcContent = `// tRPC Router — auto-generated by guardrail
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  health: t.procedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })),
});

export type AppRouter = typeof appRouter;
`;
      await this.writeFile(path.join(projectPath, 'src', 'trpc.ts'), trpcContent);
    }
  }

  /**
   * Generate File Rules
   */
  private async generateFileRules(context: TemplateContext, projectPath: string): Promise<void> {
    const cursorRules = this.applyVariables(`# {{projectName}} — Cursor Rules

## Project Context
- Project: {{projectName}}
- Description: {{projectDescription}}
- Generated by: guardrail template generator

## Code Style
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use named exports over default exports
- Keep files under 300 lines
- Co-locate tests with source files

## File Organization
- Components: src/components/<Name>/<Name>.tsx
- Hooks: src/hooks/use<Name>.ts
- Utils: src/lib/<name>.ts
- Types: src/types/<name>.ts
- Tests: <file>.test.ts alongside source

## Naming Conventions
- Components: PascalCase
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- Types/interfaces: PascalCase
- Files: kebab-case (except components)

## Guardrail Checks
- Never hardcode API keys or secrets
- All API routes must have authentication
- All forms must have validation
- All async operations need error handling and loading states
- All lists need empty states and pagination
`, context);

    await this.writeFile(path.join(projectPath, '.cursorrules'), cursorRules);
  }

  /**
   * Generate Testing Setup
   */
  private async generateTesting(context: TemplateContext, projectPath: string): Promise<void> {
    const testsDir = path.join(projectPath, 'tests');
    await this.ensureDir(testsDir);

    // Vitest config
    const vitestConfig = `import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'tests/'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
`;
    await this.writeFile(path.join(projectPath, 'vitest.config.ts'), vitestConfig);

    // Test setup
    const setupContent = `// Test setup — auto-generated by guardrail
import '@testing-library/jest-dom';

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-minimum-32-chars';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
`;
    await this.writeFile(path.join(testsDir, 'setup.ts'), setupContent);

    // Example test
    const exampleTest = `import { describe, it, expect } from 'vitest';

describe('Example Test Suite', () => {
  it('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle async operations', async () => {
    const result = await Promise.resolve('hello');
    expect(result).toBe('hello');
  });
});
`;
    await this.writeFile(path.join(testsDir, 'example.test.ts'), exampleTest);
  }

  /**
   * Generate State Management
   */
  private async generateStateManagement(context: TemplateContext, projectPath: string): Promise<void> {
    const storeDir = path.join(projectPath, 'src', 'store');
    await this.ensureDir(storeDir);

    // Zustand store
    const storeContent = `// Global store — auto-generated by guardrail
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface AppState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;

  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // Sidebar
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  createdAt: number;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // Theme
        theme: 'system',
        setTheme: (theme) => set({ theme }),

        // Notifications
        notifications: [],
        addNotification: (notification) =>
          set((state) => ({
            notifications: [
              ...state.notifications,
              {
                ...notification,
                id: crypto.randomUUID(),
                createdAt: Date.now(),
              },
            ],
          })),
        removeNotification: (id) =>
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          })),
        clearNotifications: () => set({ notifications: [] }),

        // Sidebar
        sidebarOpen: true,
        toggleSidebar: () =>
          set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      }),
      { name: 'app-store' },
    ),
  ),
);
`;
    await this.writeFile(path.join(storeDir, 'app-store.ts'), storeContent);

    // Auth store
    const authStoreContent = `// Auth store — auto-generated by guardrail
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: { id: string; email: string; name: string; role: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthState['user'], token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true }),
      clearAuth: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-store' },
  ),
);
`;
    await this.writeFile(path.join(storeDir, 'auth-store.ts'), authStoreContent);

    // Barrel export
    const indexContent = `export { useAppStore } from './app-store';
export { useAuthStore } from './auth-store';
`;
    await this.writeFile(path.join(storeDir, 'index.ts'), indexContent);
  }

  /**
   * Generate Environment Config
   */
  private async generateEnvironment(context: TemplateContext, projectPath: string): Promise<void> {
    // Copy env config validator from templates
    const configDir = path.join(projectPath, 'src', 'config');
    await this.ensureDir(configDir);
    await this.copyTemplateFile(path.join('backend', 'config', 'env.config.ts'), path.join(configDir, 'env.config.ts'));

    // Copy .env.example
    await this.copyTemplateFile(path.join('backend', 'env.example'), path.join(projectPath, '.env.example'));

    // Generate .gitignore entry for .env
    const gitignoreContent = `# Environment
.env
.env.local
.env.*.local

# Dependencies
node_modules/

# Build
dist/
build/
.next/
out/

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Test
coverage/

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;
    await this.writeFile(path.join(projectPath, '.gitignore'), gitignoreContent);
  }

  /**
   * Generate Database Setup
   */
  private async generateDatabase(context: TemplateContext, projectPath: string): Promise<void> {
    const { config } = context;
    const orm = (config.orm as string) || 'prisma';

    // Copy database utility
    const utilsDir = path.join(projectPath, 'src', 'utils');
    await this.ensureDir(utilsDir);
    await this.copyTemplateFile(path.join('backend', 'utils', 'database.util.ts'), path.join(utilsDir, 'database.util.ts'));

    if (orm === 'prisma') {
      const prismaDir = path.join(projectPath, 'prisma');
      await this.ensureDir(prismaDir);

      const schemaContent = `// Prisma schema — auto-generated by guardrail
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${config.database === 'mongodb' ? 'mongodb' : config.database === 'mysql' ? 'mysql' : 'postgresql'}"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  sessions  Session[]
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  refreshToken String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum Role {
  USER
  ADMIN
}
`;
      await this.writeFile(path.join(prismaDir, 'schema.prisma'), schemaContent);
    } else if (orm === 'drizzle') {
      const drizzleDir = path.join(projectPath, 'src', 'db');
      await this.ensureDir(drizzleDir);

      const schemaContent = `// Drizzle schema — auto-generated by guardrail
import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }),
  password: text('password').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshToken: text('refresh_token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
`;
      await this.writeFile(path.join(drizzleDir, 'schema.ts'), schemaContent);
    }
  }

  /**
   * Generate Authentication
   */
  private async generateAuth(context: TemplateContext, projectPath: string): Promise<void> {
    const { config } = context;
    const authType = (config.auth as string) || 'jwt';

    // Copy auth middleware
    const middlewareDir = path.join(projectPath, 'src', 'middleware');
    await this.ensureDir(middlewareDir);
    await this.copyTemplateFile(
      path.join('backend', 'middleware', 'auth.middleware.ts'),
      path.join(middlewareDir, 'auth.middleware.ts'),
    );

    // Copy auth utilities
    const utilsDir = path.join(projectPath, 'src', 'utils');
    await this.ensureDir(utilsDir);
    await this.copyTemplateFile(path.join('backend', 'utils', 'jwt.util.ts'), path.join(utilsDir, 'jwt.util.ts'));
    await this.copyTemplateFile(path.join('backend', 'utils', 'password.util.ts'), path.join(utilsDir, 'password.util.ts'));
    await this.copyTemplateFile(path.join('backend', 'utils', 'email.util.ts'), path.join(utilsDir, 'email.util.ts'));

    if (authType === 'jwt' || authType === 'both') {
      const authRoutesContent = `// Auth routes — auto-generated by guardrail
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = registerSchema.parse(req.body);
    // TODO: Implement registration logic
    // 1. Check if user exists
    // 2. Hash password
    // 3. Create user in database
    // 4. Generate tokens
    // 5. Return user + tokens
    res.status(201).json({ success: true, message: 'User registered' });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = loginSchema.parse(req.body);
    // TODO: Implement login logic
    // 1. Find user by email
    // 2. Verify password
    // 3. Generate tokens
    // 4. Return user + tokens
    res.status(200).json({ success: true, message: 'Login successful' });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'Refresh token required' });
    }
    // TODO: Implement token refresh
    res.status(200).json({ success: true, message: 'Token refreshed' });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Implement logout (invalidate refresh token)
    res.status(200).json({ success: true, message: 'Logged out' });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    // TODO: Implement forgot password (send reset email)
    res.status(200).json({ success: true, message: 'Password reset email sent' });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
`;
      const routesDir = path.join(projectPath, 'src', 'routes');
      await this.ensureDir(routesDir);
      await this.writeFile(path.join(routesDir, 'auth.route.ts'), authRoutesContent);
    }

    if (authType === 'oauth' || authType === 'both') {
      const oauthContent = `// OAuth configuration — auto-generated by guardrail
export interface OAuthProvider {
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

export const oauthProviders: Record<string, OAuthProvider> = {
  google: {
    name: 'Google',
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  github: {
    name: 'GitHub',
    clientId: process.env.GITHUB_CLIENT_ID || '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
};
`;
      const configDir = path.join(projectPath, 'src', 'config');
      await this.ensureDir(configDir);
      await this.writeFile(path.join(configDir, 'oauth.config.ts'), oauthContent);
    }
  }

  /**
   * Generate Guardrails
   */
  private async generateGuardrails(context: TemplateContext, projectPath: string): Promise<void> {
    // .guardrailrc config
    const guardrailrc = this.applyVariables(`{
  "version": "1.0.0",
  "project": "{{projectName}}",
  "scans": {
    "secrets": { "enabled": true, "threshold": "high" },
    "vulnerabilities": { "enabled": true, "threshold": "high" },
    "compliance": { "enabled": false }
  },
  "gating": {
    "enabled": true,
    "blockOnCritical": true,
    "blockOnHigh": false
  },
  "output": {
    "format": "table",
    "badgeGeneration": true
  }
}
`, context);
    await this.writeFile(path.join(projectPath, '.guardrailrc'), guardrailrc);

    // TSConfig
    const tsconfig = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "outDir": "dist"
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
`;
    await this.writeFile(path.join(projectPath, 'tsconfig.json'), tsconfig);

    // Package.json
    const pkg = this.applyVariables(`{
  "name": "{{projectName}}",
  "version": "0.1.0",
  "description": "{{projectDescription}}",
  "author": "{{author}}",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "test": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src/",
    "guardrail:ship": "npx guardrail ship",
    "guardrail:fix": "npx guardrail ship --fix"
  }
}
`, context);
    await this.writeFile(path.join(projectPath, 'package.json'), pkg);

    // README
    const readme = this.applyVariables(`# {{projectName}}

> {{projectDescription}}

## Quick Start

\`\`\`bash
npm install
cp .env.example .env
npm run dev
\`\`\`

## Guardrail

This project was scaffolded with [guardrail](https://guardrail.dev) and includes:

- ✅ Production-ready error handling
- ✅ Loading states and empty states
- ✅ Environment validation
- ✅ Authentication scaffolding
- ✅ Rate limiting middleware
- ✅ Input validation with Zod
- ✅ Design system tokens

Run \`npx guardrail ship\` to check readiness before deploying.

## Author

{{author}}
`, context);
    await this.writeFile(path.join(projectPath, 'README.md'), readme);
  }

  // ─── Helper Methods ─────────────────────────────────────────────────

  /**
   * Apply template variables to content string
   */
  private applyVariables(template: string, context: TemplateContext): string {
    let content = template;
    content = content.replace(/\{\{projectName\}\}/g, context.config.projectName);
    content = content.replace(/\{\{projectDescription\}\}/g, context.config.projectDescription || '');
    content = content.replace(/\{\{author\}\}/g, context.config.author || '');

    // Replace answer variables
    Object.entries(context.answers).forEach(([key, value]) => {
      content = content.replace(
        new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
        value || '',
      );
    });

    return content;
  }

  /**
   * Copy a template file from templates/ to the target path
   */
  private async copyTemplateFile(templateRelPath: string, targetPath: string): Promise<void> {
    const sourcePath = path.join(this.templatesDir, templateRelPath);
    try {
      const content = await fs.promises.readFile(sourcePath, 'utf8');
      await this.ensureDir(path.dirname(targetPath));
      await fs.promises.writeFile(targetPath, content, 'utf8');
      this.result.filesCreated.push(targetPath);
    } catch (error) {
      const msg = `Failed to copy template ${templateRelPath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.result.errors.push(msg);
    }
  }

  /**
   * Write content to a file
   */
  private async writeFile(filePath: string, content: string): Promise<void> {
    try {
      await this.ensureDir(path.dirname(filePath));
      await fs.promises.writeFile(filePath, content, 'utf8');
      this.result.filesCreated.push(filePath);
    } catch (error) {
      const msg = `Failed to write ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.result.errors.push(msg);
    }
  }

  /**
   * Ensure a directory exists (recursive mkdir)
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
      this.result.dirsCreated.push(dirPath);
    } catch {
      // Directory already exists or other non-fatal error
    }
  }

  /**
   * List available project types
   */
  listProjectTypes(): Array<{ key: string; name: string; templates: string[] }> {
    return Object.entries(PROJECT_TYPES).map(([key, def]) => ({
      key,
      name: def.name,
      templates: def.templates,
    }));
  }
}

export const templateGenerator = new TemplateGenerator();
