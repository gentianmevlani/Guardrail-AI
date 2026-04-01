# Real-Time Tracking Guide

## 🎯 Overview

guardrail AI now tracks your project in real-time as you build, automatically storing:
- **API Endpoints** - Every endpoint is registered immediately
- **Component Usage** - Tracks which components are used where
- **File Changes** - Monitors all changes to your codebase
- **Path Validation** - Ensures frontend/backend paths always match

## 🚀 Quick Start

### Start Tracking
```bash
guardrail start-tracking
```

This starts watching your project and automatically registers:
- New API endpoints as you create them
- Component usage as you import them
- File changes in real-time

### Validate Paths
```bash
guardrail validate-paths
```

Checks that all frontend API calls match registered backend endpoints.

### Generate API Client
```bash
guardrail generate-api-client
```

Generates a TypeScript API client from all registered endpoints.

## 📋 Features

### 1. **Automatic API Endpoint Registration**

When you create an API endpoint, it's automatically registered:

```typescript
// Backend: app/api/users/route.ts
export async function GET() {
  // This endpoint is automatically registered as GET /api/users
}

// Express: routes/users.ts
app.get('/api/v1/users', getUsers);
// Automatically registered as GET /api/v1/users
```

### 2. **Path Validation**

Frontend calls are validated against registered endpoints:

```typescript
// Frontend: components/UserList.tsx
fetch('/api/v1/users') // ✅ Validated against registry

// If path doesn't match:
// ❌ Error: API endpoint not found
// 💡 Suggestion: /api/v1/users (did you mean this?)
```

### 3. **Auto-Generated API Client**

Generate a complete API client from your endpoints:

```typescript
// Generated: src/lib/api-client.ts
export async function getUsers() {
  const url = `${API_BASE}/users`;
  const response = await fetch(url, { method: 'GET' });
  return response.json();
}
```

### 4. **Component Tracking**

Tracks which components are used where:

```typescript
// Component: Button.tsx
export const Button = () => { ... }

// Usage tracked automatically:
// - Used in: components/Header.tsx
// - Used in: pages/Home.tsx
```

## 🔧 Usage Examples

### Example 1: Create API Endpoint

```typescript
// Backend: app/api/users/route.ts
export async function GET() {
  return Response.json({ users: [] });
}
```

**Automatically registered:**
- Method: GET
- Path: /api/users
- File: app/api/users/route.ts

### Example 2: Validate Frontend Call

```typescript
// Frontend: components/UserList.tsx
const users = await fetch('/api/v1/users').then(r => r.json());
```

**Validation:**
```bash
guardrail validate-paths
# ✅ Path validated: GET /api/v1/users
```

### Example 3: Generate API Client

```bash
guardrail generate-api-client
# ✅ API client generated: src/lib/api-client.ts
```

**Generated code:**
```typescript
export async function getUsers() {
  const url = `${API_BASE}/users`;
  const response = await fetch(url, { method: 'GET' });
  return response.json();
}
```

## 📊 Registry Files

All tracking data is stored in `.guardrail/`:

- **api-registry.json** - All registered API endpoints
- **component-registry.json** - All components and their usage
- **file-changes.json** - History of file changes

## 🎯 Benefits

### 1. **Never Miss an Endpoint**
- Every endpoint is automatically registered
- No manual documentation needed
- Always up-to-date

### 2. **Path Sync**
- Frontend paths always match backend
- Automatic validation
- Suggestions for typos

### 3. **Auto-Generated Code**
- API clients generated automatically
- Type-safe API calls
- No manual wiring needed

### 4. **Component Insights**
- See which components are used
- Find unused components
- Track component dependencies

## 🔍 Registry Structure

### API Registry
```json
{
  "endpoints": [
    {
      "id": "endpoint-123",
      "method": "GET",
      "path": "/users",
      "fullPath": "/api/v1/users",
      "filePath": "app/api/users/route.ts",
      "handler": "GET",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "basePaths": ["/api/v1"],
  "lastUpdated": "2024-01-01T00:00:00Z"
}
```

### Component Registry
```json
{
  "components": [
    {
      "id": "component-123",
      "name": "Button",
      "filePath": "components/Button.tsx",
      "props": ["children", "onClick"],
      "usedIn": ["components/Header.tsx", "pages/Home.tsx"]
    }
  ]
}
```

## 🛠️ Advanced Usage

### Manual Endpoint Registration
```typescript
import { apiEndpointTracker } from '@guardrail/api-endpoint-tracker';

apiEndpointTracker.registerEndpoint(
  'POST',
  '/api/v1/users',
  'routes/users.ts',
  'createUser',
  {
    params: ['id'],
    bodySchema: { name: 'string', email: 'string' },
    description: 'Create a new user'
  }
);
```

### Custom File Watcher
```typescript
import { fileWatcher } from '@guardrail/file-watcher';

fileWatcher.onChange((change) => {
  console.log(`File ${change.type}: ${change.filePath}`);
});

fileWatcher.startWatching(['**/*.ts', '**/*.tsx']);
```

## 💡 Tips

1. **Start Tracking Early** - Run `start-tracking` when you start your project
2. **Validate Often** - Run `validate-paths` before committing
3. **Generate Client** - Regenerate API client after adding endpoints
4. **Check Registry** - View `.guardrail/api-registry.json` to see all endpoints

## 🚨 Troubleshooting

### Endpoints Not Registering
- Make sure `start-tracking` is running
- Check file patterns match your project structure
- Verify endpoints follow Express/Next.js patterns

### Path Validation Failing
- Ensure backend endpoints are registered
- Check path format matches (e.g., `/api/v1/users` vs `/api/users`)
- Run `validate-paths --fix` to see suggestions

### Generated Client Missing Endpoints
- Regenerate after adding new endpoints
- Check base path matches your API structure
- Verify endpoints are in the registry

---

**Never lose track of your API endpoints again!** 📡✨

