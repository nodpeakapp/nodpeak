# ─────────────────────────────────────────────────────────────
#  Nodpeak — multi-stage image
#  Primary target: linux/arm64 (Oracle Cloud Ampere A1)
#  Also builds clean on linux/amd64.
#
#  docker build --platform linux/arm64 -t nodpeak:latest .
# ─────────────────────────────────────────────────────────────

# ── 1. deps ──────────────────────────────────────────────────
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/widget/package.json ./packages/widget/package.json
RUN npm ci --include=dev || npm install --include=dev

# ── 2. builder ───────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder — the real DATABASE_URL is injected at runtime.
ENV DATABASE_URL="file:/tmp/build.db"

# Compile the embed widget into apps/web/public/widget.js
RUN npm run build --workspace=@nodpeak/widget

# Generate the Prisma client, then build Next in standalone mode
RUN npx prisma generate --schema=apps/web/prisma/schema.prisma
RUN npm run build --workspace=@nodpeak/web

# ── 3. litestream (optional SQLite -> S3/R2 replication) ─────
FROM node:22-bookworm-slim AS litestream
ARG LITESTREAM_VERSION=0.3.13
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
RUN set -eux; \
    arch="$(dpkg --print-architecture)"; \
    case "$arch" in \
      arm64) lsarch=arm64 ;; \
      amd64) lsarch=amd64 ;; \
      *) echo "unsupported arch $arch" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-${lsarch}.tar.gz" \
      -o /tmp/ls.tar.gz; \
    tar -C /usr/local/bin -xzf /tmp/ls.tar.gz litestream; \
    chmod +x /usr/local/bin/litestream

# ── 4. runner ────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 nodejs \
    && useradd  --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/nodpeak.db

COPY --from=litestream /usr/local/bin/litestream /usr/local/bin/litestream

# Next standalone server + its traced node_modules
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Prisma schema + CLI so the entrypoint can run `db push` on first boot
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

COPY --chown=nextjs:nodejs docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --chown=nextjs:nodejs litestream.yml /etc/litestream.yml
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /data && chown -R nextjs:nodejs /data
VOLUME ["/data"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/web/server.js"]
