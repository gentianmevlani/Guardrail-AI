# AI Agent Prompt Template

Copy this template to the START of every AI agent prompt to keep agents on track:

---

```
## CRITICAL: AI AGENT GUARDRAILS

Before doing anything, read and follow these rules:

### 1. FILE ORGANIZATION
- NEVER create files in root directory (except: package.json, tsconfig.json, *.config.js/ts, .env, .gitignore, README.md)
- ALWAYS specify full file paths when creating files
- Use feature-based organization: /src/features/[name]/
- Shared code: /src/components, /src/lib, /src/hooks, /src/types

### 2. NO MOCK DATA OR FAKE ENDPOINTS
- NEVER use mock data, fake endpoints, or placeholder data
- ALWAYS use real API endpoints that are registered in src/config/api-endpoints.ts
- If an endpoint doesn't exist, create it first, then use it
- No hardcoded arrays of objects with fake data
- Never use external mock APIs (jsonplaceholder, reqres, etc.)

### 3. API ENDPOINTS
- Only use registered API endpoints (check src/config/api-endpoints.ts)
- Register new endpoints using: apiValidator.registerEndpoint()
- Use validatedFetch() wrapper for all API calls (import from @/lib/api-validator)
- Example: import { validatedFetch } from '@/lib/api-validator'; const res = await validatedFetch('/api/users');

### 4. CODE QUALITY
- All code must pass ESLint and TypeScript checks
- Use proper TypeScript types (no 'any' types)
- Fix all linting errors before completing
- Follow the project's architecture patterns

### 5. VALIDATION
- Before finishing, verify:
  - All files are in correct locations
  - No mock data is used
  - All API endpoints are registered
  - Code passes type checking

### FILE LOCATION EXAMPLES
✅ CORRECT:
- /src/features/user/components/UserProfile.tsx
- /src/hooks/useAuth.ts
- /src/lib/api.ts
- /src/app/api/users/route.ts

❌ WRONG:
- /UserProfile.tsx (root directory)
- /api.ts (root directory)
- /components/Button.tsx (should be /src/components/ui/Button.tsx)

### WHEN CREATING FILES
1. Check if it belongs in a feature directory (/src/features/[name]/)
2. Verify the full path is correct
3. Ensure no similar file exists
4. Use proper naming conventions
5. Always specify the complete path

---

Now proceed with the task, following all rules above.
```

---

## Quick Copy Version (One-Liner)

For quick inclusion in prompts:

```
IMPORTANT: Follow guardrails: 1) Files in /src/ subdirectories only (never root), 2) No mock data - only real registered API endpoints (use validatedFetch from @/lib/api-validator), 3) All code must pass ESLint/TypeScript, 4) Register endpoints in src/config/api-endpoints.ts. Always specify full file paths.
```

---

## For Specific Tasks

### Creating a Component
```
Create [ComponentName] component following guardrails:
- Location: /src/features/[feature]/components/[ComponentName].tsx (or /src/components/ui/ if shared)
- Use TypeScript with proper types
- No mock data - use real API endpoints
- Register any new API endpoints needed
```

### Creating an API Route
```
Create API route for [resource] following guardrails:
- Location: /src/app/api/[resource]/route.ts
- Register endpoint in src/config/api-endpoints.ts
- Use proper error handling
- No mock data in responses
```

### Creating a Hook
```
Create [HookName] hook following guardrails:
- Location: /src/features/[feature]/hooks/use[HookName].ts (or /src/hooks/ if shared)
- Use validatedFetch for API calls
- Proper TypeScript types
- No mock data
```

---

**Remember:** Always include guardrails at the start of prompts to keep AI agents on track! 🎯

