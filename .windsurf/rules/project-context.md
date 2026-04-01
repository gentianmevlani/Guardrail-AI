# Project Context - guardrail-Ofiicial-main

## Overview
- **Framework:** React
- **Language:** TypeScript
- **Architecture:** Next.js Pages Router
- **Monorepo:** pnpm with 9 workspaces

## Tech Stack

- React
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
- `src/server/`
- `prisma/`

## Workspaces
- `apps\api` - @guardrail/api
- `apps\web-ui` - @guardrail/web-ui
- `packages\ai-guardrails` - @guardrail/ai-guardrails
- `packages\cli` - guardrail-cli-tool
- `packages\compliance` - @guardrail/compliance
- `packages\core` - guardrail-core
- `packages\database` - @guardrail/database
- `packages\security` - guardrail-security
- `packages\ship` - guardrail-ship


## Components (3)
- EmptyState
- ErrorBoundary
- LoadingState



## API Routes (617)
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
- Tenant
- TenantUser
- GithubAccount
- Repository
- Agent
- AgentAction
- AttackSurfaceAnalysis
- DependencyAnalysis
- SBOM
- OutputValidation
- LicenseAnalysis
- LicenseKey
- LicenseActivation
- Invoice
- BillingEvent
- UsageLog
- Scan
- Finding
- UserLLMKey
- UsageCounter
- UsageToken
- OfflineUsageQueue
- UserOnboarding
- Organization
- OrganizationMember
- TeamSeat
- SecurityEvent
- Report
- ConsentPreferences
- LegalAcceptance
- GdprJob
- GdprAuditLog
- AdminAuditLog
- ImpersonationSession
- SupportNote
- BroadcastJob
- BroadcastRecipient
- RolePermission
- TeamInvitation
- RBACActivityLog
- FeatureFlag
- Feedback
- IncidentMessage


## Environment Variables
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


---
*Context Enhanced by guardrail AI*
