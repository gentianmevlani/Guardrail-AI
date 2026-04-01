# 🚀 Production Deployment Guide

This guide covers deploying guardrail to production environments.

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose
- SSL certificates
- Domain name

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web UI        │    │   API Server    │    │   Database      │
│   (Next.js)     │◄──►│   (Fastify)     │◄──►│   (PostgreSQL)  │
│   Port: 3000    │    │   Port: 3001    │    │   Port: 5432    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN/Static    │    │   Redis Cache   │    │   File Storage  │
│   (Netlify)     │    │   Port: 6379    │    │   (AWS S3)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Environment Configuration

### Production Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/guardrail_prod

# Redis
REDIS_URL=redis://host:6379

# Authentication
JWT_SECRET=your-super-secret-jwt-key
SESSION_SECRET=your-session-secret

# API Keys
OPENAI_API_KEY=sk-openai-key
ANTHROPIC_API_KEY=sk-ant-key

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Monitoring
SENTRY_DSN=https://your-sentry-dsn

# Application
NODE_ENV=production
API_BASE_URL=https://api.guardrailai.dev
WEB_URL=https://guardrailai.dev
```

### Docker Configuration
```dockerfile
# Dockerfile.api
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma

EXPOSE 3001
CMD ["node", "dist/start.js"]
```

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: guardrail_prod
      POSTGRES_USER: guardrail
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

## 🌐 Web UI Deployment (Netlify)

### Netlify Configuration
```toml
# netlify.toml
[build]
  base = "apps/web-ui"
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from = "/api/*"
  to = "https://api.guardrailai.dev/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

## 🔒 Security Configuration

### SSL/TLS Setup
```bash
# Using Let's Encrypt
certbot --nginx -d guardrailai.dev -d api.guardrailai.dev

# Or AWS Certificate Manager
aws acm request-certificate --domain-name guardrailai.dev
```

### Firewall Rules
```bash
# UFW configuration
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3001/tcp  # API (internal only)
ufw enable
```

### Rate Limiting
```javascript
// API rate limiting
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

## 📊 Monitoring & Logging

### Application Monitoring
```javascript
// Sentry integration
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: 'production',
  tracesSampleRate: 0.1
});
```

### Health Checks
```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    memory: process.memoryUsage(),
    uptime: process.uptime()
  };
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks
  });
});
```

### Log Management
```javascript
// Structured logging
import logger from 'pino';

const log = logger({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino/file',
    options: { destination: '/var/log/guardrail.log' }
  }
});
```

## 🗄️ Database Setup

### Production Database
```bash
# Create database
createdb guardrail_prod

# Run migrations
npm run db:migrate:prod

# Seed initial data (optional)
npm run db:seed:prod
```

### Backup Strategy
```bash
# Daily backups
0 2 * * * pg_dump guardrail_prod | gzip > /backups/guardrail_$(date +%Y%m%d).sql.gz

# Retention policy (30 days)
0 3 * * * find /backups -name "guardrail_*.sql.gz" -mtime +30 -delete
```

## 🚀 Deployment Steps

### 1. Prepare Infrastructure
```bash
# Setup server
ssh root@your-server
apt update && apt upgrade -y
apt install docker docker-compose nginx certbot -y

# Create directories
mkdir -p /opt/guardrail
mkdir -p /var/log/guardrail
mkdir -p /backups
```

### 2. Deploy Application
```bash
# Clone repository
git clone https://github.com/your-org/guardrail.git /opt/guardrail
cd /opt/guardrail

# Set environment
cp .env.example .env
# Edit .env with production values

# Build and start
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Configure Web Server
```nginx
# /etc/nginx/sites-available/guardrailai.dev
server {
    listen 443 ssl http2;
    server_name api.guardrailai.dev;

    ssl_certificate /etc/letsencrypt/live/guardrailai.dev/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/guardrailai.dev/privkey.pem;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Setup CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/guardrail
            git pull origin main
            docker-compose -f docker-compose.prod.yml up -d --build
```

## 🔍 Post-Deployment Checklist

### ✅ Security Verification
- [ ] SSL certificates valid
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] Environment variables secure
- [ ] Database access restricted

### ✅ Performance Verification
- [ ] Application responding
- [ ] Database connections healthy
- [ ] Redis cache working
- [ ] Load times acceptable
- [ ] Memory usage normal

### ✅ Functionality Verification
- [ ] User registration works
- [ ] Authentication working
- [ ] Scans executing properly
- [ ] Payments processing
- [ ] Email notifications sent

### ✅ Monitoring Setup
- [ ] Error tracking enabled
- [ ] Performance monitoring active
- [ ] Log rotation configured
- [ ] Backup schedules set
- [ ] Health checks functional

## 🚨 Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database status
docker-compose logs postgres

# Test connection
psql $DATABASE_URL -c "SELECT 1;"
```

#### High Memory Usage
```bash
# Check memory usage
docker stats

# Restart services
docker-compose restart
```

#### Slow Response Times
```bash
# Check database queries
docker-compose logs api | grep "slow query"

# Analyze performance
npm run perf:analyze
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Load balancer configuration
- Multiple API instances
- Database read replicas
- CDN for static assets

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Implement caching strategies
- Profile and optimize code

## 🔄 Maintenance

### Regular Tasks
- **Daily**: Monitor logs and metrics
- **Weekly**: Update dependencies
- **Monthly**: Security patches
- **Quarterly**: Performance reviews

### Emergency Procedures
- Rollback plan
- Data recovery procedures
- Communication templates
- Escalation contacts

---

## 🎉 Production Ready!

Your guardrail instance is now running in production! Users can:

- ✅ Register and authenticate
- ✅ Run security scans
- ✅ Upgrade to paid tiers
- ✅ Access compliance features
- ✅ Get customer support

For ongoing maintenance and support, refer to the operations handbook.
