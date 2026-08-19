# KV Engine

Назначение
- key-value хранилище поверх LMDB для быстрых операций и префиксных выборок.

Backend
- `bun-lmdbx` (LMDB).

Ключи и данные
- ключ — массив строк `string[]`, объединяется через `KEY_SEPARATOR`.
- значения сериализуются как JSON или бинарные (Buffer/Uint8Array) с заголовками.

API (основное)
- `open`, `close`, `migrate`
- `get`, `put`, `delete`, `listKeys`
- префиксные/диапазонные выборки: `getKeysWithPrefix`, `getValuesRangeAsArrayByPrefix`, и т.д.

Миграции
- через общий механизм `Migration`/`Migrator`.

Файлы
- `dataLocation` — путь к LMDB базе.
