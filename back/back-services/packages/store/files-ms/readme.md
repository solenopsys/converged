 

## Метасервис файлов (`FilesService` )

### 🔹 Назначение

Метасервис управляет **описанием файлов, их структурой и связями** — но не занимается физическим хранением данных.
Он хранит только **метаинформацию**, необходимую для поиска, идентификации, статистики и координации других сервисов, отвечающих за сами данные.

---

### 🔹 Основные сущности

#### `FileMetadata`

Описывает файл как логическую единицу:

* имя, тип, владелец, время создания;
* статус (`uploading`, `uploaded`, `failed`);
* количество чанков и параметры сжатия.

```ts
export type FileMetadata = {
  id: UUID;
  hash: HashString;
  status: 'uploading' | 'uploaded' | 'failed';
  name: string;
  fileSize: number;
  fileType: string;
  compression: string;
  owner: string;
  createdAt: ISODateString;
  chunksCount: number;
}
```

#### `FileChunk`

Представляет часть файла, используется для сборки целостного состояния.

```ts
export type FileChunk = {
  fileId: UUID;
  hash: HashString;
  chunkNumber: number;
  chunkSize: number;
  createdAt: ISODateString;
}
```

#### `FileStatistic`

Агрегированная информация по системе.

```ts
export type FileStatistic = {
  totalFiles: number;
  totalChunks: number;
  totalSize: number;
  createdAt: ISODateString;
}
```

---

### 🔹 Хранилище метаданных

Метаданные файлов и чанков организованы в виде нескольких таблиц, поддерживающих быстрый поиск и статистику.

```sql
-- Основная таблица файлов
CREATE TABLE files (
  id TEXT PRIMARY KEY,            
  hash TEXT NOT NULL,             
  status TEXT NOT NULL,           
  name TEXT NOT NULL,             
  fileSize INTEGER NOT NULL,      
  fileType TEXT,                  
  compression TEXT,               
  owner TEXT NOT NULL,            
  createdAt TEXT NOT NULL,        
  chunksCount INTEGER NOT NULL    
);

-- Чанки файла
CREATE TABLE file_chunks (
  fileId TEXT NOT NULL,           
  hash TEXT NOT NULL,             
  chunkNumber INTEGER NOT NULL,   
  chunkSize INTEGER NOT NULL,     
  createdAt TEXT NOT NULL,        
  PRIMARY KEY (fileId, chunkNumber),
  FOREIGN KEY (fileId) REFERENCES files(id)
);

-- Поиск и индексы
CREATE INDEX idx_files_name ON files(name);
CREATE INDEX idx_files_owner ON files(owner);
CREATE VIRTUAL TABLE files_fts USING fts5(name);

-- Статистика по владельцам
CREATE TABLE user_storage (
  owner TEXT PRIMARY KEY,
  total_size INTEGER,
  file_count INTEGER,
  last_activity TEXT
);
```

---

### 🔹 Интерфейс `FilesService`

Метасервис предоставляет операции над метаданными:

```ts
export interface FilesService {
  save(file: FileMetadata): Promise<UUID>;
  saveChunk(chunk: FileChunk): Promise<HashString>;
  update(id: UUID, file: FileMetadata): Promise<void>;
  delete(id: UUID): Promise<void>;
  get(id: UUID): Promise<FileMetadata>;
  getChunks(id: UUID): Promise<FileChunk[]>;
  list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>>;
  statistic(): Promise<FileStatistic>;
}
```

---

### 🔹 Логика работы

1. **save / saveChunk** — регистрируют появление файла или его части в системе.
   Физическая загрузка выполняется другими сервисами; метасервис фиксирует факт и структуру.

2. **update** — изменяет статус или свойства метаданных (например, после завершения загрузки).

3. **list** — возвращает пагинированный список файлов, используя индексы и FTS.

4. **statistic** — агрегирует сводные данные (`FileStatistic`) для анализа активности.

---

### 🔹 Ключевая идея

> Метасервис не хранит данные — он хранит **смысл данных**.
>
> Все связи, идентификаторы, хеши и статистика находятся под его контролем,
> но физический контент находится в других слоях системы.

---

Хочешь, я добавлю короткий блок «Взаимодействие с другими сервисами» — чтобы показать, как метасервис связывает логику с фактическими сторами (например, store-service или block-service)?
