# ENVIRONMENT & CONFIGURATION TEMPLATE

## Overview

This template sets up proper environment variables, configuration management, and secrets handling.

---

## MASTER PROMPT

```
Set up environment and configuration management for [PROJECT_NAME].

## CRITICAL: FILE LOCATIONS

```
/
├── .env.example              # Template (committed)
├── .env.local                # Local overrides (not committed)
│
└── /src
    └── /config               # Configuration files
        ├── env.ts            # Environment validation
        ├── site.ts           # Site configuration
        ├── routes.ts         # Route definitions
        ├── api.ts            # API configuration
        └── index.ts          # Barrel export
```

## DELIVERABLES

### 1. ENVIRONMENT EXAMPLE

**FILE: /.env.example**
```bash
# ==========================================
# APP
# ==========================================
NEXT_PUBLIC_APP_NAME="[PROJECT_NAME]"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_ENV="development"

# ==========================================
# API
# ==========================================
NEXT_PUBLIC_API_URL="http://localhost:3000/api"
API_SECRET_KEY="your-secret-key-here"

# ==========================================
# DATABASE
# ==========================================
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"

# ==========================================
# AUTHENTICATION
# ==========================================
JWT_SECRET="your-jwt-secret-min-32-chars-here"
JWT_EXPIRES_IN="7d"

# ==========================================
# SERVICES (optional)
# ==========================================
REDIS_URL="redis://localhost:6379"
```

### 2. ENVIRONMENT VALIDATION

**FILE: /src/config/env.ts**
```typescript
import { z } from 'zod';

// Server-side environment schema
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  REDIS_URL: z.string().url().optional(),
  API_SECRET_KEY: z.string().min(16),
});

// Client-side environment schema (NEXT_PUBLIC_ prefix)
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('[PROJECT_NAME]'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000/api'),
});

// Validate server environment
function validateServerEnv() {
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Invalid server environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid server environment variables');
  }
  return parsed.data;
}

// Validate client environment
function validateClientEnv() {
  const clientEnv = {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  };
  const parsed = clientEnvSchema.safeParse(clientEnv);
  if (!parsed.success) {
    console.error('❌ Invalid client environment variables:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid client environment variables');
  }
  return parsed.data;
}

export const serverEnv = validateServerEnv();
export const clientEnv = validateClientEnv();

export const env = {
  ...serverEnv,
  ...clientEnv,
  isDev: serverEnv.NODE_ENV === 'development',
  isProd: serverEnv.NODE_ENV === 'production',
};
```

### 3. SITE CONFIGURATION

**FILE: /src/config/site.ts**
```typescript
import { clientEnv } from './env';

export const siteConfig = {
  name: clientEnv.NEXT_PUBLIC_APP_NAME,
  url: clientEnv.NEXT_PUBLIC_APP_URL,
  description: 'Your app description',
  ogImage: `${clientEnv.NEXT_PUBLIC_APP_URL}/og.png`,
  links: {
    twitter: 'https://twitter.com/yourhandle',
    github: 'https://github.com/yourrepo',
  },
} as const;
```

### 4. ROUTE CONFIGURATION

**FILE: /src/config/routes.ts**
```typescript
export const routes = {
  home: '/',
  auth: {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
  },
  dashboard: '/dashboard',
  settings: {
    index: '/settings',
    profile: '/settings/profile',
    security: '/settings/security',
  },
  api: {
    auth: {
      login: '/api/auth/login',
      logout: '/api/auth/logout',
      register: '/api/auth/register',
    },
    users: '/api/users',
  },
} as const;

export const protectedRoutes = ['/dashboard', '/settings'];
export const publicRoutes = ['/', '/login', '/register'];

export function isProtectedRoute(path: string): boolean {
  return protectedRoutes.some((route) => path.startsWith(route));
}
```

### 5. API CONFIGURATION

**FILE: /src/config/api.ts**
```typescript
import { clientEnv } from './env';

export const apiConfig = {
  baseUrl: clientEnv.NEXT_PUBLIC_API_URL,
  timeout: 30000,
  retry: { attempts: 3, delay: 1000 },
  pagination: { defaultLimit: 10, maxLimit: 100 },
} as const;
```

### 6. BARREL EXPORT

**FILE: /src/config/index.ts**
```typescript
export { env, serverEnv, clientEnv } from './env';
export { siteConfig } from './site';
export { routes, isProtectedRoute } from './routes';
export { apiConfig } from './api';
```

---

Now create all configuration files in /src/config/, NOT in root (except .env.example which goes in root).
```
