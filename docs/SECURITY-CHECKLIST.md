# guardrail Web Dashboard Security Checklist

This document outlines the security measures implemented and verification steps.

## Implemented Security Headers

### In `next.config.mjs`
| Header | Value | Purpose |
|--------|-------|---------|
| `Access-Control-Allow-Origin` | `$ALLOWED_ORIGIN` or `https://guardrailai.dev` | Restrict CORS to trusted origins |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer information |
| `Content-Security-Policy` | Strict policy | Prevent XSS and injection |
| `X-XSS-Protection` | `1; mode=block` | Legacy browser XSS protection |
| `X-RateLimit-Limit` | `100` | Informational rate limit header |
| `Permissions-Policy` | Restrictive | Disable camera, mic, geolocation |

### In `middleware.ts` (Edge)
| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS (production only) |
| `Cache-Control` | `no-store, no-cache, must-revalidate, private` | Prevent caching of sensitive pages |

## Image Security

Remote images are restricted to trusted domains only:
- `avatars.githubusercontent.com`
- `github.com`
- `guardrailai.dev`
- `guardrailai.dev`

## Authentication Security

✅ **Tokens stored in httpOnly cookies** (not localStorage)  
✅ **No tokens logged to console**  
✅ **Credentials: "include" for all auth requests**  
✅ **Proper logout clears all auth state**  

## API Key Security

- Keys generated with `crypto.randomBytes(32)` (256-bit entropy)
- Format: `gr_<base64url>` for easy identification
- Rate limited: 5 generations per hour per session
- Key hash stored in database, raw key shown only once
- Response headers prevent caching

## Environment Variables

Required for production:
```bash
ALLOWED_ORIGIN=https://your-domain.com
```

## Verification Commands

```bash
# Check npm dependencies for vulnerabilities
npm audit

# Check security headers (after deployment)
curl -I https://your-domain.com

# Check specific headers
curl -s -D - https://your-domain.com -o /dev/null | grep -E "(Strict-Transport|X-Frame|X-Content-Type|Content-Security)"
```

## Security Testing Tools

- [Mozilla Observatory](https://observatory.mozilla.org/)
- [Security Headers](https://securityheaders.com/)
- [SSL Labs](https://www.ssllabs.com/ssltest/)

## Rate Limiting

### Edge Middleware (`middleware.ts`)

| Path Pattern | Limit | Window |
|--------------|-------|--------|
| `/api/auth/*` | 10 requests | 1 minute |
| `/api/keys/*` | 5 requests | 1 hour |
| `/api/*` | 100 requests | 1 minute |
| All other routes | 200 requests | 1 minute |

Rate limiting is implemented in `apps/web-ui/src/middleware.ts` using the Vercel Edge Runtime.

### Response Headers

All responses include:
- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Requests remaining in window
- `X-RateLimit-Reset` - Unix timestamp when limit resets

### Cloudflare Configuration

For additional protection, see `docs/CLOUDFLARE-SECURITY.md` for:
- WAF rate limiting rules
- Bot management
- DDoS protection
- Cloudflare Workers for distributed rate limiting

## WebSocket Security

- WebSocket disabled in production unless `NEXT_PUBLIC_WS_URL` is explicitly set
- Connection requires authentication via token query parameter
- Auto-reconnect limited to 5 attempts

## Sensitive Pages (No-Cache)

The following paths have cache disabled:
- `/dashboard/*`
- `/settings/*`
- `/api/*`

## CSP Violation Reporting

CSP violations are reported to `/api/csp-report`:

- **Endpoint**: `apps/web-ui/src/app/api/csp-report/route.ts`
- **CSP Header**: Includes `report-uri /api/csp-report; report-to csp-endpoint;`
- **Filtering**: Browser extension violations are filtered out
- **Logging**: Set `CSP_REPORT_ENDPOINT` env var for external logging

## CI/CD Security

The `security-audit.yml` workflow runs:

1. **NPM Audit** - Fails on high/critical vulnerabilities
2. **License Check** - Validates OSS license compliance
3. **Secret Scanning** - Uses Gitleaks to detect secrets
4. **SARIF Upload** - Integrates with GitHub Security tab

Runs on: push, PR, daily at 2 AM UTC

## Production Deployment Checklist

- [ ] Set `ALLOWED_ORIGIN` environment variable
- [ ] Verify HTTPS is enforced
- [ ] Run `npm audit` and fix vulnerabilities
- [ ] Test all security headers with securityheaders.com
- [ ] Configure rate limiting at edge/CDN level
- [ ] Enable CSP reporting (optional)
- [ ] Set up error monitoring (Sentry)
- [ ] Review and rotate secrets

---

*Last updated: January 2026*
