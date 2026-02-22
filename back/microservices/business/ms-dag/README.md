# ms-dag — Движок исполнения воркфлоу

## Концепция

Воркфлоу пишется как обычный TypeScript-класс. Логика DAG выражена кодом, не JSON-конфигом.

Система разделена на два независимых слоя:

- **Workflow** — структура управления. Определяет порядок вызовов узлов, кэширует результаты, управляет идемпотентностью.
- **NodeProcessor** — исполнитель узлов. Инкапсулирует все проблемы внешних взаимодействий: таймауты, ошибки, состояния. Ничего не знает про воркфлоу и контексты.

Такое разделение даёт устойчивость: воркфлоу видит только `result | error`, а весь хаос внешних вызовов остаётся внутри процессора.

## Структура

```
src/
  workflow.ts        — базовый класс Workflow + интерфейс WorkflowContext
  node-processor.ts  — NodeProcessor + интерфейс NodeProcessorStore
  dag-api.ts         — интерфейсы INode, Provider, ProviderState
  plugin.ts          — HTTP backend (nrpc)
  index.ts           — публичные экспорты
  store/
    processing/      — KV: состояние воркфлоу + persistent данные узлов
    stats/           — SQL: состояния и аналитика выполнения узлов
  tools/             — утилиты: JSONPath, шаблонизатор, хэши
```

## Слой 1 — Workflow (управление)

```typescript
interface WorkflowContext {
  getStep(id: string, key: string): any;
  setStep(id: string, key: string, value: any): void;
  setStatus(id: string, status: WorkflowStatus): void;
}

abstract class Workflow {
  readonly id: string;
  constructor(ctx: WorkflowContext, id?: string)

  // Идемпотентный вызов узла — результат кэшируется в KV
  // Если узел уже выполнен — execute() не вызывается, берётся из KV
  protected async invoke<T>(key: string, fn: () => Promise<T>): Promise<T>

  // Запуск воркфлоу: running -> done | failed
  async start(params: any): Promise<void>

  abstract execute(params: any): Promise<void>
}
```

`invoke()` — вся идемпотентность. Ключ — имя узла, уникальное в рамках воркфлоу. При рестарте уже завершённые узлы не вызываются повторно.

## Слой 2 — NodeProcessor (исполнение)

Тупой исполнитель — как молоток. Его задача: получить вызов, выполнить узел, вернуть результат или ошибку. Не знает ни про воркфлоу, ни про контексты, ни про кэш.

- При старте сбрасывает все зависшие записи (`start → err`) — он единственный исполнитель и только что запустился
- Все узлы уже инициализированы провайдерами — процессор об этом не знает
- Получает код узла в формате `workflowName:nodeCodeName`

```typescript
interface NodeProcessorStore {
  create(record: ...): Promise<void>;
  setState(id: string, state: NodeState, result?: any, error?: string): Promise<void>;
  resetStale(): Promise<void>;
}

class NodeProcessor {
  async init(nodes: Map<string, INode>): Promise<void>
  async run(id: string, code: string, data: any): Promise<any>
}
```

Состояние одного вызова узла:

| Поле | Описание |
|------|---------|
| `id` | uuid |
| `code` | `workflowName:nodeCodeName` |
| `state` | `new → start → end \| err` |
| `data` | входные данные (`inputData`) |
| `result` | результат (`outputData`) |

## Узлы и провайдеры

**INode** — единица логики:
```typescript
interface INode {
  name: string;
  execute(params: any): Promise<any>;
}
```

**Provider** — внешний сервис с жизненным циклом:
```typescript
interface Provider {
  start(): Promise<void>;
  stop(): Promise<void>;
}
```

Провайдеры инжектируются в узлы ядром до старта. Узел получает готовый провайдер и просто использует его.

## Хранилища

### KV — `store/processing/`

Состояние воркфлоу. Используется через `WorkflowContext`.

| Ключ | Что хранит |
|------|-----------|
| `{workflowId}:{nodeName}` | Результат выполнения узла (кэш `invoke`) |
| `{workflowId}:__status__` | Статус воркфлоу: `running \| done \| failed` |

Сущности:
- **context** — мета воркфлоу (время создания, входные параметры)
- **persistent** — долгоживущие данные узлов между запусками

### SQL — `store/stats/`

Состояние и аналитика исполнения узлов. Реализует `NodeProcessorStore`.

| Таблица | Что хранит |
|---------|-----------|
| `process` | Запуск воркфлоу: статус, время начала/конца, мета |
| `nodes` | Вызов узла: `state`, ошибка, retry, timestamps |

SQL — единственное место где видно что происходит внутри каждого вызова узла.

## Пример воркфлоу

```typescript
export class PlacesWorkflow extends Workflow {
  private geoQuery = new GeoQueryNode();
  private placesSearch = new PlacesSearchNode();
  private placesSave = new PlacesSaveNode();

  constructor(ctx: WorkflowContext, id?: string) {
    super(ctx, id);
    this.geoQuery.provider = Providers.geo;
    this.placesSearch.provider = Providers.googlePlaces;
    this.placesSave.provider = Providers.places;
  }

  async execute(params: { geoId: string }) {
    const geo = await this.invoke("get-geo", () =>
      this.geoQuery.execute({ id: params.geoId })
    );
    if (!geo?.query) return;

    const search = await this.invoke("search-places", () =>
      this.placesSearch.execute({ query: geo.query })
    );

    await this.invoke("save-places", () =>
      this.placesSave.execute({ searchResult: search.searchResult })
    );
  }
}
```
