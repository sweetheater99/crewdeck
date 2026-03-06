# Stage 1 - Install dependencies
FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY cli/package.json cli/
COPY server/package.json server/
COPY ui/package.json ui/
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/adapter-utils/package.json packages/adapter-utils/
COPY packages/adapters/claude-local/package.json packages/adapters/claude-local/
COPY packages/adapters/codex-local/package.json packages/adapters/codex-local/
RUN pnpm install --frozen-lockfile

# Stage 2 - Build
FROM base AS build
WORKDIR /app
COPY --from=deps /app /app
COPY . .
RUN pnpm --filter @crewdeck/shared build
RUN pnpm --filter @crewdeck/db build
RUN pnpm --filter @crewdeck/ui build
RUN pnpm --filter @crewdeck/server build

# Stage 3 - Production
FROM node:20-bookworm-slim AS production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl postgresql postgresql-client \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production \
  HOME=/crewdeck \
  HOST=0.0.0.0 \
  PORT=3100 \
  SERVE_UI=true \
  CREWDECK_HOME=/crewdeck \
  CREWDECK_INSTANCE_ID=default \
  CREWDECK_CONFIG=/crewdeck/instances/default/config.json \
  CREWDECK_DEPLOYMENT_MODE=local_trusted \
  CREWDECK_DEPLOYMENT_EXPOSURE=private

VOLUME ["/crewdeck"]
EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3100/api/health || exit 1

CMD ["node", "--import", "./server/node_modules/tsx/dist/loader.mjs", "server/dist/index.js"]
