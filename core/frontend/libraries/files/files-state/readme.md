# File Transfer Library

Библиотека для эффективной передачи файлов с поддержкой сжатия, блочного хранения и дедупликации.

## Особенности

- 🗜️ **Компрессия Deflate** - автоматическое сжатие данных перед передачей
- 📦 **Блочное хранилище** - разбиение на блоки по 1MB для оптимизации
- 🔄 **Дедупликация** - использование SHA-256 для избежания дублирования блоков
- ⏸️ **Pause/Resume** - возможность приостановки и возобновления загрузки
- 🔁 **Retry механизм** - автоматическая повторная попытка для упавших чанков
- ⚡ **Параллельная загрузка** - загрузка нескольких чанков одновременно
- 🧩 **Модульная архитектура** - независимые модули с явными интеграциями
- 🔧 **Singleton сервисы** - простая инициализация без хранения в state

## Архитектура

### Принципы

1. **Singleton для сервисов** - сервисы инжектятся один раз при старте
2. **Модульность** - каждый модуль независим и тестируем
3. **Слабая связность** - интеграция через один файл `integrations.ts`

 

## Установка и инициализация

```typescript
import { services } from './src';
import { createFilesService } from './api/files';
import { createStoreService } from './api/store';

// Инициализация сервисов при старте приложения
services.setFilesService(createFilesService());
services.setStoreService(createStoreService());
```

## Использование

### Upload файла

```typescript
import { openFilePicker, $files, getFileProgress } from './src';

// Открыть file picker
openFilePicker();

// Отслеживать состояние
$files.watch(files => {
  files.forEach(file => {
    console.log(`${file.fileName}: ${file.status}`);
  });
});

// Прогресс конкретного файла
const progress$ = getFileProgress(fileId);
progress$.watch(p => console.log(`${p?.progress}%`));
```

### Download файла

```typescript
import { downloadRequested } from './model';

downloadRequested('file-uuid');
```

### Управление загрузкой

```typescript
import { pauseUpload, resumeUpload, cancelUpload, retryChunk } from './model';

// Пауза
pauseUpload(fileId);

// Возобновление
resumeUpload(fileId);

// Отмена
cancelUpload(fileId);

// Повтор упавшего чанка
retryChunk({ fileId, chunkNumber });
```

## React интеграция

```typescript
import { useUnit } from 'effector-react';
import { $files, getFileProgress, pauseUpload, resumeUpload } from './model';

function FileUploadList() {
  const files = useUnit($files);
  
  return (
    <div>
      {Array.from(files.values()).map(file => (
        <FileItem key={file.fileId} fileId={file.fileId} />
      ))}
    </div>
  );
}

function FileItem({ fileId }) {
  const progress = useUnit(getFileProgress(fileId));
  
  if (!progress) return null;
  
  return (
    <div>
      <span>{progress.progress}%</span>
      <button onClick={() => pauseUpload(fileId)}>Pause</button>
      <button onClick={() => resumeUpload(fileId)}>Resume</button>
    </div>
  );
}
```

## Конфигурация

```typescript
// config.ts
export const BLOCK_SIZE = 1024 * 1024;        // 1MB блоки
export const COMPRESSION_LEVEL = 6;           // 0-9, где 9 максимальное сжатие
export const MAX_PARALLEL_UPLOADS = 3;        // Параллельные загрузки
export const MAX_RETRY_ATTEMPTS = 3;          // Попыток повтора
export const UPLOAD_TIMEOUT = 30000;          // Таймаут в мс
```

## Потоки данных

### Upload Flow
```
File selected → Compression → Chunking → Block save → Metadata save → Complete
```

### Download Flow  
```
Request → Load metadata → Load chunks → Decompression → Write to file → Complete
```

## Тестирование

```bash
npm test
```

Каждый модуль тестируется изолированно. Интеграционные тесты проверяют взаимодействие модулей.

## Документация

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Подробная архитектура
- [USAGE.md](./USAGE.md) - Примеры использования
- [MIGRATION.md](./MIGRATION.md) - Гайд по миграции
- [SUMMARY.md](./SUMMARY.md) - Краткий обзор

## Лицензия

MIT