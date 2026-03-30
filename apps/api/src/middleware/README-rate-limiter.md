# Enhanced Redis Rate Limiter

Production-ready rate limiting with safe fallback behavior when Redis is unavailable.

## Overview

The enhanced Redis rate limiter provides robust rate limiting with the following key features:

- **Safe Fallback**: Sensitive operations fail closed (503) when Redis is down
- **Reduced Limits**: Non-sensitive operations use 50% of normal limits during Redis outages  
- **Circuit Breaker**: Prevents log spam during Redis flapping
- **Structured Logging**: Comprehensive logging with request IDs and context
- **Route Metadata**: Support for explicit sensitive operation marking

## Sensitive Operations

The following operations are automatically detected as sensitive:

### Route Patterns
- `/billing/*` - Billing operations (payments, subscriptions)
- `/auth/*` - Authentication operations (login, signup, password reset)
- `/api-keys/*` - API key management (create, delete, rotate)
- `/scans/*/start|run|execute` - Expensive scan operations
- `/ship/*` - Ship operations
- `/reality/*/run|execute` - Reality mode operations
- `/admin/*` - Admin operations
- `/organizations/*` - Organization management

### HTTP Method Context
Sensitive HTTP methods (`POST`, `PUT`, `DELETE`, `PATCH`) on sensitive routes are also detected.

### Route Metadata Override
```typescript
// Explicitly mark any route as sensitive
fastify.post('/custom-route', {
  config: { sensitive: true }
}, handler);
```

## Usage

### Pre-configured Middleware

```typescript
import { 
  authRateLimit,           // Auth endpoints (sensitive)
  billingRateLimit,        // Billing operations (sensitive)
  apiRateLimit,            // General API endpoints
  expensiveRateLimit,      // Expensive operations (sensitive)
  apiKeyManagementRateLimit, // API key management (sensitive)
  adminRateLimit           // Admin operations (sensitive)
} from './middleware/redis-rate-limiter';

// Apply to routes
fastify.post('/auth/login', { preHandler: authRateLimit }, loginHandler);
fastify.post('/billing/subscribe', { preHandler: billingRateLimit }, subscribeHandler);
fastify.get('/api/projects', { preHandler: apiRateLimit }, getProjectsHandler);
```

### Custom Rate Limiters

```typescript
import { createRateLimiter } from './middleware/redis-rate-limiter';

// Custom sensitive endpoint
const sensitiveLimiter = createRateLimiter({
  policy: "api",
  limitType: "api",
  sensitive: true  // Fail closed when Redis is down
});

// Custom non-sensitive endpoint  
const normalLimiter = createRateLimiter({
  policy: "api",
  limitType: "api",
  sensitive: false  // Use 50% limits when Redis is down
});
```

### Route Registration with Metadata

```typescript
// Method 1: Route config metadata
fastify.post('/critical-operation', {
  config: { sensitive: true },
  preHandler: createRateLimiter({ policy: "api" })
}, handler);

// Method 2: Explicit sensitive flag
const limiter = createRateLimiter({ 
  policy: "api", 
  sensitive: true 
});
```

## Behavior During Redis Outages

### Sensitive Operations
- **Response**: `503 Service Unavailable`
- **Body**: 
```json
{
  "success": false,
  "error": "Service temporarily unavailable", 
  "code": "SERVICE_UNAVAILABLE",
  "message": "Rate limiting service is temporarily unavailable. Please try again later.",
  "requestId": "abc123"
}
```

### Non-Sensitive Operations
- **Response**: `429 Too Many Requests` (when reduced limit exceeded)
- **Headers**:
  - `X-RateLimit-Limit`: 50% of normal limit
  - `X-RateLimit-Remaining`: Remaining requests at reduced limit
  - `X-RateLimit-Mode`: `degraded`

## Logging

### Structured Events

#### Redis Down (Sensitive Operations)
```json
{
  "event": "rate_limiter.redis_down",
  "requestId": "abc123",
  "route": "/billing/subscribe",
  "method": "POST", 
  "ip": "192.168.1.100",
  "userId": "user-123",
  "apiKeyId": "key-456",
  "sensitive": true
}
```

#### Fallback Usage (Non-Sensitive Operations)
```json
{
  "event": "rate_limiter.fallback_used",
  "requestId": "def456", 
  "route": "/api/projects",
  "method": "GET",
  "ip": "192.168.1.100",
  "userId": "user-123",
  "originalLimit": 60,
  "fallbackLimit": 30,
  "sensitive": false
}
```

### Circuit Breaker
- Prevents log spam during Redis flapping
- Logs once per 60-second cooldown period
- Resets when Redis reconnects

## Testing

### Run Tests
```bash
npm test -- redis-rate-limiter
```

### Proof of Concept
```bash
node src/middleware/proof-rate-limiter.js
```

### Test Coverage
- ✅ Redis down + sensitive route → 503
- ✅ Redis down + normal route → 429 at reduced limit  
- ✅ Circuit breaker behavior
- ✅ Sensitive operation detection
- ✅ Route metadata override
- ✅ Structured logging

## Configuration

### Environment Variables
```bash
REDIS_URL=redis://localhost:6379
```

### Rate Limit Tiers
| Tier | API Requests/min | Expensive/min | Uploads/min |
|------|------------------|---------------|-------------|
| Free | 60 | 5 | 5 |
| Starter | 200 | 20 | 20 |
| Pro | 500 | 50 | 50 |
| Compliance | 1000 | 100 | 100 |
| Enterprise | 5000 | 500 | 500 |

## Implementation Details

### Key Components

1. **Sensitive Operation Detection**: Pattern matching + metadata
2. **Circuit Breaker**: Prevents log spam during Redis issues
3. **Fallback Logic**: 50% limits for non-sensitive operations
4. **Structured Logging**: Request IDs, user context, route info
5. **Response Headers**: Rate limit info + degraded mode indicator

### Security Considerations

- **Fail Closed**: Sensitive operations rejected during Redis outages
- **Reduced Attack Surface**: Lower limits during degraded mode
- **Request Tracking**: Full audit trail with structured logs
- **IP Hashing**: SHA-256 hashed IP addresses for privacy

### Performance

- **Memory Cleanup**: Automatic cleanup of old rate limit records
- **Circuit Breaker**: Reduces logging overhead during Redis issues
- **Sliding Window**: Accurate rate limiting with Redis sorted sets
- **In-Memory Fallback**: Fast fallback when Redis is unavailable

## Migration Guide

### From Basic Rate Limiter
1. Replace existing middleware with enhanced versions
2. Add `sensitive: true` to critical endpoints
3. Update monitoring to watch for `503` responses
4. Add alerts for `rate_limiter.redis_down` events

### Monitoring Endpoints
Monitor these metrics for Redis health:
- `X-RateLimit-Mode: degraded` header frequency
- `503 Service Unavailable` response rate
- `rate_limiter.redis_down` log events
- `rate_limiter.fallback_used` log events
