FROM oven/bun:1-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY src ./src
COPY services ./services
COPY tsconfig.json ./
RUN bun bld

FROM oven/bun:1-alpine AS production

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --production

COPY --from=builder /app/dist ./dist
RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app

USER 1000

CMD ["bun", "run", "dist/server.js"]