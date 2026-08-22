# docs-builder

Собирает документацию из исходников, разложенных по дереву, в четыре формата:
боевой сайт, README для GitHub, статический HTML и PDF. Плюс отдаёт исходники
в `translation-control`.

## Исходники

Документацию заводит любая директория, у которой есть `docs`:

```
<владелец>/docs/<lang>/<section>/index.json    список статей
<владелец>/docs/<lang>/<section>/<id>.md       сами статьи
<владелец>/docs/<lang>/<section>/meta.json     необязательно: заголовок блока
```

Сканируется всё дерево проектов из `docs.config.json` — модуль, библиотека,
инструмент, корень репозитория. `node_modules`, `dist`, `build` и прочий шум
пропускаются, а `docs` без `<lang>/<section>/index.json` не считается нашей:
чужих папок `docs` в зависимостях много, отличает их именно индекс.

Язык стоит перед секцией не случайно — в такой раскладке `docs` является
корректным корнем для `translation-control`, который сравнивает деревья
`<root>/<locale>/<...>`.

`index.json` — тот же формат, что отдаёт `struct-ms`:

```json
[
  { "slug": "overview", "title": "Что делает Converged", "order": 0 },
  { "slug": "arch",     "title": "Архитектура",          "order": 1 }
]
```

`id` можно не указывать — тогда файл ищется как `<slug>.md`.

## Секции и слияние

Секция (`product`, `club`, ...) — глава сайта, и вкладываться в неё может
несколько владельцев.

- Один владелец — плоский индекс, статьи идут по `order`.
- Несколько — compound-индекс: `{ "compound": true, "groups": [...] }`, блок
  каждого владельца лежит отдельно и сохраняет порядок. Заголовок блока берётся
  из `meta.json` (`group`), по умолчанию — имя владельца.

`mf-docs` умеет читать оба варианта.

Совпадение `slug` у двух владельцев в одной секции — ошибка сборки.

## Запуск

```bash
bun run docs:list          # что нашлось
bun run docs:site          # struct-ms + markdown-ms
bun run docs:readme        # build/docs/readme/<lang>/<section>.md
bun run docs:html          # build/docs/html/<lang>/<section>.html
bun run docs:pdf           # build/docs/pdf/<lang>/<section>.pdf
bun run docs:translations  # конфиг для translation-control
bun run docs               # всё сразу
```

Ключи: `--config <path>`, `--section <name>`, `--lang <code>`, `--dry-run`,
`--no-prune`.

## Что куда попадает

| Цель | Куда | Что это |
| --- | --- | --- |
| `site` | `data/club/struct-ms/struct/data`, `data/club/markdown-ms/markdown/data` | то, что читает боевой сайт |
| `readme` | `build/docs/readme` | одна статья на секцию, с оглавлением |
| `html` | `build/docs/html` | preact-SSR, боковое меню, стили инлайном |
| `pdf` | `build/docs/pdf` | те же страницы, напечатанные |
| `translations` | `build/docs/translation-control.json` | проекты для `translation-control` |

HTML и PDF рендерятся тем же `MarkdownRenderer`, что и сайт, а стили собираются
из `uno.mf.config.ts` и токенов `front-core` — статическая сборка не расходится
с продуктом. PDF печатает puppeteer, если он установлен, иначе любой найденный
Chrome или Chromium (`DOCS_CHROME` переопределяет).

## Удаление устаревшего

Каждый запуск пишет `.docs-build.json` — список того, что он создал. На
следующем запуске всё, что выпало из этого списка, удаляется, а опустевшие
директории убираются до корня вывода. Именно поэтому вычищается только своё:
в `struct-ms` рядом лежит рукописный контент (`landing/`, `functions/`), и
никакое правило по именам не отделило бы его от сгенерированного. `--no-prune`
выключает уборку.

## Переводы

`docs:translations` собирает конфиг, где каждый найденный `docs` — отдельный
проект `translation-control`. Дальше:

```bash
cd ../../../../club/tools/translation-control
bun run src/index.ts --check --config ../../../build/docs/translation-control.json
```

Отслеживается расхождение в исходниках, а не в сгенерированных хранилищах:
правка в `data/` всё равно была бы затёрта следующей сборкой. Корни без языка
`sourceLocale` в конфиг не попадают — сравнивать их не с чем.
