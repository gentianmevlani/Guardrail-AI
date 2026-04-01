# guardrail Production Deployment Checklist

## Pre-Deployment Requirements

### Environment Variables (Required)

| Variable               | Description                          | Example                               |
| ---------------------- | ------------------------------------ | ------------------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string         | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET`           | Strong random string for JWT signing | Generate with `openssl rand -hex 64`  |
| `GITHUB_CLIENT_ID`     | GitHub OAuth App Client ID           | From GitHub Developer Settings        |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App Secret              | From GitHub Developer Settings        |
| `NODE_ENV`             | Must be `production`                 | `production`                          |

### Environment Variables (Optional but Recommended)

| Variable                | Description                       | Default |
| ----------------------- | --------------------------------- | ------- |
| `PORT`                  | Server port                       | `3000`  |
| `CORS_ORIGIN`           | Allowed origins (comma-separated) | `*`     |
| `STRIPE_SECRET_KEY`     | Stripe API key for billing        | -       |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret   | -       |
| `OPENAI_API_KEY`        | OpenAI API key for AI features    | -       |
| `FRONTEND_URL`          | Frontend URL for OAuth redirects  | -       |

## Security Checklist

- [ ] `JWT_SECRET` is a strong random string (64+ characters)
- [ ] All secrets are stored in environment variables, not in code
- [ ] `NODE_ENV=production` is set
- [ ] HTTPS is enabled (handled by Railway/Netlify)
- [ ] CORS origins are properly configured
- [ ] Rate limiting is enabled
- [ ] Database connection uses SSL (`?sslmode=require`)

## Database Setup

1. **Create PostgreSQL database** (Railway provides this automatically)
2. **Run migrations**: Handled automatically by `start.sh`
3. **Verify tables exist**: The startup script checks critical tables

## Deployment Steps

### Railway Deployment

1. Push to `main` branch
2. Railway automatically builds using Dockerfile
3. Environment variables are injected from Railway dashboard
4. `start.sh` runs migrations and starts server

### Required Railway Environment Variables

Set these in Railway dashboard → Variables:

```
DATABASE_URL=<from Railway PostgreSQL>
JWT_SECRET=<generate with: openssl rand -hex 64>
GITHUB_CLIENT_ID=<your GitHub OAuth app>
GITHUB_CLIENT_SECRET=<your GitHub OAuth secret>
FRONTEND_URL=https://your-netlify-app.netlify.app
CORS_ORIGIN=https://your-netlify-app.netlify.app
```

## Post-Deployment Verification

### Health Checks

```bash
# Liveness check
curl https://your-api.railway.app/api/live

# Readiness check
curl https://your-api.railway.app/api/ready

# Full health status
curl https://your-api.railway.app/api/health
```

### Expected Responses

**Liveness** (`/api/live`):

```json
{ "status": "ok", "timestamp": "..." }
```

**Readiness** (`/api/ready`):

```json
{ "status": "ready", "database": "connected" }
```

## Monitoring

- **Logs**: Available in Railway dashboard
- **Metrics**: Available via `/api/metrics` endpoint
- **Health**: Healthcheck runs every 30 seconds

## Rollback Procedure

1. Go to Railway dashboard
2. Select previous successful deployment
3. Click "Rollback to this deployment"

## Common Issues

### Database Connection Failed

- Verify `DATABASE_URL` is correct
- Check if PostgreSQL addon is provisioned
- Ensure SSL mode is enabled for Railway

### JWT Errors

- Verify `JWT_SECRET` is set
- Ensure it's the same across all instances

### CORS Errors

- Add your frontend URL to `CORS_ORIGIN`
- Include both http and https if needed

## Security Hardening

The API includes:

- **Helmet.js** for security headers
- **Rate limiting** on all endpoints
- **Input sanitization**
- **JWT authentication**
- **CORS protection**
- **Request body size limits**
- **Non-root Docker user**

## API Documentation

Swagger UI available at: `https://your-api.railway.app/docs`
