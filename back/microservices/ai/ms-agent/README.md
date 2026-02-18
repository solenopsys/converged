# ms-agent — Микросервис AI-оркестратора

Автономный AI-агент с итеративным выполнением инструментов, мульти-провайдерной поддержкой LLM и персистентной памятью.

## Архитектура

```
ms-agent/
├── src/
│   ├── index.ts
│   ├── plugin.ts                  # nrpc backend export
│   ├── agent-service.ts           # AgentServiceImpl — API-фасад
│   │
│   ├── core/
│   │   ├── loop.ts                # AgentLoop — цикл LLM → tools → LLM
│   │   ├── context.ts             # ContextBuilder — сборка system prompt из bootstrap + memory + skills
│   │   ├── subagent.ts            # SubagentManager — spawn/track фоновых агентов
│   │   └── types.ts               # InboundMessage, OutboundMessage, StreamEvent
│   │
│   ├── providers/
│   │   ├── base.ts                # LLMProvider interface
│   │   ├── registry.ts            # ProviderRegistry — auto-detection, prefixing, per-model overrides
│   │   ├── claude.ts              # Anthropic Claude
│   │   └── openai.ts              # OpenAI
│   │
│   ├── tools/
│   │   ├── base.ts                # Tool interface
│   │   ├── registry.ts            # ToolRegistry — динамическая регистрация
│   │   ├── shell.ts               # exec (с защитой от опасных команд)
│   │   ├── web.ts                 # web_search, web_fetch
│   │   ├── files.ts               # read, write, edit, list
│   │   └── spawn.ts               # spawn subagent
│   │
│   ├── skills/
│   │   ├── loader.ts              # Markdown-скиллы, progressive loading
│   │   └── types.ts               # SkillDefinition, SkillMetadata
│   │
│   ├── memory/
│   │   ├── long-term.ts           # Факты, предпочтения, паттерны
│   │   ├── daily.ts               # Дневные заметки (YYYY-MM-DD.md), временное окно
│   │   ├── vec-store.ts           # Семантический поиск через embeddings
│   │   └── types.ts
│   │
│   ├── bootstrap/
│   │   ├── loader.ts              # Загрузка и валидация bootstrap-файлов
│   │   └── defaults/              # Дефолтные bootstrap-файлы
│   │       ├── SOUL.md            # Личность агента — тон, стиль, ценности
│   │       ├── USER.md            # Профиль пользователя — предпочтения, контекст
│   │       └── AGENTS.md          # Инструкции агенту — правила поведения, ограничения
│   │
│   ├── session/
│   │   ├── manager.ts             # SessionManager — CRUD, история, кеширование
│   │   └── types.ts               # Session, SessionKey, SessionMetadata
│   │
│   ├── bus/
│   │   ├── events.ts              # Типы событий
│   │   └── queue.ts               # Async message queue
│   │
│   └── store/
│       ├── index.ts               # StoresController
│       ├── processing/            # KV (LMDB) — runtime state
│       │   ├── entities.ts        #   контексты, сообщения, tool results
│       │   └── services.ts
│       ├── history/               # SQL — история сессий
│       │   ├── entities.ts        #   conversations, messages, token usage
│       │   ├── services.ts
│       │   └── migrations/
│       └── vectors/               # Vec — embeddings
│           ├── entities.ts
│           └── services.ts
```

## Ключевые концепции

### Tools, Skills, Subagents — в чём разница

Три уровня возможностей агента, каждый со своей ролью:

**Tools — руки агента.** Атомарные действия. Одна функция = один результат. LLM вызывает их напрямую через function calling.
- `exec("ls -la")` → вывод директории
- `read_file("config.json")` → содержимое файла
- `web_search("bun sqlite")` → результаты поиска

**Skills — знания агента.** Markdown-инструкции, которые объясняют агенту *как* решать определённый класс задач. Не выполняются — читаются. Становятся частью system prompt.
- `github.md` — "используй `gh pr create`, формат коммитов такой-то"
- `deploy.md` — "деплой через podman, сначала проверь конфиг"
- `code-review.md` — "обращай внимание на безопасность, проверяй типы"

**Subagents — клоны агента на подзадачи.** Фоновые экземпляры agent loop. Главный агент порождает их через tool `spawn` когда задача параллельная или долгая. Subagent получает свой промпт, урезанный набор tools (без spawn, без messaging — защита от рекурсии), работает независимо, возвращает результат через bus.
- Главный: "Нужно проанализировать 3 репозитория" → spawn 3 subagents, каждый работает параллельно

| | Что это | Кто вызывает | Результат |
|---|---|---|---|
| **Tool** | Функция | LLM через function calling | Строка с результатом |
| **Skill** | Markdown-инструкция | ContextBuilder при сборке промпта | Часть system prompt |
| **Subagent** | Отдельный agent loop | Главный агент через tool `spawn` | Сообщение в bus по завершении |

### Bootstrap-файлы — персонализация агента

Агент без контекста — пустой. Bootstrap-файлы определяют *кто* он и *как* себя ведёт:

**SOUL.md** — личность агента. Тон общения, стиль ответов, ценности, ограничения. Определяет *характер*.
```markdown
# Soul
Ты — технический ассистент. Отвечай кратко и по делу.
Не используй эмодзи. Приоритет — точность над вежливостью.
```

**USER.md** — профиль пользователя. Предпочтения, стек технологий, контекст работы. Определяет *для кого* агент работает.
```markdown
# User
Стек: Bun, TypeScript, React, Elysia.
Проект: converged-portal — микросервисная платформа.
Предпочитает минимализм, не любит overengineering.
```

**AGENTS.md** — инструкции поведения. Правила работы с tools, ограничения, стратегии решения задач. Определяет *как* агент действует.
```markdown
# Agents
- Всегда читай файл перед редактированием
- Не создавай файлы без необходимости
- Используй exec с осторожностью
```

ContextBuilder собирает system prompt из: bootstrap-файлы → memory (long-term + daily + vec) → skills (progressive) → session history.

Bootstrap-файлы хранятся per-agent. Разные агенты (или subagents) могут иметь разные bootstrap-наборы.

### Session Manager

Управление сессиями разговоров. Сессия — это один непрерывный диалог с агентом.

```typescript
interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;  // модель, источник, пользователь
  messages: Message[];
}
```

- Персистентность в SQL (history store) — сообщения, токены, метаданные
- In-memory кеш активных сессий для быстрого доступа
- `getHistory(maxMessages)` — последние N сообщений для контекстного окна LLM
- Ключ сессии: произвольный (фронтенд генерирует при создании чата)

Session Manager — прослойка между AgentLoop и History Store. Loop работает с сессией в памяти, Manager синхронизирует с SQL.

### Agent Loop

Итеративный цикл: получить сообщение → собрать контекст → вызвать LLM → выполнить tools → вернуть результаты → повторить до финального ответа.

```
InboundMessage → Bus.queue
                    ↓
              AgentLoop.run()
              ┌─────────────────────────────┐
              │ ContextBuilder              │
              │   ├ skills (progressive)    │
              │   ├ memory (long-term + vec)│
              │   └ session history         │
              │         ↓                   │
              │   LLM call (via Provider)   │
              │         ↓                   │
              │   tool_calls? ──YES──→ ToolRegistry.execute()
              │       │                     │        ↓
              │       NO            results → KV store
              │       ↓                     │        ↓
              │   response                  │   loop back to LLM
              └─────────────────────────────┘
                    ↓
              OutboundMessage → Bus.queue
                    ↓
              History → SQL
              Memory  → Vec + long-term
```

Максимум итераций на запрос: настраивается (по умолчанию 20). Каждый tool call result сохраняется в KV перед повторным входом в цикл — это даёт восстановление после падения.

### Три слоя хранения

| Хранилище | Движок | Назначение | Данные |
|-----------|--------|------------|--------|
| **Processing** | KV (LMDB) | Горячее runtime-состояние | Активные контексты, in-flight сообщения, промежуточные tool results |
| **History** | SQL (Kysely + SQLite) | Холодное персистентное состояние | Разговоры, сообщения, расход токенов, статистика |
| **Vectors** | Vec store | Семантическая память | Embeddings для контекстно-зависимого поиска |

Каждое хранилище независимо. Нет перекрёстных зависимостей между ними.

### Tool Registry

Динамическая регистрация инструментов. Каждый tool реализует:

```typescript
interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute(args: Record<string, unknown>): Promise<string>;
}
```

Tools автоматически генерируют OpenAI-совместимые function definitions для LLM-вызовов. Registry валидирует параметры перед выполнением.

Встроенные tools: `exec`, `read_file`, `write_file`, `edit_file`, `list_dir`, `web_search`, `web_fetch`, `spawn`.

### Provider Registry

Единый интерфейс над несколькими LLM-провайдерами:

```typescript
interface LLMProvider {
  chat(params: {
    messages: Message[];
    tools?: ToolDefinition[];
    model: string;
    maxTokens: number;
    temperature: number;
  }): AsyncGenerator<StreamEvent>;
}
```

Реестр провайдеров — единый источник правды. Каждый провайдер описан декларативно:

```typescript
interface ProviderSpec {
  name: string;
  keywords: string[];           // ["claude", "anthropic"] — auto-detection по имени модели
  envVar: string;               // имя env-переменной для API key
  prefix?: string;              // авто-префикс модели (e.g. "dashscope/qwen-max")
  skipPrefix?: string[];        // модели, которые не нужно префиксить
  modelOverrides?: Record<string, {  // per-model параметры
    minTemperature?: number;         // e.g. Kimi K2.5 требует temp >= 1.0
    maxTokens?: number;
  }>;
  isGateway?: boolean;          // мульти-модельные роутеры (OpenRouter, etc.)
  isLocal?: boolean;            // локальные серверы (vLLM, Ollama)
  defaultApiBase?: string;
}
```

Добавление нового провайдера = одна запись `ProviderSpec` в реестре. Всё остальное (env setup, model routing, status display) выводится автоматически. Нет if-elif цепочек.

### Skill System

Скиллы — markdown-файлы с опциональным YAML frontmatter:

```markdown
---
name: github
description: Операции с GitHub
requires: [gh]
---

# GitHub Skill

Инструкции для агента...
```

Progressive loading: core-скиллы всегда в контексте, остальные показаны как summary. Агент загружает полное содержимое скилла по требованию через `read_file`.

### Memory

Три слоя:
- **Long-term** — явные факты, предпочтения пользователя, выученные паттерны. Персистентный markdown-файл (`MEMORY.md`), всегда включён в контекст.
- **Daily** — дневные заметки в формате `YYYY-MM-DD.md`. Агент дописывает в них в течение дня. `getRecentMemories(days)` возвращает записи за последние N дней — скользящее временное окно. Включаются в контекст как "недавние события".
- **Vector** — семантическая память. Embeddings прошлых взаимодействий и знаний. Извлекаются по similarity к текущему запросу, инжектятся в контекст.

Порядок включения в system prompt: long-term (всегда) → daily (последние дни) → vector (по релевантности к запросу).

### Message Bus

Async-очередь, развязывающая входящие источники от ядра агента. Обеспечивает:
- Несколько источников ввода без изменения loop
- Результаты subagents возвращаются как системные сообщения
- Обработку backpressure

## API

```typescript
interface AgentService {
  // Сессии
  createSession(params: { model?: string }): { sessionId: string };
  sendMessage(params: { sessionId: string; content: string }): AsyncGenerator<StreamEvent>;
  getSession(sessionId: string): SessionInfo;
  listSessions(params: Pagination): SessionList;
  deleteSession(sessionId: string): void;

  // Память
  getMemory(): MemoryState;
  updateMemory(params: { facts: string[] }): void;
  searchMemory(params: { query: string; limit?: number }): MemoryResult[];

  // Скиллы
  listSkills(): SkillSummary[];
  getSkill(name: string): SkillDefinition;

  // Инструменты
  listTools(): ToolDefinition[];

  // Статистика
  getStats(): { sessions: number; messages: number; tokens: TokenUsage };
}
```

## Связь с другими сервисами

- **ms-assistant** — простой чат с LLM. Нет agent loop, нет tools. ms-agent заменяет его для агентных сценариев.
- **ms-dag** — декларативная оркестрация workflow с durability. Другой уровень абстракции. ms-agent реактивный (LLM решает следующий шаг), ms-dag декларативный (граф определяет поток). Они не зависят друг от друга.

## Конфигурация

```typescript
type AgentServiceConfig = {
  defaults: {
    model: string;
    maxTokens: number;
    temperature: number;
    maxIterations: number;
  };
  providers: Record<string, {
    apiKey: string;
    apiBase?: string;
  }>;
  tools: {
    exec: { timeout: number };
    web: { searchApiKey?: string };
    restrictToWorkspace: boolean;
  };
  skills: {
    dir: string;
    alwaysLoad: string[];
  };
  memory: {
    longTermPath: string;
    dailyDir: string;
    dailyWindowDays: number;      // сколько дней daily-памяти включать в контекст
    vecStorePath: string;
  };
  bootstrap: {
    dir: string;                  // директория с SOUL.md, USER.md, AGENTS.md
  };
  session: {
    maxHistoryMessages: number;   // лимит сообщений для контекстного окна LLM
  };
};
```
