# Run guardrail Locally

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ 
- PostgreSQL 14+
- Redis 6+
- Docker & Docker Compose (recommended)
- Git

### Option 1: Docker (Recommended)

1. **Clone the repository**
```bash
git clone https://github.com/your-org/guardrail.git
cd guardrail
```

2. **Copy environment files**
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

3. **Start all services**
```bash
docker-compose up -d
```

4. **Run database migrations**
```bash
docker-compose exec api npm run db:migrate
```

5. **Seed the database**
```bash
docker-compose exec api npm run db:seed
```

6. **Access the application**
- API: http://localhost:3000
- Web UI: http://localhost:3001
- Database Studio: http://localhost:5555 (Prisma Studio)

### Option 2: Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Start PostgreSQL and Redis**
```bash
# Using Homebrew (macOS)
brew services start postgresql
brew services start redis

# Or using Docker
docker run -d --name postgres -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:14
docker run -d --name redis -p 6379:6379 redis:6-alpine
```

3. **Set up environment variables**
```bash
# Copy and edit environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# Edit .env files with your local configuration
```

4. **Setup database**
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed
```

5. **Start development servers**
```bash
# Terminal 1: API server
npm run api:dev

# Terminal 2: Web UI
npm run web:dev

# Terminal 3: MCP server (optional)
npm run mcp:dev
```

---

## 📁 Environment Configuration

### Root .env
```env
# Node environment
NODE_ENV=development

# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/guardrail"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"
JWT_REFRESH_EXPIRES_IN="30d"

# API Configuration
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=debug

# CORS
CORS_ORIGIN="http://localhost:3000,http://localhost:3001"

# AI Services (Optional - for advanced features)
ANTHROPIC_API_KEY="your-anthropic-key"
OPENAI_API_KEY="your-openai-key"

# External Services (Optional)
SLACK_WEBHOOK_URL="your-slack-webhook"
EMAIL_SERVICE_API_KEY="your-email-service-key"
```

### API .env (apps/api/.env)
```env
# Inherits from root .env

# API-specific settings
API_PREFIX="/api"
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW="1 minute"

# Database connection pool
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# File uploads
MAX_FILE_SIZE="10MB"
UPLOAD_DIR="./uploads"

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET="your-session-secret"
```

---

## 🛠️ Development Workflow

### 1. Making Changes
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Watch mode for tests
npm run test:watch
```

### 2. Database Operations
```bash
# Create new migration
npm run db:migrate -- --name add_new_table

# Apply migrations
npm run db:migrate

# Reset database
npm run db:reset

# View database
npm run db:studio

# Seed data
npm run db:seed
```

### 3. Working with Packages
```bash
# Build all packages
npm run build

# Clean all packages
npm run clean

# Run specific package commands
npm run dev --filter=@guardrail/api
npm run test --filter=@guardrail/core
```

---

## 🧪 Testing

### Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### Test Structure
```
tests/
├── unit/           # Unit tests for individual functions
├── integration/    # API endpoint tests
├── e2e/           # Full user journey tests
├── fixtures/      # Test data
└── helpers/       # Test utilities
```

---

## 🔧 Troubleshooting

### Common Issues

1. **Database connection failed**
```bash
# Check PostgreSQL is running
brew services list | grep postgres
# or
docker ps | grep postgres

# Check connection string
psql $DATABASE_URL
```

2. **Redis connection failed**
```bash
# Check Redis is running
redis-cli ping

# Check URL
redis-cli -u $REDIS_URL ping
```

3. **Port already in use**
```bash
# Find process using port
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run api:dev
```

4. **Permission denied errors**
```bash
# Fix file permissions
chmod +x scripts/*.js

# Fix node_modules permissions
sudo chown -R $(whoami) node_modules
```

5. **TypeScript errors**
```bash
# Clear TypeScript cache
npm run clean

# Rebuild
npm run build

# Check specific package
npm run type-check --filter=@guardrail/api
```

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm run api:dev
```

Or for specific components:
```bash
DEBUG=guardrail:* npm run api:dev
```

---

## 📊 Monitoring

### Health Checks
```bash
# API health
curl http://localhost:3000/health

# Database health
curl http://localhost:3000/health/db

# WebSocket health
curl http://localhost:3000/health/ws
```

### Logs
```bash
# API logs
docker-compose logs -f api

# Database logs
docker-compose logs -f postgres

# All services
docker-compose logs -f
```

---

## 🚀 Production Considerations

When moving to production:

1. **Change all secrets**
   - Generate new JWT secrets
   - Update database passwords
   - Rotate API keys

2. **Enable security features**
   - Set NODE_ENV=production
   - Enable rate limiting
   - Configure CORS properly

3. **Set up monitoring**
   - Enable health check endpoints
   - Configure log aggregation
   - Set up alerting

4. **Database optimization**
   - Configure connection pooling
   - Enable query logging
   - Set up backups

---

## 📚 Additional Resources

- [API Documentation](./docs/API.md)
- [Testing Guide](./docs/TESTING.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Contributing Guide](./CONTRIBUTING.md)

---

## 🆘 Getting Help

1. Check the [troubleshooting section](#-troubleshooting)
2. Search [existing issues](https://github.com/your-org/guardrail/issues)
3. Join our [Discord community](https://discord.gg/guardrail)
4. Create a [new issue](https://github.com/your-org/guardrail/issues/new)

---

*Last Updated: December 30, 2024*
*Context Enhanced by guardrail AI*
