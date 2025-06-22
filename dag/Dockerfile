# Этап сборки
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Копируем файлы зависимостей
COPY package.json bun.lock ./

# Устанавливаем все зависимости (включая devDependencies для сборки)
RUN bun install

# Копируем исходный код
COPY src ./src
COPY tsconfig.json ./

# Выполняем сборку проекта
RUN bun bld

# Продакшн этап
FROM oven/bun:1-alpine AS production

WORKDIR /app

# Копируем только package.json и bun.lock для установки продакшн зависимостей
COPY package.json bun.lock ./

# Устанавливаем только продакшн зависимости
RUN bun install --production

# Копируем собранное приложение из этапа сборки
COPY --from=builder /app/dist ./dist

# Создаем директорию для базы данных
RUN mkdir -p /app/data

# Устанавливаем права доступа
RUN chown -R 1000:1000 /app

# Переключаемся на непривилегированного пользователя
USER 1000

# Запускаем собранное приложение
CMD ["bun", "run", "dist/index.js"]