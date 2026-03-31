# Express API Example with guardrail

This example demonstrates how to integrate guardrail into an Express.js API project.

## Quick Start

```bash
# Install dependencies
npm install

# Run guardrail scan
npx guardrail scan

# Start development
npm run dev
```

## What This Example Shows

1. **API Route Verification** - guardrail checks all routes are implemented
2. **Auth Middleware Detection** - Ensures sensitive routes have auth
3. **Secret Scanning** - Catches hardcoded API keys
4. **Environment Variable Validation** - Checks required env vars

## Project Structure

```
express-api/
├── src/
│   ├── routes/        # API routes
│   ├── middleware/    # Auth, validation, etc.
│   └── index.ts       # Entry point
├── guardrail.config.json
└── package.json
```

## Key guardrail Checks

### Route Integrity

guardrail verifies that all defined routes have actual implementations:

```typescript
// ✅ Good - Route has implementation
app.get("/api/users", (req, res) => {
  res.json(users);
});

// ❌ Bad - Route returns placeholder
app.get("/api/users", (req, res) => {
  res.json({ message: "TODO" });
});
```

### Auth Enforcement

guardrail ensures sensitive routes have authentication:

```typescript
// ✅ Good - Protected route
app.delete("/api/users/:id", authMiddleware, (req, res) => {
  // ...
});

// ❌ Bad - Unprotected sensitive route
app.delete("/api/users/:id", (req, res) => {
  // ...
});
```

## Learn More

- [guardrail Documentation](https://guardrailai.dev/docs)
- [Express.js Documentation](https://expressjs.com/)
