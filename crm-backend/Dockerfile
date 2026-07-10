FROM oven/bun:1.3-alpine as base
WORKDIR /app

FROM base AS builder
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

FROM base AS runner
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
EXPOSE 8000
CMD ["bun", "run", "start:prod"]
