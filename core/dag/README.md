# tools/dag — flow-only workflows для RT VM (centimanus)

Workflow-ы нового DAG-рантайма: тонкий flow-JS, исполняемый в QuickJS
(`navite/apps/centimanus`). Философия и план миграции — `final/docs/dag.md`.

## Раскладка

```
core/                    dag-core: общий обвес всех workflow
  env.ts                 глобальные типы rt/__execId/__params (контракт prelude.js)
  contract-client.ts     contractClient<T>() — типизированный rt-клиент по contract.md,
                         пока метод не попал в tools/types/services (+codegen g-*/rt)
  build.ts               buildWorkflow(): bun-бандл TS-workflow → одна IIFE-строка для VM
workflows/
  wf-files-process/      batch workflow обработки загруженных файлов
```

## Правила workflow (кратко)

- только flow: ветвления, циклы, имена шагов; вся работа — `rt.call` в MS;
- каждый side effect строго внутри `rt.node`/`rt.attempt`; имя узла уникально,
  в циклах включает id/номер итерации;
- error-boundary — это `rt.attempt`: ошибка приходит значением `{ok,error}`,
  а не исключением, поэтому ветвление по ней читается как обычный код;
- плоский стиль: один файл на workflow, никаких классов/`Run`-машинерии —
  очередь это массив + while, отчёт это объект (эталон: wf-files-process);
- крупные данные ходят по ссылке (`CacheRef` в Valkey), не в payload;
- MS не вызывают друг друга — workflow держит ref-ы и передаёт между сервисами;
- никаких Promise/async, никаких дефолтов provider/model в `rt.llm`.

## Клиенты сервисов

Предпочтительно — сгенерированные `g-<service>/rt` (`tools/generated/*`,
экспорт `./rt`). Если нужного метода/пакета ещё нет: описываем контракт
интерфейсом в workflow и строим клиент через `contractClient` из dag-core;
после расширения `tools/types/services/**` и кодогенерации меняется только
import в clients.ts.

## Сборка

```ts
import { buildWorkflow } from "dag-core/build";
const js = await buildWorkflow("modules/workflows/wf-files-process/index.ts");
```

Собранную строку centimanus забирает сам по HTTP: `listAvailableWorkflows`
(rp-dag) отдаёт для `script` его `sourceUrl`, а `workflow_registry.zig` его
скачивает. В dev адрес выдаёт `core/tools/dev/src/workflows.ts` — он пересобирает
исходник на каждый запрос, так что правка workflow видна без рестарта; в кластере
это прокси ptah по дайджесту из `registry.workflows`.

Чтобы workflow вообще резолвился, он должен быть перечислен в трёх местах:
`modules/solutions/mapping.json` (ссылка на скрипт), `workflows` нужного
solution-фрагмента и `solutions.converged.workflows` в
`core/tools/install/chart/values.yaml` (проверяется тестом
`core/tools/install/solution.test.ts`). Это касается и тех, кого зовут только
через `rt.sub`: делегирование идёт через тот же список, незарегистрированный
ребёнок валит родителя с `WorkflowNotFound`. `brief`/`description`/`parameters`
добавляем только тем, кого ассистенту можно вызывать самому — по ним чат
публикует workflow в каталог функций.

Тесты на реальном VM-ядре с mock-транспортом:
`navite/apps/centimanus/test/bun` (`zig build mock && bun test test/bun`).
