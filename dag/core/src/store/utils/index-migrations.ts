import { Kysely, sql } from 'kysely'

// Миграция 001: Создание основных таблиц
export async function up001(db: Kysely<any>): Promise<void> {
  // Таблица запусков workflow
  await db.schema
    .createTable('runs')
    .addColumn('pid', 'blob', (col) => col.primaryKey())
    .addColumn('workflow', 'text', (col) => col.notNull())
    .addColumn('started_at', 'integer', (col) => col.notNull())
    .addColumn('finished_at', 'integer')
    .addColumn('status', 'text', (col) => col.notNull())
    .execute()

  // Индексы для runs
  await db.schema
    .createIndex('idx_runs_workflow')
    .on('runs')
    .column('workflow')
    .execute()

  await db.schema
    .createIndex('idx_runs_status')
    .on('runs')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_runs_started_at')
    .on('runs')
    .column('started_at')
    .execute()

  // Таблица узлов
  await db.schema
    .createTable('nodes')
    .addColumn('pid', 'blob', (col) => col.notNull())
    .addColumn('node_name', 'text', (col) => col.notNull())
    .addColumn('kind', 'text', (col) => col.notNull())
    .addColumn('started_at', 'integer')
    .addColumn('finished_at', 'integer')
    .addColumn('status', 'text')
    .addColumn('error_code', 'text')
    .addPrimaryKeyConstraint('pk_nodes', ['pid', 'node_name'])
    .addForeignKeyConstraint('fk_nodes_pid', ['pid'], 'runs', ['pid'], (cb) => cb.onDelete('cascade'))
    .execute()

  // Индексы для nodes
  await db.schema
    .createIndex('idx_nodes_status')
    .on('nodes')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_nodes_kind')
    .on('nodes')
    .column('kind')
    .execute()

  // Таблица событий
  await db.schema
    .createTable('events')
    .addColumn('event_id', 'blob', (col) => col.primaryKey())
    .addColumn('source', 'text', (col) => col.notNull())
    .addColumn('payload', 'text')
    .addColumn('enqueued_at', 'integer', (col) => col.notNull())
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('pid', 'blob')
    .addColumn('error', 'text')
    .addForeignKeyConstraint('fk_events_pid', ['pid'], 'runs', ['pid'], (cb) => cb.onDelete('set null'))
    .execute()

  // Индексы для events
  await db.schema
    .createIndex('idx_events_status')
    .on('events')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_events_source')
    .on('events')
    .column('source')
    .execute()

  await db.schema
    .createIndex('idx_events_enqueued_at')
    .on('events')
    .column('enqueued_at')
    .execute()

  await db.schema
    .createIndex('idx_events_pid')
    .on('events')
    .column('pid')
    .execute()
}

export async function down001(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('events').execute()
  await db.schema.dropTable('nodes').execute()
  await db.schema.dropTable('runs').execute()
}

// Миграция 002: Добавление констрейнтов для статусов
export async function up002(db: Kysely<any>): Promise<void> {
  // Добавляем проверки для статусов runs
  await sql`
    ALTER TABLE runs ADD CONSTRAINT check_runs_status 
    CHECK (status IN ('succeeded', 'failed', 'canceled', 'timeout'))
  `.execute(db)

  // Добавляем проверки для статусов nodes
  await sql`
    ALTER TABLE nodes ADD CONSTRAINT check_nodes_status 
    CHECK (status IS NULL OR status IN ('succeeded', 'failed', 'timeout'))
  `.execute(db)

  // Добавляем проверки для статусов events
  await sql`
    ALTER TABLE events ADD CONSTRAINT check_events_status 
    CHECK (status IN ('ready', 'reserved', 'done', 'dead'))
  `.execute(db)
}

export async function down002(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE runs DROP CONSTRAINT check_runs_status`.execute(db)
  await sql`ALTER TABLE nodes DROP CONSTRAINT check_nodes_status`.execute(db)
  await sql`ALTER TABLE events DROP CONSTRAINT check_events_status`.execute(db)
}

// Экспорт всех миграций
export const migrations = {
  '001_initial_tables': { up: up001, down: down001 },
  '002_status_constraints': { up: up002, down: down002 },
}