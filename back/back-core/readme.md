

aws ecr-public create-repository --repository-name back --region us-east-1
buildah bud  -t public.ecr.aws/i5x9u8b2/back .
buildah push public.ecr.aws/i5x9u8b2/back




1 store 
  - sqlite - sql хранилище
  - lmdb - key-value хранилище
  - chdb - column-family хранилище
  - lowdb - json хранилище
  - files - файловое хранилище
  - sqlite-vec - векторное хранилище
  все хранится в общей папке data
  для каждой базы создается подпапка
  в этой подпапке data.db
  в ней config.yaml - конфигурация название, описание параметры инициализации 
  в ней подпапка migrations/ тут миграции
2 entity - описание сущностей 
3 migration - механизм позволяющий проводить миграции на любых типах данных
4 function - атомарные функции доступа к данным 
  - считывание 
  - запись
5 group - механизмы группировки функций по entity предоставляет контекст необходимый  


  
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
  
