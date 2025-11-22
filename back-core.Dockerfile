FROM oven/bun:1.3-alpine

RUN apk add --no-cache libgcc libstdc++

WORKDIR /app

# Копируем исходники back-core
COPY back/back-core/src ./back-core/src
COPY back/back-core/tsconfig.json ./back-core/tsconfig.json

# Копируем bin-libs
COPY back/back-core/bin-libs ./bin-libs

WORKDIR /app/back-core

# Создаем минимальный package.json
RUN echo '{"type":"module","dependencies":{}}' > package.json

# Устанавливаем внешние зависимости (без lmdb - используем свою lmdbx через FFI)
RUN bun add @elysiajs/cors @elysiajs/jwt bcryptjs elysia kysely kysely-bun-sqlite lowdb pg

RUN mkdir -p /app/data
RUN chown -R 1000:1000 /app

USER 1000

ENV BIN_LIBS_PATH=/app/bin-libs
ENV NODE_ENV=production

# Запускаем TypeScript напрямую
CMD ["bun", "run", "src/services.ts"]
