FROM oven/bun:1-alpine AS builder

WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
COPY src ./src 
COPY tsconfig.json ./
RUN bun install 
RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app

USER 1000


CMD ["bun", "run", "src/services.ts"]