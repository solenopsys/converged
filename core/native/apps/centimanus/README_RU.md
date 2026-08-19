# Centimanus: workflow runtime

`centimanus` - нативный runtime на Zig для исполнения workflow-сценариев в
QuickJS. Его задача - выполнять только orchestration/flow: последовательность
шагов, ветвления, циклы и вызовы инструментов. Бизнес-логика остается во
внешних микросервисах, исходный код workflow загружается из сервиса `scripts`,
а состояние хранится в памяти процесса либо в Valkey.

Это не универсальный JavaScript-сервер и не полноценный планировщик DAG.
Workflow исполняется синхронно, по одному memoized-узлу за одну изолированную
QuickJS evaluation.

Это каноническая документация Centimanus. Английский `README.md` намеренно
содержит только ссылку на этот файл, чтобы две версии не расходились.

## Содержание

- [Общая схема](#общая-схема)
- [Роль в системе и транспорт](#роль-в-системе-и-транспорт)
- [Состав проекта](#состав-проекта)
- [Точки входа](#точки-входа)
- [Как устроен DAG](#как-устроен-dag)
- [Gate и LLM hub](#gate-и-llm-hub)
- [Как устроен QuickJS-процессор](#как-устроен-quickjs-процессор)
- [Состояние и область видимости](#состояние-и-область-видимости)
- [Внешние вызовы](#внешние-вызовы)
- [Параллелизм и модель памяти](#параллелизм-и-модель-памяти)
- [Конфигурация](#конфигурация)
- [Сборка и тесты](#сборка-и-тесты)
- [Фактические ограничения](#фактические-ограничения)

## Общая схема

```text
                              +-----------------------+
POST /run ------------------->|                       |
Fujin chat.message ---------->|  Engine (engine.zig)  |
Scheduler timer ------------->|                       |
                              +-----------+-----------+
                                          |
                              scripts.readScript(path)
                                          |
                                          v
                              +-----------------------+
                              | VM loop (vm.zig)      |
                              | prelude + workflow    |
                              | одна node/evaluation  |
                              +-----------+-----------+
                                          |
                              C ABI: libqjs.so
                                          |
                                          v
                              +-----------------------+
                              | новый QuickJS runtime |
                              | и context на каждый   |
                              | шаг                   |
                              +-----------+-----------+
                                          |
                                globalThis.__host(JSON)
                                          |
                 +------------------------+------------------------+
                 |                        |                        |
              rt.call                 rt.get/set                 rt.llm
                 |                        |                        |
          SERVICES_BASE              memory/Valkey          provider Hub
          /service/method                                  /      |      \
                                                       OpenAI  Claude  Gemini
```

Главное разделение ответственности:

| Слой | Ответственность |
|---|---|
| Workflow JS | порядок действий, ветвления, циклы, имена узлов |
| `prelude.js` | API `rt`, memoization узлов, сигнал `yielded/done/failed` |
| `vm.zig` | цикл шагов, мост JS -> Zig, транспортный интерфейс |
| `engine.zig` | production wiring, загрузка скрипта, scope, execution ID, DAG telemetry |
| `state.zig` | непрозрачный key/value storage в memory или Valkey |
| `llm/*` | единый LLM-контракт и адаптеры wire-протоколов провайдеров |
| `wrapers/qjs` | изолированная QuickJS evaluation через компактный C ABI |

## Роль в системе и транспорт

Centimanus - исполняемый слой workflow, а не микросервис с предметной
логикой, не хранилище и не брокер сообщений. Он получает повод запустить
сценарий, загружает его, выполняет flow и связывает внешние системы через
`rt.call`, state и `rt.llm`. В общей архитектуре его роль описана кратко в
[`docs/architect/centimanus.md`](../../../../docs/architect/centimanus.md).

### Входы

- **Fujin:** процесс подключается к Fujin как `transport.Service` с логическим
  target `centimanus`. Сейчас он обслуживает только `chat.message`: обязательный
  `scope` из доверенного envelope передается в execution, а результат
  возвращается событием `chat.result` с тем же `requestId`.
- **HTTP:** `GET /healthz` и `POST /run` существуют для локального и
  операционного запуска. У `POST /run` нет аутентификации и scope, поэтому его
  нельзя выставлять наружу; доступ должен ограничиваться сетью или reverse
  proxy.
- **Scheduler:** при `RT_SCHEDULER=on` runtime периодически читает готовые
  интервалы из `sheduller.schedule()` и запускает указанные сценарии.

### Исходящие связи и текущее состояние миграции

Fujin используется для входного chat-gate, но внутренние вызовы Centimanus
пока не переведены на единый кластерный transport. Текущий `engine.zig`
обращается по HTTP через `SERVICES_BASE` к `scripts`, `dag`, `sheduller` и
методам `rt.call`; при scoped запуске он передает scope заголовком. State
напрямую использует memory/Valkey, а LLM hub вызывает API провайдеров по HTTPS.

Следовательно, Centimanus является частью системы, но пока исключением из
целевой схемы, где межсервисные сообщения идут через Fujin. Этот факт важен
для эксплуатации: адресацию и права внутренних HTTP-вызовов сейчас не следует
приписывать Fujin. Их перевод на общий transport - отдельная миграционная
задача; данный runtime не должен создавать новый собственный RPC-протокол.

## Состав проекта

| Файл/каталог | Назначение |
|---|---|
| `src/main.zig` | bootstrap процесса, HTTP server, Fujin thread, scheduler thread |
| `src/engine.zig` | фасад запуска workflow и production-реализация `vm.Transport` |
| `src/vm.zig` | транспортно-независимое ядро step-driven DAG |
| `src/prelude.js` | JS runtime API: `rt.call/get/set/log/llm/node/attempt` |
| `src/qjs.zig` | Zig binding к `libqjs.so` |
| `src/state.zig` | memory/Valkey backend |
| `src/mscall.zig` | NRPC-подобный HTTP POST к микросервисам |
| `src/llm/` | LLM hub, общий контракт и адаптеры OpenAI/Claude/Gemini |
| `src/signal_provider.zig` | входной Fujin chat-gate |
| `src/cron.zig` | периодический launcher по формализованному расписанию |
| `src/testlib.zig` | C ABI mock runtime для Bun FFI-тестов |
| `examples/workflows/` | примеры flow-only workflow |
| `test/bun/` | интеграционные тесты реального VM core с mock transport |
| `build.zig` | сборка executable, mock library и QuickJS wrapper |

QuickJS wrapper находится рядом, вне этого каталога:
`../wrapers/qjs`. В него vendored `quickjs-ng` версии `0.15.1`.

## Точки входа

### HTTP

Процесс поднимает минимальный HTTP/1.1 server:

```text
GET  /healthz
POST /run  { "script": "wf-demo.js", "params": { ... } }
```

`POST /run` передает путь скрипта и параметры в `Engine.runWorkflow`. Сам
исходник в запросе не принимается: engine вызывает
`scripts.readScript({path})` через `SERVICES_BASE`.

Успешный ответ:

```json
{
  "executionId": "exec-...",
  "ok": true,
  "result": {}
}
```

Ошибка workflow возвращается как HTTP 500 с `ok: false`; отсутствующий скрипт
дает HTTP 404. HTTP server обрабатывает соединения последовательно в основном
цикле.

### Fujin chat-gate

В отдельном thread работает Fujin client. `signal_provider.zig` принимает
только команду `chat.message`, требует непустой `scope`, преобразует payload в
параметры и запускает фиксированный workflow `wf-browser-chat-turn.js`.

```text
Fujin command
  scope + {name:"chat.message", requestId, payload}
    -> buildParams(payload)
    -> Engine.runWorkflowScoped(scope, "wf-browser-chat-turn.js", params)
    -> {type:"event", name:"chat.result", requestId, payload:<LLM result>}
```

Здесь есть defaults входного протокола: `provider=openai`,
`model=gpt-5.4-nano`, `maxTokens=4096`. Это defaults именно chat-gate, а не
LLM hub и не `rt.llm`.

### Scheduler

При `RT_SCHEDULER=on` запускается еще один thread. Раз в 30 секунд он получает
`sheduller.schedule()` и ожидает уже формализованный список:

```json
{
  "items": [
    {"script": "wf.js", "params": {}, "periodMs": 300000}
  ]
}
```

Cron expressions, timezone, pause/resume в Centimanus не разбираются. Runtime
делает tick раз в секунду и синхронно вызывает workflow при наступлении
`next_due`. После каждого refresh все `next_due` вычисляются заново как
`now + periodMs`.

## Как устроен DAG

### DAG является исполняемым потоком

В проекте нет структуры `Graph`, списка ребер или предварительной топологической
сортировки. Граф задается обычным JavaScript-кодом:

```js
rt.workflow = function (params) {
  var lead = rt.node("find-lead", function () {
    return rt.call("sales", "findLead", { lang: params.lang });
  });

  if (!lead) return { skipped: true };

  var sent = rt.node("send", function () {
    return rt.call("smtp", "send", { to: lead.email });
  });

  return { id: sent.id };
};
```

Фактический путь по графу определяется результатами предыдущих узлов. Поэтому
ветка `send` вообще не появляется в исполнении, если `lead` пустой.

### Один узел за одну evaluation

`vm.run` формирует один текст программы:

```text
globalThis.__execId = <execution ID>;
globalThis.__params = <params JSON>;
<prelude.js>
<workflow source>
__step();
```

Далее до 100 000 раз выполняется следующий цикл:

1. Создается/очищается arena текущего шага.
2. В новом QuickJS runtime заново исполняется весь текст программы.
3. Уже завершенные `rt.node` читаются из state store и мгновенно replay-ятся.
4. Первый еще не выполненный узел исполняет callback.
5. Результат или ошибка узла сохраняются в state store.
6. Prelude бросает специальный объект `YIELD`, разматывая JS stack.
7. `__step()` преобразует его в `{"status":"yielded"}`.
8. Zig начинает следующую evaluation с начала workflow.
9. Когда новых узлов не осталось, workflow возвращает значение и сигнал
   становится `{"status":"done","result":...}`.

Это можно представить так:

```text
evaluation 1: find-lead EXECUTE -> persist -> yielded
evaluation 2: find-lead REPLAY  -> send EXECUTE -> persist -> yielded
evaluation 3: find-lead REPLAY  -> send REPLAY  -> done
```

### Memoization и ключи

Prelude строит ключ результата узла так:

```text
rt:task:<executionId>:<nodeName>
```

Значение - один из JSON-объектов:

```json
{"ok": true, "value": {}}
```

```json
{"ok": false, "error": "message"}
```

Имя узла является его идентичностью внутри execution. Повторный вызов
`rt.node("x", ...)` с тем же именем вернет первый сохраненный результат и не
выполнит новый callback. Поэтому имена в циклах должны включать номер итерации,
а в tool loop - номер round/tool.

### `rt.node` и `rt.attempt`

- `rt.node(name, fn)` replay-ит успешное значение, но при сохраненной ошибке
  бросает `Error` и завершает весь workflow как `failed`.
- `rt.attempt(name, fn)` возвращает `{ok,value}` либо `{ok,error}` и позволяет
  workflow обработать ошибку самостоятельно.

При первом выполнении ошибка callback также memoize-ится и вызывает yield.
Разница проявляется на следующем replay: `node` пробросит сохраненную ошибку,
а `attempt` отдаст ее как значение.

### Что должно находиться внутри узла

Все внешние side effects необходимо оборачивать в `rt.node`/`rt.attempt`:

```js
var result = rt.node("charge", function () {
  return rt.call("billing", "charge", params);
});
```

Код вне узла выполняется заново на каждой evaluation. Это относится и к
`rt.call`, `rt.llm`, `rt.set`, логированию и мутациям внешнего состояния.
Локальные вычисления допустимы, если они детерминированы относительно params и
replayed результатов.

### Учет execution в DAG-сервисе

`engine.zig` отправляет best-effort telemetry в сервис `dag`:

```text
openExecution
  -> createTask + setTaskDone/setTaskFailed для yielded node
  -> setExecutionStatus(done|failed)
```

Ошибки telemetry игнорируются и не меняют результат workflow. Это слой
наблюдаемости, а не источник состояния VM: memoization работает через
`StateStore`.

В текущем коде есть несоответствие контракта: `vm.zig` ожидает в сигнале
`yielded` поля `node`, `ok`, `error`, но `prelude.js` возвращает только
`{"status":"yielded"}`. Поэтому hook фактически получает node `"?"` и
`ok=true`; корректное per-node имя/ошибка сейчас в DAG telemetry не попадает.

## Gate и LLM hub

Термин "LLM gate" важно разделить на два контура:

1. Входной gate - Fujin `chat.message`, описанный выше. Он выбирает chat
   workflow и формирует его параметры.
2. Исходящий provider gate - `src/llm/hub.zig`. Он принимает единый запрос
   `rt.llm`, валидирует его, выбирает провайдера и нормализует ответ.

Отдельного сетевого сервиса с именем `gate-llm` внутри проекта нет.

### Путь вызова `rt.llm`

```text
workflow
  -> rt.llm(params)                         prelude.js
  -> __host({op:"llm", json:"..."})        JSON/string boundary
  -> vm.dispatch                            vm.zig
  -> Engine.tLlm                            engine.zig
  -> Hub.complete                           llm/hub.zig
  -> Provider.complete                      openai/claude/gemini.zig
  -> HTTPS POST                             llm/http.zig
  -> uniform completion JSON
  -> JavaScript object
```

Обязательный единый запрос:

```js
{
  provider: "openai", // также claude/anthropic, gemini/google
  model: "...",
  maxTokens: 2048,
  messages: [
    { role: "system", content: "..." },
    { role: "user", content: "..." },
    { role: "assistant", content: "...", toolCalls: [] },
    { role: "tool", toolCallId: "...", name: "...", content: "..." }
  ],
  tools: [{ name: "...", description: "...", parameters: {} }],
  temperature: 0.7
}
```

`provider`, `model`, `maxTokens` и непустой `messages` обязательны. Hub не
выбирает их по умолчанию. `temperature` должен быть числом, `tools` опционален.

Единый ответ:

```js
{
  provider: "openai",
  model: "...",
  text: "...",
  toolCalls: [{ id: "...", name: "...", args: {} }],
  finishReason: "stop",
  usage: { input: 10, output: 5 }
}
```

### Регистрация и выбор провайдера

Hub создается один раз вместе с `Engine`. Провайдер регистрируется только если
при старте найден API key:

| Имена в запросе | Переменная |
|---|---|
| `openai` | `OPENAI_API_KEY` |
| `claude`, `anthropic` | `ANTHROPIC_API_KEY` или `CLAUDE_API_KEY` |
| `gemini`, `google` | `GEMINI_API_KEY` |

Неизвестный provider и известный, но не настроенный provider дают явные ошибки.
Один `std.http.Client` принадлежит Hub и переиспользуется для всех запросов,
чтобы сохранять connection pool/TLS sessions.

### Wire-адаптеры

| Адаптер | Endpoint | Особенности преобразования |
|---|---|---|
| OpenAI | `/chat/completions` | `max_completion_tokens`, function tools, arguments как JSON string |
| Claude | `/messages` | system вынесен наверх, `tool_use`/`tool_result` content blocks |
| Gemini | `/models/{model}:generateContent` | роли `user/model`, `systemInstruction`, `functionCall/functionResponse` |

Claude и Gemini объединяют несколько system messages через пустую строку.
Gemini синтезирует стабильный в пределах ответа ID `call-N`, если vendor его
не вернул. Все реализации нестриминговые и читают ответ целиком.

### Agent/tool loop

Hub не выполняет инструменты и не управляет agent loop. Это делает workflow,
например `examples/workflows/wf-chat-turn.js`:

1. LLM round оборачивается в `rt.node("llm-round-N", ...)`.
2. `toolCalls` преобразуются в `rt.call` отдельных memoized nodes.
3. Tool results добавляются в history.
4. Выполняется следующий LLM round.
5. History сохраняется через `rt.set`.

Memoization предотвращает повторную оплату уже завершенного LLM round при
внутренних replay одного execution.

## Как устроен QuickJS-процессор

QuickJS интегрирован через три слоя:

```text
vm.zig -> qjs.zig -> libqjs.so -> quickjs-ng C API
```

### Zig binding (`src/qjs.zig`)

Binding знает только три C-функции:

```c
int  qjs_eval(input, input_len, output_ptr, output_len);
void qjs_free(output_ptr, output_len);
void qjs_set_host_fn(callback);
```

`qjs.eval` сразу копирует результат из C buffer в allocator текущего шага и
освобождает оригинал через `qjs_free`.

### Wrapper (`../wrapers/qjs/src/main.zig`)

На каждый `qjs_eval` wrapper:

1. Создает новый `JSRuntime`.
2. Ставит лимит heap 16 MiB.
3. Ставит лимит stack 512 KiB.
4. Регистрирует interrupt deadline 100 ms monotonic time.
5. Создает новый `JSContext`.
6. Добавляет `globalThis.__host`.
7. Исполняет source как global script через `JS_Eval`.
8. Преобразует result или exception в UTF-8 string.
9. Уничтожает context и runtime.

Таким образом между DAG-шагами не сохраняется JS heap, closures, globals или
event loop. Единственная долговременная память workflow - данные, явно
записанные через `rt.set`, и memoized node outcomes.

100 ms ограничивают выполнение JS-кода одной evaluation. Синхронный native
host call (HTTP/Valkey/LLM) сам по себе этим interrupt handler не прерывается.

### Host bridge

QuickJS видит единственную native-функцию `__host(string) -> string`.
`prelude.js` скрывает этот низкоуровневый интерфейс за объектом `rt`.

Запросы и ответы пересекают границу только как JSON strings:

```json
{"op":"call","service":"sales","method":"findLead","body":"{...}"}
{"op":"get","key":"..."}
{"op":"set","key":"...","json":"{...}"}
{"op":"log","message":"..."}
{"op":"llm","json":"{...}"}
```

В `vm.dispatch` разбирается только envelope. Тела service calls и значения
state по возможности передаются как непрозрачный JSON.

### Prelude API

| API | Поведение |
|---|---|
| `rt.call(service, method, params)` | синхронный HTTP-вызов микросервиса |
| `rt.get(key)` | чтение и JSON-декодирование state value |
| `rt.set(key, value)` | JSON-сериализация и запись state value |
| `rt.log(message)` | запись `[wf] ...` в stderr |
| `rt.llm(params)` | синхронный вызов LLM hub |
| `rt.node(name, fn)` | строгий memoized DAG step |
| `rt.attempt(name, fn)` | memoized DAG step с ошибкой как значением |

Workflow entrypoint ищется сначала как `rt.workflow`, затем как глобальная
функция `workflow`. Async/Promise orchestration не реализована: весь контракт
синхронный.

## Состояние и область видимости

`StateStore` имеет два backend:

- `memory` - process-local `StringHashMap`, подходит для тестов и локального
  запуска;
- `valkey` - простые RESP `GET`/`SET`, новое TCP-соединение на каждую операцию.

Zig не интерпретирует значения state; JSON принадлежит prelude/workflow.
TTL, удаление ключей, транзакции и CAS не реализованы.

Для Fujin-запусков `scope` добавляется к каждому state key:

```text
scope:<scope>:<original key>
```

Тот же `scope` передается HTTP-заголовком во все вызовы микросервисов, включая
`scripts` и `dag`. Обычный `POST /run` и scheduler используют пустой scope.

## Внешние вызовы

`rt.call(service, method, params)` выполняет:

```text
POST <SERVICES_BASE>/<service>/<method>
content-type: application/json
authorization: Bearer <RT_SERVICE_TOKEN>  # если задан
scope: <scope>                             # если непустой
```

Для каждого service call создается отдельный `std.http.Client`, поэтому
соединения к микросервисам не переиспользуются. Это отличается от LLM Hub, у
которого HTTP client долгоживущий.

Не-2xx ответ превращается в ошибку `rt.call`. Если тело содержит
`{"error":"..."}`, prelude использует этот текст; иначе формирует сообщение
`HTTP <status> <service>/<method>`.

## Параллелизм и модель памяти

`Engine.runWorkflowScoped` защищен одним `run_mutex`. Поэтому HTTP, Fujin и
scheduler могут инициировать запуск из разных thread, но реальные workflow
исполняются строго по одному.

Сериализация необходима текущей реализации, потому что:

- callback `qjs_set_host_fn` process-global;
- активный `ExecContext` в `vm.zig` хранится в глобальной переменной `g_ctx`;
- `Engine.current_scope` также является общим mutable полем;
- memory state backend не имеет собственного lock.

HTTP accept loop тоже последовательный. Следовательно, долгий LLM или service
call блокирует все остальные executions, хотя health endpoint может быть
дополнительно задержан еще и последовательным HTTP loop.

Память распределена по уровням:

- request arena владеет HTTP request/result;
- step arena очищается перед каждой QuickJS evaluation;
- `gpa` владеет Engine, Hub, memory store и долгоживущими конфигурациями;
- C allocator используется на ABI-границе QuickJS.

## Конфигурация

Обязательные переменные:

| Переменная | Назначение |
|---|---|
| `RT_BIND` | `host:port`; может быть заменен первым CLI-аргументом |
| `SERVICES_BASE` | base URL gateway микросервисов |
| `RT_STATE_BACKEND` | строго `memory` или `valkey` |
| `VALKEY_HOST`, `VALKEY_PORT` | обязательны при backend `valkey` |

Опциональные переменные:

| Переменная | Назначение |
|---|---|
| `RT_SCHEDULER=on` | включить launcher расписаний |
| `RT_SERVICE_TOKEN` | Bearer token для вызовов микросервисов |
| `OPENAI_API_KEY` | включить OpenAI adapter |
| `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` | включить Claude adapter |
| `GEMINI_API_KEY` | включить Gemini adapter |
| `RT_OPENAI_BASE_URL` | заменить endpoint OpenAI |
| `RT_ANTHROPIC_BASE_URL` | заменить endpoint Anthropic |
| `RT_GEMINI_BASE_URL` | заменить endpoint Gemini |
| `CENTIMANUS_FUJIN_ZMQ_ENDPOINT` | Fujin DEALER endpoint |
| `CENTIMANUS_FUJIN_ZIMQ_LIB` | путь к target-specific `libzimq` |
| `CENTIMANUS_FUJIN_ZMQ_IDENTITY` | ZMQ identity |

Для Fujin также действуют fallback-переменные, реализованные общим
`fujin-client`: `FUJIN_ZMQ_ENDPOINT` и `FUJIN_ZIMQ_LIB`.

## Сборка и тесты

По умолчанию target - `x86_64-linux-musl`:

```bash
zig build
```

Для локального glibc:

```bash
zig build -Dtarget=x86_64-linux-gnu

RT_BIND=127.0.0.1:9777 \
RT_STATE_BACKEND=memory \
SERVICES_BASE=http://127.0.0.1:9888 \
zig build -Dtarget=x86_64-linux-gnu run
```

`build.zig` сначала собирает соседний QuickJS wrapper, линкует `libqjs.so` и
устанавливает библиотеку рядом с executable. Поддерживаются x86_64/aarch64 и
gnu/musl; `zig build -Dall` собирает все поддерживаемые цели.

Mock library и Bun-тесты:

```bash
zig build mock -Dtarget=x86_64-linux-gnu
bun test test/bun
```

`librt-mock.so` использует то же `vm.zig` и тот же QuickJS processor, но
подменяет `rt.call`, state и `rt.llm` callback-функциями из Bun. Тесты проверяют
ветвления, ошибки, передачу данных через cache, tool loop и отсутствие повторных
LLM/tool calls при replay.

## Фактические ограничения

Ниже перечислено поведение именно текущего кода, важное для эксплуатации:

1. **Нет API продолжения существующего execution.** Каждый вызов
   `runWorkflow` создает новый `executionId`; ключи memoization включают этот ID.
   Поэтому replay надежен внутри одного непрерывного вызова `vm.run`, но после
   падения процесса автоматически продолжить тот же execution нельзя.
2. **Нет очистки task keys.** Для Valkey не задаются TTL и delete; завершенные
   `rt:task:*` остаются в storage.
3. **Нет параллельного исполнения.** Один mutex сериализует все источники
   запусков и все LLM/service calls.
4. **DAG telemetry теряет имя и ошибку узла.** Prelude не включает эти поля в
   сигнал `yielded`, хотя VM hook их ожидает.
5. **Side effects вне node повторяются.** Весь workflow replay-ится с начала на
   каждом шаге.
6. **Уникальность имени node обязательна.** Два логически разных шага с одним
   именем разделят один cached outcome.
7. **JS deadline не является сетевым timeout.** Он прерывает JS evaluation, но
   не ограничивает длительность синхронного native HTTP/Valkey вызова.
8. **Scheduler не сохраняет фазы между refresh.** Каждые 30 секунд расписание
   перечитывается, а `next_due` рассчитывается заново.
9. **HTTP реализация минимальна.** Нет keep-alive, chunked request parsing,
   request concurrency, auth на `/run` или явного ограничения размера body
   сверх фиксированного reader buffer.

Эти ограничения не мешают текущей модели небольшого flow runtime, но их нужно
учитывать, если Centimanus должен стать crash-resumable, multi-tenant runtime с
параллельным исполнением и точной DAG observability.
