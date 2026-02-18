# Worker Interface

## Простая модель работы

```
Файл → Поток байтов → Буфер → Чанк (512KB) → Сжатие → Store → Hash → CHUNK_READY
```

## INPUT (что получает воркер)

### UPLOAD_START
```typescript
{
  type: "UPLOAD_START"
  fileId: string
  file: File
}
```

## OUTPUT (что отправляет воркер)

### UPLOAD_PROGRESS
```typescript
{
  type: "UPLOAD_PROGRESS"
  fileId: string
  bytesProcessed: number  // сколько байт прочитано
  totalBytes: number      // размер файла
}
```

### CHUNK_READY
```typescript
{
  type: "CHUNK_READY"
  fileId: string
  chunkNumber: number
  chunkSize: number  // размер сжатых данных
  hash: string       // SHA-256 хеш от store
}
```

### FILE_UPLOADED
```typescript
{
  type: "FILE_UPLOADED"
  fileId: string
  totalChunks: number
}
```

### ERROR
```typescript
{
  type: "ERROR"
  fileId: string
  error: string
}
```

## Что делает воркер

1. Читает файл потоком: `file.stream().getReader()`
2. Накапливает данные в буфер
3. Когда буфер >= 512KB:
   - Вырезает чанк
   - Сжимает deflate
   - Загружает в store
   - Получает hash
   - Отправляет **CHUNK_READY**
4. При каждом чтении отправляет **UPLOAD_PROGRESS**
5. Когда файл прочитан отправляет **FILE_UPLOADED**

## Что делает files-state

При получении **CHUNK_READY**:
1. `blockSaved` - фиксирует что воркер сохранил блок в store
2. `chunkMetadataSaveRequested` - запрос сохранить метаданные в БД
3. `chunkMetadataSaved` - метаданные сохранены в БД
4. `chunkUploaded` - обновление прогресса в UI

## Важно

- Воркер САМ сжимает и сохраняет данные в store
- Воркер САМ получает hash от store
- files-state ТОЛЬКО сохраняет метаданные (fileId, chunkNumber, hash, size) в БД
- files-state НЕ сохраняет данные повторно
