# Workflow Server

## Структура файлов

```
├── server.ts           # Основной сервер
├── database.ts         # База данных
├── workflow-service.ts # Сервис workflow
├── webhook-service.ts  # Сервис webhooks
├── webhook-tool.ts     # CLI инструмент
├── types.ts           # Zod схемы
└── package.json
```

## package.json

```json
{
  "dependencies": {
    "elysia": "latest",
    "@elysiajs/swagger": "latest", 
    "@elysiajs/cors": "latest",
    "kysely": "latest",
    "zod": "latest"
  }
}
```

## Запуск

```bash
bun install
bun run server.ts
```

## API

**Swagger UI:** http://localhost:3000/docs

### Workflow endpoints:
- `GET /api/workflows` - все workflow
- `POST /api/workflows` - создать workflow
- `GET /api/workflows/:id` - получить workflow
- `PUT /api/workflows/:id` - обновить workflow  
- `DELETE /api/workflows/:id` - удалить workflow
- `POST /api/workflows/:id/execute` - выполнить workflow

### Webhook endpoints:
- `GET /api/workflows/:id/webhooks` - webhooks для workflow
- `POST /api/workflows/:id/webhooks` - добавить webhook
- `GET /api/webhooks` - все webhooks
- `DELETE /api/webhooks/:id` - удалить webhook
- `POST /webhook/:workflowId` - триггер workflow

## CLI

```bash
# Список webhooks
bun webhook-tool.ts list

# Добавить webhook
bun webhook-tool.ts add 1 "https://example.com/hook" "secret"

# Удалить webhook
bun webhook-tool.ts remove 5
```

## Примеры

### Создание workflow
```bash
curl -X POST http://localhost:3000/api/workflows \
  -H "Content-Type: application/json" \
  -d '{"name": "test", "config": {"nodes": []}}'
```

### Добавление webhook
```bash
curl -X POST http://localhost:3000/api/workflows/1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/hook"}'
```

### Выполнение workflow
```bash
curl -X POST http://localhost:3000/api/workflows/1/execute \
  -H "Content-Type: application/json" \
  -d '{"data": {"test": "value"}}'
```