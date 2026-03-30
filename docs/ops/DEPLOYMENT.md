# guardrail Deployment Guide

This guide provides a single documented path to deploy guardrail locally, to staging, and to production.

## Table of Contents

- [Required Environment Variables](#required-environment-variables)
- [Local Development](#local-development)
- [Staging Deployment](#staging-deployment)
- [Production Deployment](#production-deployment)
- [Rollback Steps](#rollback-steps)
- [Troubleshooting](#troubleshooting)

---

## Required Environment Variables

### Core (Always Required)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | Generate with: `openssl rand -base64 32` |

### Production/Staging Required

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Public API URL for web-ui | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `https://yourdomain.com` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Generate with: `openssl rand -base64 32` |
| `REDIS_PASSWORD` | Redis password | Generate with: `openssl rand -base64 32` |

### Optional (Features Disabled if Missing)

| Variable | Description | Purpose |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | GitHub integration |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth secret | GitHub integration |
| `STRIPE_SECRET_KEY` | Stripe API secret key | Billing features |
| `STRIPE_PUBLISHABLE_KEY` | Stripe publishable key | Billing features |
| `OPENAI_API_KEY` | OpenAI API key | AI features |
| `REDIS_URL` | Redis connection string | Caching/sessions |
| `SENTRY_DSN` | Sentry DSN | Error monitoring |

### Generate Secrets

```bash
# Generate secure secrets
export JWT_SECRET=$(openssl rand -base64 32)
export POSTGRES_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)
export COOKIE_SECRET=$(openssl rand -base64 32)
export SESSION_SECRET=$(openssl rand -base64 32)
```

---

## Local Development

### Prerequisites

- Docker and Docker Compose
- Node.js 20+ and pnpm 9.15.1+
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd guardrail-Ofiicial-main
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   # Edit .env and set required variables
   ```

3. **Generate secrets**
   ```bash
   # Add to .env file:
   JWT_SECRET=$(openssl rand -base64 32)
   POSTGRES_PASSWORD=$(openssl rand -base64 32)
   REDIS_PASSWORD=$(openssl rand -base64 32)
   ```

4. **Start services with Docker Compose**
   ```bash
   docker-compose up -d
   ```

5. **Verify services are running**
   ```bash
   docker-compose ps
   # Should show: postgres, redis, api, web (all healthy)
   ```

6. **Run migrations** (if needed)
   ```bash
   docker-compose exec api npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma
   ```

7. **Run smoke test**
   ```bash
   ./scripts/smoke-test.sh local
   ```

### Access Services

- **Web UI**: http://localhost:5000
- **API**: http://localhost:3000
- **API Health**: http://localhost:3000/health
- **API Docs**: http://localhost:3000/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

### Local Development Without Docker

If you prefer to run services locally:

1. **Start PostgreSQL and Redis**
   ```bash
   # PostgreSQL
   docker run -d --name guardrail-db \
     -e POSTGRES_PASSWORD=localdev \
     -e POSTGRES_DB=guardrail \
     -p 5432:5432 \
     postgres:15-alpine
   
   # Redis
   docker run -d --name guardrail-redis \
     -p 6379:6379 \
     redis:7-alpine
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up database**
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Start API**
   ```bash
   pnpm api:dev
   ```

5. **Start Web UI** (in another terminal)
   ```bash
   pnpm web:dev
   ```

---

## Staging Deployment

### Prerequisites

- Docker and Docker Compose installed on staging server
- Domain configured (e.g., `staging.yourdomain.com`)
- SSL certificate (Let's Encrypt recommended)

### Deployment Steps

1. **Set environment variables**
   ```bash
   export NODE_ENV=staging
   export POSTGRES_PASSWORD=$(openssl rand -base64 32)
   export REDIS_PASSWORD=$(openssl rand -base64 32)
   export JWT_SECRET=$(openssl rand -base64 32)
   export NEXT_PUBLIC_API_URL=https://api-staging.yourdomain.com
   export NEXT_PUBLIC_APP_URL=https://staging.yourdomain.com
   export DATABASE_URL=postgresql://user:pass@db-host:5432/guardrail_staging
   export REDIS_URL=redis://:password@redis-host:6379
   ```

2. **Pull latest code**
   ```bash
   git pull origin main
   ```

3. **Build and start services**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Verify deployment**
   ```bash
   docker-compose ps
   docker-compose logs api
   docker-compose logs web
   ```

5. **Run smoke tests**
   ```bash
   ./scripts/smoke-test.sh staging
   ```

### Health Checks

- API: `https://api-staging.yourdomain.com/health`
- Web: `https://staging.yourdomain.com/api/health`

---

## Production Deployment

### Prerequisites

- Docker and Docker Compose installed on production server
- Production domain configured
- SSL certificate configured
- Database backup strategy in place
- Monitoring and alerting configured

### Pre-Deployment Checklist

- [ ] All environment variables set
- [ ] Database migrations tested in staging
- [ ] Secrets rotated and secure
- [ ] SSL certificates valid
- [ ] Database backup taken
- [ ] Monitoring dashboards ready
- [ ] Rollback plan documented

### Deployment Steps

1. **Set production environment variables**
   ```bash
   export NODE_ENV=production
   export POSTGRES_PASSWORD=<secure-password>
   export REDIS_PASSWORD=<secure-password>
   export JWT_SECRET=<secure-secret-min-32-chars>
   export NEXT_PUBLIC_API_URL=https://api.yourdomain.com
   export NEXT_PUBLIC_APP_URL=https://yourdomain.com
   export DATABASE_URL=postgresql://user:pass@db-host:5432/guardrail_prod
   export REDIS_URL=redis://:password@redis-host:6379
   
   # Optional but recommended:
   export GITHUB_CLIENT_ID=<your-github-client-id>
   export GITHUB_CLIENT_SECRET=<your-github-secret>
   export STRIPE_SECRET_KEY=<your-stripe-key>
   export SENTRY_DSN=<your-sentry-dsn>
   ```

2. **Pull latest code**
   ```bash
   git pull origin main
   git tag -a "v$(date +%Y%m%d-%H%M%S)" -m "Production deployment"
   ```

3. **Build images**
   ```bash
   docker-compose build --no-cache
   ```

4. **Run database migrations** (before starting new containers)
   ```bash
   # Option 1: Run migrations in a temporary container
   docker-compose run --rm api npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma
   
   # Option 2: If using external database, run locally:
   DATABASE_URL=$DATABASE_URL npx prisma migrate deploy --schema=./packages/database/prisma/schema.prisma
   ```

5. **Start services with zero-downtime deployment**
   ```bash
   # Start new containers
   docker-compose up -d
   
   # Wait for health checks
   sleep 30
   
   # Verify all services are healthy
   docker-compose ps
   ```

6. **Verify deployment**
   ```bash
   # Check logs
   docker-compose logs --tail=100 api
   docker-compose logs --tail=100 web
   
   # Check health endpoints
   curl https://api.yourdomain.com/health
   curl https://yourdomain.com/api/health
   ```

7. **Run smoke tests**
   ```bash
   ./scripts/smoke-test.sh production
   ```

8. **Monitor for issues**
   ```bash
   # Watch logs
   docker-compose logs -f api web
   
   # Check metrics (if configured)
   # Monitor error rates, response times, etc.
   ```

### Post-Deployment Verification

- [ ] All health checks passing
- [ ] Smoke tests passing
- [ ] No errors in logs
- [ ] API responding correctly
- [ ] Web UI loading correctly
- [ ] Database connections stable
- [ ] Redis connections stable

---

## Rollback Steps

### Quick Rollback (Last Deployment)

1. **Stop current containers**
   ```bash
   docker-compose down
   ```

2. **Checkout previous version**
   ```bash
   git checkout <previous-tag-or-commit>
   ```

3. **Rebuild and restart**
   ```bash
   docker-compose build
   docker-compose up -d
   ```

4. **Verify rollback**
   ```bash
   ./scripts/smoke-test.sh production
   ```

### Database Migration Rollback

If a migration caused issues:

1. **Identify problematic migration**
   ```bash
   # Check migration history
   docker-compose exec api npx prisma migrate status --schema=./packages/database/prisma/schema.prisma
   ```

2. **Rollback migration** (if using Prisma migrations)
   ```bash
   # Note: Prisma doesn't support automatic rollback
   # You'll need to manually reverse the migration SQL
   docker-compose exec postgres psql -U guardrail -d guardrail
   # Then manually run reverse SQL
   ```

3. **Or restore from backup**
   ```bash
   # Restore database from backup
   # (specific commands depend on your backup strategy)
   ```

### Emergency Rollback

If the system is completely down:

1. **Stop all containers immediately**
   ```bash
   docker-compose down
   ```

2. **Restore from last known good state**
   ```bash
   git checkout <last-known-good-commit>
   docker-compose build
   docker-compose up -d
   ```

3. **Restore database** (if needed)
   ```bash
   # Restore from backup
   ```

---

## Troubleshooting

### Services Won't Start

**Check logs:**
```bash
docker-compose logs api
docker-compose logs web
docker-compose logs postgres
docker-compose logs redis
```

**Common issues:**
- Missing environment variables → Check `.env` file
- Port conflicts → Check if ports 3000, 5000, 5432, 6379 are available
- Database connection failed → Verify `DATABASE_URL` is correct
- Invalid JWT_SECRET → Must be at least 32 characters

### Database Migration Failures

**Check migration status:**
```bash
docker-compose exec api npx prisma migrate status --schema=./packages/database/prisma/schema.prisma
```

**Common issues:**
- Migration already applied → Check migration history
- Database connection failed → Verify `DATABASE_URL`
- Schema drift → May need to reset (⚠️ **destructive**)

### Health Checks Failing

**Check individual services:**
```bash
# API health
curl http://localhost:3000/health

# Web health
curl http://localhost:5000/api/health

# Database health
docker-compose exec postgres pg_isready -U guardrail

# Redis health
docker-compose exec redis redis-cli -a $REDIS_PASSWORD ping
```

### Performance Issues

**Check resource usage:**
```bash
docker stats
```

**Check logs for errors:**
```bash
docker-compose logs --tail=1000 | grep -i error
```

**Common fixes:**
- Increase container resources
- Check database query performance
- Verify Redis is working (caching)
- Check for memory leaks

### Environment Variable Issues

**Validate environment:**
```bash
docker-compose exec api node scripts/validate-env.js
```

**Common issues:**
- Missing required vars → Check `env.example`
- Invalid format → Check variable format (URLs, secrets, etc.)
- Localhost in production → Remove localhost references

---

## Additional Resources

- [Environment Variables Reference](./env.example)
- [API Documentation](http://localhost:3000/docs) (when running locally)
- [Smoke Test Script](./scripts/smoke-test.sh)
- [Database Schema](./prisma/schema.prisma)

---

## Support

For deployment issues:
1. Check logs: `docker-compose logs`
2. Run smoke tests: `./scripts/smoke-test.sh`
3. Check health endpoints
4. Review this guide's troubleshooting section
