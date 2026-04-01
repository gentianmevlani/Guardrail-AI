# API & Data Patterns

## Database (Prisma)

### Available Models
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

### Usage
```typescript
import { prisma } from '@/lib/prisma'

// Query
const users = await prisma.user.findMany()

// Create with validation
const user = await prisma.user.create({
  data: validatedInput
})
```

### Rules
- Always import from `@/lib/prisma`
- Use transactions for multi-step operations
- Handle errors gracefully
- Never expose raw errors to client


## API Routes

### Existing Endpoints
- `/auth/api-key`
- `/auth/forgot-password`
- `/auth/github/callback`
- `/auth/github/connect`
- `/auth/github/disconnect`
- `/auth/github/login`
- `/auth/github`
- `/auth/google/callback`
- `/auth/google`
- `/auth/login`
- `/auth/logout`
- `/auth/register`
- `/auth/reset-password`
- `/auth/user`
- `/checkout`
- `/compliance/audit-trail`
- `/compliance/export`
- `/compliance/frameworks`
- `/compliance/integrity`
- `/csp-report`

### API Response Pattern
```typescript
// Success
return Response.json({ data, success: true })

// Error
return Response.json({ error: message }, { status: 400 })
```

### Validation
Use Zod for input validation:
```typescript
const schema = z.object({ name: z.string() })
const data = schema.parse(await req.json())
```



