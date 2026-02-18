# SQL Engine

Назначение
- SQL-хранилище на SQLite с доступом через Kysely.

Backend
- `bun:sqlite` + `kysely-bun-sqlite`.
- включен WAL и параметры для конкурентного доступа.

Ключи и данные
- обычные таблицы SQLite.

API (основное)
- `open`, `close`, `migrate`
- `db` (Kysely)
- `applyWhereConditions` для сборки WHERE из объекта

Миграции
- через общий механизм `Migration`/`Migrator`.

Файлы
- `dataLocation` — файл SQLite БД.
