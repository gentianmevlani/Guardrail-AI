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
COPY packages/engines/package.json ./packages/engines/
COPY packages/llm-safety/package.json ./packages/llm-safety/
COPY packages/procedural-memory/package.json ./packages/procedural-memory/
COPY mcp-server/package.json ./mcp-server/
COPY vscode-extension/package.json ./vscode-extension/

# Install dependencies - skip optional native modules that cause issues
RUN pnpm install --frozen-lockfile --ignore-scripts || pnpm install --no-frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Stale tsbuildinfo + missing dist makes `tsc` no-op with exit 0; purge before compile.
RUN find /app -name '*.tsbuildinfo' -delete

# Generate Prisma client
RUN npx prisma generate --schema=./packages/database/prisma/schema.prisma

# Snapshot generated client for the runner stage (pnpm stores it under .pnpm)
RUN set -eux; \
    src="$(ls -d /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma 2>/dev/null | head -1)"; \
    test -n "$src"; \
    cp -a "$src" /tmp/prisma-generated-dot-prisma

# Build API and all its dependencies (including database, core, security, ai-guardrails, etc.)
RUN pnpm turbo run build --filter=@guardrail/api...

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
COPY packages/engines/package.json ./packages/engines/
COPY packages/llm-safety/package.json ./packages/llm-safety/
COPY packages/procedural-memory/package.json ./packages/procedural-memory/
COPY mcp-server/package.json ./mcp-server/
COPY vscode-extension/package.json ./vscode-extension/

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

# Reuse Prisma client generated in builder (runner uses `pnpm install --prod` — no prisma CLI;
# `npx prisma generate` here can fail with internal `pnpm add @prisma/client`.)
COPY --from=builder /tmp/prisma-generated-dot-prisma /tmp/prisma-generated-dot-prisma
RUN set -eux; \
    dest="$(ls -d /app/node_modules/.pnpm/@prisma+client@*/node_modules 2>/dev/null | head -1)"; \
    test -n "$dest"; \
    rm -rf "$dest/.prisma"; \
    cp -a /tmp/prisma-generated-dot-prisma "$dest/.prisma"; \
    rm -rf /tmp/prisma-generated-dot-prisma

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
