# DATABASE & ORM TEMPLATE

## Overview

This template sets up database connection, schema design, migrations, and seeding with Prisma.

---

## CONFIGURATION

```yaml
DATABASE: "postgresql" # postgresql | mysql | mongodb | sqlite
ORM: "prisma" # prisma | drizzle
```

---

## MASTER PROMPT

```
Set up database layer for [PROJECT_NAME] using Prisma with PostgreSQL.

## CRITICAL: FILE LOCATIONS

```
/
├── /prisma                    # Prisma files
│   ├── schema.prisma          # Database schema
│   ├── /migrations            # Migration files (auto-generated)
│   └── seed.ts                # Seed script
│
├── /scripts                   # Database scripts
│   ├── db-push.ts
│   ├── db-seed.ts
│   └── db-reset.ts
│
└── /src
    └── /server
        └── /db
            ├── client.ts      # Prisma client
            ├── helpers.ts     # DB helpers
            └── index.ts
```

## DELIVERABLES

### 1. PRISMA SCHEMA

**FILE: /prisma/schema.prisma**
```prisma
// Prisma Schema for [PROJECT_NAME]
// Docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// USER & AUTH
// ==========================================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  password      String
  avatar        String?
  emailVerified DateTime?
  
  // Relations
  accounts      Account[]
  sessions      Session[]
  
  // Timestamps
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("users")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ==========================================
// ADD YOUR MODELS HERE
// ==========================================

// Example: Posts
model Post {
  id        String   @id @default(cuid())
  title     String
  content   String?  @db.Text
  published Boolean  @default(false)
  authorId  String
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([authorId])
  @@map("posts")
}
```

### 2. PRISMA CLIENT

**FILE: /src/server/db/client.ts**
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Export for convenience
export { Prisma } from '@prisma/client';
export type { User, Post } from '@prisma/client';
```

**FILE: /src/server/db/helpers.ts**
```typescript
import { Prisma } from '@prisma/client';

// Pagination helper
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function getPaginationParams(params: PaginationParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;
  
  return { page, limit, skip, take: limit };
}

export function createPaginatedResult<T>(
  data: T[],
  total: number,
  params: { page: number; limit: number }
): PaginatedResult<T> {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    },
  };
}

// Search helper
export function createSearchFilter(
  search: string | undefined,
  fields: string[]
): Prisma.StringFilter | undefined {
  if (!search) return undefined;
  
  return {
    contains: search,
    mode: 'insensitive',
  };
}

// Transaction helper
export async function withTransaction<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const { db } = await import('./client');
  return db.$transaction(fn);
}
```

**FILE: /src/server/db/index.ts**
```typescript
export { db, Prisma } from './client';
export type { User, Post } from './client';
export * from './helpers';
```

### 3. SEED SCRIPT

**FILE: /prisma/seed.ts**
```typescript
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (careful in production!)
  if (process.env.NODE_ENV !== 'production') {
    await prisma.post.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create test users
  const hashedPassword = await hash('password123', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@example.com',
      name: 'Test User',
      password: hashedPassword,
      emailVerified: new Date(),
    },
  });

  // Create test posts
  await prisma.post.createMany({
    data: [
      {
        title: 'First Post',
        content: 'This is the first post content.',
        published: true,
        authorId: admin.id,
      },
      {
        title: 'Second Post',
        content: 'This is the second post content.',
        published: true,
        authorId: user.id,
      },
      {
        title: 'Draft Post',
        content: 'This is a draft.',
        published: false,
        authorId: admin.id,
      },
    ],
  });

  console.log('✅ Seeding complete!');
  console.log(`   Created ${await prisma.user.count()} users`);
  console.log(`   Created ${await prisma.post.count()} posts`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 4. DATABASE SCRIPTS

**FILE: /scripts/db-reset.ts**
```typescript
/**
 * Reset database: drop all tables, run migrations, seed
 * WARNING: This will delete all data!
 */

import { execSync } from 'child_process';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Cannot reset production database!');
    process.exit(1);
  }

  console.log('🗑️  Resetting database...');
  
  // Reset database
  execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
  
  console.log('✅ Database reset complete!');
}

main().catch(console.error);
```

### 5. PACKAGE.JSON SCRIPTS

```json
{
  "scripts": {
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:migrate:prod": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:reset": "ts-node scripts/db-reset.ts",
    "db:studio": "prisma studio"
  },
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

---

Now create all database files in their specified locations. Prisma files go in /prisma/, DB client goes in /src/server/db/.
```
