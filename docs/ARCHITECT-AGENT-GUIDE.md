# Architect Agent - Complete Guide

## 🎯 What is the Architect Agent?

The **Architect Agent** is an intelligent orchestrator that:
- ✅ Analyzes your project context automatically
- ✅ Selects appropriate templates
- ✅ Applies them in correct order
- ✅ Handles all dependencies
- ✅ Works seamlessly with your IDE

**No thinking required - just run it and it figures everything out!**

## 🚀 Usage

### Command Line
```bash
npm run architect
```

### In Your IDE (MCP)
The architect agent is available as MCP tools:
- `architect_analyze` - Analyze project and get recommendations
- `architect_apply` - Apply templates automatically

### One-Command Setup
```bash
npm run architect
# Answer "yes" to apply templates
```

## 🧠 How It Works

### 1. Context Detection
The agent automatically detects:
- Project type (frontend, backend, fullstack)
- Framework (React, Vue, Express, etc.)
- Project stage (new, growing, mature)
- Existing features (database, auth, API)
- Missing infrastructure

### 2. Intelligent Recommendations
Based on context, it recommends:
- **Critical** - Must-have items (error handlers, .gitignore)
- **High** - Important for production (observability, resilience)
- **Medium** - Best practices (design system, polish)
- **Low** - Nice-to-have improvements

### 3. Dependency Resolution
Automatically resolves template dependencies:
- Design tokens → Theme → Component Library
- Logger → Correlation ID → Error Reporting
- Error Handler → Rate Limit → CORS

### 4. Ordered Application
Applies templates in correct order:
1. Dependencies first
2. Critical items
3. High priority
4. Medium/Low priority

## 📊 Example Output

```
🏗️  Architect Agent

📊 PROJECT CONTEXT

   Type: fullstack
   Framework: react, express
   Stage: growing
   Has Database: Yes
   Has Auth: No
   Has API: Yes

💡 RECOMMENDATIONS

   1. 🔴 [CRITICAL] Missing .gitignore - critical for security
      Action: setup | Templates: 1
      ✅ Will auto-apply

   2. 🔴 [CRITICAL] Backend needs essential middleware
      Action: setup | Templates: 4
      ✅ Will auto-apply

   3. 🟠 [HIGH] Add observability for production debugging
      Action: enhance | Templates: 3

   4. 🟠 [HIGH] Add resilience patterns for reliability
      Action: enhance | Templates: 2

   5. 🟡 [MEDIUM] Create design system for UI consistency
      Action: enhance | Templates: 3

📋 TEMPLATE PLAN

   Total Templates: 13
   Estimated Time: 10-20 minutes

   Templates to apply (in order):

   1. .gitignore (Configuration)
      → .gitignore
      Reason: Critical for security

   2. Error Handler (Backend)
      → src/backend/middleware/error-handler.middleware.ts
      Reason: Critical for production error handling

   3. Rate Limiting (Backend)
      → src/backend/middleware/rate-limit.middleware.ts
      Reason: Protect API from abuse

   4. CORS (Backend)
      → src/backend/middleware/cors.middleware.ts
      Reason: Required for frontend to connect

   5. Health Check (Backend)
      → src/backend/routes/health.route.ts
      Reason: Required for deployment monitoring

   6. Structured Logging (Observability)
      → src/infrastructure/observability/logger.ts
      Reason: Essential for production debugging

   7. Correlation ID (Observability)
      → src/infrastructure/observability/correlation-id.middleware.ts
      Depends on: logger
      Reason: Track requests across services

   8. Error Reporting (Observability)
      → src/infrastructure/observability/error-reporting.ts
      Depends on: logger
      Reason: Catch production errors

   ... and more

🚀 Apply templates automatically? (yes/no): yes

✅ Applied templates:
   ✅ .gitignore
   ✅ Error Handler
   ✅ Rate Limiting
   ✅ CORS
   ✅ Health Check
   ✅ Structured Logging
   ✅ Correlation ID
   ✅ Error Reporting
```

## 🎯 What Gets Applied

### Automatically Applied (Critical)
- ✅ .gitignore
- ✅ Error handlers
- ✅ Rate limiting
- ✅ CORS
- ✅ Health checks
- ✅ Growth features (error boundaries, 404s, etc.)

### Requires Approval (High/Medium)
- ⚠️ Observability stack
- ⚠️ Resilience patterns
- ⚠️ Design system
- ⚠️ Advanced features

## 💡 Benefits

### For You
- ✅ **No thinking** - Agent figures it out
- ✅ **Correct order** - Dependencies handled
- ✅ **Context-aware** - Only what you need
- ✅ **Time-saving** - Minutes instead of hours

### For Your Project
- ✅ **Production-ready** - All essentials included
- ✅ **Best practices** - Industry standards
- ✅ **Consistent** - Same patterns everywhere
- ✅ **Maintainable** - Proper structure

## 🔧 IDE Integration

### Cursor / VS Code / Windsurf
The architect agent is available as MCP tools:

**Analyze:**
```
Use architect_analyze tool to analyze project
```

**Apply:**
```
Use architect_apply tool to apply templates
```

The AI assistant in your IDE can:
- Analyze your project automatically
- Suggest templates based on context
- Apply them when you approve
- Explain what each template does

## 📋 Template Registry

The agent knows about all templates:
- Frontend components (ErrorBoundary, LoadingState, etc.)
- Backend middleware (ErrorHandler, RateLimit, CORS, etc.)
- Infrastructure (Logger, Retry, CircuitBreaker, etc.)
- Design system (Tokens, Theme, Components)
- Configuration (.gitignore, .env.example, etc.)

## 🎯 Smart Features

### Context Awareness
- Detects React → Adds React-specific templates
- Detects Express → Adds Express middleware
- Detects fullstack → Adds both frontend and backend

### Dependency Resolution
- Design tokens must come before theme
- Logger must come before correlation ID
- Error handler must come before error reporting

### Priority Ordering
- Critical items first
- Dependencies before dependents
- High priority before medium/low

## 🚀 Workflow

### New Project
1. Create project
2. Run `npm run architect`
3. Review recommendations
4. Apply templates
5. Start coding!

### Existing Project
1. Run `npm run architect`
2. See what's missing
3. Apply recommended templates
4. Customize as needed

### Continuous
1. Run `npm run architect` periodically
2. Get new recommendations as project grows
3. Apply incrementally

## 💡 Pro Tips

1. **Run early** - Better to set up infrastructure from the start
2. **Review first** - See what will be applied before confirming
3. **Customize after** - Templates are starting points, customize as needed
4. **Run regularly** - As project grows, new templates become relevant

---

**Let the Architect Agent handle the complexity - you focus on building!** 🏗️

