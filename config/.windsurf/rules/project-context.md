# Project Context - codeguard

## Overview
- **Framework:** Express
- **Language:** TypeScript
- **Architecture:** Next.js Pages Router
- **Monorepo:** pnpm with 9 workspaces

## Tech Stack


- TypeScript
- Prisma ORM

- Zustand
- Zod


## Directory Structure
- `src/`
- `src/pages/`
- `src/components/`
- `src/lib/`
- `src/services/`
- `server/`
- `src/server/`
- `prisma/`

## Workspaces
- `apps\api` - @guardrail/api
- `apps\web-ui` - @guardrail/web-ui
- `packages\ai-guardrails` - @guardrail/ai-guardrails
- `packages\cli` - @guardrail/cli
- `packages\compliance` - @guardrail/compliance
- `packages\core` - @guardrail/core
- `packages\database` - @guardrail/database
- `packages\security` - @guardrail/security
- `packages\ship` - @guardrail/ship


## Components (3)
- EmptyState
- ErrorBoundary
- LoadingState



## API Routes (14)
- /auth/index
- /auth/jwt
- /auth/middleware
- /auth/oauth
- /auth/password
- /auth/routes
- /auth/userRepository
- /db
- /index
- /replit_integrations/auth/index
- /replit_integrations/auth/replitAuth
- /replit_integrations/auth/routes
- /replit_integrations/auth/storage
- /types/express.d

## Data Models
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
- RoomActivity
- RepositoryAnalysis
- CrossRepoInsight
- DesignSystem
- ComplianceAssessment
- AuditEvent
- ComplianceSchedule
- Alert
- AlertConfig
- RemediationTask
- ReportSchedule
- EvidenceCollection
- KubernetesScan
- ContainerScan
- IaCScan
- PIIDetection
- ComplianceReport
- GithubAccount
- Repository
- Agent
- AgentAction
- AttackSurfaceAnalysis
- DependencyAnalysis
- SBOM
- OutputValidation
- LicenseAnalysis


## Environment Variables
- `ANTHROPIC_API_KEY`
- `API_BASE_URL`
- `API_URL`
- `APPDATA`
- `CODEGUARD_API_URL`
- `COOKIE_DOMAIN`
- `COOKIE_SECRET`
- `CORS_ORIGIN`
- `DATABASE_POOL_SIZE`
- `DATABASE_URL`
- `DEBUG`
- `FRONTEND_URL`
- `GITHUB_API_RATE_LIMIT`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_CLIENT_SECRET`


---
*Context Enhanced by guardrail AI*
