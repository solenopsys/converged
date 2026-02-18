# ms-agent MVP — План реализации

## Контекст

Изолированное ядро AI-оркестратора. Все внешние сервисы (cron, settings, notifications) — отдельные микросервисы, доступные через nrpc. ms-agent — только agent loop engine.

## Файловая структура

```
ms-agent/
├── package.json
├── README.md
├── PLAN.md
└── src/
    ├── index.ts                    # AgentServiceImpl — главный класс сервиса
    ├── plugin.ts                   # createHttpBackend({ metadata, serviceImpl })
    ├── types.ts                    # Реэкспорт из g-agent + внутренние типы
    │
    ├── core/
    │   ├── loop.ts                 # AgentLoop — цикл LLM → tools → LLM
    │   ├── context.ts              # ContextBuilder — сборка system prompt
    │   └── types.ts                # AgentMessage, ToolCallRequest, LoopStreamEvent
    │
    ├── providers/
    │   ├── base.ts                 # LLMProvider interface, ProviderStreamEvent
    │   ├── registry.ts             # ProviderRegistry — auto-detection по keywords
    │   ├── claude.ts               # ClaudeProvider
    │   └── openai.ts               # OpenAIProvider
    │
    ├── tools/
    │   ├── base.ts                 # Tool interface + toolToFunctionDefinition()
    │   └── registry.ts             # ToolRegistry — регистрация + executeBatch()
    │
    ├── bootstrap/
    │   ├── loader.ts               # BootstrapLoader — чтение SOUL/USER/AGENTS.md
    │   └── defaults/
    │       ├── SOUL.md
    │       ├── USER.md
    │       └── AGENTS.md
    │
    ├── session/
    │   └── manager.ts              # SessionManager — CRUD, история, in-memory кеш
    │
    └── store/
        ├── index.ts                # StoresController extends StoreControllerAbstract
        ├── processing/
        │   ├── entities.ts         # KV ключи: LoopStateKey
        │   └── services.ts         # ProcessingStoreService
        └── history/
            ├── entities.ts         # SQL entities: SessionEntity, MessageEntity
            ├── services.ts         # HistoryStoreService
            └── migrations/
                ├── createSessions.ts
                ├── createMessages.ts
                └── index.ts
```

Плюс nrpc-интеграция:
```
tools/integration/types/agent.ts              # AgentService interface
tools/integration/generated/g-agent/          # Auto-generated (nrpc gen)
    ├── package.json
    └── src/index.ts                          # metadata, client factory
```

---

## Порядок реализации

### Фаза 0: nrpc-интерфейс

**Файл: `tools/integration/types/agent.ts`**

Определяет публичный контракт сервиса. nrpc генератор парсит его в `g-agent`.

```typescript
export enum AgentStreamEventType {
  TEXT_DELTA = "text_delta",
  TOOL_CALL_START = "tool_call_start",
  TOOL_CALL_RESULT = "tool_call_result",
  ITERATION = "iteration",
  COMPLETED = "completed",
  ERROR = "error",
}

export type AgentStreamEvent = {
  tokens?: number;
} & (
  | { type: AgentStreamEventType.TEXT_DELTA; content: string }
  | { type: AgentStreamEventType.TOOL_CALL_START; id: string; name: string; args: any }
  | { type: AgentStreamEventType.TOOL_CALL_RESULT; id: string; name: string; result: string }
  | { type: AgentStreamEventType.ITERATION; iteration: number; maxIterations: number }
  | { type: AgentStreamEventType.COMPLETED; finishReason: string; totalIterations: number }
  | { type: AgentStreamEventType.ERROR; message: string }
);

export interface SessionInfo {
  id: string;
  model: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface PaginationParams {
  offset: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

export interface TokenUsage {
  total: number;
  input: number;
  output: number;
}

export interface AgentService {
  createSession(model?: string): Promise<SessionInfo>;
  sendMessage(sessionId: string, content: string): AsyncIterable<AgentStreamEvent>;
  getSession(sessionId: string): Promise<SessionInfo>;
  listSessions(params: PaginationParams): Promise<PaginatedResult<SessionInfo>>;
  deleteSession(sessionId: string): Promise<void>;
  listTools(): Promise<ToolDefinition[]>;
  getStats(): Promise<{ sessions: number; messages: number; tokens: TokenUsage }>;
}
```

`sendMessage` возвращает `AsyncIterable` — nrpc сгенерирует `isAsyncIterable: true` в metadata, что автоматически даст SSE-стриминг через `streamLocalMethod`.

После создания файла — запустить `nrpc gen` для генерации `g-agent`.

### Фаза 1: Типы и базовые интерфейсы (нет зависимостей)

**`src/types.ts`** — реэкспорт из g-agent + AgentServiceConfig:

```typescript
export interface AgentServiceConfig {
  defaults: {
    model: string;          // default: "claude-sonnet-4-20250514"
    maxTokens: number;      // default: 4096
    temperature: number;    // default: 0.7
    maxIterations: number;  // default: 20
  };
  providers: {
    anthropic?: { apiKey: string; apiBase?: string };
    openai?: { apiKey: string; apiBase?: string };
  };
  bootstrap: { dir?: string };
  session: { maxHistoryMessages: number };  // default: 50
}
```

**`src/core/types.ts`** — внутренний формат сообщений (provider-agnostic):

```typescript
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface AgentMessage {
  role: MessageRole;
  content: string;
  toolCalls?: ToolCallRequest[];
  toolCallId?: string;
  name?: string;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  result: string;
  isError: boolean;
}
```

**`src/tools/base.ts`** — интерфейс инструмента:

```typescript
export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute(args: Record<string, unknown>): Promise<string>;
}
```

**`src/providers/base.ts`** — интерфейс LLM-провайдера:

```typescript
export type ProviderStreamEvent =
  | { type: "text_delta"; content: string }
  | { type: "tool_call_start"; id: string; name: string }
  | { type: "tool_call_delta"; id: string; argsJson: string }
  | { type: "tool_call_end"; id: string; name: string; args: Record<string, unknown> }
  | { type: "message_complete"; finishReason: string; usage: { input: number; output: number } }
  | { type: "error"; message: string };

export interface LLMProviderChatParams {
  messages: AgentMessage[];
  tools?: { name: string; description: string; parameters: any }[];
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface LLMProvider {
  name: string;
  chat(params: LLMProviderChatParams): AsyncGenerator<ProviderStreamEvent>;
}
```

### Фаза 2: Хранилища (зависит от back-core)

**SQL Schema — sessions:**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  messageCount INTEGER DEFAULT 0,
  totalTokensInput INTEGER DEFAULT 0,
  totalTokensOutput INTEGER DEFAULT 0
);
```

**SQL Schema — messages:**
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT DEFAULT '',
  toolCalls TEXT DEFAULT '',      -- JSON
  toolCallId TEXT DEFAULT '',
  tokenUsage INTEGER DEFAULT 0,
  createdAt INTEGER NOT NULL
);
```

**StoresController** — singleton, два хранилища:
- `history` (SQL) — сессии и сообщения
- `processing` (KV/LMDB) — hot state (loop state per session)

Паттерн: по аналогии с `ms-dag/src/controller.ts` — `static getInstance()` с deferred init.

**HistoryStoreService** — обёртки над repositories + custom query `getSessionMessages(sessionId, limit)` через raw Kysely (BaseRepositorySQL.findAll не поддерживает WHERE filter).

**ProcessingStoreService** — три метода:
- `saveLoopState(sessionId, state)` — сохранить состояние цикла
- `getLoopState(sessionId)` — получить (для crash recovery)
- `deleteLoopState(sessionId)` — очистить после завершения

### Фаза 3: Реестры (зависит от Фазы 1)

**ToolRegistry:**
- `Map<string, Tool>`
- `register(tool)`, `unregister(name)`, `get(name)`, `list()`
- `getFunctionDefinitions()` — массив для LLM function calling
- `executeBatch(calls)` — параллельное выполнение через `Promise.all`
- `execute(call)` — try/catch, ошибки возвращаются как строки (не бросаются)

**ClaudeProvider:**
- Singleton `Anthropic` клиент
- `chat()` — `AsyncGenerator<ProviderStreamEvent>`
- Конвертация `AgentMessage[]` → `Anthropic.MessageParam[]`
- Стриминг: обработка `content_block_start`, `content_block_delta` (text_delta + input_json_delta), `content_block_stop`, `message_delta`, `message_stop`
- Аккумуляция partial JSON для tool_calls по content block index
- system prompt передаётся отдельным полем (не в messages)

**OpenAIProvider:**
- Аналогичная структура
- tool_calls через `delta.tool_calls` в стриме
- tool results как `role: "tool"` с `tool_call_id`

**ProviderRegistry:**
- `ProviderSpec[]` — name, keywords, factory
- `getProviderForModel(modelName)` — auto-detection по keywords в имени модели
- Lazy creation — провайдер создаётся при первом обращении

```typescript
const SPECS = [
  { name: "anthropic", keywords: ["claude", "anthropic"], factory: (k) => new ClaudeProvider(k) },
  { name: "openai", keywords: ["gpt", "openai", "o1", "o3"], factory: (k) => new OpenAIProvider(k) },
];
```

### Фаза 4: Session + Bootstrap (зависит от Фазы 2)

**BootstrapLoader:**
- Читает SOUL.md, USER.md, AGENTS.md из указанной директории
- Fallback на defaults/ если custom файлы отсутствуют
- Кеширует после первого чтения, `reload()` для сброса

**SessionManager:**
- `createSession(model)` — генерирует UUID, пишет в SQL
- `getSession(id)`, `listSessions(offset, limit)`, `deleteSession(id)`
- `getHistory(sessionId, maxMessages)` — из in-memory кеша или SQL
- `appendMessage(sessionId, message, tokenUsage)` — в SQL + кеш
- `updateTokenUsage(sessionId, input, output)` — аккумуляция токенов

In-memory кеш `Map<sessionId, AgentMessage[]>` для активных сессий.

### Фаза 5: Ядро (зависит от 2, 3, 4)

**ContextBuilder:**
- `buildSystemPrompt()` — собирает из SOUL + USER + AGENTS (разделитель `\n\n---\n\n`)
- `buildMessages(sessionId, userMessage)` — история из SessionManager + новое сообщение
- Post-MVP: сюда добавятся memory (long-term + daily + vec) и skills

**AgentLoop — сердце системы:**

```
async *run(sessionId, userMessage, config): AsyncGenerator<LoopStreamEvent>
  1. Получить provider по config.model
  2. Собрать systemPrompt из ContextBuilder
  3. Собрать messages из ContextBuilder (история + user message)
  4. Сохранить user message в SessionManager
  5. Сохранить loop state в KV (status: running)

  ЦИКЛ (iteration < maxIterations):
    6. yield { type: "iteration", iteration, maxIterations }
    7. Вызвать provider.chat(messages, tools, systemPrompt, ...)
    8. Стримить ProviderStreamEvent:
       - text_delta → yield наружу
       - tool_call_start/delta/end → аккумулировать toolCalls
       - message_complete → сохранить usage
       - error → yield error, return
    9. Собрать assistantMessage из текста + toolCalls
    10. Сохранить assistantMessage в SessionManager
    11. Если toolCalls пусто → break (цикл завершён)
    12. Выполнить ToolRegistry.executeBatch(toolCalls)
    13. Для каждого результата:
        - yield { type: "tool_call_result", ... }
        - Добавить tool message в messages
        - Сохранить в SessionManager
    14. Обновить loop state в KV
    → вернуться к шагу 6

  15. Обновить token usage в сессии
  16. yield { type: "completed", finishReason, totalIterations }
  17. Удалить loop state из KV (finally блок)
```

### Фаза 6: Сервис + Plugin (зависит от всего)

**AgentServiceImpl:**
- Constructor: принимает `Partial<AgentServiceConfig>`, мержит с defaults и env vars
- `init()` — создаёт StoresController, ProviderRegistry, ToolRegistry, BootstrapLoader, SessionManager, ContextBuilder, AgentLoop
- `ensureInit()` — guard на всех публичных методах
- Методы маппят LoopStreamEvent → AgentStreamEvent

Env vars:
- `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY`
- `OPENAI_API_KEY`
- `AGENT_MODEL` (default: `claude-sonnet-4-20250514`)
- `DATA_DIR` (default: `./data`)

**Plugin:**
```typescript
export default (config?: Partial<AgentServiceConfig>) => {
  const serviceImpl = new AgentServiceImpl(config);
  return createHttpBackend({ metadata, serviceImpl });
};
```

**package.json:**
```json
{
  "name": "ms-agent",
  "private": true,
  "type": "module",
  "exports": { "./plugin": "./src/plugin.ts" },
  "dependencies": {
    "back-core": "workspace:*",
    "nrpc": "workspace:*",
    "g-agent": "workspace:*",
    "@anthropic-ai/sdk": "latest",
    "openai": "latest"
  }
}
```

---

## Цепочка стриминга

```
AgentLoop.run()           → AsyncGenerator<LoopStreamEvent>
  ↓
AgentServiceImpl.sendMessage() → AsyncIterable<AgentStreamEvent>
  ↓
nrpc streamLocalMethod()  → ReadableStream (SSE: "data: JSON\n\n")
  ↓
HTTP Response: Content-Type: text/event-stream
```

---

## Что отложено на post-MVP

- Subagents (spawn tool + SubagentManager)
- Vector memory (vec store + embeddings)
- Daily memory (YYYY-MM-DD.md)
- Long-term memory (MEMORY.md)
- Skill system (progressive loading)
- Message bus (прямые вызовы в MVP)
- Встроенные tools (exec, web, files) — в MVP tools регистрируются извне через config
- Concurrent session lock (проверка что loop уже не запущен для сессии)
- Tool timeout (Promise.race с таймаутом)
- Token counting и smart truncation истории

---

## Верификация

1. Создать `g-agent` через nrpc gen
2. `bun run dev` — сервис стартует без ошибок
3. `POST /services/agent/createSession` — создаёт сессию
4. `POST /services/agent/sendMessage/stream` — получает SSE поток с text_delta событиями
5. Регистрация тестового tool → sendMessage вызывает tool → получаем tool_call_start + tool_call_result + финальный text_delta
6. `GET /services/agent/listSessions` — видим созданные сессии
7. `GET /services/agent/getStats` — счётчики не нулевые
