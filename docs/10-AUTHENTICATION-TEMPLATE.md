# AUTHENTICATION SYSTEM TEMPLATE

## Overview

This template sets up a complete authentication system with JWT, OAuth, and protected routes.

---

## MASTER PROMPT

```
Set up authentication for [PROJECT_NAME] with JWT authentication.

## CRITICAL: FILE LOCATIONS

```
/src
├── /app
│   └── /api
│       └── /auth
│           ├── /login/route.ts
│           ├── /logout/route.ts
│           ├── /register/route.ts
│           ├── /refresh/route.ts
│           └── /me/route.ts
│
├── /server
│   ├── /api
│   │   ├── /controllers
│   │   │   └── auth.controller.ts
│   │   └── /validators
│   │       └── auth.validator.ts
│   │
│   ├── /services
│   │   └── auth.service.ts
│   │
│   └── /lib
│       ├── jwt.ts
│       ├── hash.ts
│       └── cookies.ts
│
├── /features
│   └── /auth
│       ├── /components
│       │   ├── LoginForm.tsx
│       │   ├── RegisterForm.tsx
│       │   ├── AuthGuard.tsx
│       │   └── index.ts
│       ├── /hooks
│       │   ├── useAuth.ts
│       │   └── index.ts
│       └── index.ts
│
└── /middleware.ts           # Next.js middleware for route protection
```

## DELIVERABLES

### 1. JWT UTILITIES

**FILE: /src/server/lib/jwt.ts**
```typescript
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/config/env';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface TokenPayload {
  sub: string; // user id
  email: string;
  iat?: number;
  exp?: number;
}

export async function signToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(secret);
}

export async function signRefreshToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  return payload as TokenPayload;
}
```

**FILE: /src/server/lib/hash.ts**
```typescript
import { hash, compare } from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return compare(password, hashedPassword);
}
```

**FILE: /src/server/lib/cookies.ts**
```typescript
import { cookies } from 'next/headers';

const ACCESS_TOKEN_NAME = 'access_token';
const REFRESH_TOKEN_NAME = 'refresh_token';

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const cookieStore = await cookies();
  
  cookieStore.set(ACCESS_TOKEN_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
  
  cookieStore.set(REFRESH_TOKEN_NAME, refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });
}

export async function clearAuthCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_NAME);
  cookieStore.delete(REFRESH_TOKEN_NAME);
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_NAME)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_TOKEN_NAME)?.value;
}
```

### 2. AUTH SERVICE

**FILE: /src/server/services/auth.service.ts**
```typescript
import { db } from '@/server/db';
import { signToken, signRefreshToken, verifyToken } from '@/server/lib/jwt';
import { hashPassword, verifyPassword } from '@/server/lib/hash';
import { UnauthorizedError, ConflictError, NotFoundError } from '@/server/lib/errors';
import type { User } from '@prisma/client';

type SafeUser = Omit<User, 'password'>;

export const AuthService = {
  async register(data: { email: string; password: string; name: string }): Promise<{
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
  }> {
    // Check if email exists
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name,
        password: hashedPassword,
      },
    });

    // Generate tokens
    const tokenPayload = { sub: user.id, email: user.email };
    const accessToken = await signToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);

    const { password, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  },

  async login(data: { email: string; password: string }): Promise<{
    user: SafeUser;
    accessToken: string;
    refreshToken: string;
  }> {
    // Find user
    const user = await db.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Verify password
    const isValid = await verifyPassword(data.password, user.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Generate tokens
    const tokenPayload = { sub: user.id, email: user.email };
    const accessToken = await signToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);

    const { password, ...safeUser } = user;
    return { user: safeUser, accessToken, refreshToken };
  },

  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      const payload = await verifyToken(refreshToken);
      
      // Verify user still exists
      const user = await db.user.findUnique({ where: { id: payload.sub } });
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      // Generate new tokens
      const tokenPayload = { sub: user.id, email: user.email };
      const newAccessToken = await signToken(tokenPayload);
      const newRefreshToken = await signRefreshToken(tokenPayload);

      return { accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }
  },

  async getMe(userId: string): Promise<SafeUser> {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { password, ...safeUser } = user;
    return safeUser;
  },
};
```

### 3. AUTH VALIDATORS

**FILE: /src/server/api/validators/auth.validator.ts**
```typescript
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
```

### 4. AUTH API ROUTES

**FILE: /src/app/api/auth/login/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { loginSchema } from '@/server/api/validators/auth.validator';
import { setAuthCookies } from '@/server/lib/cookies';
import { withErrorHandler } from '@/server/api/middleware';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = loginSchema.parse(body);

  const { user, accessToken, refreshToken } = await AuthService.login(validated);

  // Set cookies
  await setAuthCookies(accessToken, refreshToken);

  return NextResponse.json({
    success: true,
    data: { user, accessToken },
  });
});
```

**FILE: /src/app/api/auth/register/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { registerSchema } from '@/server/api/validators/auth.validator';
import { setAuthCookies } from '@/server/lib/cookies';
import { withErrorHandler } from '@/server/api/middleware';

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const validated = registerSchema.parse(body);

  const { user, accessToken, refreshToken } = await AuthService.register(validated);

  await setAuthCookies(accessToken, refreshToken);

  return NextResponse.json(
    { success: true, data: { user, accessToken } },
    { status: 201 }
  );
});
```

**FILE: /src/app/api/auth/logout/route.ts**
```typescript
import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/server/lib/cookies';

export async function POST() {
  await clearAuthCookies();
  return NextResponse.json({ success: true });
}
```

**FILE: /src/app/api/auth/me/route.ts**
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/server/services/auth.service';
import { authMiddleware, withErrorHandler } from '@/server/api/middleware';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = await authMiddleware(request);
  const user = await AuthService.getMe(userId);

  return NextResponse.json({ success: true, data: user });
});
```

### 5. NEXT.JS MIDDLEWARE

**FILE: /src/middleware.ts**
```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/server/lib/jwt';

const protectedPaths = ['/dashboard', '/settings'];
const authPaths = ['/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;

  // Check if path is protected
  const isProtectedPath = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  // Verify token
  let isAuthenticated = false;
  if (accessToken) {
    try {
      await verifyToken(accessToken);
      isAuthenticated = true;
    } catch {
      // Token invalid or expired
    }
  }

  // Redirect if accessing protected route without auth
  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect if accessing auth pages while authenticated
  if (isAuthPath && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 6. CLIENT-SIDE AUTH HOOK

**FILE: /src/features/auth/hooks/useAuth.ts**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

export function useAuth() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await api.get<{ data: User }>('/auth/me');
      return response.data;
    },
    retry: false,
  });

  const login = useMutation({
    mutationFn: async (data: { email: string; password: string }) => {
      const response = await api.post<{ data: { user: User } }>('/auth/login', data);
      return response.data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user);
      router.push('/dashboard');
    },
  });

  const register = useMutation({
    mutationFn: async (data: { email: string; password: string; name: string }) => {
      const response = await api.post<{ data: { user: User } }>('/auth/register', data);
      return response.data.user;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(['auth', 'me'], user);
      router.push('/dashboard');
    },
  });

  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      queryClient.setQueryData(['auth', 'me'], null);
      queryClient.clear();
      router.push('/login');
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
  };
}
```

### 7. AUTH GUARD COMPONENT

**FILE: /src/features/auth/components/AuthGuard.tsx**
```typescript
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return fallback || <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
```

---

Now create all auth files in their specified locations. Server files in /src/server/, features in /src/features/auth/, routes in /src/app/api/auth/.
```
