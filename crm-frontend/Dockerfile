FROM oven/bun:1.3-alpine as base
WORKDIR /app

FROM base AS builder
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

FROM base AS runner
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
EXPOSE 4000
CMD ["bun", "start"]
