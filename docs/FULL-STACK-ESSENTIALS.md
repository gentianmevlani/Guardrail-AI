# Full Stack Essentials - Complete Guide

## 🎯 The Problem

Building a full stack app requires **hundreds of little things** that AI agents often miss:
- Environment variable validation
- Proper error handling
- Rate limiting
- CORS configuration
- Request validation
- Password security
- JWT tokens
- Database connection pooling
- Health checks
- File uploads
- Pagination
- Search/filtering
- And so much more...

## ✅ The Solution

**Complete backend templates** with all essential features pre-built and ready to use!

## 📦 What's Included

### 1. Authentication & Authorization ✅

**Files:**
- `templates/backend/middleware/auth.middleware.ts`

**Features:**
- JWT authentication
- Optional authentication
- Role-based access control (RBAC)
- Owner or admin checks
- Token validation

**Usage:**
```typescript
import { authenticateJWT, requireAdmin, requireRole } from './middleware/auth.middleware';

// Protect route
router.get('/protected', authenticateJWT, handler);

// Admin only
router.delete('/admin', authenticateJWT, requireAdmin, handler);

// Specific roles
router.post('/moderator', authenticateJWT, requireRole('admin', 'moderator'), handler);
```

### 2. Request Validation ✅

**Files:**
- `templates/backend/middleware/validation.middleware.ts`

**Features:**
- Body validation
- Query parameter validation
- Route parameter validation
- Common schemas (email, password, pagination)

**Usage:**
```typescript
import { validateBody, commonSchemas } from './middleware/validation.middleware';
import { z } from 'zod';

const createUserSchema = z.object({
  email: commonSchemas.email,
  password: commonSchemas.password,
  name: z.string().min(1),
});

router.post('/users', validateBody(createUserSchema), handler);
```

### 3. Rate Limiting ✅

**Files:**
- `templates/backend/middleware/rate-limit.middleware.ts`

**Features:**
- Per-IP/user rate limiting
- Configurable windows
- Rate limit headers
- Different limits for different endpoints

**Usage:**
```typescript
import { strictRateLimit, standardRateLimit } from './middleware/rate-limit.middleware';

// Strict (for auth endpoints)
router.post('/login', strictRateLimit, handler);

// Standard (for general endpoints)
router.get('/api/data', standardRateLimit, handler);
```

### 4. CORS & Security Headers ✅

**Files:**
- `templates/backend/middleware/cors.middleware.ts`

**Features:**
- Proper CORS configuration
- Security headers (X-Frame-Options, CSP, etc.)
- Environment-based configuration
- Preflight handling

**Usage:**
```typescript
import { corsMiddleware, securityHeaders } from './middleware/cors.middleware';

app.use(corsMiddleware);
app.use(securityHeaders);
```

### 5. Error Handling ✅

**Files:**
- `templates/backend/middleware/error-handler.middleware.ts`

**Features:**
- Standardized error responses
- Custom error classes
- Database error handling
- Development vs production errors
- Error logging

**Usage:**
```typescript
import { CustomError, errorHandler, asyncHandler } from './middleware/error-handler.middleware';

// Throw custom error
throw new CustomError('User not found', 404, 'USER_NOT_FOUND');

// Wrap async handlers
router.get('/data', asyncHandler(async (req, res) => {
  // Your code
}));

// Add error handler last
app.use(errorHandler);
```

### 6. Request ID Tracking ✅

**Files:**
- `templates/backend/middleware/request-id.middleware.ts`

**Features:**
- Unique ID for every request
- Debugging and logging
- Response headers

**Usage:**
```typescript
import { requestIdMiddleware } from './middleware/request-id.middleware';

app.use(requestIdMiddleware);
// Every request now has X-Request-ID header
```

### 7. Standardized Responses ✅

**Files:**
- `templates/backend/utils/response.util.ts`

**Features:**
- Consistent API responses
- Success/error helpers
- Paginated responses
- Created responses

**Usage:**
```typescript
import { sendSuccess, sendError, sendPaginated } from './utils/response.util';

// Success
sendSuccess(res, data);

// Error
sendError(res, 'Something went wrong', 400, 'ERROR_CODE');

// Paginated
sendPaginated(res, items, page, limit, total);
```

### 8. Password Security ✅

**Files:**
- `templates/backend/utils/password.util.ts`

**Features:**
- Bcrypt hashing
- Password verification
- Strength validation
- Secure defaults

**Usage:**
```typescript
import { hashPassword, verifyPassword, validatePasswordStrength } from './utils/password.util';

// Hash password
const hash = await hashPassword('user-password');

// Verify password
const isValid = await verifyPassword('user-password', hash);

// Validate strength
const { valid, errors } = validatePasswordStrength(password);
```

### 9. JWT Tokens ✅

**Files:**
- `templates/backend/utils/jwt.util.ts`

**Features:**
- Access token generation
- Refresh token generation
- Token verification
- Token pair generation

**Usage:**
```typescript
import { generateTokenPair, verifyAccessToken } from './utils/jwt.util';

// Generate tokens
const { accessToken, refreshToken } = generateTokenPair({
  id: user.id,
  email: user.email,
  role: user.role,
});

// Verify token
const payload = verifyAccessToken(token);
```

### 10. Database Utilities ✅

**Files:**
- `templates/backend/utils/database.util.ts`

**Features:**
- Connection pooling
- Transaction support
- Query helpers
- Health checks
- Graceful shutdown

**Usage:**
```typescript
import { initDatabase, query, transaction } from './utils/database.util';

// Initialize
initDatabase(process.env.DATABASE_URL);

// Query
const result = await query('SELECT * FROM users WHERE id = $1', [userId]);

// Transaction
await transaction(async (client) => {
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
});
```

### 11. Pagination ✅

**Files:**
- `templates/backend/utils/pagination.util.ts`

**Features:**
- Query parsing
- Metadata calculation
- SQL offset calculation
- Formatted responses

**Usage:**
```typescript
import { parsePagination, formatPaginatedResponse, getOffset } from './utils/pagination.util';

const { page, limit } = parsePagination(req.query);
const offset = getOffset(page, limit);

const result = await query(
  `SELECT * FROM items LIMIT $1 OFFSET $2`,
  [limit, offset]
);

const total = await query('SELECT COUNT(*) FROM items');

return sendPaginated(res, result.rows, page, limit, total.rows[0].count);
```

### 12. Search & Filtering ✅

**Files:**
- `templates/backend/utils/search.util.ts`

**Features:**
- Search parameter parsing
- SQL WHERE clause building
- Filter support
- Sort ordering

**Usage:**
```typescript
import { parseSearchParams, buildSearchWhere, buildSortOrder } from './utils/search.util';

const searchParams = parseSearchParams(req.query);
const { where, params } = buildSearchWhere(
  searchParams,
  ['name', 'email', 'description'],
  'u'
);
const orderBy = buildSortOrder(searchParams.sortBy, searchParams.sortOrder, 'created_at', 'u');

const query = `SELECT * FROM users u ${where} ${orderBy}`;
```

### 13. File Uploads ✅

**Files:**
- `templates/backend/utils/file-upload.util.ts`

**Features:**
- Multer integration
- File type validation
- Size limits
- Secure file naming
- File deletion

**Usage:**
```typescript
import { uploadSingle, validateFile } from './utils/file-upload.util';

router.post('/upload', uploadSingle('file'), async (req, res) => {
  const file = req.file;
  const validation = validateFile(file);
  
  if (!validation.valid) {
    return sendError(res, validation.error, 400);
  }
  
  // Process file
});
```

### 14. Health Checks ✅

**Files:**
- `templates/backend/routes/health.route.ts`

**Features:**
- Basic health check
- Detailed health with dependencies
- Readiness probe (Kubernetes)
- Liveness probe (Kubernetes)

**Usage:**
```typescript
import healthRoutes from './routes/health.route';

app.use(healthRoutes);

// Endpoints:
// GET /health - Basic health
// GET /health/check - Detailed health
// GET /ready - Readiness probe
// GET /live - Liveness probe
```

### 15. Environment Configuration ✅

**Files:**
- `templates/backend/config/env.config.ts`
- `templates/backend/.env.example`

**Features:**
- Environment variable validation
- Type-safe config
- Startup validation
- Example file

**Usage:**
```typescript
import { env } from './config/env.config';

// All env vars are validated and typed
console.log(env.DATABASE_URL);
console.log(env.JWT_SECRET);
```

## 🚀 Complete App Example

See `templates/backend/app.example.ts` for a complete Express app with all middleware wired up correctly!

## 📋 Installation

### 1. Copy Templates
```bash
cp -r templates/backend/* your-project/src/backend/
```

### 2. Install Dependencies
```bash
npm install express pg bcrypt jsonwebtoken zod multer
npm install -D @types/express @types/pg @types/bcrypt @types/jsonwebtoken @types/multer
```

### 3. Set Environment Variables
```bash
cp templates/backend/.env.example .env
# Fill in your values
```

### 4. Use in Your App
```typescript
import app from './app.example';
// Customize as needed
```

## 🎯 What This Solves

### Before (AI Agent):
- ❌ No rate limiting → API abuse
- ❌ No request validation → Security issues
- ❌ Inconsistent errors → Bad UX
- ❌ No health checks → Deployment issues
- ❌ Weak passwords → Security vulnerabilities
- ❌ No CORS config → Frontend can't connect
- ❌ No error handling → Crashes

### After (With Templates):
- ✅ Rate limiting → Protected API
- ✅ Request validation → Secure inputs
- ✅ Consistent errors → Great UX
- ✅ Health checks → Smooth deployments
- ✅ Strong passwords → Secure users
- ✅ Proper CORS → Frontend works
- ✅ Error handling → Stable app

## 💡 Best Practices Included

1. **Security First**
   - Password hashing
   - JWT tokens
   - Rate limiting
   - Input validation
   - Security headers

2. **Production Ready**
   - Error handling
   - Logging
   - Health checks
   - Graceful shutdown
   - Connection pooling

3. **Developer Experience**
   - Type safety
   - Consistent responses
   - Request IDs
   - Clear errors

4. **Scalability**
   - Database pooling
   - Transactions
   - Pagination
   - Search/filtering

## 🔄 Next Steps

1. Copy templates to your project
2. Install dependencies
3. Configure environment variables
4. Customize as needed
5. Build your features on top!

**All the "little things" are handled - focus on your business logic!** 🚀

