Client files and other production files.
metadata  and link to stor

Метаданные хранятся  
sqlite статистика и быстрый поиск по названиям, человекочитаемые названия файлов. 
Файлы храняться по хешам. 
хеш->метаданные. 

букеты храняться в lmdb просто как ключи - по ключу открывается хеш файла


-- Основная таблица файлов
CREATE TABLE files (
  hash TEXT PRIMARY KEY,
  original_name TEXT NOT NULL,
  size INTEGER NOT NULL,
  mime_type TEXT,
  user_id TEXT NOT NULL,
  upload_date INTEGER NOT NULL,
  metadata JSON  -- chunks, custom fields, etc.
);

-- Букеты (человекочитаемые пути)
CREATE TABLE bucket_paths (
  path TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL,
  created_at INTEGER,
  FOREIGN KEY (file_hash) REFERENCES files(hash)
);

-- Индексы для поиска
CREATE INDEX idx_files_name ON files(original_name);
CREATE INDEX idx_files_user ON files(user_id);
CREATE VIRTUAL TABLE files_fts USING fts5(original_name, path);

-- Статистика
CREATE TABLE user_storage (
  user_id TEXT PRIMARY KEY,
  total_size INTEGER,
  file_count INTEGER,
  last_activity INTEGER
);

-- Поиск по именам
files_search (hash, original_name, bucket_path, user_id, upload_date)
CREATE INDEX idx_name ON files_search(original_name);
CREATE VIRTUAL TABLE files_fts USING fts5(original_name, bucket_path);

-- Статистика пользователей
user_storage (user_id, total_size, file_count, last_activity)