# 💰 Subscription Pricing & Dependencies

## 📊 Subscription Tiers

### 🆓 Free Tier
**Price:** $0/month (Forever Free)

**Limits:**
- 500 files max
- 10,000 lines of code max
- 5MB codebase size max
- 1 project
- 1 team member
- 100 validations/month
- 10 API endpoints

**Features:**
- ✅ Basic guardrails
- ✅ Error boundary
- ✅ 404 page
- ✅ Basic templates
- ✅ Community support

---

### 🚀 Starter Tier
**Price:** $19/month or $190/year (Save 17%)

**Limits:**
- 2,000 files max
- 50,000 lines of code max
- 25MB codebase size max
- 3 projects
- 3 team members
- 1,000 validations/month
- 50 API endpoints

**Features:**
- ✅ All free features
- ✅ Breadcrumbs
- ✅ Loading states
- ✅ Empty states
- ✅ Backend middleware
- ✅ Email support
- ✅ Basic analytics

---

### 💼 Pro Tier
**Price:** $49/month or $490/year (Save 17%)

**Limits:**
- 10,000 files max
- 250,000 lines of code max
- 100MB codebase size max
- 10 projects
- 10 team members
- 10,000 validations/month
- 200 API endpoints

**Features:**
- ✅ All starter features
- ✅ Advanced guardrails
- ✅ Custom rules
- ✅ Priority support
- ✅ Analytics dashboard
- ✅ API access
- ✅ Predictive quality
- ✅ Code relationships
- ✅ Evolution tracking

---

### 🏢 Enterprise Tier
**Price:** $199/month or $1,990/year (Save 17%)

**Limits:**
- 50,000 files max
- 1,000,000 lines of code max
- 500MB codebase size max
- 50 projects
- 50 team members
- 100,000 validations/month
- Unlimited API endpoints

**Features:**
- ✅ All pro features
- ✅ Unlimited custom rules
- ✅ Dedicated support
- ✅ SLA guarantee
- ✅ Custom integrations
- ✅ On-premise option
- ✅ AI behavior learning
- ✅ Code pattern DNA
- ✅ Predictive refactoring
- ✅ Health scoring

---

### ♾️ Unlimited Tier
**Price:** Custom (Contact Sales)

**Limits:**
- Unlimited files
- Unlimited lines
- Unlimited size
- Unlimited projects
- Unlimited team members
- Unlimited validations
- Unlimited API endpoints

**Features:**
- ✅ Everything in Enterprise
- ✅ Custom feature development
- ✅ Dedicated account manager
- ✅ White-label option
- ✅ Source code access
- ✅ Custom SLA

---

## 💳 Payment Processing

### Stripe Integration Required

**Dependencies:**
```json
{
  "stripe": "^14.0.0",
  "@stripe/stripe-js": "^2.0.0"
}
```

**Environment Variables:**
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...
```

**Features Needed:**
- Subscription management
- Payment processing
- Webhook handling
- Invoice generation
- Customer portal
- Usage-based billing (optional)

---

## 🤖 AI API Dependencies

### OpenAI API
**Required For:**
- Semantic code search (embeddings)
- Code generation suggestions
- Predictive quality analysis
- AI behavior learning

**Dependencies:**
```json
{
  "openai": "^4.20.0"
}
```

**Environment Variables:**
```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Pricing:**
- Embeddings: $0.02 per 1M tokens
- GPT-4: ~$0.01-0.03 per 1K tokens
- Estimated cost: $5-50/month per active user

---

### Anthropic API
**Required For:**
- Alternative code analysis
- Claude-based suggestions
- Advanced reasoning

**Dependencies:**
```json
{
  "@anthropic-ai/sdk": "^0.20.0"
}
```

**Environment Variables:**
```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-opus-20240229
```

**Pricing:**
- Claude 3 Opus: $15 per 1M input tokens
- Estimated cost: $10-100/month per active user

---

### Cohere API (Optional)
**Required For:**
- Alternative embeddings
- Text classification

**Dependencies:**
```json
{
  "cohere-ai": "^7.0.0"
}
```

**Environment Variables:**
```env
COHERE_API_KEY=...
```

**Pricing:**
- Embeddings: $0.10 per 1M tokens
- Estimated cost: $2-20/month per active user

---

## 🗄️ Database Requirements

### Primary Database: PostgreSQL
**Why:** Reliable, scalable, supports complex queries

**Dependencies:**
```json
{
  "pg": "^8.11.0",
  "@types/pg": "^8.10.0",
  "prisma": "^5.7.0",
  "@prisma/client": "^5.7.0"
}
```

**Environment Variables:**
```env
DATABASE_URL=postgresql://user:password@localhost:5432/guardrail
DATABASE_POOL_SIZE=20
```

**Schema Needed:**
- Users
- Subscriptions
- Payments
- Usage tracking
- Projects
- Teams
- API keys
- Analytics

---

### Cache Database: Redis
**Why:** Fast caching, session storage, rate limiting

**Dependencies:**
```json
{
  "redis": "^4.6.0",
  "ioredis": "^5.3.0"
}
```

**Environment Variables:**
```env
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=...
```

**Use Cases:**
- Session storage
- Rate limiting
- API response caching
- Real-time features

---

### Vector Database (Optional): Pinecone/Weaviate
**Why:** Efficient semantic search for massive codebases

**Dependencies:**
```json
{
  "@pinecone-database/pinecone": "^1.1.0"
}
```

**Environment Variables:**
```env
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX=guardrail-embeddings
```

**Pricing:**
- Pinecone: $70/month starter
- Weaviate Cloud: $25/month starter

---

## 📦 Complete Dependency List

### Core Dependencies
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "stripe": "^14.0.0",
    "@stripe/stripe-js": "^2.0.0",
    "openai": "^4.20.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "cohere-ai": "^7.0.0",
    "pg": "^8.11.0",
    "@prisma/client": "^5.7.0",
    "prisma": "^5.7.0",
    "redis": "^4.6.0",
    "ioredis": "^5.3.0",
    "@pinecone-database/pinecone": "^1.1.0",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "zod": "^3.22.4",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "rate-limiter-flexible": "^3.0.0",
    "nodemailer": "^6.9.7",
    "chalk": "^5.3.0",
    "ora": "^7.0.1",
    "chokidar": "^3.5.3"
  }
}
```

---

## 🔐 Environment Variables Template

Create `.env.example`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/guardrail
REDIS_URL=redis://localhost:6379

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_STARTER=price_...
STRIPE_PRICE_ID_PRO=price_...
STRIPE_PRICE_ID_ENTERPRISE=price_...

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-opus-20240229

# Cohere (Optional)
COHERE_API_KEY=...

# Pinecone (Optional)
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=...
PINECONE_INDEX=guardrail-embeddings

# App
NODE_ENV=production
PORT=3000
JWT_SECRET=...
SESSION_SECRET=...
FRONTEND_URL=https://guardrailai.dev
API_URL=https://api.guardrailai.dev

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=...
EMAIL_FROM=noreply@guardrailai.dev
```

---

## 💰 Cost Estimates

### Per User Monthly Costs:
- **Free Tier:** $0 (no API usage)
- **Starter Tier:** ~$5-15 (light API usage)
- **Pro Tier:** ~$20-50 (moderate API usage)
- **Enterprise Tier:** ~$50-150 (heavy API usage)

### Infrastructure Costs:
- **PostgreSQL:** $25-100/month (managed)
- **Redis:** $15-50/month (managed)
- **Vector DB:** $0-70/month (optional)
- **Hosting:** $50-500/month (Vercel/Heroku/AWS)

### Total Monthly Costs:
- **Starter:** ~$100-200/month (10 users)
- **Pro:** ~$500-1,000/month (50 users)
- **Enterprise:** ~$2,000-5,000/month (200 users)

---

## 🚀 Implementation Priority

1. **Phase 1:** Stripe + PostgreSQL (Core subscriptions)
2. **Phase 2:** OpenAI API (Semantic search)
3. **Phase 3:** Redis (Caching & sessions)
4. **Phase 4:** Anthropic API (Advanced features)
5. **Phase 5:** Vector DB (Massive repos)

---

**Status:** Ready for implementation! 🎉

