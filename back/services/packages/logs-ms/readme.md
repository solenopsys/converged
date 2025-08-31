# Log Aggregator MVP

Минималистичный агрегатор логов на базе Bun + LMDB + ChDB + Parquet.

## Архитектура

- **Bun** - runtime и HTTP сервер
- **LMDB** - быстрый кеш логов в памяти 
- **ChDB** - SQL запросы к данным
- **Parquet** - колоночное хранение логов (файлы по дням)
- **Fluent Bit** - агент для сбора логов

## Установка

```bash
# Установите Bun
curl -fsSL https://bun.sh/install | bash

# Клонируйте проект
git clone <your-repo>
cd log-aggregator-mvp

# Установите зависимости
bun install

# Запустите сервер
bun run dev
```

## Использование

### Запуск агрегатора логов

```bash
# Разработка с hot reload
bun run dev

# Продакшн
bun run start
```

Сервер запустится на `http://localhost:3000`

### Настройка Fluent Bit

1. Установите Fluent Bit:
```bash
# Ubuntu/Debian
curl https://raw.githubusercontent.com/fluent/fluent-bit/master/install.sh | sh

# MacOS
brew install fluent-bit

# Docker
docker run -v $(pwd)/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf fluent/fluent-bit
```

2. Используйте прилагаемый `fluent-bit.conf` или настройте свой:
```bash
fluent-bit -c fluent-bit.conf
```

### API Endpoints

#### Прием логов (для Fluent Bit)
```bash
POST /logs
Content-Type: application/json

{
  "timestamp": 1693478400000,
  "service": "nginx",
  "level": "INFO", 
  "message": "Request processed",
  "metadata": {
    "ip": "192.168.1.1",
    "method": "GET"
  }
}
```

#### Выполнение SQL запросов
```bash
POST /query
Content-Type: application/json

{
  "sql": "SELECT service, count() FROM file('./parquet_logs/logs_*.parquet', 'Parquet') GROUP BY service"
}
```

#### Получение логов по сервису
```bash
GET /logs/service?service=nginx&date=2025-08-31
```

#### Получение ошибок за период
```bash
GET /logs/errors?hours=24
```

#### Статистика за день
```bash
GET /stats?date=2025-08-31
```

## Примеры запросов

### Получение топ ошибок
```sql
SELECT 
  service,
  message,
  count() as error_count
FROM file('./parquet_logs/logs_2025-08-31.parquet', 'Parquet')
WHERE level = 'ERROR'
GROUP BY service, message
ORDER BY error_count DESC
LIMIT 10
```

### Анализ активности по часам
```sql
SELECT 
  toHour(toDateTime(timestamp/1000)) as hour,
  service,
  count() as requests
FROM file('./parquet_logs/logs_*.parquet', 'Parquet')
WHERE toDate(timestamp/1000) = today()
GROUP BY hour, service
ORDER BY hour, requests DESC
```

### Поиск по тексту сообщения
```sql
SELECT timestamp, service, level, message
FROM file('./parquet_logs/logs_*.parquet', 'Parquet') 
WHERE message ILIKE '%timeout%'
AND timestamp > now() - INTERVAL 1 HOUR
ORDER BY timestamp DESC
```

## Структура данных

### Схема логов в Parquet
- `timestamp` (BigInt64) - Unix timestamp в миллисекундах
- `service` (String) - Название сервиса
- `level` (String) - Уровень лога (INFO, WARN, ERROR, DEBUG)
- `message` (String) - Текст сообщения
- `metadata` (String) - JSON строка с дополнительными данными

### Файловая структура
```
project/
├── index.ts              # Основной код агрегатора
├── package.json          # Зависимости
├── fluent-bit.conf       # Конфиг Fluent Bit
├── lmdb_cache/           # LMDB кеш (создается автоматически)
└── parquet_logs/         # Parquet файлы
    ├── logs_2025-08-30.parquet
    ├── logs_2025-08-31.parquet
    └── ...
```

## Конфигурация

### Параметры агрегатора
Можно настроить в коде `index.ts`:
- `flushInterval` - интервал дампа из LMDB в Parquet (по умолчанию 60 сек)
- `parquetDir` - директория для Parquet файлов
- Компрессия Parquet (по умолчанию ZSTD)

### Пример Fluent Bit конфигурации
Файл `fluent-bit.conf` содержит примеры для:
- Чтения логов из файлов
- Сбора логов из systemd
- Приема логов по сети
- Парсинга JSON
- Добавления метаданных

## Производительность

### Рекомендации
- LMDB кеш держит логи в памяти до дампа
- Parquet файлы сжаты ZSTD для экономии места
- ChDB выполняет запросы напрямую из Parquet файлов
- Файлы разбиты по дням для оптимизации запросов

### Мониторинг
```bash
# Проверка размера кеша
du -sh lmdb_cache/

# Проверка размера Parquet файлов
du -sh parquet_logs/

# Количество файлов по дням
ls -la parquet_logs/
```

## Troubleshooting

### LMDB ошибки
```bash
# Очистка кеша при необходимости
rm -rf lmdb_cache/
```

### ChDB ошибки
- Проверьте корректность SQL синтаксиса ClickHouse
- Убедитесь что Parquet файлы существуют
- Проверьте права доступа к файлам

### Fluent Bit не отправляет логи
- Проверьте доступность `http://localhost:3000/logs`
- Посмотрите логи Fluent Bit на наличие ошибок
- Проверьте формат отправляемых данных

## Лицензия

MIT