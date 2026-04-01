# Security Implementation Guide

This document outlines the comprehensive security implementation for guardrail's API, covering authentication, authorization, input validation, error handling, and rate limiting.

## Table of Contents

1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [Input Validation](#input-validation)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Security Headers](#security-headers)
7. [Testing](#testing)

## Authentication

### JWT Implementation

We use JSON Web Tokens (JWT) for authentication with the following features:

- **Token Generation**: Tokens are signed with a secret key and expire after 7 days
- **Token Verification**: Middleware verifies tokens on protected routes
- **Token Refresh**: Users can refresh their tokens before expiration
- **Secure Storage**: Tokens are stored in HTTP-only cookies in production

```typescript
// Generate token
const token = generateToken({ id: userId, email: userEmail });

// Verify token in middleware
await authMiddleware(request, reply);
```

### Authentication Middleware Features

- **Automatic Token Extraction**: From `Authorization: Bearer <token>` header
- **User Attachment**: Verified user info attached to request object
- **Error Handling**: Clear error codes for different failure scenarios
- **Optional Authentication**: Available for routes that can work without auth

### Supported Authentication Methods

1. **JWT Bearer Tokens** (Primary)
2. **API Keys** (For service-to-service communication)
3. **Session-based** (Future enhancement)

## Authorization

### Role-Based Access Control (RBAC)

The system implements hierarchical roles:

- `admin`: Full system access
- `moderator`: Limited administrative access
- `user`: Standard user access
- `viewer`: Read-only access

```typescript
// Require specific role
fastify.get('/admin/users', {
  preHandler: [requireRole(['admin'])]
}, handler);
```

### Subscription-Based Authorization

Users can be restricted based on subscription tier:

- `free`: Basic features
- `premium`: Advanced features
- `enterprise`: Full feature access

```typescript
// Require subscription tier
fastify.post('/ai/analyze', {
  preHandler: [requireSubscription(['premium', 'enterprise'])]
}, handler);
```

### Resource Ownership

Users can only access their own resources unless they are admins:

```typescript
// Require ownership or admin role
fastify.put('/projects/:id', {
  preHandler: [requireOwner]
}, handler);
```

## Input Validation

### Zod Schema Validation

All inputs are validated using Zod schemas:

```typescript
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  name: z.string().min(1).max(100)
});
```

### Validation Features

- **Request Body Validation**: Automatic parsing and validation
- **Query Parameter Validation**: Type checking and constraints
- **Route Parameter Validation**: UUID format validation
- **Header Validation**: Custom header validation
- **File Upload Validation**: Size and type restrictions

### Input Sanitization

- **XSS Prevention**: Script tags and dangerous attributes removed
- **SQL Injection Prevention**: Pattern detection and rejection
- **HTML Sanitization**: Safe HTML content handling
- **Trimming**: Automatic whitespace removal

## Error Handling

### Centralized Error Handler

All errors are handled centrally with consistent responses:

```typescript
// Error response format
{
  success: false,
  error: "Human readable error message",
  code: "ERROR_CODE",
  details: {} // Only in development or for validation errors
}
```

### Error Types

1. **Validation Errors**: 400 with field details
2. **Authentication Errors**: 401 with specific codes
3. **Authorization Errors**: 403 with permission details
4. **Not Found Errors**: 404 for missing resources
5. **Rate Limit Errors**: 429 with retry-after
6. **Server Errors**: 500 without sensitive details

### Custom Error Classes

```typescript
// Create custom errors
throw createError.unauthorized('Invalid credentials');
throw createError.forbidden('Insufficient permissions');
throw createError.notFound('Resource not found');
```

## Rate Limiting

### Rate Limiting Strategy

- **Global Rate Limit**: 100 requests per minute per IP
- **Authentication Endpoints**: 10 requests per minute
- **AI Services**: 20 requests per minute
- **Premium Users**: 500 requests per minute
- **Upload Endpoints**: 10 uploads per hour

### Rate Limiting Features

- **Sliding Window**: Accurate rate limiting
- **Headers Included**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- **User-based Limits**: Different limits for authenticated users
- **IP Fallback**: Anonymous users limited by IP

### Implementation

```typescript
// Apply rate limiting
fastify.post('/api/auth/login', {
  preHandler: [authRateLimit]
}, handler);
```

## Security Headers

### Implemented Headers

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy`: Configurable CSP
- `Strict-Transport-Security`: HTTPS enforcement

### CORS Configuration

Dynamic CORS based on environment:

```typescript
// Development
origin: ['http://localhost:3000', 'http://localhost:5173']

// Production
origin: ['https://app.guardrail.com']
```

## Testing

### Authentication Tests

- Token generation and verification
- Protected route access
- Invalid token handling
- Role-based authorization
- Rate limiting behavior

### Validation Tests

- Schema validation
- XSS prevention
- SQL injection prevention
- File upload validation
- Input sanitization

### Security Tests

- Header verification
- CORS behavior
- CSRF protection
- Error information leakage

## Best Practices Implemented

1. **Principle of Least Privilege**: Users only get necessary permissions
2. **Defense in Depth**: Multiple security layers
3. **Fail Securely**: Default to secure behavior
4. **Input Validation**: Never trust user input
5. **Error Handling**: Don't leak sensitive information
6. **Rate Limiting**: Prevent abuse and DoS attacks
7. **HTTPS Enforcement**: Secure communication only
8. **Regular Updates**: Dependencies kept up to date

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:3000,http://localhost:5173

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Security
NODE_ENV=production
CSRF_SECRET=your-csrf-secret-key
```

### Database Security

- Passwords hashed with bcrypt (12 rounds)
- Sensitive data encrypted at rest
- Database connection encrypted
- Regular security audits

## Monitoring and Logging

### Security Events Logged

- Authentication failures
- Authorization violations
- Rate limit exceeded
- Suspicious patterns
- Admin actions

### Monitoring Metrics

- Request rates per endpoint
- Authentication success/failure rates
- Error rates by type
- Response times
- Active sessions

## Future Enhancements

1. **Multi-Factor Authentication (MFA)**
2. **OAuth2 Integration** (Google, GitHub, etc.)
3. **WebAuthn / Passkeys**
4. **Advanced Threat Detection**
5. **API Key Management**
6. **Audit Logging**
7. **Session Management**
8. **Consent Management (GDPR)**

## Security Checklist

- [ ] JWT secret is strong and rotated regularly
- [ ] Passwords meet complexity requirements
- [ ] All inputs are validated and sanitized
- [ ] Error messages don't leak information
- [ ] Rate limiting is properly configured
- [ ] Security headers are set
- [ ] HTTPS is enforced in production
- [ ] Database connections are encrypted
- [ ] Sensitive data is encrypted at rest
- [ ] Regular security audits are performed
- [ ] Dependencies are kept up to date
- [ ] Security tests are comprehensive
- [ ] Monitoring covers security events
- [ ] Incident response plan is in place

## Reporting Security Issues

If you discover a security vulnerability, please report it privately:

- Email: security@guardrail.com
- Encrypted messages accepted
- Responsible disclosure policy followed
- Bug bounty program available

Thank you for helping keep guardrail secure!
