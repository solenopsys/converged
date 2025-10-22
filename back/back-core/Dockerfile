FROM oven/bun:1-alpine AS builder

RUN apk add --no-cache libgcc libstdc++ 

WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
COPY src ./src 
COPY tsconfig.json ./
COPY bin-libs ./bin-libs


RUN bun install 
RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app

USER 1000

ENV BIN_LIBS_PATH=/app/bin-libs
CMD ["bun", "run", "src/services.ts"]