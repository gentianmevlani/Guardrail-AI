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

# Generate Prisma client (needed for web-ui if it uses database types)
RUN npx prisma generate --schema=./packages/database/prisma/schema.prisma || true

# Build database package first (needed by other packages)
RUN pnpm turbo run build --filter=@guardrail/database || true

# Build web-ui
RUN pnpm turbo run build --filter=@guardrail/web-ui

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Force npm/pnpm to skip all scripts (prevents native module builds)
ENV npm_config_ignore_scripts=true
ENV PNPM_IGNORE_SCRIPTS=true

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@9.15.1

# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy package.json files
COPY apps/web-ui/package.json ./apps/web-ui/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --ignore-scripts --prod --filter=@guardrail/web-ui... || \
    pnpm install --no-frozen-lockfile --ignore-scripts --prod --filter=@guardrail/web-ui...

# Copy built files
COPY --from=builder /app/apps/web-ui/.next ./apps/web-ui/.next
COPY --from=builder /app/apps/web-ui/public ./apps/web-ui/public
COPY --from=builder /app/apps/web-ui/package.json ./apps/web-ui/package.json
COPY --from=builder /app/apps/web-ui/next.config.mjs ./apps/web-ui/next.config.mjs
COPY --from=builder /app/apps/web-ui/tsconfig.json ./apps/web-ui/tsconfig.json

# Copy shared packages if needed
COPY --from=builder /app/packages/core/dist ./packages/core/dist || true

# Copy startup script
COPY scripts/start-web.sh /app/scripts/start-web.sh
RUN chmod +x /app/scripts/start-web.sh

WORKDIR /app/apps/web-ui

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Start the web-ui (with env validation)
WORKDIR /app
CMD ["/app/scripts/start-web.sh"]
