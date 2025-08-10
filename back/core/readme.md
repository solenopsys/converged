
  
  # 🚀 Elysia Plugin Server
  
  Сервер на **Elysia** и **Bun** с автоматической загрузкой плагинов из JS/TS файлов.
  
  ## ✨ Особенности
  
  - 🔌 **Автоматическая загрузка плагинов** из директории `./plugins/`
  - 🔄 **Hot Reload** плагинов в runtime
  - 📊 **API для управления плагинами**
  - 🛡️ **Встроенная безопасность** (CORS, Helmet)
  - 📖 **Swagger документация**
  - 🎯 **TypeScript поддержка**
  - ⚡ **Высокая производительность** благодаря Bun
  
  ## 🚀 Быстрый старт
  
  ```bash
  # Установка зависимостей
  bun install
  
  # Создание директории для плагинов
  mkdir -p plugins
  
  # Копирование примера конфигурации
  cp .env.example .env
  
  # Запуск в режиме разработки
  bun run dev
  
  # Или обычный запуск
  bun run start
  ```
  
  ## 📁 Структура проекта
  
  ```
  elysia-plugin-server/
  ├── server.ts              # Основной сервер
  ├── plugins/               # Директория плагинов
  │   ├── example-plugin.ts  # Пример плагина
  │   ├── auth-plugin.ts     # Плагин аутентификации
  │   └── ...                # Другие плагины
  ├── package.json
  ├── .env.example
  └── README.md
  ```
  
  ## 🔌 Создание плагинов
  
  Плагин - это функция, которая принимает экземпляр Elysia и возвращает его:
  
  ```typescript
  import { Elysia } from "elysia";
  
  export default function myPlugin(app: Elysia) {
    return app
      .get("/api/my-route", () => "Hello from plugin!")
      .post("/api/my-route", ({ body }) => ({ received: body }));
  }
  ```
  
  ## 📊 API для управления
  
  - `GET /api/plugins` - Список загруженных плагинов
  - `POST /api/plugins/reload` - Перезагрузка всех плагинов
  - `GET /health` - Статус сервера
  - `GET /swagger` - Документация API
  
  ## 🛠️ Конфигурация
  
  Настройки через переменные окружения:
  
  ```env
SERVICES_PORT=3001
DATA_DIR=data 
API_PORT=3000
OPENAI_API_KEY=
  ```
  
aws ecr-public create-repository --repository-name back --region us-east-1
buildah bud  -t public.ecr.aws/i5x9u8b2/back .
buildah push public.ecr.aws/i5x9u8b2/back

