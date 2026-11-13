FROM oven/bun:1.4-slim AS base
WORKDIR /app

FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG BACKEND_URL=http://crm-backend:8000
ENV BACKEND_URL=$BACKEND_URL
ARG SITE_BACKEND_URL=http://site-backend:5000
ENV SITE_BACKEND_URL=$SITE_BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

# Runner: Node with the standalone server.js, not `next start` under Bun. Bun's
# Node-compat layer retained memory over days on the public site, and `bun start`
# as PID 1 does not forward SIGTERM to the Next process. Debian slim matches the
# glibc builder, so traced native modules (sharp) still load.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=4000
ENV HOSTNAME=0.0.0.0
# Guardrail: a leak shows up as a restart instead of unbounded RSS.
ENV NODE_OPTIONS=--max-old-space-size=512
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 4000
CMD ["node", "server.js"]
