FROM oven/bun:1.4-alpine AS base
WORKDIR /app

FROM base AS builder
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM base AS runner
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
EXPOSE 8000
# Run the app as PID 1 so it receives SIGTERM on deploy; `bun run` does not forward it.
CMD ["bun", "dist/main.js"]
