# Base Node.js image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install Turbo
RUN npm install -g turbo

# Copy package files
COPY package.json package-lock.json* ./
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/ai-guardrails/package.json ./packages/ai-guardrails/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN npm install

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN cd packages/database && npx prisma generate

# Build the application
RUN npx turbo run build --filter=@GUARDRAIL/api

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 GUARDRAIL

# Copy necessary files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/jest.config.js ./apps/api/
COPY --from=builder /app/apps/api/jest.setup.ts ./apps/api/
COPY --from=builder /app/config/jest.config.js ./config/
COPY --from=builder /app/packages/database/node_modules/.prisma ./packages/database/node_modules/.prisma
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/start.sh ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Create directories that need write permissions
RUN mkdir -p /app/reports /app/uploads /app/temp && chown -R GUARDRAIL:nodejs /app/reports /app/uploads /app/temp

USER GUARDRAIL

EXPOSE 3000

ENV PORT=3000

CMD ["node", "apps/api/dist/index.js"]
