# Enhanced API Key Security Implementation

This document provides a complete implementation of enhanced API key security features for guardrail, making stolen API keys much harder to monetize.

## 🚀 Features Implemented

### ✅ Core Security Features
- **IP Allowlisting**: Restrict API key usage to specific CIDR ranges
- **Time-based Restrictions**: Limit access to specific UTC hours
- **Country Restrictions**: Allow/block requests from specific countries  
- **Usage Quotas**: Enforce daily request and expensive operation limits
- **Fingerprinting**: Detect suspicious changes in client patterns
- **Key Rotation**: Securely rotate keys with configurable overlap windows

### ✅ Security Guarantees
- **Server-side enforcement**: All policy validation happens on the server
- **No client trust**: API keys contain no tier or policy information
- **Consistent error responses**: No sensitive information leaked
- **Defense-in-depth**: Multiple independent security layers

## 📁 Files Created/Modified

### Database Schema
- `prisma/schema.prisma` - Enhanced ApiKey model with security fields
- `prisma/migrations/20260106000000_add_api_key_security/` - Database migration

### Core Services
- `apps/api/src/services/enhanced-api-key-service.ts` - Enhanced API key service with security policies
- `apps/api/src/middleware/enhanced-fastify-auth.ts` - Enhanced authentication middleware

### API Routes
- `apps/api/src/routes/enhanced-api-keys.ts` - New routes for enhanced API key management

### Testing & Documentation
- `apps/api/src/services/__tests__/enhanced-api-key-security.test.ts` - Comprehensive test suite
- `API-KEY-SECURITY-PROOF.md` - Proof of implementation with curl examples
- `ENHANCED-API-KEY-SECURITY.md` - This documentation

## 🛠️ Setup Instructions

### 1. Database Migration

First, apply the database migration to add the new security fields:

```bash
# Navigate to project root
cd /path/to/codeguard

# Apply migration
npx prisma migrate deploy

# Or if you want to create the migration file first
npx prisma migrate dev --name add_api_key_security
```

### 2. Generate Prisma Client

```bash
npx prisma generate
```

### 3. Set Environment Variables

Add these to your `.env` file:

```env
# Server pepper for fingerprinting (change in production!)
API_KEY_PEPPER=your-secret-pepper-value-here

# Optional: GeoIP service for country detection
GEOIP_SERVICE=maxmind
GEOIP_DATABASE_PATH=/path/to/GeoLite2-Country.mmdb
```

### 4. Update API Server Registration

Register the new enhanced API key routes in your Fastify app:

```typescript
// In apps/api/src/server.ts or similar
import { enhancedApiKeysRoutes } from './routes/enhanced-api-keys';

async function buildServer() {
  const server = fastify();
  
  // Register enhanced routes
  await server.register(enhancedApiKeysRoutes, { prefix: '/api' });
  
  // ... other setup
  
  return server;
}
```

### 5. Update Middleware Usage

Replace existing API key authentication with enhanced version:

```typescript
// Before
import { apiKeyAuth, requireApiKeyScope } from '../middleware/fastify-auth';

// After  
import { enhancedApiKeyAuth, requireEnhancedApiKeyScope } from '../middleware/enhanced-fastify-auth';

// In your route definitions
fastify.get('/protected-route', {
  preHandler: enhancedApiKeyAuth
}, handler);

// For sensitive operations
fastify.post('/admin-action', {
  preHandler: requireEnhancedApiKeyScope(['admin'], { 
    isExpensive: true, 
    enforceStrictPolicy: true 
  })
}, handler);
```

## 🔧 Usage Examples

### Create Enhanced API Key

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "securityPolicy": {
      "allowedIpCidrs": ["203.0.113.0/24"],
      "allowedCountries": ["US", "GB", "CA"],
      "allowedHoursUtc": { "start": 9, "end": 17 },
      "sensitiveScopes": ["admin", "delete"],
      "requestsPerDay": 10000,
      "expensivePerDay": 1000,
      "rotationOverlapDays": 30
    }
  }'
```

### Use Enhanced API Key

```bash
curl -X GET https://api.guardrailai.dev/projects \
  -H "X-API-Key: grl_your_enhanced_api_key_here" \
  -H "User-Agent: MyApp/1.0"
```

### Rotate API Key

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/key-id/rotate \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "preservePolicy": true,
    "expiresInDays": 90
  }'
```

## 🧪 Testing

### Run Test Suite

```bash
# Run enhanced API key security tests
cd apps/api
npm test -- enhanced-api-key-security.test.ts

# Or run all tests
npm test
```

### Manual Testing

Use the examples in `API-KEY-SECURITY-PROOF.md` to manually test all security features:

1. IP allowlist enforcement
2. Country restrictions
3. Time-based access control
4. Usage quota limits
5. Fingerprinting detection
6. Key rotation workflow

## 🔒 Security Configuration

### Production Hardening

1. **Set a strong API key pepper**:
   ```env
   API_KEY_PEPPER=$(openssl rand -hex 32)
   ```

2. **Configure strict default policies**:
   ```typescript
   const defaultSecurityPolicy = {
     allowedIpCidrs: [], // Must be explicitly set
     allowedCountries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP'],
     allowedHoursUtc: { start: 0, end: 23 },
     requestsPerDay: 1000,
     expensivePerDay: 100,
     rotationOverlapDays: 30,
   };
   ```

3. **Enable monitoring and alerts**:
   ```typescript
   // Log security violations
   server.addHook('onRequest', async (request, reply) => {
     if (request.apiKeyValidation?.securityPolicy?.warnings) {
       // Send to monitoring system
       await sendSecurityAlert({
         type: 'FINGERPRINT_CHANGE',
         userId: request.user?.id,
         warnings: request.apiKeyValidation.securityPolicy.warnings,
         metadata: {
           ip: extractClientIP(request),
           userAgent: request.headers['user-agent'],
           path: request.url,
         }
       });
     }
   });
   ```

### IP Allowlist Best Practices

1. **Use specific CIDR ranges** rather than single IPs
2. **Include backup ranges** for high availability
3. **Regularly audit and update** allowlists
4. **Consider using VPN endpoints** for mobile clients

### Quota Management

1. **Set reasonable defaults** based on usage patterns
2. **Monitor quota exhaustion** for potential abuse
3. **Provide upgrade paths** for legitimate high-usage users
4. **Implement burst handling** for legitimate spikes

## 📊 Monitoring & Alerting

### Key Metrics to Monitor

1. **Security violation rate**: IP/country/time policy failures
2. **Fingerprint changes**: Sudden changes in client patterns  
3. **Quota exhaustion**: Keys hitting daily limits
4. **Geographic anomalies**: Requests from unexpected locations
5. **Time pattern anomalies**: Requests outside normal hours

### Sample Monitoring Setup

```typescript
// Security metrics collection
const securityMetrics = {
  ipViolations: new Counter('api_key_ip_violations'),
  countryViolations: new Counter('api_key_country_violations'),
  timeViolations: new Counter('api_key_time_violations'),
  quotaExhausted: new Counter('api_key_quota_exhausted'),
  fingerprintChanges: new Counter('api_key_fingerprint_changes'),
  keyRotations: new Counter('api_key_rotations'),
};

// In enhanced middleware
if (!validation.securityPolicy.allowed) {
  if (validation.error.includes('IP')) {
    securityMetrics.ipViolations.inc();
  } else if (validation.error.includes('Country')) {
    securityMetrics.countryViolations.inc();
  } else if (validation.error.includes('time')) {
    securityMetrics.timeViolations.inc();
  }
}
```

## 🚨 Incident Response

### Stolen API Key Response Procedure

1. **Immediate actions**:
   - Revoke the compromised key
   - Rotate all keys for the affected user
   - Review recent access logs for the key

2. **Investigation**:
   - Analyze violation patterns
   - Check for data exfiltration
   - Identify attack source

3. **Prevention**:
   - Implement stricter IP allowlists
   - Reduce quota limits temporarily
   - Enable additional monitoring

### Automated Response

```typescript
// Auto-revoke on suspicious patterns
const autoRevokeThreshold = {
  ipViolations: 10,
  fingerprintChanges: 5,
  quotaExhaustion: 3,
};

if (violationCount > autoRevokeThreshold.ipViolations) {
  await enhancedApiKeyService.revokeApiKey(keyId, userId);
  await sendSecurityAlert({
    type: 'AUTO_REVOCATION',
    reason: 'Excessive IP violations',
    keyId,
    userId,
  });
}
```

## 🔄 Migration from Original API Keys

### Step-by-Step Migration

1. **Deploy enhanced service alongside original**
2. **Gradually migrate users to enhanced keys**
3. **Monitor for any issues**
4. **Decommission original service**

### Backward Compatibility

The enhanced service maintains compatibility with existing API keys:

```typescript
// Original keys work with enhanced validation
const validation = await enhancedApiKeyService.validateApiKeyWithPolicy(
  originalApiKey, 
  context
);

// Missing security fields default to permissive values
if (!key.allowedIpCidrs) {
  // No IP restrictions for legacy keys
}
```

## 📚 Additional Resources

- [API Key Security Proof](./API-KEY-SECURITY-PROOF.md) - Complete curl examples
- [Test Suite](./apps/api/src/services/__tests__/enhanced-api-key-security.test.ts) - Comprehensive tests
- [Security Policy Templates](./apps/api/src/routes/enhanced-api-keys.ts) - Pre-configured templates

## 🤝 Contributing

When adding new security features:

1. Update the Prisma schema
2. Create database migration  
3. Implement in enhanced service
4. Add comprehensive tests
5. Update documentation
6. Add proof examples

## 📞 Support

For issues or questions about the enhanced API key security implementation:

1. Check the test suite for expected behavior
2. Review the proof documentation for examples
3. Enable debug logging for troubleshooting
4. Check monitoring dashboards for patterns

---

**Security Note**: This implementation assumes a trusted server environment. Always ensure your server infrastructure is properly secured with network segmentation, access controls, and regular security audits.
