# Use Node.js 20 LTS with Debian (better native module support than Alpine)
FROM node:20-slim AS base

# Install dependencies and build
FROM base AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9.15.1

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy ALL package.json files (pnpm needs all workspace packages to resolve dependencies)
COPY apps/api/package.json ./apps/api/
COPY apps/web-ui/package.json ./apps/web-ui/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/security/package.json ./packages/security/
COPY packages/ai-guardrails/package.json ./packages/ai-guardrails/
COPY packages/compliance/package.json ./packages/compliance/
COPY packages/ship/package.json ./packages/ship/
COPY packages/cli/package.json ./packages/cli/

# Install dependencies - skip optional native modules that cause issues
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Stale tsbuildinfo + missing dist makes `tsc` no-op with exit 0; purge before compile.
RUN find /app -name '*.tsbuildinfo' -delete

# Generate Prisma client
RUN npx prisma generate --schema=./packages/database/prisma/schema.prisma

# Build database package first (needed by other packages)
RUN pnpm turbo run build --filter=@guardrail/database

# Build only API and its dependencies
RUN pnpm turbo run build --filter=@guardrail/api

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Force npm/pnpm to skip all scripts (prevents native module builds)
ENV npm_config_ignore_scripts=true
ENV PNPM_IGNORE_SCRIPTS=true

# Install runtime dependencies (including Python for optional native modules)
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.1

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files
COPY apps/api/package.json ./apps/api/
COPY apps/web-ui/package.json ./apps/web-ui/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/security/package.json ./packages/security/
COPY packages/ai-guardrails/package.json ./packages/ai-guardrails/
COPY packages/compliance/package.json ./packages/compliance/
COPY packages/ship/package.json ./packages/ship/
COPY packages/cli/package.json ./packages/cli/

# Install production dependencies only
# Python is now available if native modules need to build
RUN pnpm install --frozen-lockfile --ignore-scripts --prod || \
    pnpm install --no-frozen-lockfile --ignore-scripts --prod

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/security/dist ./packages/security/dist
COPY --from=builder /app/packages/ai-guardrails/dist ./packages/ai-guardrails/dist
COPY --from=builder /app/packages/compliance/dist ./packages/compliance/dist
COPY --from=builder /app/packages/ship/dist ./packages/ship/dist

# Copy prisma schema and migrations
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma

# Generate Prisma client in runner stage
RUN npx prisma generate --schema=./packages/database/prisma/schema.prisma

# Copy startup script
COPY scripts/start-api.sh /app/scripts/start-api.sh
COPY scripts/validate-env.js /app/scripts/validate-env.js
RUN chmod +x /app/scripts/start-api.sh

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the API (with env validation and migrations)
WORKDIR /app
CMD ["/app/scripts/start-api.sh"]
