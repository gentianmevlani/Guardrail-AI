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
- GithubAccount
- Repository
- Agent
- AgentAction
- AttackSurfaceAnalysis
- DependencyAnalysis
- SBOM
- OutputValidation
- LicenseAnalysis

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
- `/auth/index`
- `/auth/jwt`
- `/auth/middleware`
- `/auth/oauth`
- `/auth/password`
- `/auth/routes`
- `/auth/userRepository`
- `/db`
- `/index`
- `/replit_integrations/auth/index`
- `/replit_integrations/auth/replitAuth`
- `/replit_integrations/auth/routes`
- `/replit_integrations/auth/storage`
- `/types/express.d`

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



