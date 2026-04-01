# Cloudflare Security Configuration

This document outlines the recommended Cloudflare security settings for guardrail.

## Rate Limiting Rules

Configure these rules in **Cloudflare Dashboard > Security > WAF > Rate limiting rules**.

### 1. API Rate Limiting (General)

```
Expression: (http.request.uri.path contains "/api/")
Rate: 100 requests per minute
Action: Block for 1 minute
Response: 429 Too Many Requests
```

### 2. Authentication Endpoints (Strict)

```
Expression: (http.request.uri.path contains "/api/auth/")
Rate: 10 requests per minute
Action: Block for 5 minutes
Response: 429 Too Many Requests
```

### 3. API Key Generation (Very Strict)

```
Expression: (http.request.uri.path contains "/api/keys/")
Rate: 5 requests per hour
Action: Block for 1 hour
Response: 429 Too Many Requests
```

### 4. Login Brute Force Protection

```
Expression: (http.request.uri.path eq "/api/auth/login") and (http.request.method eq "POST")
Rate: 5 requests per 10 minutes
Action: Challenge (CAPTCHA)
Response: Interactive challenge
```

## Firewall Rules

### 1. Block Known Bad Bots

```
Expression: (cf.client.bot) and not (cf.verified_bot_category in {"search_engine" "monitoring"})
Action: Block
```

### 2. Block Suspicious User Agents

```
Expression: (http.user_agent contains "curl") or 
            (http.user_agent contains "wget") or 
            (http.user_agent contains "python") or
            (http.user_agent eq "")
And: (http.request.uri.path contains "/api/")
Action: Challenge
```

### 3. Geographic Restrictions (Optional)

```
Expression: (ip.geoip.country in {"CN" "RU" "KP"}) and (http.request.uri.path contains "/api/")
Action: Challenge
```

## Page Rules

### 1. Cache Static Assets

```
URL: *guardrailai.dev/_next/static/*
Settings:
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 month
  - Browser Cache TTL: 1 year
```

### 2. No Cache for API

```
URL: *guardrailai.dev/api/*
Settings:
  - Cache Level: Bypass
  - Disable Apps: On
  - Disable Performance: On
```

### 3. Security Headers for Dashboard

```
URL: *guardrailai.dev/dashboard/*
Settings:
  - SSL: Full (Strict)
  - Always Use HTTPS: On
  - Security Level: High
```

## Transform Rules (HTTP Response Headers)

Add these in **Rules > Transform Rules > Modify Response Header**:

```yaml
# Security Headers
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()

# HSTS (if not set by origin)
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

## Bot Management (Enterprise)

If using Cloudflare Enterprise, enable:

1. **Bot Fight Mode**: Enabled
2. **Super Bot Fight Mode**: 
   - Definitely automated: Block
   - Likely automated: Challenge
   - Verified bots: Allow
3. **Browser Integrity Check**: Enabled

## DDoS Protection

Cloudflare's DDoS protection is automatic, but you can customize:

1. **Security Level**: High
2. **Challenge Passage**: 30 minutes
3. **Browser Integrity Check**: On

## SSL/TLS Settings

```
SSL Mode: Full (Strict)
Minimum TLS Version: TLS 1.2
Opportunistic Encryption: On
TLS 1.3: On
Automatic HTTPS Rewrites: On
Always Use HTTPS: On
```

## Workers (Advanced Rate Limiting)

For more sophisticated rate limiting, deploy a Cloudflare Worker:

```javascript
// workers/rate-limit.js
const RATE_LIMITS = {
  '/api/auth/': { max: 10, window: 60 },
  '/api/keys/': { max: 5, window: 3600 },
  '/api/': { max: 100, window: 60 },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ip = request.headers.get('cf-connecting-ip');
    
    // Find matching rate limit
    let config = { max: 200, window: 60 };
    for (const [path, limit] of Object.entries(RATE_LIMITS)) {
      if (url.pathname.startsWith(path)) {
        config = limit;
        break;
      }
    }
    
    // Use KV for distributed rate limiting
    const key = `rate:${ip}:${url.pathname}`;
    const current = await env.RATE_LIMIT_KV.get(key, { type: 'json' }) || { count: 0, reset: Date.now() + config.window * 1000 };
    
    if (Date.now() > current.reset) {
      current.count = 0;
      current.reset = Date.now() + config.window * 1000;
    }
    
    current.count++;
    
    if (current.count > config.max) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((current.reset - Date.now()) / 1000).toString(),
        },
      });
    }
    
    await env.RATE_LIMIT_KV.put(key, JSON.stringify(current), { expirationTtl: config.window });
    
    return fetch(request);
  },
};
```

## Monitoring

Set up alerts in Cloudflare:

1. **High Error Rate**: Alert when 5xx errors exceed 1%
2. **DDoS Attack**: Alert on attack detection
3. **Rate Limit Triggers**: Alert when rate limits are frequently hit
4. **Bot Score**: Alert on high bot traffic

---

*Last updated: January 2026*
