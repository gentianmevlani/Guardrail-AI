# Enhanced API Key Security - Proof of Implementation

This document demonstrates the enhanced API key security features with sample curl commands and expected outputs.

## Overview

The enhanced API key system provides:
- **IP Allowlisting**: Restrict API key usage to specific IP ranges
- **Time-based Restrictions**: Limit access to specific UTC hours
- **Country Restrictions**: Allow/block requests from specific countries
- **Usage Quotas**: Enforce daily request and expensive operation limits
- **Fingerprinting**: Detect suspicious changes in client patterns
- **Key Rotation**: Securely rotate keys with overlap windows

## Setup

First, authenticate to get a JWT token:

```bash
curl -X POST https://api.guardrailai.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "your-password"
  }'
```

Save the token from response:
```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 1. Create API Key with Security Policy

### Create a Production API Key with Strict Security

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production API Key",
    "expiresInDays": 90,
    "securityPolicy": {
      "allowedIpCidrs": ["203.0.113.0/24", "198.51.100.0/24"],
      "allowedCountries": ["US", "GB", "CA"],
      "allowedHoursUtc": { "start": 9, "end": 17 },
      "sensitiveScopes": ["admin", "delete", "write"],
      "requestsPerDay": 10000,
      "expensivePerDay": 1000,
      "rotationOverlapDays": 30
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "key": "grl_1a2b3c4d5e6f7890abcdef1234567890abcdef12",
  "apiKey": {
    "id": "ck_abc123def456",
    "name": "Production API Key",
    "prefix": "grl_1a2b3c4d...",
    "tierOverride": null,
    "expiresAt": "2024-04-01T14:30:00.000Z",
    "createdAt": "2024-01-01T14:30:00.000Z",
    "securityPolicy": {
      "allowedIpCidrs": ["203.0.113.0/24", "198.51.100.0/24"],
      "allowedCountries": ["US", "GB", "CA"],
      "allowedHoursUtc": { "start": 9, "end": 17 },
      "sensitiveScopes": ["admin", "delete", "write"],
      "requestsPerDay": 10000,
      "expensivePerDay": 1000,
      "rotationOverlapDays": 30
    },
    "rotationOverlapDays": 30
  },
  "warning": "Save this API key now. You won't be able to see it again!"
}
```

Save the API key:
```bash
API_KEY="grl_1a2b3c4d5e6f7890abcdef1234567890abcdef12"
```

---

## 2. IP Allowlist Enforcement

### ✅ Allowed IP Address

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "tierOverride": null,
  "securityPolicy": {
    "allowed": true,
    "quotaRemaining": {
      "requests": 10000,
      "expensive": 1000
    }
  }
}
```

### ❌ Disallowed IP Address

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "192.168.1.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "IP address not in allowlist",
  "securityPolicy": {
    "allowed": false,
    "reason": "IP address not in allowlist"
  }
}
```

---

## 3. Country Restrictions

### ✅ Allowed Country

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "CA",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "securityPolicy": {
    "allowed": true,
    "quotaRemaining": {
      "requests": 9999,
      "expensive": 1000
    }
  }
}
```

### ❌ Disallowed Country

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "CN",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "Country not allowed",
  "securityPolicy": {
    "allowed": false,
    "reason": "Country not allowed"
  }
}
```

---

## 4. Time-Based Restrictions

### ✅ Within Allowed Hours (9 AM - 5 PM UTC)

```bash
# Assuming current time is 2 PM UTC
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "securityPolicy": {
    "allowed": true,
    "quotaRemaining": {
      "requests": 9998,
      "expensive": 1000
    }
  }
}
```

### ❌ Outside Allowed Hours

```bash
# Assuming current time is 2 AM UTC
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "Access outside allowed time window",
  "securityPolicy": {
    "allowed": false,
    "reason": "Access outside allowed time window"
  }
}
```

---

## 5. Usage Quotas

### ✅ Within Quota Limits

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response (showing remaining quota):**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "securityPolicy": {
    "allowed": true,
    "quotaRemaining": {
      "requests": 9997,
      "expensive": 1000
    }
  }
}
```

### ❌ Quota Exceeded

```bash
# After 10,000 requests have been made today
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "Daily request quota exceeded",
  "securityPolicy": {
    "allowed": false,
    "reason": "Daily request quota exceeded",
    "quotaRemaining": {
      "requests": 0,
      "expensive": 1000
    }
  }
}
```

### ❌ Expensive Operations Quota Exceeded

```bash
# After 1000 expensive operations have been made today
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": true
    }
  }'
```

**Expected Response:**
```json
{
  "valid": false,
  "error": "Expensive operations quota exceeded",
  "securityPolicy": {
    "allowed": false,
    "reason": "Expensive operations quota exceeded",
    "quotaRemaining": {
      "requests": 5000,
      "expensive": 0
    }
  }
}
```

---

## 6. Fingerprinting for Sensitive Scopes

### ✅ First Request with Sensitive Scope

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "country": "US",
      "requestedScopes": ["admin"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "securityPolicy": {
    "allowed": true,
    "quotaRemaining": {
      "requests": 9996,
      "expensive": 1000
    }
  }
}
```

### ⚠️ Fingerprint Change Detected

```bash
# Same IP but different User-Agent (suspicious)
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "'$API_KEY'",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "country": "US",
      "requestedScopes": ["admin"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "securityPolicy": {
    "allowed": true,
    "warnings": ["Fingerprint change detected for sensitive scope access"],
    "quotaRemaining": {
      "requests": 9995,
      "expensive": 1000
    }
  }
}
```

---

## 7. Key Rotation

### Rotate API Key with Overlap Window

```bash
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/ck_abc123def456/rotate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "expiresInDays": 90,
    "preservePolicy": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "oldKeyId": "ck_abc123def456",
  "newKey": "grl_9z8y7x6w5v4u3t2s1r0p9o8n7m6l5k4j3i2h1g",
  "newApiKey": {
    "id": "ck_def789ghi012",
    "name": "Production API Key (rotated)",
    "prefix": "grl_9z8y7x6w...",
    "tierOverride": null,
    "expiresAt": "2024-04-01T14:35:00.000Z",
    "createdAt": "2024-01-01T14:35:00.000Z",
    "securityPolicy": {
      "allowedIpCidrs": ["203.0.113.0/24", "198.51.100.0/24"],
      "allowedCountries": ["US", "GB", "CA"],
      "allowedHoursUtc": { "start": 9, "end": 17 },
      "sensitiveScopes": ["admin", "delete", "write"],
      "requestsPerDay": 10000,
      "expensivePerDay": 1000,
      "rotationOverlapDays": 30
    },
    "rotationOverlapDays": 30
  },
  "overlapExpiresAt": "2024-01-31T14:35:00.000Z"
}
```

### Old Key Still Works During Overlap

```bash
# Old key still works during 30-day overlap
curl -X POST https://api.guardrailai.dev/enhanced-api-keys/validate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "grl_1a2b3c4d5e6f7890abcdef1234567890abcdef12",
    "context": {
      "ipAddress": "203.0.113.100",
      "userAgent": "Mozilla/5.0 (compatible; MyApp/1.0)",
      "country": "US",
      "requestedScopes": ["read"],
      "isExpensive": false
    }
  }'
```

**Expected Response:**
```json
{
  "valid": true,
  "userId": "user_12345",
  "tier": "pro",
  "securityPolicy": {
    "allowed": true,
    "quotaRemaining": {
      "requests": 9994,
      "expensive": 1000
    }
  }
}
```

---

## 8. Security Policy Templates

### Get Available Templates

```bash
curl -X GET https://api.guardrailai.dev/enhanced-api-keys/templates/security-policies \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "templates": {
    "development": {
      "name": "Development Key",
      "description": "For local development with relaxed restrictions",
      "securityPolicy": {
        "allowedIpCidrs": ["127.0.0.0/8", "::1/128", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"],
        "allowedCountries": [],
        "allowedHoursUtc": { "start": 6, "end": 22 },
        "sensitiveScopes": ["write", "delete", "admin"],
        "requestsPerDay": 1000,
        "expensivePerDay": 100,
        "rotationOverlapDays": 7
      }
    },
    "production": {
      "name": "Production Key",
      "description": "For production use with strict restrictions",
      "securityPolicy": {
        "allowedIpCidrs": [],
        "allowedCountries": ["US", "GB", "CA", "AU", "DE", "FR", "JP"],
        "allowedHoursUtc": { "start": 0, "end": 23 },
        "sensitiveScopes": ["write", "delete", "admin"],
        "requestsPerDay": 10000,
        "expensivePerDay": 1000,
        "rotationOverlapDays": 30
      }
    },
    "readonly": {
      "name": "Read-Only Key",
      "description": "For third-party integrations with read-only access",
      "securityPolicy": {
        "allowedIpCidrs": [],
        "allowedCountries": ["US", "GB", "CA", "AU", "DE", "FR", "JP"],
        "allowedHoursUtc": { "start": 0, "end": 23 },
        "sensitiveScopes": [],
        "requestsPerDay": 5000,
        "expensivePerDay": 0,
        "rotationOverlapDays": 90
      }
    },
    "ci-cd": {
      "name": "CI/CD Key",
      "description": "For automated deployment pipelines",
      "securityPolicy": {
        "allowedIpCidrs": [],
        "allowedCountries": [],
        "allowedHoursUtc": { "start": 0, "end": 23 },
        "sensitiveScopes": ["write", "deploy"],
        "requestsPerDay": 500,
        "expensivePerDay": 50,
        "rotationOverlapDays": 0
      }
    }
  }
}
```

---

## 9. Real API Usage with Enhanced Security

### Using Enhanced API Key in Production

```bash
# Make an API call with the enhanced key
curl -X GET https://api.guardrailai.dev/projects \
  -H "X-API-Key: $API_KEY" \
  -H "X-Forwarded-For: 203.0.113.100" \
  -H "User-Agent: MyApp/1.0" \
  -H "CF-IPCountry: US"
```

**Expected Response (success):**
```json
{
  "success": true,
  "projects": [...],
  "X-RateLimit-Limit": "API_KEY_QUOTA",
  "X-RateLimit-Remaining": "9993"
}
```

### API Call from Disallowed Location

```bash
# Same call but from disallowed IP
curl -X GET https://api.guardrailai.dev/projects \
  -H "X-API-Key: $API_KEY" \
  -H "X-Forwarded-For: 192.168.1.100" \
  -H "User-Agent: MyApp/1.0" \
  -H "CF-IPCountry: US"
```

**Expected Response (blocked):**
```json
{
  "success": false,
  "error": "IP address not in allowlist",
  "code": "POLICY_VIOLATION"
}
```

---

## 10. Error Response Consistency

All security violations return consistent error responses:

### Policy Violation (403)
```json
{
  "success": false,
  "error": "IP address not in allowlist",
  "code": "POLICY_VIOLATION"
}
```

### Quota Exceeded (429)
```json
{
  "success": false,
  "error": "Daily request quota exceeded",
  "code": "QUOTA_EXCEEDED",
  "quotaRemaining": {
    "requests": 0,
    "expensive": 1000
  }
}
```

### Invalid API Key (401)
```json
{
  "success": false,
  "error": "Invalid API key",
  "code": "INVALID_API_KEY"
}
```

---

## Security Benefits Demonstrated

1. **Stolen keys are useless without proper IP/country/time context**
2. **Quotas prevent abuse even with valid credentials**
3. **Fingerprinting detects suspicious behavior patterns**
4. **Key rotation allows seamless credential updates**
5. **All policy enforcement happens server-side - no client trust**
6. **Consistent error responses don't leak sensitive information**

This implementation provides defense-in-depth for API key security while maintaining a clean developer experience.
