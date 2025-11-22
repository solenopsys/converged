FROM oven/bun:1.3-alpine

WORKDIR /app

# Копируем исходники всех зависимых пакетов (только src и необходимые файлы)
COPY back/back-core/src ./back-core/src
COPY back/back-core/tsconfig.json ./back-core/tsconfig.json
COPY back/back-core/package.json ./back-core/package.json
COPY builders/src ./builders/src
COPY builders/package.json ./builders/package.json
COPY nrpc/src ./nrpc/src
COPY nrpc/package.json ./nrpc/package.json
COPY adag/dag-api ./dag-api
COPY adag/dag-core/src ./dag-core/src
COPY adag/dag-core/generated ./dag-core/generated
COPY adag/dag-core/tsconfig.docker.json ./dag-core/tsconfig.json
COPY adag/dag-core/package.docker.json ./dag-core/package.json

# Копируем bin-libs для LMDB
COPY back/back-core/bin-libs ./bin-libs

WORKDIR /app/back-core
RUN bun install --production --no-save

WORKDIR /app/builders
RUN bun install --production --no-save

WORKDIR /app/nrpc
RUN bun install --production --no-save

WORKDIR /app/dag-core
RUN bun install --production --no-save

RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app

USER 1000

ENV BIN_LIBS_PATH=/app/bin-libs
ENV NODE_ENV=production

# Запускаем TypeScript напрямую
CMD ["bun", "run", "src/api.ts"]
