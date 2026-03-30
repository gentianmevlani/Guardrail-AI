# Claude Desktop - Project Context

## Project: guardrail-Ofiicial-main

### Quick Reference

| Property | Value |
|----------|-------|
| Framework | React |
| Language | TypeScript |
| Architecture | Next.js Pages Router |
| Monorepo | pnpm (9 workspaces) |

### Tech Stack


- **React** - UI library
- **TypeScript** - Type safety
- **Prisma** - Database ORM

- **Zustand** - State management
- **Zod** - Validation


### Key Directories

- `src/`
- `src/pages/`
- `src/components/`
- `src/lib/`
- `src/services/`
- `src/server/`
- `prisma/`

### Workspaces

- `apps\api` → @guardrail/api
- `apps\web-ui` → @guardrail/web-ui
- `packages\ai-guardrails` → @guardrail/ai-guardrails
- `packages\cli` → guardrail-cli-tool
- `packages\compliance` → @guardrail/compliance
- `packages\core` → guardrail-core
- `packages\database` → @guardrail/database
- `packages\security` → guardrail-security
- `packages\ship` → guardrail-ship


### Available Commands

- `npm run setup`
- `npm run build`
- `npm run build:all`
- `npm run build:lib`
- `npm run build:netlify`
- `npm run deploy:production`
- `npm run dev`
- `npm run test`
- `npm run test:watch`
- `npm run test:coverage`

### Data Models

- User
- TokenBlacklist
- RefreshToken
- OAuthState
- Subscription
- Payment
- Project
- Team
- TeamMember
- UsageRecord
- ApiKey
- Analytics
- CodeSnapshot
- EvolutionTrend
- CollaborationRoom

### Custom Hooks

None detected

### Components

- EmptyState
- ErrorBoundary
- LoadingState

### Environment Variables

- `ANTHROPIC_API_KEY`
- `APPDATA`
- `ARTIFACTS_DIR`
- `BUILDKITE`
- `CI`
- `CIRCLECI`
- `CONTINUOUS_INTEGRATION`
- `DATABASE_URL`
- `DEBUG`
- `FRONTEND_URL`
- `GITHUB_ACTIONS`
- `GITHUB_ACTOR`
- `GITLAB_CI`
- `GITLAB_USER_LOGIN`
- `GITLAB_USER_NAME`

### API Routes

- /auth/api-key
- /auth/forgot-password
- /auth/github/callback
- /auth/github/connect
- /auth/github/disconnect
- /auth/github/login
- /auth/github
- /auth/google/callback
- /auth/google
- /auth/login
- /auth/logout
- /auth/register
- /auth/reset-password
- /auth/user
- /checkout

### Rules for AI

1. **Follow existing patterns** - Match the codebase style
2. **Use TypeScript strictly** - No `any` types
3. **Use existing components** - Check list above first
4. **Use existing hooks** - Don't recreate what exists
5. **Validate inputs** - Use Zod for validation
6. **No hardcoded secrets** - Use environment variables
7. **No mock data** - Use real API endpoints

### ⚠️ Avoid These Patterns

- Potential hardcoded secrets detected
- Console statements found in production code
- Usage of `any` type detected
- TODO/FIXME comments found


---

*Context Enhanced by guardrail AI*
