# Column Engine

Назначение
- колоночное хранилище для больших потоков данных и аналитики.

Backend
- `bun-stanchion` (SQLite virtual table + файлы колонок).
- доступ через Kysely и raw Stanchion.

Ключи и данные
- таблицы создаются через `CREATE VIRTUAL TABLE ... USING stanchion`.
- сортировка задается `SORT KEY (...)` в DDL.

API (основное)
- `open`, `close`, `migrate`
- `db` (Kysely), `raw` (StanchionDatabase)
- батч запись: `ColumnStore.batchInsert(...)` или `BaseRepositoryColumn.createBatch(...)`

Миграции
- через общий механизм `Migration`/`Migrator`.

Файлы
- `dataLocation` — файл БД stanchion.
