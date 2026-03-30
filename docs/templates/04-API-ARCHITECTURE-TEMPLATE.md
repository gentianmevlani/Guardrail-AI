# API GATEWAY & BACKEND ARCHITECTURE TEMPLATE

## Overview

This template sets up a scalable API layer with proper separation of concerns, error handling, caching, and type safety.

---

## CONFIGURATION

```yaml
PROJECT_NAME: "Your App"
API_STYLE: "rest" # rest | graphql | trpc
AUTH_METHOD: "jwt" # jwt | session | api-key | oauth
DATABASE: "postgresql" # postgresql | mongodb | mysql | supabase | firebase
ORM: "prisma" # prisma | drizzle | mongoose | none
CACHING: "redis" # redis | memory | none
RATE_LIMITING: true
```

---

## MASTER PROMPT

```
Set up a complete API architecture for [PROJECT_NAME] with the following specifications:

API Style: [API_STYLE]
Auth: [AUTH_METHOD]
Database: [DATABASE]
ORM: [ORM]
Caching: [CACHING]

## CRITICAL: FILE LOCATIONS

All files MUST be created in their specified directories. DO NOT create files in the root directory.

## DIRECTORY STRUCTURE

Create this exact structure:

```
/src
├── /app
│   └── /api                      # Next.js API routes
│       ├── /auth
│       │   ├── /login
│       │   │   └── route.ts
│       │   ├── /logout
│       │   │   └── route.ts
│       │   ├── /register
│       │   │   └── route.ts
│       │   ├── /refresh
│       │   │   └── route.ts
│       │   └── /me
│       │       └── route.ts
│       │
│       ├── /users
│       │   ├── route.ts          # GET all, POST create
│       │   └── /[id]
│       │       └── route.ts      # GET one, PUT, DELETE
│       │
│       └── /[resource]           # Pattern for all resources
│           ├── route.ts
│           └── /[id]
│               └── route.ts
│
├── /server                       # Server-side code
│   │
│   ├── /api                      # API layer
│   │   ├── /controllers          # Request handlers
│   │   │   ├── auth.controller.ts
│   │   │   ├── user.controller.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── /middleware           # API middleware
│   │   │   ├── auth.middleware.ts
│   │   │   ├── rateLimit.middleware.ts
│   │   │   ├── validate.middleware.ts
│   │   │   ├── error.middleware.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── /validators           # Request validation (Zod)
│   │   │   ├── auth.validator.ts
│   │   │   ├── user.validator.ts
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── /services                 # Business logic
│   │   ├── auth.service.ts
│   │   ├── user.service.ts
│   │   ├── email.service.ts
│   │   └── index.ts
│   │
│   ├── /repositories             # Database access
│   │   ├── user.repository.ts
│   │   └── index.ts
│   │
│   ├── /db                       # Database setup
│   │   ├── client.ts             # DB client (Prisma/etc)
│   │   ├── schema.prisma         # Schema (if Prisma)
│   │   └── migrations/
│   │
│   ├── /cache                    # Caching layer
│   │   ├── client.ts             # Redis/cache client
│   │   ├── keys.ts               # Cache key patterns
│   │   └── index.ts
│   │
│   ├── /lib                      # Server utilities
│   │   ├── jwt.ts                # JWT helpers
│   │   ├── hash.ts               # Password hashing
│   │   ├── errors.ts             # Custom error classes
│   │   └── index.ts
│   │
│   └── /types                    # Server types
│       ├── api.types.ts
│       ├── auth.types.ts
│       └── index.ts
│
├── /lib                          # Shared client utilities
│   └── /api                      # API client
│       ├── client.ts             # Fetch wrapper
│       ├── endpoints.ts          # Endpoint definitions
│       └── index.ts
│
└── /types                        # Shared types
    ├── api.types.ts
    └── index.ts
```

## LAYER RESPONSIBILITIES

### 1. Route Layer (/app/api)
- Receive HTTP requests
- Call controller methods
- Return responses
- NO business logic here

### 2. Controller Layer (/server/api/controllers)
- Parse/validate requests
- Call service methods
- Format responses
- Handle errors

### 3. Service Layer (/server/services)
- Business logic
- Orchestrate operations
- Call repositories
- Call external services

### 4. Repository Layer (/server/repositories)
- Database operations only
- No business logic
- Return raw data

---

## FILE IMPLEMENTATIONS

### 1. API Route (Thin Layer)

**FILE: /src/app/api/users/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { UserController } from '@/server/api/controllers';
import { authMiddleware } from '@/server/api/middleware';
import { withErrorHandler } from '@/server/api/middleware/error.middleware';

export const GET = withErrorHandler(async (request: NextRequest) => {
  await authMiddleware(request);
  return UserController.getAll(request);
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  await authMiddleware(request);
  return UserController.create(request);
});
```

**FILE: /src/app/api/users/[id]/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { UserController } from '@/server/api/controllers';
import { authMiddleware } from '@/server/api/middleware';
import { withErrorHandler } from '@/server/api/middleware/error.middleware';

type Params = { params: { id: string } };

export const GET = withErrorHandler(async (request: NextRequest, { params }: Params) => {
  await authMiddleware(request);
  return UserController.getById(request, params.id);
});

export const PUT = withErrorHandler(async (request: NextRequest, { params }: Params) => {
  await authMiddleware(request);
  return UserController.update(request, params.id);
});

export const DELETE = withErrorHandler(async (request: NextRequest, { params }: Params) => {
  await authMiddleware(request);
  return UserController.delete(request, params.id);
});
```

### 2. Controller Layer

**FILE: /src/server/api/controllers/user.controller.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/server/services';
import { createUserSchema, updateUserSchema } from '@/server/api/validators';
import { ApiResponse, PaginatedResponse } from '@/server/types';

export const UserController = {
  async getAll(request: NextRequest): Promise<NextResponse<PaginatedResponse<User>>> {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || undefined;

    const result = await UserService.findAll({ page, limit, search });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      },
    });
  },

  async getById(request: NextRequest, id: string): Promise<NextResponse<ApiResponse<User>>> {
    const user = await UserService.findById(id);

    return NextResponse.json({
      success: true,
      data: user,
    });
  },

  async create(request: NextRequest): Promise<NextResponse<ApiResponse<User>>> {
    const body = await request.json();
    const validated = createUserSchema.parse(body);

    const user = await UserService.create(validated);

    return NextResponse.json(
      { success: true, data: user },
      { status: 201 }
    );
  },

  async update(request: NextRequest, id: string): Promise<NextResponse<ApiResponse<User>>> {
    const body = await request.json();
    const validated = updateUserSchema.parse(body);

    const user = await UserService.update(id, validated);

    return NextResponse.json({
      success: true,
      data: user,
    });
  },

  async delete(request: NextRequest, id: string): Promise<NextResponse<ApiResponse<null>>> {
    await UserService.delete(id);

    return NextResponse.json({
      success: true,
      data: null,
      message: 'User deleted successfully',
    });
  },
};
```

**FILE: /src/server/api/controllers/index.ts**
```typescript
export { UserController } from './user.controller';
export { AuthController } from './auth.controller';
```

### 3. Service Layer

**FILE: /src/server/services/user.service.ts**
```typescript
import { UserRepository } from '@/server/repositories';
import { CacheService } from '@/server/cache';
import { NotFoundError, ConflictError } from '@/server/lib/errors';
import { hashPassword } from '@/server/lib/hash';
import type { CreateUserInput, UpdateUserInput, User, PaginatedResult } from '@/server/types';

const CACHE_PREFIX = 'user';
const CACHE_TTL = 60 * 5; // 5 minutes

export const UserService = {
  async findAll(params: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<PaginatedResult<User>> {
    const { page, limit, search } = params;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      UserRepository.findMany({ skip, take: limit, search }),
      UserRepository.count({ search }),
    ]);

    return {
      data,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },

  async findById(id: string): Promise<User> {
    // Check cache first
    const cacheKey = `${CACHE_PREFIX}:${id}`;
    const cached = await CacheService.get<User>(cacheKey);
    if (cached) return cached;

    // Fetch from DB
    const user = await UserRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Cache for next time
    await CacheService.set(cacheKey, user, CACHE_TTL);

    return user;
  },

  async create(input: CreateUserInput): Promise<User> {
    // Check for existing email
    const existing = await UserRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError('Email already in use');
    }

    // Hash password
    const hashedPassword = await hashPassword(input.password);

    // Create user
    const user = await UserRepository.create({
      ...input,
      password: hashedPassword,
    });

    // Don't return password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async update(id: string, input: UpdateUserInput): Promise<User> {
    // Check exists
    const existing = await UserRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    // If updating email, check not taken
    if (input.email && input.email !== existing.email) {
      const emailTaken = await UserRepository.findByEmail(input.email);
      if (emailTaken) {
        throw new ConflictError('Email already in use');
      }
    }

    // If updating password, hash it
    if (input.password) {
      input.password = await hashPassword(input.password);
    }

    // Update
    const user = await UserRepository.update(id, input);

    // Invalidate cache
    await CacheService.delete(`${CACHE_PREFIX}:${id}`);

    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async delete(id: string): Promise<void> {
    const existing = await UserRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    await UserRepository.delete(id);
    await CacheService.delete(`${CACHE_PREFIX}:${id}`);
  },
};
```

**FILE: /src/server/services/index.ts**
```typescript
export { UserService } from './user.service';
export { AuthService } from './auth.service';
export { EmailService } from './email.service';
```

### 4. Repository Layer

**FILE: /src/server/repositories/user.repository.ts**
```typescript
import { db } from '@/server/db/client';
import type { User, CreateUserInput, UpdateUserInput } from '@/server/types';

export const UserRepository = {
  async findMany(params: {
    skip?: number;
    take?: number;
    search?: string;
  }): Promise<User[]> {
    const { skip = 0, take = 10, search } = params;

    return db.user.findMany({
      skip,
      take,
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  },

  async count(params: { search?: string }): Promise<number> {
    return db.user.count({
      where: params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
    });
  },

  async findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } });
  },

  async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  },

  async create(data: CreateUserInput): Promise<User> {
    return db.user.create({ data });
  },

  async update(id: string, data: UpdateUserInput): Promise<User> {
    return db.user.update({ where: { id }, data });
  },

  async delete(id: string): Promise<void> {
    await db.user.delete({ where: { id } });
  },
};
```

**FILE: /src/server/repositories/index.ts**
```typescript
export { UserRepository } from './user.repository';
```

### 5. Middleware

**FILE: /src/server/api/middleware/auth.middleware.ts**
```typescript
import { NextRequest } from 'next/server';
import { verifyToken } from '@/server/lib/jwt';
import { UnauthorizedError } from '@/server/lib/errors';

export async function authMiddleware(request: NextRequest): Promise<{ userId: string }> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyToken(token);
    return { userId: payload.sub };
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

// Optional auth - doesn't throw, returns null if no auth
export async function optionalAuthMiddleware(
  request: NextRequest
): Promise<{ userId: string } | null> {
  try {
    return await authMiddleware(request);
  } catch {
    return null;
  }
}
```

**FILE: /src/server/api/middleware/error.middleware.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AppError, isAppError } from '@/server/lib/errors';

type Handler = (request: NextRequest, context?: any) => Promise<NextResponse>;

export function withErrorHandler(handler: Handler): Handler {
  return async (request: NextRequest, context?: any) => {
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);

      // Zod validation error
      if (error instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: 'Validation error',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }

      // Custom app error
      if (isAppError(error)) {
        return NextResponse.json(
          {
            success: false,
            error: error.message,
            code: error.code,
          },
          { status: error.statusCode }
        );
      }

      // Unknown error
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  };
}
```

**FILE: /src/server/api/middleware/rateLimit.middleware.ts**
```typescript
import { NextRequest } from 'next/server';
import { CacheService } from '@/server/cache';
import { TooManyRequestsError } from '@/server/lib/errors';

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,      // 100 requests per minute
};

export async function rateLimitMiddleware(
  request: NextRequest,
  config: RateLimitConfig = defaultConfig
): Promise<void> {
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  const key = `ratelimit:${ip}`;

  const current = await CacheService.get<number>(key) || 0;

  if (current >= config.maxRequests) {
    throw new TooManyRequestsError('Rate limit exceeded');
  }

  await CacheService.set(key, current + 1, config.windowMs / 1000);
}
```

**FILE: /src/server/api/middleware/index.ts**
```typescript
export { authMiddleware, optionalAuthMiddleware } from './auth.middleware';
export { withErrorHandler } from './error.middleware';
export { rateLimitMiddleware } from './rateLimit.middleware';
```

### 6. Validators

**FILE: /src/server/api/validators/user.validator.ts**
```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).max(100).optional(),
});

export const userIdSchema = z.object({
  id: z.string().uuid(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

**FILE: /src/server/api/validators/auth.validator.ts**
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
```

**FILE: /src/server/api/validators/index.ts**
```typescript
export * from './user.validator';
export * from './auth.validator';
```

### 7. Error Classes

**FILE: /src/server/lib/errors.ts**
```typescript
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'Bad request') {
    super(message, 400, 'BAD_REQUEST');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
```

### 8. Database Client

**FILE: /src/server/db/client.ts**
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
```

### 9. Cache Service

**FILE: /src/server/cache/client.ts**
```typescript
import { Redis } from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function getRedisClient(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return globalForRedis.redis;
}

export const redis = getRedisClient();
```

**FILE: /src/server/cache/index.ts**
```typescript
import { redis } from './client';

export const CacheService = {
  async get<T>(key: string): Promise<T | null> {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  },

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  },

  async delete(key: string): Promise<void> {
    await redis.del(key);
  },

  async deletePattern(pattern: string): Promise<void> {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};
```

### 10. Client-Side API Client

**FILE: /src/lib/api/client.ts**
```typescript
import { ApiResponse, ApiError } from '@/types/api.types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface RequestConfig extends RequestInit {
  params?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private getAuthHeader(): HeadersInit {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();

    if (!response.ok) {
      const error: ApiError = {
        message: data.error || 'An error occurred',
        code: data.code,
        status: response.status,
        details: data.details,
      };
      throw error;
    }

    return data as T;
  }

  async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...this.defaultHeaders,
        ...this.getAuthHeader(),
        ...config?.headers,
      },
      ...config,
    });
    return this.handleResponse<T>(response);
  }

  async post<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.defaultHeaders,
        ...this.getAuthHeader(),
        ...config?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...config,
    });
    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: unknown, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...this.defaultHeaders,
        ...this.getAuthHeader(),
        ...config?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
      ...config,
    });
    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const url = this.buildUrl(endpoint, config?.params);
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        ...this.defaultHeaders,
        ...this.getAuthHeader(),
        ...config?.headers,
      },
      ...config,
    });
    return this.handleResponse<T>(response);
  }

  setAuthToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', token);
    }
  }

  clearAuthToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
    }
  }
}

export const api = new ApiClient(BASE_URL);
```

**FILE: /src/lib/api/endpoints.ts**
```typescript
// Centralized endpoint definitions
export const endpoints = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    register: '/auth/register',
    refresh: '/auth/refresh',
    me: '/auth/me',
  },
  users: {
    list: '/users',
    get: (id: string) => `/users/${id}`,
    create: '/users',
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
  },
  // Add more as needed
} as const;
```

**FILE: /src/lib/api/index.ts**
```typescript
export { api } from './client';
export { endpoints } from './endpoints';
```

### 11. Shared Types

**FILE: /src/types/api.types.ts**
```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  status: number;
  details?: Array<{
    field: string;
    message: string;
  }>;
}
```

---

## ADDING A NEW RESOURCE

When adding a new API resource (e.g., "posts"):

1. Create route files:
   - `/src/app/api/posts/route.ts`
   - `/src/app/api/posts/[id]/route.ts`

2. Create controller:
   - `/src/server/api/controllers/post.controller.ts`

3. Create service:
   - `/src/server/services/post.service.ts`

4. Create repository:
   - `/src/server/repositories/post.repository.ts`

5. Create validators:
   - `/src/server/api/validators/post.validator.ts`

6. Add types:
   - `/src/server/types/post.types.ts`

7. Update exports in all index.ts files

---

Now create all files in their specified locations. Do NOT create any files in the root directory.
```
