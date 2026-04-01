# Security Hardening Verification Guide

This document provides commands to verify the security hardening measures are working correctly.

## Prerequisites

```bash
# Start the API server
cd apps/api
pnpm dev

# API is running at http://localhost:3001
API_URL="http://localhost:3001"
```

---

## 1. Rate Limiting Verification

### Test Global Rate Limit (100 req/min)

```bash
# Send multiple requests rapidly - should see rate limit after ~100 requests
for i in {1..110}; do
  curl -s -o /dev/null -w "%{http_code}\n" "$API_URL/health"
done | sort | uniq -c
# Expected: 100x 200, 10x 429
```

### Test Auth Rate Limit (10 req/min)

```bash
# Test auth endpoint rate limiting
for i in {1..15}; do
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}')
  echo "Request $i: $(echo "$response" | tail -1)"
done
# Expected: First 10 return 401 (invalid creds), remaining return 429 (rate limited)
```

### Verify Rate Limit Headers

```bash
curl -i -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Expected headers:
# X-RateLimit-Limit: 10
# X-RateLimit-Remaining: 9
# X-RateLimit-Reset: <timestamp>
```

---

## 2. Input Validation Tests

### Test Invalid Email Rejection

```bash
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","password":"SecurePass123"}'

# Expected: 400 Bad Request with validation error
```

### Test Weak Password Rejection

```bash
curl -X POST "$API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"weak"}'

# Expected: 400 Bad Request with password requirements error
```

### Test Checkout Validation

```bash
# Missing required fields
curl -X POST "$API_URL/api/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{}'

# Expected: 400 Bad Request - "Either plan or priceId is required"

# Invalid plan
curl -X POST "$API_URL/api/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"plan":"invalid-plan"}'

# Expected: 400 Bad Request - invalid plan
```

---

## 3. Body Size Limit Tests

### Test Default Limit (1MB)

```bash
# Generate 2MB of data - should be rejected
dd if=/dev/zero bs=1024 count=2048 2>/dev/null | base64 | \
  curl -X POST "$API_URL/api/projects" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d @-

# Expected: 413 Payload Too Large
```

### Test Small Route Limit (100KB for auth)

```bash
# Generate 200KB payload for auth endpoint
python3 -c "print('{\"email\":\"' + 'a'*200000 + '@test.com\",\"password\":\"test\"}')" | \
  curl -X POST "$API_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d @-

# Expected: 413 Payload Too Large
```

---

## 4. SQL Injection Detection Tests

### Basic SQL Injection

```bash
curl -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"'; DROP TABLE users; --"}'

# Expected: 400 Bad Request - "Invalid input detected"
```

### OR 1=1 Attack

```bash
curl -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin'\'' OR 1=1 --","password":"x"}'

# Expected: 400 Bad Request - "Invalid input detected"
```

### UNION Attack

```bash
curl -X GET "$API_URL/api/projects?search=1%20UNION%20SELECT%20*%20FROM%20users"

# Expected: 400 Bad Request - "Invalid input detected"
```

---

## 5. JSON Depth Limiting Tests

### Test Deep Nesting (Should Pass - depth 10)

```bash
curl -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"h":{"i":{"j":"value"}}}}}}}}}}'

# Expected: Normal response (depth 10 is allowed)
```

### Test Excessive Nesting (Should Fail - depth 25)

```bash
# Generate deeply nested JSON
python3 -c "
import json
obj = 'value'
for i in range(25):
    obj = {'level': obj}
print(json.dumps(obj))
" | curl -X POST "$API_URL/api/projects" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer <token>" \
    -d @-

# Expected: 400 Bad Request - "Request body exceeds maximum nesting depth"
```

---

## 6. Content-Type Validation Tests

### Missing Content-Type

```bash
curl -X POST "$API_URL/api/auth/login" \
  -d '{"email":"test@test.com","password":"test"}'

# Expected: 415 Unsupported Media Type - "Content-Type header is required"
```

### Invalid Content-Type

```bash
curl -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/xml" \
  -d '<login><email>test@test.com</email></login>'

# Expected: 415 Unsupported Media Type
```

---

## 7. XSS Sanitization Tests

### Script Tag Removal

```bash
curl -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"<script>alert(1)</script>Test Project"}'

# Expected: 200 OK, but name should be sanitized (no script tag)
```

### Event Handler Removal

```bash
curl -X POST "$API_URL/api/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"description":"<div onclick=\"evil()\">Click me</div>"}'

# Expected: 200 OK, but onclick should be removed
```

---

## 8. API Versioning Tests

### Check Version Info

```bash
curl "$API_URL/api/version"

# Expected: {"success":true,"data":{"current":"v1","supported":["v1"],"deprecated":[]}}
```

### Version Headers

```bash
curl -i "$API_URL/v1/health"

# Expected header: X-API-Version: v1
```

### Custom Version Header

```bash
curl -i "$API_URL/api/projects" \
  -H "X-API-Version: v1" \
  -H "Authorization: Bearer <token>"

# Expected header: X-API-Version: v1
```

---

## 9. Authentication Tests

### Invalid Token Format

```bash
curl -X GET "$API_URL/api/projects" \
  -H "Authorization: Bearer invalid-token"

# Expected: 401 Unauthorized - "Invalid token"
```

### Missing Token

```bash
curl -X GET "$API_URL/api/projects"

# Expected: 401 Unauthorized - "No token provided"
```

### Expired Token

```bash
# Use an old/expired token
curl -X GET "$API_URL/api/projects" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InRlc3QiLCJlbWFpbCI6InRlc3RAdGVzdC5jb20iLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyM30.xxx"

# Expected: 401 Unauthorized - "Token expired"
```

---

## 10. API Key Tests

### Invalid API Key Format

```bash
curl -X GET "$API_URL/api/projects" \
  -H "X-API-Key: invalid-key"

# Expected: 401 Unauthorized - "Invalid API key format"
```

### Valid Format but Non-Existent Key

```bash
curl -X GET "$API_URL/api/projects" \
  -H "X-API-Key: grl_00000000000000000000000000000000"

# Expected: 401 Unauthorized - "Invalid API key"
```

---

## Running Automated Tests

```bash
# Run security integration tests
cd apps/api
pnpm test -- --grep "Security Hardening"

# Run all integration tests
pnpm test -- src/__tests__/integration/

# Run with coverage
pnpm test -- --coverage src/__tests__/integration/security-hardening.test.ts
```

---

## Checklist

- [ ] Rate limiting kicks in after configured threshold
- [ ] Rate limit headers are present on all responses
- [ ] Invalid input is rejected with proper error messages
- [ ] Oversized bodies are rejected (413)
- [ ] SQL injection patterns are blocked (400)
- [ ] Deep JSON nesting is blocked (400)
- [ ] Missing Content-Type is rejected (415)
- [ ] XSS patterns are sanitized
- [ ] API version headers are present
- [ ] Invalid tokens return 401
- [ ] API keys are validated properly

---

## Production Recommendations

1. **Redis for Rate Limiting**: Set `REDIS_URL` environment variable for distributed rate limiting
2. **Fail Closed**: Rate limiter is configured to deny requests if Redis fails (safer)
3. **Monitor Blocked Requests**: Check logs for `security` service entries
4. **Adjust Limits**: Modify rate limits based on your traffic patterns
5. **Enable All Validators**: Ensure all middleware is registered in `index.ts`
